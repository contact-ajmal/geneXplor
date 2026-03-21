"""
Unified search service: resolves parsed queries, ranks results, returns them.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from dataclasses import dataclass, field, asdict
from typing import Any

import redis.asyncio as aioredis

from app.services.query_parser import (
    ParsedQuery, ClassifiedTerm, QueryType, parse_query,
)
from app.services.gene_index_service import get_gene_index, SearchableGene
from app.services.alias_index_service import get_alias_index
from app.services.disease_index_service import get_disease_index
from app.utils.http_client import fetch_json
from app.utils.cache_utils import cache_get, cache_set
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MatchReason:
    reason_type: str
    detail: str
    source: str
    confidence: float


@dataclass
class SearchResult:
    gene_symbol: str
    gene_name: str
    chromosome: str
    band: str
    biotype: str
    ensembl_id: str
    score: float
    match_reasons: list[MatchReason]
    highlights: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "gene_symbol": self.gene_symbol,
            "gene_name": self.gene_name,
            "chromosome": self.chromosome,
            "band": self.band,
            "biotype": self.biotype,
            "ensembl_id": self.ensembl_id,
            "score": round(self.score, 1),
            "match_reasons": [asdict(r) for r in self.match_reasons],
            "highlights": self.highlights,
        }


@dataclass
class SearchResponse:
    query: str
    total_results: int
    results: list[SearchResult]
    parsed_query: dict[str, Any]
    search_time_ms: int
    did_you_mean: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "total_results": self.total_results,
            "results": [r.to_dict() for r in self.results],
            "parsed_query": self.parsed_query,
            "search_time_ms": self.search_time_ms,
            "did_you_mean": self.did_you_mean,
        }


@dataclass
class AutocompleteItem:
    text: str
    category: str
    detail: str = ""
    resolved_to: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "text": self.text,
            "category": self.category,
            "detail": self.detail,
        }
        if self.resolved_to:
            d["resolved_to"] = self.resolved_to
        return d


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Full Search
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def search(
    query: str,
    limit: int = 20,
    offset: int = 0,
    redis_client: aioredis.Redis | None = None,
) -> SearchResponse:
    t0 = time.time()

    # Check cache
    if redis_client:
        cache_key = f"search:result:{hashlib.md5(query.lower().encode()).hexdigest()}"
        cached = await cache_get(redis_client, cache_key)
        if cached:
            elapsed = int((time.time() - t0) * 1000)
            cached["search_time_ms"] = elapsed
            return SearchResponse(
                query=cached["query"],
                total_results=cached["total_results"],
                results=[_dict_to_result(r) for r in cached["results"]],
                parsed_query=cached["parsed_query"],
                search_time_ms=elapsed,
                did_you_mean=cached.get("did_you_mean"),
            )

    parsed = parse_query(query)

    # Resolve each term type
    gene_scores: dict[str, float] = {}
    gene_reasons: dict[str, list[MatchReason]] = {}

    tasks: list[tuple[str, Any]] = []
    for ct in parsed.classified_terms:
        tasks.append((ct.query_type.value, _resolve_term(ct)))

    resolved = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

    for (term_type, _), result in zip(tasks, resolved):
        if isinstance(result, Exception):
            logger.warning("Resolver error for %s: %s", term_type, result)
            continue
        if not isinstance(result, dict):
            continue
        for symbol, (score, reason) in result.items():
            gene_scores[symbol] = gene_scores.get(symbol, 0) + score
            if symbol not in gene_reasons:
                gene_reasons[symbol] = []
            gene_reasons[symbol].append(reason)

    # Multi-term intersection bonus
    if len(parsed.classified_terms) > 1:
        term_results: list[set[str]] = []
        for (_, _), result in zip(tasks, resolved):
            if isinstance(result, dict):
                term_results.append(set(result.keys()))
        if term_results:
            intersection = term_results[0]
            for s in term_results[1:]:
                intersection = intersection & s
            for symbol in intersection:
                gene_scores[symbol] += 15

    # Build results
    gene_idx = get_gene_index()
    results: list[SearchResult] = []
    for symbol, score in sorted(gene_scores.items(), key=lambda x: x[1], reverse=True):
        gene = gene_idx.get(symbol) if gene_idx.loaded else None
        results.append(SearchResult(
            gene_symbol=symbol,
            gene_name=gene.name if gene else "",
            chromosome=gene.chromosome if gene else "",
            band=gene.band if gene else "",
            biotype=gene.biotype if gene else "",
            ensembl_id=gene.ensembl_id if gene else "",
            score=score,
            match_reasons=gene_reasons.get(symbol, []),
            highlights=_build_highlights(symbol, gene, parsed),
        ))

    total = len(results)
    results = results[offset:offset + limit]

    # Spelling suggestion
    did_you_mean = None
    if not results and parsed.classified_terms:
        did_you_mean = _suggest_spelling(query)

    elapsed = int((time.time() - t0) * 1000)

    response = SearchResponse(
        query=query,
        total_results=total,
        results=results,
        parsed_query={
            "raw": parsed.raw,
            "terms": [{"term": ct.term, "type": ct.query_type.value, "confidence": ct.confidence,
                        "resolved_to": ct.resolved_to} for ct in parsed.classified_terms],
            "strategy": parsed.combined_strategy,
        },
        search_time_ms=elapsed,
        did_you_mean=did_you_mean,
    )

    # Cache for 1 hour
    if redis_client and results:
        cache_key = f"search:result:{hashlib.md5(query.lower().encode()).hexdigest()}"
        await cache_set(redis_client, cache_key, response.to_dict(), 3600)

    return response


def _dict_to_result(d: dict) -> SearchResult:
    return SearchResult(
        gene_symbol=d["gene_symbol"],
        gene_name=d.get("gene_name", ""),
        chromosome=d.get("chromosome", ""),
        band=d.get("band", ""),
        biotype=d.get("biotype", ""),
        ensembl_id=d.get("ensembl_id", ""),
        score=d.get("score", 0),
        match_reasons=[MatchReason(**r) for r in d.get("match_reasons", [])],
        highlights=d.get("highlights", []),
    )


async def _resolve_term(ct: ClassifiedTerm) -> dict[str, tuple[float, MatchReason]]:
    """Resolve a classified term to gene symbols with scores."""
    results: dict[str, tuple[float, MatchReason]] = {}
    gene_idx = get_gene_index()
    alias_idx = get_alias_index()
    disease_idx = get_disease_index()

    if ct.query_type == QueryType.GENE_SYMBOL:
        symbol = ct.resolved_to or ct.term.upper()
        results[symbol] = (40, MatchReason("exact_symbol", symbol, "gene_index", 0.95))

    elif ct.query_type == QueryType.GENE_ALIAS:
        symbol = ct.resolved_to or ct.term.upper()
        results[symbol] = (30, MatchReason("alias", f"{ct.term} → {symbol}", "hgnc", 0.90))

    elif ct.query_type == QueryType.GENE_ID:
        symbol = ct.resolved_to
        if symbol:
            results[symbol] = (35, MatchReason("ensembl_id", ct.term, "ensembl", 0.95))

    elif ct.query_type == QueryType.GENE_PREFIX:
        if gene_idx.loaded:
            prefix_genes = gene_idx.prefix_search(ct.term, limit=20)
            for g in prefix_genes:
                score = 25 if g.symbol_lower.startswith(ct.term.lower()) else 15
                results[g.symbol] = (score, MatchReason("prefix", f"starts with '{ct.term}'", "gene_index", 0.7))

    elif ct.query_type == QueryType.GENE_NAME:
        if gene_idx.loaded:
            symbols = gene_idx.search_by_name_words([ct.term], limit=30)
            for s in symbols:
                results[s] = (15, MatchReason("name_match", f"name contains '{ct.term}'", "gene_index", 0.6))

    elif ct.query_type == QueryType.DISEASE_NAME:
        if disease_idx.loaded:
            disease_results = disease_idx.search_disease(ct.term, limit=5)
            for disease_name, genes in disease_results:
                for g in genes:
                    existing_score = results.get(g, (0, None))[0]
                    score = 20 + min(len(genes), 5)  # more variants = higher relevance
                    if score > existing_score:
                        results[g] = (score, MatchReason(
                            "disease", f"associated with '{disease_name}'", "clinvar", 0.8,
                        ))

    elif ct.query_type in (QueryType.CHROMOSOMAL_LOCATION, QueryType.CYTOGENETIC_BAND):
        if gene_idx.loaded:
            genes = _resolve_location(ct, gene_idx)
            for g in genes[:50]:
                score = 20
                if g.biotype == "protein_coding":
                    score += 5
                results[g.symbol] = (score, MatchReason(
                    "location", f"located at {ct.detail or ct.term}", "gene_index", 0.9,
                ))

    elif ct.query_type == QueryType.VARIANT_ID:
        resolved = await _resolve_variant(ct.term)
        for symbol in resolved:
            results[symbol] = (35, MatchReason("variant", f"variant {ct.term}", "ncbi", 0.95))

    elif ct.query_type == QueryType.FUNCTION_KEYWORD:
        resolved = await _resolve_function(ct.term)
        for symbol in resolved:
            results[symbol] = (15, MatchReason(
                "function", f"function: '{ct.term}'", "uniprot", 0.7,
            ))

    elif ct.query_type == QueryType.FREETEXT:
        # Try all indexes
        if gene_idx.loaded:
            name_matches = gene_idx.search_by_name_words([ct.term], limit=10)
            for s in name_matches:
                results[s] = (10, MatchReason("text_match", ct.term, "gene_index", 0.3))

    return results


def _resolve_location(ct: ClassifiedTerm, gene_idx) -> list[SearchableGene]:
    """Resolve chromosomal location or cytogenetic band."""
    if ct.query_type == QueryType.CYTOGENETIC_BAND:
        return gene_idx.genes_at_band(ct.term, limit=200)

    # Parse chromosome from detail or term
    detail = ct.detail or ct.term
    m = re.match(r"(?:chr(?:omosome)?\s*)?(\d{1,2}|[XYxy])", detail, re.IGNORECASE)
    if m:
        chrom = m.group(1).upper()
        return gene_idx.genes_on_chromosome(chrom, limit=200)
    return []


async def _resolve_variant(term: str) -> list[str]:
    """Resolve a variant ID to gene symbols via NCBI APIs."""
    try:
        if term.lower().startswith("rs"):
            rs_num = term[2:]
            url = f"{settings.clinvar_base_url}/esummary.fcgi"
            data = await fetch_json(url, params={"db": "snp", "id": rs_num, "retmode": "json"})
            result = data.get("result", {})
            for uid, info in result.items():
                if uid == "uids":
                    continue
                genes = info.get("genes", [])
                return [g.get("name", "") for g in genes if g.get("name")]
        elif term.upper().startswith("VCV"):
            num = re.sub(r"\D", "", term)
            url = f"{settings.clinvar_base_url}/esummary.fcgi"
            data = await fetch_json(url, params={"db": "clinvar", "id": num, "retmode": "json"})
            result = data.get("result", {})
            for uid, info in result.items():
                if uid == "uids":
                    continue
                genes = info.get("genes", [])
                return [g.get("symbol", "") for g in genes if g.get("symbol")]
    except Exception as e:
        logger.warning("Variant resolution failed for %s: %s", term, e)
    return []


async def _resolve_function(term: str) -> list[str]:
    """Resolve a function keyword to gene symbols via UniProt."""
    try:
        url = f"{settings.uniprot_base_url}/uniprotkb/search"
        params = {
            "query": f"{term} AND organism_id:9606",
            "fields": "gene_names",
            "format": "json",
            "size": "50",
        }
        data = await fetch_json(url, params=params)
        symbols: list[str] = []
        for entry in data.get("results", []):
            genes = entry.get("genes", [])
            for g in genes:
                name = g.get("geneName", {}).get("value", "")
                if name:
                    symbols.append(name.upper())
                    break
        return symbols[:50]
    except Exception as e:
        logger.warning("UniProt function search failed for %s: %s", term, e)
        return []


def _build_highlights(symbol: str, gene: SearchableGene | None, parsed: ParsedQuery) -> list[str]:
    highlights: list[str] = []
    if gene:
        if gene.biotype == "protein_coding":
            highlights.append("Protein-coding gene")
        if gene.chromosome:
            highlights.append(f"Chr {gene.chromosome}")
        if gene.band:
            highlights.append(gene.band)
    return highlights


def _suggest_spelling(query: str) -> str | None:
    """Suggest spelling corrections using Levenshtein distance against gene symbols."""
    gene_idx = get_gene_index()
    if not gene_idx.loaded:
        return None

    q = query.upper().strip()
    if len(q) < 2 or len(q) > 15:
        return None

    best: str | None = None
    best_dist = 3  # max distance

    # Only check symbols starting with the same letter (performance)
    first_char = q[0]
    for symbol in gene_idx.symbol_map:
        if symbol[0] != first_char:
            continue
        if abs(len(symbol) - len(q)) > 2:
            continue
        d = _levenshtein(q, symbol)
        if d < best_dist:
            best_dist = d
            best = symbol

    return best


def _levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr_row.append(min(
                curr_row[j] + 1,
                prev_row[j + 1] + 1,
                prev_row[j] + cost,
            ))
        prev_row = curr_row
    return prev_row[-1]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Autocomplete (must be <100ms, in-memory only)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def autocomplete(query: str, limit: int = 10) -> list[AutocompleteItem]:
    """Fast autocomplete from in-memory indexes only."""
    q = query.strip()
    if len(q) < 1:
        return []

    items: list[AutocompleteItem] = []
    gene_idx = get_gene_index()
    alias_idx = get_alias_index()
    disease_idx = get_disease_index()

    q_upper = q.upper()
    q_lower = q.lower()

    # 1. Gene symbol prefix (highest priority)
    if gene_idx.loaded:
        prefix_genes = gene_idx.prefix_search(q, limit=5)
        for g in prefix_genes:
            items.append(AutocompleteItem(
                text=g.symbol,
                category="gene",
                detail=f"{g.name}, Chr{g.chromosome}" if g.name else f"Chr{g.chromosome}",
            ))

    # 2. Alias matches
    if alias_idx.loaded and len(items) < limit:
        resolved = alias_idx.resolve(q)
        if resolved and resolved != q_upper:
            gene = gene_idx.get(resolved) if gene_idx.loaded else None
            items.append(AutocompleteItem(
                text=q_upper,
                category="alias",
                detail=f"→ {resolved}" + (f" ({gene.name})" if gene else ""),
                resolved_to=resolved,
            ))

    # 3. Gene name matches
    if gene_idx.loaded and len(items) < limit and len(q) >= 3:
        name_matches = gene_idx.search_by_name_words(q_lower.split(), limit=3)
        for s in name_matches:
            if not any(item.text == s for item in items):
                gene = gene_idx.get(s)
                items.append(AutocompleteItem(
                    text=s,
                    category="gene_name",
                    detail=gene.name if gene else "",
                    resolved_to=s,
                ))

    # 4. Disease name matches
    if disease_idx.loaded and len(items) < limit and len(q) >= 3:
        disease_results = disease_idx.search_disease(q, limit=3)
        for d_name, genes in disease_results:
            items.append(AutocompleteItem(
                text=d_name[:60],
                category="disease",
                detail=f"{len(genes)} associated genes",
            ))

    # 5. Chromosome suggestions
    if q_lower.startswith("chr") and len(q) >= 4:
        chrom = q[3:].strip().upper()
        if gene_idx.loaded and gene_idx.genes_on_chromosome(chrom):
            count = len(gene_idx.chromosome_index.get(chrom, []))
            items.append(AutocompleteItem(
                text=f"chr{chrom}",
                category="location",
                detail=f"Chromosome {chrom} — {count} genes",
            ))

    return items[:limit]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Suggest (spelling correction)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def suggest(query: str) -> list[str]:
    """Return up to 3 spelling suggestions."""
    gene_idx = get_gene_index()
    if not gene_idx.loaded:
        return []

    q = query.upper().strip()
    if len(q) < 2:
        return []

    suggestions: list[tuple[int, str]] = []
    first_char = q[0]

    for symbol in gene_idx.symbol_map:
        if symbol[0] != first_char:
            continue
        if abs(len(symbol) - len(q)) > 2:
            continue
        d = _levenshtein(q, symbol)
        if 0 < d <= 2:
            suggestions.append((d, symbol))

    suggestions.sort(key=lambda x: x[0])
    return [s[1] for s in suggestions[:3]]
