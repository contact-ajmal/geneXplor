import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_KEY = "ai_summary:{symbol}"


async def generate_gene_summary(gene_data: dict) -> dict:
    """Generate a clinical summary for a gene from dashboard data.

    Returns dict with keys: summary, generated_at, source.
    Tries LLM first (if configured), falls back to template.
    """
    symbol = gene_data.get("gene_symbol", "")
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("AI summary cache hit for %s", symbol)
        return cached

    logger.info("Generating summary for %s", symbol)

    summary_text = ""
    source = "template"

    # Try LLM if configured
    if (
        settings.ai_summary_enabled
        and settings.llm_api_url
        and settings.llm_api_key
    ):
        try:
            summary_text = await _call_llm(gene_data)
            source = "ai"
            logger.info("AI summary generated for %s", symbol)
        except Exception as exc:
            logger.error("LLM failed for %s, falling back to template: %s", symbol, exc)
            summary_text = ""

    # Fallback to template
    if not summary_text:
        summary_text = _generate_template_summary(gene_data)
        source = "template"

    result = {
        "summary": summary_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
    }

    await cache_set(redis_client, cache_key, result)
    return result


async def _call_llm(gene_data: dict) -> str:
    """Call an OpenAI-compatible LLM API to generate a summary."""
    gene = gene_data.get("gene") or {}
    protein = gene_data.get("protein") or {}
    variants = gene_data.get("variants") or {}
    publications = gene_data.get("publications") or {}
    pathways = gene_data.get("pathways") or {}

    # Build structured user prompt
    diseases = variants.get("diseases", [])
    top_diseases = ", ".join(
        d["disease_name"] for d in diseases[:5]
    ) or "none reported"

    clinvar_variants = variants.get("variants", [])
    pathogenic = [v for v in clinvar_variants if "pathogenic" in v.get("clinical_significance", "").lower() and "likely" not in v.get("clinical_significance", "").lower()]
    top_pathogenic = "; ".join(
        f'{v["title"]} ({v["clinical_significance"]})' for v in pathogenic[:3]
    ) or "none"

    pathway_list = pathways.get("pathways", [])
    pathway_summary = ", ".join(p["name"] for p in pathway_list[:5]) or "none identified"

    user_prompt = f"""Gene: {gene.get("gene_symbol", "")} ({gene.get("gene_name", "")})
Description: {gene.get("description", "")}
Chromosome: {gene.get("chromosome", "")}, Position: {gene.get("start", 0)}-{gene.get("end", 0)}, Biotype: {gene.get("biotype", "")}

Protein: {protein.get("protein_name", "N/A")}, {protein.get("protein_length", 0)} amino acids
Function: {protein.get("function_description", "N/A")[:500]}

Disease associations ({len(diseases)} total): {top_diseases}
Top pathogenic variants: {top_pathogenic}
Total ClinVar variants: {len(clinvar_variants)}

Pathways: {pathway_summary}

Publications: {publications.get("total_results", 0)} recent PubMed articles

Please provide a concise clinical genetics summary (3-4 paragraphs)."""

    system_prompt = (
        "You are a clinical genetics expert writing for healthcare professionals "
        "and advanced biology students. Provide a concise, accurate summary of "
        "the gene based on the provided data. Use professional clinical genetics "
        "language. Structure: 1) Gene function and significance, 2) Key clinical "
        "associations, 3) Notable variants, 4) Research context."
    )

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        response = await client.post(
            settings.llm_api_url,
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 800,
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


def _generate_template_summary(gene_data: dict) -> str:
    """Generate a structured summary from data without AI."""
    gene = gene_data.get("gene") or {}
    protein = gene_data.get("protein") or {}
    variants_data = gene_data.get("variants") or {}
    publications = gene_data.get("publications") or {}
    pathways = gene_data.get("pathways") or {}

    symbol = gene.get("gene_symbol", "Unknown")
    gene_name = gene.get("gene_name", gene.get("description", "a gene"))
    biotype = gene.get("biotype", "protein_coding").replace("_", " ")
    chromosome = gene.get("chromosome", "?")
    start = gene.get("start", 0)
    end = gene.get("end", 0)
    strand = "forward (+)" if gene.get("strand", 1) == 1 else "reverse (-)"
    gene_length_kb = round(abs(end - start) / 1000, 1)

    protein_name = protein.get("protein_name", "")
    protein_length = protein.get("protein_length", 0)
    function_desc = protein.get("function_description", "")
    domains = protein.get("domains", [])

    clinvar_variants = variants_data.get("variants", [])
    diseases = variants_data.get("diseases", [])

    # Count variant categories
    pathogenic_count = sum(
        1 for v in clinvar_variants
        if "pathogenic" in v.get("clinical_significance", "").lower()
        and "likely" not in v.get("clinical_significance", "").lower()
    )
    likely_pathogenic_count = sum(
        1 for v in clinvar_variants
        if "likely pathogenic" in v.get("clinical_significance", "").lower()
        or "likely_pathogenic" in v.get("clinical_significance", "").lower()
    )
    benign_count = sum(
        1 for v in clinvar_variants
        if "benign" in v.get("clinical_significance", "").lower()
    )
    vus_count = sum(
        1 for v in clinvar_variants
        if "uncertain" in v.get("clinical_significance", "").lower()
        or "vus" in v.get("clinical_significance", "").lower()
    )

    pub_count = publications.get("total_results", 0)
    pathway_list = pathways.get("pathways", [])

    # ── Paragraph 1: Gene identity & function ──
    parts = [f"{gene_name} ({symbol}) is a {biotype} gene located on chromosome {chromosome} ({start:,}-{end:,}, {strand} strand), spanning approximately {gene_length_kb} kb."]

    if protein_name and protein_length:
        parts.append(f"It encodes {protein_name}, a {protein_length:,} amino acid protein.")
    if function_desc:
        # Take first 2 sentences
        sentences = function_desc.split(". ")
        func_text = ". ".join(sentences[:2])
        if not func_text.endswith("."):
            func_text += "."
        parts.append(func_text)
    if domains:
        domain_names = [d["name"] for d in domains[:4]]
        parts.append(f"The protein contains notable functional domains including {', '.join(domain_names)}.")

    para1 = " ".join(parts)

    # ── Paragraph 2: Clinical significance ──
    if diseases or clinvar_variants:
        clin_parts = []
        if diseases:
            top_diseases = [d["disease_name"] for d in sorted(diseases, key=lambda d: d["variant_count"], reverse=True)[:3]]
            clin_parts.append(f"{symbol} is associated with {len(diseases)} conditions in ClinVar, most notably {', '.join(top_diseases)}.")
        if clinvar_variants:
            clin_parts.append(f"A total of {len(clinvar_variants)} clinical variants have been reported, including {pathogenic_count} pathogenic, {likely_pathogenic_count} likely pathogenic, and {vus_count} variants of uncertain significance.")
        if benign_count:
            clin_parts.append(f"{benign_count} variants are classified as benign or likely benign.")
        para2 = " ".join(clin_parts)
    else:
        para2 = f"No clinical variant data is currently available for {symbol} in ClinVar."

    # ── Paragraph 3: Pathways & research ──
    research_parts = []
    if pathway_list:
        pathway_names = [p["name"] for p in pathway_list[:3]]
        research_parts.append(f"{symbol} participates in {len(pathway_list)} biological pathways, including {', '.join(pathway_names)}.")
    if pub_count:
        if pub_count > 500:
            interest = "very high"
        elif pub_count > 100:
            interest = "high"
        elif pub_count > 20:
            interest = "moderate"
        else:
            interest = "growing"
        research_parts.append(f"With {pub_count:,} recent publications in PubMed, {symbol} demonstrates {interest} research interest in the scientific community.")
    if not research_parts:
        research_parts.append(f"Research data for {symbol} is currently limited in the queried databases.")

    para3 = " ".join(research_parts)

    return f"{para1}\n\n{para2}\n\n{para3}"
