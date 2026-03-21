import asyncio
import re

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.redis import get_redis
from app.schemas.gene_schema import (
    ClinicalReportResponse,
    GeneDashboardResponse,
    GeneSummaryResponse,
    HealthResponse,
    ReconciliationData,
)
from app.services.ai_summary_service import generate_gene_summary
from app.services.gene_aggregator_service import get_gene_dashboard
from app.services.report_pdf_service import generate_report_pdf
from app.services.report_service import generate_clinical_report
from app.utils.exceptions import InvalidGeneSymbolError

router = APIRouter()

GENE_SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9\-]{0,19}$")


@router.get("/health", response_model=HealthResponse)
async def health_check(session: AsyncSession = Depends(get_session)) -> HealthResponse:
    db_status = "ok"
    redis_status = "ok"

    try:
        await session.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        redis_client = await get_redis()
        await redis_client.ping()
    except Exception:
        redis_status = "error"

    overall = "healthy" if db_status == "ok" and redis_status == "ok" else "degraded"

    return HealthResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        version="0.2.0",
    )


@router.get("/gene/compare", response_model=list[GeneDashboardResponse])
async def compare_genes(
    genes: str = Query(..., description="Comma-separated gene symbols (e.g. TP53,BRCA1)"),
    session: AsyncSession = Depends(get_session),
) -> list[GeneDashboardResponse]:
    symbols = [s.strip().upper() for s in genes.split(",") if s.strip()]

    if len(symbols) != 2:
        raise InvalidGeneSymbolError("Provide exactly two comma-separated gene symbols")

    for sym in symbols:
        if not GENE_SYMBOL_PATTERN.match(sym):
            raise InvalidGeneSymbolError(sym)

    results = await asyncio.gather(
        get_gene_dashboard(symbols[0], session),
        get_gene_dashboard(symbols[1], session),
    )
    return list(results)


@router.get("/gene/{symbol}", response_model=GeneDashboardResponse)
async def get_gene(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> GeneDashboardResponse:
    symbol_upper = symbol.upper().strip()

    # Try alias resolution before strict validation
    from app.services.alias_index_service import get_alias_index
    from app.services.gene_index_service import get_gene_index

    alias_idx = get_alias_index()
    gene_idx = get_gene_index()

    resolved = None
    if alias_idx.loaded:
        resolved = alias_idx.resolve(symbol_upper)
    if not resolved and gene_idx.loaded:
        gene = gene_idx.get(symbol_upper)
        if gene:
            resolved = gene.symbol

    final_symbol = resolved or symbol_upper

    if not GENE_SYMBOL_PATTERN.match(final_symbol):
        raise InvalidGeneSymbolError(symbol)

    return await get_gene_dashboard(final_symbol, session)


@router.get("/gene/{symbol}/summary", response_model=GeneSummaryResponse)
async def get_gene_summary(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> GeneSummaryResponse:
    symbol_upper = symbol.upper().strip()

    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    # Get the full dashboard data first (uses cache)
    dashboard = await get_gene_dashboard(symbol_upper, session)
    dashboard_dict = dashboard.model_dump()

    result = await generate_gene_summary(dashboard_dict)
    return GeneSummaryResponse(**result)


VALID_SECTIONS = {
    "gene_summary",
    "variant_summary",
    "disease_associations",
    "variant_classification",
    "population_frequencies",
    "protein_impact",
    "research_context",
    "methodology",
}


@router.get("/gene/{symbol}/report", response_model=None)
async def get_gene_report(
    symbol: str,
    format: str = Query("json", description="Output format: json, pdf, or markdown"),
    variant_filter: str = Query(
        "all",
        description="Variant filter: all, pathogenic_lp, pathogenic_lp_vus",
    ),
    sections: str = Query(
        "",
        description="Comma-separated section names to include (empty = all)",
    ),
    session: AsyncSession = Depends(get_session),
) -> ClinicalReportResponse | Response:
    symbol_upper = symbol.upper().strip()

    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    if variant_filter not in ("all", "pathogenic_lp", "pathogenic_lp_vus"):
        variant_filter = "all"

    # Parse sections filter
    section_map: dict[str, bool] | None = None
    if sections.strip():
        requested = {s.strip() for s in sections.split(",") if s.strip()}
        section_map = {s: s in requested for s in VALID_SECTIONS}

    dashboard = await get_gene_dashboard(symbol_upper, session)
    report = generate_clinical_report(dashboard, section_map, variant_filter)

    if format == "pdf":
        pdf_bytes = generate_report_pdf(report)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{symbol_upper}_clinical_report.pdf"',
            },
        )

    if format == "markdown":
        md = _report_to_markdown(report)
        return Response(
            content=md,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{symbol_upper}_clinical_report.md"',
            },
        )

    return report


@router.get("/gene/{symbol}/reconciliation", response_model=ReconciliationData)
async def get_gene_reconciliation(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> ReconciliationData:
    symbol_upper = symbol.upper().strip()
    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)
    dashboard = await get_gene_dashboard(symbol_upper, session)
    if dashboard.reconciliation:
        return dashboard.reconciliation
    return ReconciliationData()


def _report_to_markdown(report: ClinicalReportResponse) -> str:
    """Convert report to Markdown string."""
    lines: list[str] = []
    lines.append(f"# Clinical Gene Report: {report.gene_symbol}")
    lines.append(f"*Generated: {report.generated_at[:10]}*\n")
    lines.append(f"**{report.disclaimer}**\n")
    lines.append("---\n")

    if report.clinical_metrics:
        cm = report.clinical_metrics
        lines.append("## Clinical Metrics")
        lines.append(f"- Total Variants Analyzed: **{cm.total_variants_analyzed}**")
        lines.append(f"- Pathogenic Variant Burden: **{cm.pathogenic_variant_burden}%**")
        lines.append(f"- VUS-to-Pathogenic Ratio: **{cm.vus_to_pathogenic_ratio}**\n")

    if report.gene_summary:
        gs = report.gene_summary
        lines.append("## 1. Gene Summary")
        lines.append(f"- **Symbol:** `{gs.gene_symbol}`")
        lines.append(f"- **Name:** {gs.gene_name}")
        lines.append(f"- **Chromosome:** {gs.chromosome}")
        lines.append(f"- **Coordinates:** `{gs.coordinates}`")
        lines.append(f"- **Ensembl ID:** `{gs.ensembl_id}`")
        if gs.aliases:
            lines.append(f"- **Aliases:** {', '.join(gs.aliases[:5])}")
        if gs.function_summary:
            lines.append(f"\n**Function:** {gs.function_summary[:500]}\n")

    if report.variant_summary:
        vs = report.variant_summary
        lines.append("## 2. Variant Summary")
        lines.append(
            f"| Classification | Count |\n|---|---|\n"
            f"| Pathogenic | {vs.total_pathogenic} |\n"
            f"| Likely Pathogenic | {vs.total_likely_pathogenic} |\n"
            f"| VUS | {vs.total_vus} |\n"
            f"| Likely Benign | {vs.total_likely_benign} |\n"
            f"| Benign | {vs.total_benign} |\n"
        )

        if vs.variants:
            lines.append(
                "| Variant ID | HGVS Coding | Significance | Stars | AF |"
            )
            lines.append("|---|---|---|---|---|")
            for v in vs.variants[:30]:
                af = f"{v.allele_frequency:.2e}" if v.allele_frequency else "—"
                stars = "*" * v.review_stars if v.review_stars else "—"
                lines.append(
                    f"| `{v.variant_id}` | `{v.hgvs_coding or '—'}` | "
                    f"{v.clinical_significance} | {stars} | {af} |"
                )
            if len(vs.variants) > 30:
                lines.append(f"\n*Showing 30 of {len(vs.variants)} variants.*\n")
            lines.append("")

    if report.disease_associations:
        lines.append("## 3. Disease Associations\n")
        for da in report.disease_associations:
            lines.append(f"### {da.disease_name}")
            lines.append(f"- Pathogenic Variants: {da.pathogenic_variant_count}")
            if da.key_variants:
                lines.append(f"- Key Variants: {', '.join(da.key_variants[:5])}")
            lines.append("")

    if report.population_frequencies:
        lines.append("## 5. Population Frequency Analysis\n")
        lines.append("| Variant | HGVS | Max Pop | Max AF | Min Pop | Min AF |")
        lines.append("|---|---|---|---|---|---|")
        for pf in report.population_frequencies[:20]:
            lines.append(
                f"| `{pf.variant_id}` | `{pf.hgvs[:25]}` | {pf.max_population} | "
                f"{pf.max_af:.2e} | {pf.min_population} | {pf.min_af:.2e} |"
            )
        lines.append("")

    if report.protein_impact:
        pi = report.protein_impact
        lines.append("## 6. Protein Impact Analysis\n")
        if pi.domains:
            for d in pi.domains:
                count = pi.domain_variant_counts.get(f"{d.name} ({d.start}-{d.end})", 0)
                lines.append(f"- **{d.name}** (aa {d.start}-{d.end}): {count} variants")
        if pi.hotspot_regions:
            lines.append("\n**Hotspot Regions:**")
            for hs in pi.hotspot_regions:
                lines.append(f"- {hs}")
        lines.append("")

    if report.research_context:
        rc = report.research_context
        lines.append("## 7. Research Context\n")
        lines.append(f"- Publications (last 5 years): **{rc.total_publications_5yr}**\n")
        if rc.key_references:
            lines.append("**Key References:**\n")
            for ref in rc.key_references:
                lines.append(
                    f"- {ref.authors} ({ref.year}). *{ref.title}*. {ref.journal}. "
                    f"PMID: {ref.pmid}"
                )
        lines.append("")

    if report.methodology:
        meth = report.methodology
        lines.append("## 8. Methodology & Data Sources\n")
        lines.append(f"- **Genome Build:** {meth.genome_build}")
        lines.append(f"- **Access Date:** {meth.access_date}")
        lines.append("\n**Data Sources:**")
        for s, v in meth.data_sources.items():
            lines.append(f"- {s}: {v}")
        if meth.limitations:
            lines.append("\n**Limitations:**")
            for lim in meth.limitations:
                lines.append(f"- {lim}")
        lines.append("")

    lines.append("---")
    lines.append(f"\n*{report.disclaimer}*\n")

    return "\n".join(lines)
