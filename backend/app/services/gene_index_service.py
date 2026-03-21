"""
Full human gene index from Ensembl BioMart.
Loaded at startup, cached in Redis (TTL: 7 days), held in-memory for fast search.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from typing import Any

import redis.asyncio as aioredis

from app.utils.http_client import fetch_text, fetch_json
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

BIOMART_URL = "https://www.ensembl.org/biomart/martservice"
ENSEMBL_REST = "https://rest.ensembl.org"
REDIS_KEY = "search:gene_index"
REDIS_TTL = 7 * 24 * 3600  # 7 days

BIOMART_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="default" formatter="TSV" header="1"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="hsapiens_gene_ensembl" interface="default">
    <Attribute name="hgnc_symbol"/>
    <Attribute name="external_gene_name"/>
    <Attribute name="description"/>
    <Attribute name="chromosome_name"/>
    <Attribute name="start_position"/>
    <Attribute name="end_position"/>
    <Attribute name="strand"/>
    <Attribute name="band"/>
    <Attribute name="gene_biotype"/>
    <Attribute name="ensembl_gene_id"/>
  </Dataset>
</Query>"""

VALID_CHROMOSOMES = {str(i) for i in range(1, 23)} | {"X", "Y", "MT"}


@dataclass
class SearchableGene:
    symbol: str
    name: str
    description: str
    chromosome: str
    start: int
    end: int
    strand: str
    band: str
    biotype: str
    ensembl_id: str
    symbol_lower: str = ""
    name_lower: str = ""

    def __post_init__(self) -> None:
        self.symbol_lower = self.symbol.lower()
        self.name_lower = self.name.lower()


class TrieNode:
    __slots__ = ("children", "symbols")

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.symbols: list[str] = []


class PrefixTrie:
    def __init__(self) -> None:
        self.root = TrieNode()

    def insert(self, key: str, symbol: str) -> None:
        node = self.root
        for ch in key.lower():
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.symbols.append(symbol)

    def search_prefix(self, prefix: str, limit: int = 20) -> list[str]:
        node = self.root
        for ch in prefix.lower():
            if ch not in node.children:
                return []
            node = node.children[ch]
        results: list[str] = []
        self._collect(node, results, limit)
        return results

    def _collect(self, node: TrieNode, results: list[str], limit: int) -> None:
        if len(results) >= limit:
            return
        results.extend(node.symbols[: limit - len(results)])
        for child in node.children.values():
            if len(results) >= limit:
                return
            self._collect(child, results, limit)


class GeneIndex:
    """In-memory gene index for fast search."""

    def __init__(self) -> None:
        self.loaded = False
        self.count = 0
        self.protein_coding_count = 0
        self.symbol_map: dict[str, SearchableGene] = {}
        self.symbol_trie = PrefixTrie()
        self.name_words_index: dict[str, set[str]] = defaultdict(set)
        self.description_words_index: dict[str, set[str]] = defaultdict(set)
        self.chromosome_index: dict[str, list[SearchableGene]] = defaultdict(list)
        self.band_index: dict[str, list[SearchableGene]] = defaultdict(list)
        self.biotype_index: dict[str, list[SearchableGene]] = defaultdict(list)

    def build(self, genes: list[SearchableGene]) -> None:
        self.symbol_map.clear()
        self.symbol_trie = PrefixTrie()
        self.name_words_index = defaultdict(set)
        self.description_words_index = defaultdict(set)
        self.chromosome_index = defaultdict(list)
        self.band_index = defaultdict(list)
        self.biotype_index = defaultdict(list)

        for g in genes:
            if not g.symbol:
                continue
            key = g.symbol.upper()
            self.symbol_map[key] = g

            # trie
            self.symbol_trie.insert(g.symbol, g.symbol)

            # name words
            for word in g.name_lower.split():
                if len(word) > 2:
                    self.name_words_index[word].add(g.symbol)

            # description words
            desc_clean = g.description.lower().replace("[", " ").replace("]", " ")
            for word in desc_clean.split():
                word = word.strip(".,;:()")
                if len(word) > 2:
                    self.description_words_index[word].add(g.symbol)

            # chromosome
            self.chromosome_index[g.chromosome].append(g)

            # band
            if g.band:
                self.band_index[g.band].append(g)
                # also index prefix bands  e.g. "17p13.1" → index "17p13" and "17p"
                parts = g.band
                if "." in parts:
                    self.band_index[parts.rsplit(".", 1)[0]].append(g)

            # biotype
            self.biotype_index[g.biotype].append(g)

        self.count = len(self.symbol_map)
        self.protein_coding_count = len(self.biotype_index.get("protein_coding", []))
        self.loaded = True

    def get(self, symbol: str) -> SearchableGene | None:
        return self.symbol_map.get(symbol.upper())

    def prefix_search(self, prefix: str, limit: int = 20) -> list[SearchableGene]:
        symbols = self.symbol_trie.search_prefix(prefix, limit)
        return [self.symbol_map[s] for s in symbols if s in self.symbol_map]

    def search_by_name_words(self, words: list[str], limit: int = 50) -> list[str]:
        if not words:
            return []
        sets = []
        for w in words:
            w_lower = w.lower()
            matches = self.name_words_index.get(w_lower, set()) | self.description_words_index.get(w_lower, set())
            if matches:
                sets.append(matches)
        if not sets:
            return []
        # intersection for AND
        result = sets[0]
        for s in sets[1:]:
            result = result & s
        return list(result)[:limit]

    def genes_on_chromosome(self, chrom: str, limit: int = 200) -> list[SearchableGene]:
        return self.chromosome_index.get(chrom, [])[:limit]

    def genes_at_band(self, band: str, limit: int = 200) -> list[SearchableGene]:
        return self.band_index.get(band, [])[:limit]

    def to_serializable(self) -> list[dict[str, Any]]:
        return [asdict(g) for g in self.symbol_map.values()]


# ── Singleton ──
_gene_index = GeneIndex()


def get_gene_index() -> GeneIndex:
    return _gene_index


async def load_gene_index(redis_client: aioredis.Redis) -> None:
    """Load gene index from Redis cache or download from Ensembl."""
    global _gene_index
    t0 = time.time()

    # Try Redis first
    cached = await cache_get(redis_client, REDIS_KEY)
    if cached:
        genes = [SearchableGene(**g) for g in cached]
        _gene_index.build(genes)
        logger.info(
            "Gene index loaded from Redis: %d genes, %d protein-coding (%.1fs)",
            _gene_index.count, _gene_index.protein_coding_count, time.time() - t0,
        )
        return

    # Download from BioMart
    logger.info("Downloading gene index from Ensembl BioMart...")
    genes = await _download_biomart()

    if not genes:
        logger.warning("BioMart returned no data, falling back to REST API...")
        genes = await _download_rest_fallback()

    if genes:
        _gene_index.build(genes)
        # Save to Redis
        await cache_set(redis_client, REDIS_KEY, _gene_index.to_serializable(), REDIS_TTL)
        logger.info(
            "Gene index downloaded & cached: %d genes, %d protein-coding (%.1fs)",
            _gene_index.count, _gene_index.protein_coding_count, time.time() - t0,
        )
    else:
        logger.error("Failed to load gene index from any source")


async def _download_biomart() -> list[SearchableGene]:
    """Download all human genes from Ensembl BioMart (TSV)."""
    try:
        from app.utils.http_client import get_http_client
        client = get_http_client()
        resp = await client.post(
            BIOMART_URL,
            data={"query": BIOMART_XML.strip()},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=60.0,
        )
        resp.raise_for_status()
        text = resp.text

        genes: list[SearchableGene] = []
        lines = text.strip().split("\n")
        if len(lines) < 2:
            return []

        for line in lines[1:]:  # skip header
            parts = line.split("\t")
            if len(parts) < 10:
                continue
            symbol = parts[0].strip()
            if not symbol:
                symbol = parts[1].strip()
            if not symbol:
                continue
            chrom = parts[3].strip()
            if chrom not in VALID_CHROMOSOMES:
                continue
            try:
                start = int(parts[4]) if parts[4].strip() else 0
                end = int(parts[5]) if parts[5].strip() else 0
            except ValueError:
                start, end = 0, 0
            strand_val = parts[6].strip()
            strand = "+" if strand_val == "1" else "-"
            genes.append(SearchableGene(
                symbol=symbol,
                name=parts[1].strip(),
                description=parts[2].strip().split(" [")[0],  # strip "[Source:...]"
                chromosome=chrom,
                start=start,
                end=end,
                strand=strand,
                band=f"{chrom}{parts[7].strip()}" if parts[7].strip() else "",
                biotype=parts[8].strip(),
                ensembl_id=parts[9].strip(),
            ))
        return genes
    except Exception as e:
        logger.warning("BioMart download failed: %s", e)
        return []


async def _download_rest_fallback() -> list[SearchableGene]:
    """Fallback: download genes chromosome-by-chromosome via Ensembl REST."""
    chr_lengths = {
        "1": 248956422, "2": 242193529, "3": 198295559, "4": 190214555,
        "5": 181538259, "6": 170805979, "7": 159345973, "8": 145138636,
        "9": 138394717, "10": 133797422, "11": 135086622, "12": 133275309,
        "13": 114364328, "14": 107043718, "15": 101991189, "16": 90338345,
        "17": 83257441, "18": 80373285, "19": 58617616, "20": 64444167,
        "21": 46709983, "22": 50818468, "X": 156040895, "Y": 57227415,
        "MT": 16569,
    }
    all_genes: list[SearchableGene] = []

    async def fetch_chr(chrom: str, length: int) -> list[SearchableGene]:
        try:
            url = f"{ENSEMBL_REST}/overlap/region/human/{chrom}:1-{length}"
            data = await fetch_json(url, params={"feature": "gene", "content-type": "application/json"})
            result: list[SearchableGene] = []
            for g in data:
                symbol = g.get("external_name") or g.get("id", "")
                if not symbol:
                    continue
                result.append(SearchableGene(
                    symbol=symbol,
                    name=g.get("external_name", ""),
                    description=g.get("description", ""),
                    chromosome=chrom,
                    start=g.get("start", 0),
                    end=g.get("end", 0),
                    strand="+" if g.get("strand", 1) == 1 else "-",
                    band=g.get("band", ""),
                    biotype=g.get("biotype", ""),
                    ensembl_id=g.get("id", ""),
                ))
            return result
        except Exception as e:
            logger.warning("REST fallback failed for chr%s: %s", chrom, e)
            return []

    # Batch 5 at a time
    chroms = list(chr_lengths.items())
    for i in range(0, len(chroms), 5):
        batch = chroms[i:i + 5]
        results = await asyncio.gather(*[fetch_chr(c, l) for c, l in batch])
        for r in results:
            all_genes.extend(r)
        if i + 5 < len(chroms):
            await asyncio.sleep(0.5)

    return all_genes
