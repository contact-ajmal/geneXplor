"""Clinical Report Generator — assembles structured ACMG-style report data."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.schemas.gene_schema import (
    ClinicalReportResponse,
    GeneDashboardResponse,
    ReportClinicalMetrics,
    ReportDiseaseBlock,
    ReportGeneSummary,
    ReportMethodology,
    ReportPopulationFreqEntry,
    ReportProteinImpact,
    ReportResearchContext,
    ReportVariantEntry,
    ReportVariantSummary,
)

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "FOR RESEARCH USE ONLY. This report is auto-generated from public databases "
    "and has not been reviewed by a certified clinical geneticist. Not intended "
    "for clinical decision-making or diagnostic use. Variants should be "
    "independently verified before clinical use."
)

# Review status → star count mapping
REVIEW_STARS: dict[str, int] = {
    "practice guideline": 4,
    "reviewed by expert panel": 3,
    "criteria provided, multiple submitters, no conflicts": 2,
    "criteria provided, single submitter": 1,
    "criteria provided, conflicting classifications": 1,
    "no assertion criteria provided": 0,
    "no classification provided": 0,
}

PATHOGENIC_TERMS = {"pathogenic", "pathogenic/likely pathogenic"}
LP_TERMS = {"likely pathogenic"}
VUS_TERMS = {"uncertain significance"}
LB_TERMS = {"likely benign"}
BENIGN_TERMS = {"benign", "benign/likely benign"}


def _classify(sig: str) -> str:
    sig_lower = sig.lower().strip()
    if sig_lower in PATHOGENIC_TERMS:
        return "pathogenic"
    if sig_lower in LP_TERMS:
        return "likely_pathogenic"
    if sig_lower in VUS_TERMS:
        return "vus"
    if sig_lower in LB_TERMS:
        return "likely_benign"
    if sig_lower in BENIGN_TERMS:
        return "benign"
    return "other"


def generate_clinical_report(
    dashboard: GeneDashboardResponse,
    sections: dict[str, bool] | None = None,
    variant_filter: str = "all",
) -> ClinicalReportResponse:
    """Build a structured clinical report from dashboard data."""
    now = datetime.now(timezone.utc).isoformat()

    default_sections = {
        "gene_summary": True,
        "variant_summary": True,
        "disease_associations": True,
        "variant_classification": True,
        "population_frequencies": True,
        "protein_impact": True,
        "research_context": True,
        "methodology": True,
    }
    if sections:
        default_sections.update(sections)

    gene = dashboard.gene
    protein = dashboard.protein
    variants_data = dashboard.variants
    gnomad_data = dashboard.allele_frequencies
    publications = dashboard.publications

    # Build gnomAD lookup
    gnomad_map: dict[str, object] = {}
    if gnomad_data:
        for gv in gnomad_data.variants:
            gnomad_map[gv.variant_id] = gv

    # ── Filter variants ──
    all_clinvar = variants_data.variants if variants_data else []
    if variant_filter == "pathogenic_lp":
        filtered = [
            v for v in all_clinvar
            if _classify(v.clinical_significance) in ("pathogenic", "likely_pathogenic")
        ]
    elif variant_filter == "pathogenic_lp_vus":
        filtered = [
            v for v in all_clinvar
            if _classify(v.clinical_significance)
            in ("pathogenic", "likely_pathogenic", "vus")
        ]
    else:
        filtered = list(all_clinvar)

    # Sort by significance then variant_id
    sig_order = {"pathogenic": 0, "likely_pathogenic": 1, "vus": 2, "likely_benign": 3, "benign": 4, "other": 5}
    filtered.sort(key=lambda v: (sig_order.get(_classify(v.clinical_significance), 5), v.variant_id))

    # ── SECTION 1: Gene Summary ──
    gene_summary = None
    if default_sections.get("gene_summary") and gene:
        gene_summary = ReportGeneSummary(
            gene_symbol=gene.gene_symbol,
            gene_name=gene.gene_name,
            aliases=protein.gene_names if protein else [],
            chromosome=gene.chromosome,
            cytogenetic_band=f"{gene.chromosome}",
            coordinates=f"chr{gene.chromosome}:{gene.start:,}-{gene.end:,}",
            ensembl_id=gene.ensembl_id,
            function_summary=protein.function_description if protein else gene.description,
        )

    # ── SECTION 2: Variant Summary Table ──
    variant_summary = None
    if default_sections.get("variant_summary"):
        entries: list[ReportVariantEntry] = []
        counts = {"pathogenic": 0, "likely_pathogenic": 0, "vus": 0, "benign": 0, "likely_benign": 0}

        for cv in filtered:
            gv = gnomad_map.get(cv.variant_id)
            cat = _classify(cv.clinical_significance)
            if cat in counts:
                counts[cat] += 1

            entry = ReportVariantEntry(
                variant_id=cv.variant_id,
                hgvs_coding=gv.hgvsc if gv else "",
                hgvs_protein=gv.hgvsp if gv else "",
                variant_type=cv.variant_type,
                consequence=gv.consequence if gv else "",
                clinical_significance=cv.clinical_significance,
                review_status=cv.review_status,
                review_stars=REVIEW_STARS.get(cv.review_status.lower().strip(), 0),
                allele_frequency=gv.allele_frequency if gv else None,
                conditions=[cv.condition] if cv.condition else [],
            )
            entries.append(entry)

        variant_summary = ReportVariantSummary(
            variants=entries,
            total_pathogenic=counts["pathogenic"],
            total_likely_pathogenic=counts["likely_pathogenic"],
            total_vus=counts["vus"],
            total_benign=counts["benign"],
            total_likely_benign=counts["likely_benign"],
        )

    # ── SECTION 3: Disease Associations ──
    disease_blocks: list[ReportDiseaseBlock] = []
    if default_sections.get("disease_associations") and variants_data:
        for disease in variants_data.diseases:
            # Count pathogenic variants for this disease
            path_count = 0
            key_vars: list[str] = []
            for vid in disease.associated_variants:
                matching = [v for v in all_clinvar if v.variant_id == vid]
                if matching:
                    cat = _classify(matching[0].clinical_significance)
                    if cat in ("pathogenic", "likely_pathogenic"):
                        path_count += 1
                        if len(key_vars) < 5:
                            key_vars.append(matching[0].title or vid)

            disease_blocks.append(
                ReportDiseaseBlock(
                    disease_name=disease.disease_name,
                    pathogenic_variant_count=path_count,
                    key_variants=key_vars,
                )
            )

    # ── SECTION 5: Population Frequencies ──
    pop_freq_entries: list[ReportPopulationFreqEntry] = []
    if default_sections.get("population_frequencies") and gnomad_data:
        for gv in gnomad_data.variants[:50]:  # Top 50
            if not gv.population_frequencies:
                continue
            pops = {pf.population: pf.af for pf in gv.population_frequencies}
            if not pops:
                continue
            max_pop = max(pops, key=pops.get)  # type: ignore[arg-type]
            min_pop = min(pops, key=pops.get)  # type: ignore[arg-type]
            pop_freq_entries.append(
                ReportPopulationFreqEntry(
                    variant_id=gv.variant_id,
                    hgvs=gv.hgvsp or gv.hgvsc or gv.variant_id,
                    populations=pops,
                    max_population=max_pop,
                    max_af=pops[max_pop],
                    min_population=min_pop,
                    min_af=pops[min_pop],
                )
            )

    # ── SECTION 6: Protein Impact ──
    protein_impact = None
    if default_sections.get("protein_impact") and protein:
        domain_counts: dict[str, int] = {}
        hotspots: list[str] = []

        if gnomad_data:
            for gv in gnomad_data.variants:
                if not gv.hgvsp:
                    continue
                pos = gv.position
                for domain in protein.domains:
                    if domain.start <= pos <= domain.end:
                        key = f"{domain.name} ({domain.start}-{domain.end})"
                        domain_counts[key] = domain_counts.get(key, 0) + 1

        # Identify hotspots (domains with >5 variants)
        for domain_key, count in domain_counts.items():
            if count > 5:
                hotspots.append(f"{domain_key}: {count} variants")

        protein_impact = ReportProteinImpact(
            domains=protein.domains,
            domain_variant_counts=domain_counts,
            hotspot_regions=hotspots,
        )

    # ── SECTION 7: Research Context ──
    research_context = None
    if default_sections.get("research_context") and publications:
        # Get articles from last 5 years
        current_year = datetime.now(timezone.utc).year
        recent = [
            a for a in publications.articles
            if a.year.isdigit() and int(a.year) >= current_year - 5
        ]
        research_context = ReportResearchContext(
            total_publications_5yr=len(recent),
            key_references=publications.articles[:5],
        )

    # ── SECTION 8: Methodology ──
    methodology = None
    if default_sections.get("methodology"):
        methodology = ReportMethodology(
            data_sources={
                "Ensembl": "REST API v16",
                "ClinVar": "NCBI E-utilities",
                "gnomAD": "GraphQL API v4",
                "UniProt": "REST API 2024",
                "PubMed": "NCBI E-utilities",
            },
            genome_build="GRCh38",
            access_date=now[:10],
            filtering_criteria=[
                f"Variant filter: {variant_filter}",
                "Data cached for up to 24 hours",
            ],
            limitations=[
                "Variant classifications reflect ClinVar submitter assertions",
                "Population frequencies may not represent all global populations",
                "Not all variants have ACMG evidence codes available",
                "Report generated from cached data — may not reflect latest submissions",
            ],
        )

    # ── Clinical Metrics ──
    total = len(all_clinvar)
    path_count = sum(1 for v in all_clinvar if _classify(v.clinical_significance) == "pathogenic")
    lp_count = sum(1 for v in all_clinvar if _classify(v.clinical_significance) == "likely_pathogenic")
    vus_count = sum(1 for v in all_clinvar if _classify(v.clinical_significance) == "vus")
    combined_path = path_count + lp_count

    clinical_metrics = ReportClinicalMetrics(
        pathogenic_variant_burden=round(combined_path / total * 100, 1) if total > 0 else 0.0,
        vus_to_pathogenic_ratio=(
            round(vus_count / combined_path, 2) if combined_path > 0 else 0.0
        ),
        total_variants_analyzed=total,
    )

    return ClinicalReportResponse(
        gene_symbol=dashboard.gene_symbol,
        generated_at=now,
        report_sections=default_sections,
        variant_filter=variant_filter,
        gene_summary=gene_summary,
        variant_summary=variant_summary,
        disease_associations=disease_blocks,
        population_frequencies=pop_freq_entries,
        protein_impact=protein_impact,
        research_context=research_context,
        methodology=methodology,
        clinical_metrics=clinical_metrics,
        disclaimer=DISCLAIMER,
    )
