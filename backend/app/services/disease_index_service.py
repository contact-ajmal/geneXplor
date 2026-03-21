"""
Disease-gene association index from ClinVar FTP data.
Maps diseases to genes and vice versa.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

import redis.asyncio as aioredis

from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

CLINVAR_FTP = "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id"
REDIS_KEY = "search:disease_index"
REDIS_TTL = 7 * 24 * 3600


class DiseaseIndex:
    def __init__(self) -> None:
        self.loaded = False
        self.disease_to_genes: dict[str, list[str]] = defaultdict(list)
        self.gene_to_diseases: dict[str, list[str]] = defaultdict(list)
        self.disease_names: list[str] = []
        self.disease_words_index: dict[str, set[str]] = defaultdict(set)
        self.disease_count = 0
        self.association_count = 0

    def build(self, data: list[dict[str, Any]]) -> None:
        self.disease_to_genes = defaultdict(list)
        self.gene_to_diseases = defaultdict(list)
        self.disease_words_index = defaultdict(set)

        seen_pairs: set[tuple[str, str]] = set()
        for row in data:
            gene = row.get("g", "")
            disease = row.get("d", "")
            if not gene or not disease:
                continue
            pair = (gene.upper(), disease)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            self.disease_to_genes[disease].append(gene.upper())
            self.gene_to_diseases[gene.upper()].append(disease)

        # deduplicate
        for d in self.disease_to_genes:
            self.disease_to_genes[d] = list(set(self.disease_to_genes[d]))
        for g in self.gene_to_diseases:
            self.gene_to_diseases[g] = list(set(self.gene_to_diseases[g]))

        self.disease_names = sorted(self.disease_to_genes.keys())
        self.disease_count = len(self.disease_names)
        self.association_count = len(seen_pairs)

        # words index for fuzzy search
        for disease_name in self.disease_names:
            for word in disease_name.lower().split():
                word = word.strip(".,;:()-/")
                if len(word) > 2:
                    self.disease_words_index[word].add(disease_name)

        self.loaded = True

    def search_disease(self, query: str, limit: int = 20) -> list[tuple[str, list[str]]]:
        """Search diseases by name. Returns (disease_name, [gene_symbols])."""
        q = query.lower().strip()
        words = [w.strip(".,;:()-/") for w in q.split() if len(w) > 2]

        # Exact match first
        for d in self.disease_names:
            if d.lower() == q:
                return [(d, self.disease_to_genes[d])]

        # Substring match
        substring_matches: list[str] = []
        for d in self.disease_names:
            if q in d.lower():
                substring_matches.append(d)
                if len(substring_matches) >= limit:
                    break

        if substring_matches:
            return [(d, self.disease_to_genes[d]) for d in substring_matches[:limit]]

        # Word overlap match
        if not words:
            return []
        sets = [self.disease_words_index.get(w, set()) for w in words]
        sets = [s for s in sets if s]
        if not sets:
            return []
        # intersection
        matched = sets[0]
        for s in sets[1:]:
            matched = matched & s
        if not matched:
            # union fallback
            matched = set()
            for s in sets:
                matched |= s

        results = sorted(matched, key=lambda d: len(self.disease_to_genes.get(d, [])), reverse=True)
        return [(d, self.disease_to_genes[d]) for d in results[:limit]]

    def genes_for_disease(self, disease_name: str) -> list[str]:
        return self.disease_to_genes.get(disease_name, [])


_disease_index = DiseaseIndex()


def get_disease_index() -> DiseaseIndex:
    return _disease_index


async def load_disease_index(redis_client: aioredis.Redis) -> None:
    global _disease_index
    t0 = time.time()

    cached = await cache_get(redis_client, REDIS_KEY)
    if cached:
        _disease_index.build(cached)
        logger.info(
            "Disease index loaded from Redis: %d diseases, %d associations (%.1fs)",
            _disease_index.disease_count, _disease_index.association_count, time.time() - t0,
        )
        return

    logger.info("Downloading disease index from ClinVar FTP...")
    try:
        data = await _download_clinvar_diseases()
        if data:
            _disease_index.build(data)
            await cache_set(redis_client, REDIS_KEY, data, REDIS_TTL)
            logger.info(
                "Disease index downloaded & cached: %d diseases, %d associations (%.1fs)",
                _disease_index.disease_count, _disease_index.association_count, time.time() - t0,
            )
        else:
            logger.error("Failed to load disease index")
    except Exception as e:
        logger.error("Disease index download failed: %s", e)


async def _download_clinvar_diseases() -> list[dict[str, str]]:
    """Download ClinVar gene-condition associations."""
    try:
        from app.utils.http_client import get_http_client
        client = get_http_client()
        resp = await client.get(CLINVAR_FTP, timeout=60.0, headers={"Accept": "*/*"})
        resp.raise_for_status()
        text = resp.text

        result: list[dict[str, str]] = []
        for line in text.strip().split("\n"):
            if line.startswith("#") or line.startswith("GeneID"):
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            gene_symbol = parts[1].strip()
            disease_name = parts[3].strip()
            if gene_symbol and disease_name and disease_name != "not specified" and disease_name != "not provided":
                result.append({"g": gene_symbol, "d": disease_name})
        return result
    except Exception as e:
        logger.error("ClinVar FTP download failed: %s", e)
        return []
