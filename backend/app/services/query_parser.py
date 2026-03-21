"""
Multi-modal query parser. Classifies search terms using dynamic indexes.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from enum import Enum

from app.services.gene_index_service import get_gene_index
from app.services.alias_index_service import get_alias_index
from app.services.disease_index_service import get_disease_index

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    GENE_SYMBOL = "gene_symbol"
    GENE_ALIAS = "gene_alias"
    GENE_ID = "gene_id"
    GENE_PREFIX = "gene_prefix"
    GENE_NAME = "gene_name"
    DISEASE_NAME = "disease_name"
    CHROMOSOMAL_LOCATION = "chromosomal_location"
    CYTOGENETIC_BAND = "cytogenetic_band"
    VARIANT_ID = "variant_id"
    FUNCTION_KEYWORD = "function_keyword"
    FREETEXT = "freetext"


@dataclass
class ClassifiedTerm:
    term: str
    query_type: QueryType
    confidence: float
    resolved_to: str | None = None
    detail: str = ""


@dataclass
class ParsedQuery:
    raw: str
    terms: list[str]
    classified_terms: list[ClassifiedTerm]
    combined_strategy: str = "AND"

    @property
    def has_gene(self) -> bool:
        return any(ct.query_type in (
            QueryType.GENE_SYMBOL, QueryType.GENE_ALIAS,
            QueryType.GENE_ID, QueryType.GENE_PREFIX,
        ) for ct in self.classified_terms)

    @property
    def single_gene(self) -> str | None:
        """If query resolves to a single unambiguous gene, return its symbol."""
        gene_terms = [ct for ct in self.classified_terms if ct.query_type in (
            QueryType.GENE_SYMBOL, QueryType.GENE_ALIAS, QueryType.GENE_ID,
        ) and ct.confidence >= 0.9]
        if len(gene_terms) == 1 and len(self.classified_terms) == 1:
            return gene_terms[0].resolved_to or gene_terms[0].term.upper()
        return None


# ── Regex patterns ──
RE_RSID = re.compile(r"^rs\d+$", re.IGNORECASE)
RE_CLINVAR_ACC = re.compile(r"^VCV\d+$", re.IGNORECASE)
RE_HGVS_C = re.compile(r"^NM_\d+.*:c\..+$", re.IGNORECASE)
RE_PROTEIN_CHANGE = re.compile(r"^p\.[A-Z]\d+[A-Z*]", re.IGNORECASE)
RE_ENSEMBL_ID = re.compile(r"^ENSG\d{11}$", re.IGNORECASE)

RE_CHR_RANGE = re.compile(r"^chr?(\d{1,2}|[XYxy]):(\d+)-(\d+)$", re.IGNORECASE)
RE_CHR_POS = re.compile(r"^chr?(\d{1,2}|[XYxy]):(\d+)$", re.IGNORECASE)
RE_CHR_ONLY = re.compile(r"^(?:chr(?:omosome)?\s*)?(\d{1,2}|[XYxy])$", re.IGNORECASE)
RE_CYTO_BAND = re.compile(r"^(\d{1,2}|[XYxy])[pq]\d+\.?\d*$", re.IGNORECASE)


def parse_query(raw_query: str) -> ParsedQuery:
    """Parse and classify a search query using dynamic indexes."""
    raw = raw_query.strip()
    if not raw:
        return ParsedQuery(raw=raw, terms=[], classified_terms=[])

    # Tokenize: try phrase detection first
    classified: list[ClassifiedTerm] = []
    remaining = raw

    # Try to detect disease phrases (multi-word)
    disease_idx = get_disease_index()
    if disease_idx.loaded and len(raw.split()) >= 2:
        disease_match = _try_disease_phrase(raw, disease_idx)
        if disease_match:
            classified.append(disease_match)
            # Remove matched phrase from remaining
            remaining = remaining.lower().replace(disease_match.term.lower(), "").strip()

    # Classify remaining terms
    tokens = [t.strip() for t in remaining.replace(",", " ").split() if t.strip()]
    for token in tokens:
        ct = _classify_single_term(token)
        if ct:
            classified.append(ct)

    all_terms = [ct.term for ct in classified]

    return ParsedQuery(
        raw=raw,
        terms=all_terms,
        classified_terms=classified,
        combined_strategy="AND" if len(classified) > 1 else "OR",
    )


def _try_disease_phrase(query: str, disease_idx: DiseaseIndex) -> ClassifiedTerm | None:
    """Try to match the full query or substrings as a disease name."""
    q_lower = query.lower().strip()

    # Full query match
    results = disease_idx.search_disease(q_lower, limit=1)
    if results and q_lower in results[0][0].lower():
        return ClassifiedTerm(
            term=results[0][0],
            query_type=QueryType.DISEASE_NAME,
            confidence=0.9,
            detail=f"{len(results[0][1])} genes",
        )

    # Try progressively shorter n-grams
    words = q_lower.split()
    for n in range(len(words), 1, -1):
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i:i + n])
            results = disease_idx.search_disease(phrase, limit=1)
            if results and phrase in results[0][0].lower():
                return ClassifiedTerm(
                    term=results[0][0],
                    query_type=QueryType.DISEASE_NAME,
                    confidence=0.7 if n >= 2 else 0.5,
                    detail=f"{len(results[0][1])} genes",
                )
    return None


def _classify_single_term(term: str) -> ClassifiedTerm | None:
    """Classify a single search term."""
    if not term:
        return None

    # 1. Variant patterns (highest priority, unambiguous)
    if RE_RSID.match(term):
        return ClassifiedTerm(term=term, query_type=QueryType.VARIANT_ID, confidence=1.0, detail="rsID")
    if RE_CLINVAR_ACC.match(term):
        return ClassifiedTerm(term=term, query_type=QueryType.VARIANT_ID, confidence=1.0, detail="ClinVar")
    if RE_HGVS_C.match(term):
        return ClassifiedTerm(term=term, query_type=QueryType.VARIANT_ID, confidence=1.0, detail="HGVS coding")
    if RE_PROTEIN_CHANGE.match(term):
        return ClassifiedTerm(term=term, query_type=QueryType.VARIANT_ID, confidence=1.0, detail="Protein change")

    # 2. Chromosomal location
    m = RE_CHR_RANGE.match(term)
    if m:
        return ClassifiedTerm(
            term=term, query_type=QueryType.CHROMOSOMAL_LOCATION, confidence=1.0,
            detail=f"chr{m.group(1)}:{m.group(2)}-{m.group(3)}",
        )
    m = RE_CHR_POS.match(term)
    if m:
        return ClassifiedTerm(
            term=term, query_type=QueryType.CHROMOSOMAL_LOCATION, confidence=1.0,
            detail=f"chr{m.group(1)}:{m.group(2)}",
        )
    if RE_CYTO_BAND.match(term):
        return ClassifiedTerm(term=term, query_type=QueryType.CYTOGENETIC_BAND, confidence=1.0)

    # Ensembl gene ID
    if RE_ENSEMBL_ID.match(term):
        alias_idx = get_alias_index()
        resolved = alias_idx.resolve(term.upper()) if alias_idx.loaded else None
        return ClassifiedTerm(
            term=term, query_type=QueryType.GENE_ID, confidence=0.95,
            resolved_to=resolved, detail="Ensembl ID",
        )

    # 3. Gene symbol (check dynamic indexes)
    gene_idx = get_gene_index()
    alias_idx = get_alias_index()

    term_upper = term.upper()

    # Exact symbol match
    if gene_idx.loaded and gene_idx.get(term_upper):
        return ClassifiedTerm(
            term=term, query_type=QueryType.GENE_SYMBOL, confidence=0.95,
            resolved_to=term_upper,
        )

    # Alias match
    if alias_idx.loaded:
        resolved = alias_idx.resolve(term)
        if resolved:
            return ClassifiedTerm(
                term=term, query_type=QueryType.GENE_ALIAS, confidence=0.90,
                resolved_to=resolved, detail=f"alias → {resolved}",
            )

    # Prefix match (only if ≥2 chars and looks like a gene symbol)
    if gene_idx.loaded and len(term) >= 2 and term_upper.isalnum():
        prefix_results = gene_idx.prefix_search(term, limit=5)
        if prefix_results:
            return ClassifiedTerm(
                term=term, query_type=QueryType.GENE_PREFIX, confidence=0.7,
                detail=f"{len(prefix_results)} matches",
            )

    # Chromosome only (e.g. "17", "X" — but only in context)
    m = RE_CHR_ONLY.match(term)
    if m and len(term) <= 4:
        chrom = m.group(1).upper()
        if gene_idx.loaded and gene_idx.genes_on_chromosome(chrom):
            return ClassifiedTerm(
                term=term, query_type=QueryType.CHROMOSOMAL_LOCATION, confidence=0.6,
                detail=f"chromosome {chrom}",
            )

    # 4. Gene name word match
    if gene_idx.loaded and len(term) > 3:
        name_matches = gene_idx.search_by_name_words([term], limit=10)
        if name_matches:
            return ClassifiedTerm(
                term=term, query_type=QueryType.GENE_NAME, confidence=0.6,
                detail=f"{len(name_matches)} genes",
            )

    # 5. Disease single word
    disease_idx = get_disease_index()
    if disease_idx.loaded and len(term) > 3:
        disease_results = disease_idx.search_disease(term, limit=5)
        if disease_results:
            return ClassifiedTerm(
                term=term, query_type=QueryType.DISEASE_NAME, confidence=0.5,
                detail=f"{len(disease_results)} diseases",
            )

    # 6. Function keyword (common biology terms)
    if len(term) > 3:
        return ClassifiedTerm(
            term=term, query_type=QueryType.FUNCTION_KEYWORD, confidence=0.4,
            detail="function/keyword search",
        )

    # Fallback
    return ClassifiedTerm(term=term, query_type=QueryType.FREETEXT, confidence=0.3)
