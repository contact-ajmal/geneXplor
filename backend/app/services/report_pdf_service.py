"""PDF generation for clinical reports using ReportLab."""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.gene_schema import ClinicalReportResponse

logger = logging.getLogger(__name__)

# ── Colors ──
DARK_BG = colors.HexColor("#0a0e1a")
PANEL_BG = colors.HexColor("#141b2d")
CYAN = colors.HexColor("#00d4ff")
MAGENTA = colors.HexColor("#ff3366")
GREEN = colors.HexColor("#00ff88")
AMBER = colors.HexColor("#ffaa00")
TEXT_PRIMARY = colors.HexColor("#e2e8f0")
TEXT_SECONDARY = colors.HexColor("#94a3b8")
TEXT_MUTED = colors.HexColor("#64748b")
TABLE_HEADER_BG = colors.HexColor("#1a2332")
TABLE_ROW_ALT = colors.HexColor("#0f1628")
BORDER_COLOR = colors.HexColor("#1e293b")

# Print-safe significance colors
SIG_COLORS = {
    "pathogenic": colors.HexColor("#dc2626"),
    "likely pathogenic": colors.HexColor("#ea580c"),
    "pathogenic/likely pathogenic": colors.HexColor("#dc2626"),
    "uncertain significance": colors.HexColor("#d97706"),
    "likely benign": colors.HexColor("#059669"),
    "benign": colors.HexColor("#10b981"),
    "benign/likely benign": colors.HexColor("#10b981"),
}

WIDTH, HEIGHT = A4
MARGIN = 20 * mm


def _get_styles() -> dict[str, ParagraphStyle]:
    """Create custom paragraph styles."""
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=36,
            textColor=CYAN,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=14,
            textColor=TEXT_PRIMARY,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "cover_info": ParagraphStyle(
            "CoverInfo",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=TEXT_SECONDARY,
            alignment=TA_CENTER,
            spaceAfter=3,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=CYAN,
            spaceBefore=16,
            spaceAfter=8,
            borderPadding=(0, 0, 4, 0),
        ),
        "subsection": ParagraphStyle(
            "Subsection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=TEXT_PRIMARY,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=TEXT_PRIMARY,
            spaceAfter=4,
            leading=13,
        ),
        "body_small": ParagraphStyle(
            "BodySmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=TEXT_SECONDARY,
            spaceAfter=2,
            leading=10,
        ),
        "mono": ParagraphStyle(
            "Mono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=8,
            textColor=TEXT_PRIMARY,
            spaceAfter=2,
        ),
        "disclaimer": ParagraphStyle(
            "Disclaimer",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            textColor=MAGENTA,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "toc_entry": ParagraphStyle(
            "TOCEntry",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            textColor=TEXT_PRIMARY,
            spaceBefore=6,
            spaceAfter=6,
            leftIndent=20,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            textColor=CYAN,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            textColor=TEXT_PRIMARY,
            leading=9,
        ),
        "table_cell_mono": ParagraphStyle(
            "TableCellMono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=6.5,
            textColor=TEXT_PRIMARY,
            leading=8.5,
        ),
        "metric_value": ParagraphStyle(
            "MetricValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=20,
            textColor=CYAN,
            alignment=TA_CENTER,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=TEXT_SECONDARY,
            alignment=TA_CENTER,
        ),
    }


def _add_watermark(canvas: object, doc: object) -> None:
    """Add watermark and footer to every content page."""
    c = canvas  # type: ignore[assignment]
    c.saveState()

    # Background
    c.setFillColor(DARK_BG)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    # Watermark
    c.setFillColor(colors.HexColor("#1a2332"))
    c.setFont("Helvetica-Bold", 40)
    c.saveState()
    c.translate(WIDTH / 2, HEIGHT / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, "FOR RESEARCH USE ONLY")
    c.restoreState()

    # Footer
    c.setFont("Helvetica", 6)
    c.setFillColor(TEXT_MUTED)
    c.drawString(
        MARGIN,
        12 * mm,
        "FOR RESEARCH USE ONLY — Not for clinical diagnosis",
    )
    c.drawRightString(
        WIDTH - MARGIN,
        12 * mm,
        f"Page {doc.page}",  # type: ignore[attr-defined]
    )
    c.drawCentredString(
        WIDTH / 2,
        12 * mm,
        f"Generated by GeneXplor | {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
    )

    c.restoreState()


def _cover_page(canvas: object, doc: object) -> None:
    """Draw the cover page background."""
    c = canvas  # type: ignore[assignment]
    c.saveState()

    # Background
    c.setFillColor(DARK_BG)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    # Decorative border
    c.setStrokeColor(CYAN)
    c.setLineWidth(0.5)
    c.rect(MARGIN - 5, MARGIN - 5, WIDTH - 2 * MARGIN + 10, HEIGHT - 2 * MARGIN + 10, fill=0)

    # Footer disclaimer
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(MAGENTA)
    c.drawCentredString(
        WIDTH / 2,
        15 * mm,
        "FOR RESEARCH USE ONLY — Not intended for clinical decision-making or diagnostic use",
    )

    c.restoreState()


def _sig_color_tag(sig: str) -> str:
    """Return a font color tag for a significance level."""
    color = SIG_COLORS.get(sig.lower().strip(), TEXT_PRIMARY)
    hex_val = f"#{int(color.red*255):02x}{int(color.green*255):02x}{int(color.blue*255):02x}"
    return f'<font color="{hex_val}">{sig}</font>'


def generate_report_pdf(report: ClinicalReportResponse) -> bytes:
    """Generate a professional clinical report PDF."""
    buf = io.BytesIO()
    styles = _get_styles()

    content_frame = Frame(
        MARGIN, MARGIN + 5 * mm, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN - 5 * mm,
        id="content",
    )
    cover_frame = Frame(
        MARGIN, MARGIN + 5 * mm, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN - 5 * mm,
        id="cover",
    )

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN + 5 * mm,
    )

    cover_template = PageTemplate(id="cover", frames=[cover_frame], onPage=_cover_page)
    content_template = PageTemplate(id="content", frames=[content_frame], onPage=_add_watermark)
    doc.addPageTemplates([cover_template, content_template])

    story: list[object] = []

    # ══════════════════════════════════════════
    # COVER PAGE
    # ══════════════════════════════════════════
    story.append(Spacer(1, 60))
    story.append(Paragraph("GeneXplor", styles["cover_info"]))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Clinical Gene Report", styles["cover_subtitle"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph(report.gene_symbol, styles["cover_title"]))

    if report.gene_summary:
        story.append(Spacer(1, 6))
        story.append(Paragraph(report.gene_summary.gene_name, styles["cover_subtitle"]))
        story.append(Spacer(1, 10))
        story.append(Paragraph(report.gene_summary.coordinates, styles["cover_info"]))

    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            f"Report Date: {report.generated_at[:10]}",
            styles["cover_info"],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            f"Variant Filter: {report.variant_filter.replace('_', ' ').title()}",
            styles["cover_info"],
        )
    )

    # Clinical metrics on cover
    if report.clinical_metrics:
        story.append(Spacer(1, 30))
        metrics = report.clinical_metrics
        metric_data = [
            [
                Paragraph(str(metrics.total_variants_analyzed), styles["metric_value"]),
                Paragraph(f"{metrics.pathogenic_variant_burden}%", styles["metric_value"]),
                Paragraph(str(metrics.vus_to_pathogenic_ratio), styles["metric_value"]),
            ],
            [
                Paragraph("Total Variants", styles["metric_label"]),
                Paragraph("Pathogenic Burden", styles["metric_label"]),
                Paragraph("VUS:Path Ratio", styles["metric_label"]),
            ],
        ]
        metric_table = Table(metric_data, colWidths=[(WIDTH - 2 * MARGIN) / 3] * 3)
        metric_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
            ])
        )
        story.append(metric_table)

    story.append(Spacer(1, 30))
    story.append(Paragraph(report.disclaimer, styles["disclaimer"]))

    # Switch to content template
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())

    # ══════════════════════════════════════════
    # TABLE OF CONTENTS
    # ══════════════════════════════════════════
    story.append(Paragraph("Table of Contents", styles["section_heading"]))
    story.append(Spacer(1, 10))

    toc_items = []
    if report.gene_summary:
        toc_items.append("1. Gene Summary")
    if report.variant_summary:
        toc_items.append("2. Variant Summary")
    if report.disease_associations:
        toc_items.append("3. Disease Associations")
    if report.variant_summary and report.variant_summary.variants:
        toc_items.append("4. Variant Classification Details")
    if report.population_frequencies:
        toc_items.append("5. Population Frequency Analysis")
    if report.protein_impact:
        toc_items.append("6. Protein Impact Analysis")
    if report.research_context:
        toc_items.append("7. Research Context")
    if report.methodology:
        toc_items.append("8. Methodology & Data Sources")

    for item in toc_items:
        story.append(Paragraph(item, styles["toc_entry"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 1: Gene Summary
    # ══════════════════════════════════════════
    if report.gene_summary:
        gs = report.gene_summary
        story.append(Paragraph("1. Gene Summary", styles["section_heading"]))

        info_rows = [
            ["Gene Symbol:", gs.gene_symbol],
            ["Full Name:", gs.gene_name],
            ["Chromosome:", gs.chromosome],
            ["Coordinates:", gs.coordinates],
            ["Ensembl ID:", gs.ensembl_id],
        ]
        if gs.aliases:
            info_rows.append(["Aliases:", ", ".join(gs.aliases[:5])])

        info_data = [
            [
                Paragraph(row[0], styles["body_small"]),
                Paragraph(str(row[1]), styles["body"]),
            ]
            for row in info_rows
        ]

        info_table = Table(info_data, colWidths=[90, WIDTH - 2 * MARGIN - 100])
        info_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
            ])
        )
        story.append(info_table)

        if gs.function_summary:
            story.append(Spacer(1, 8))
            story.append(Paragraph("Function:", styles["subsection"]))
            # Truncate very long descriptions
            desc = gs.function_summary[:800]
            story.append(Paragraph(desc, styles["body"]))

        story.append(Spacer(1, 12))

    # ══════════════════════════════════════════
    # SECTION 2: Variant Summary Table
    # ══════════════════════════════════════════
    if report.variant_summary:
        vs = report.variant_summary
        story.append(Paragraph("2. Variant Summary", styles["section_heading"]))

        # Classification counts
        counts_text = (
            f"Pathogenic: {vs.total_pathogenic} | "
            f"Likely Pathogenic: {vs.total_likely_pathogenic} | "
            f"VUS: {vs.total_vus} | "
            f"Likely Benign: {vs.total_likely_benign} | "
            f"Benign: {vs.total_benign}"
        )
        story.append(Paragraph(counts_text, styles["body"]))
        story.append(Spacer(1, 8))

        # Variant table (show max 50)
        display_variants = vs.variants[:50]
        if display_variants:
            header = [
                Paragraph("Variant ID", styles["table_header"]),
                Paragraph("HGVS Coding", styles["table_header"]),
                Paragraph("HGVS Protein", styles["table_header"]),
                Paragraph("Type", styles["table_header"]),
                Paragraph("Significance", styles["table_header"]),
                Paragraph("Stars", styles["table_header"]),
                Paragraph("AF", styles["table_header"]),
            ]
            col_widths = [65, 80, 75, 55, 75, 30, 50]

            table_data = [header]
            for v in display_variants:
                af_str = f"{v.allele_frequency:.2e}" if v.allele_frequency else "—"
                sig_cell = Paragraph(
                    _sig_color_tag(v.clinical_significance),
                    styles["table_cell"],
                )
                table_data.append([
                    Paragraph(v.variant_id, styles["table_cell_mono"]),
                    Paragraph(v.hgvs_coding[:25] if v.hgvs_coding else "—", styles["table_cell_mono"]),
                    Paragraph(v.hgvs_protein[:20] if v.hgvs_protein else "—", styles["table_cell_mono"]),
                    Paragraph(v.variant_type[:15] if v.variant_type else "—", styles["table_cell"]),
                    sig_cell,
                    Paragraph("*" * v.review_stars if v.review_stars else "—", styles["table_cell"]),
                    Paragraph(af_str, styles["table_cell_mono"]),
                ])

            var_table = Table(table_data, colWidths=col_widths, repeatRows=1)
            var_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
                    ("TEXTCOLOR", (0, 0), (-1, 0), CYAN),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [DARK_BG, TABLE_ROW_ALT]),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ])
            )
            story.append(var_table)

            if len(vs.variants) > 50:
                story.append(Spacer(1, 4))
                story.append(
                    Paragraph(
                        f"Showing 50 of {len(vs.variants)} variants. See JSON export for full data.",
                        styles["body_small"],
                    )
                )

        story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 3: Disease Associations
    # ══════════════════════════════════════════
    if report.disease_associations:
        story.append(Paragraph("3. Disease Associations", styles["section_heading"]))

        for da in report.disease_associations:
            story.append(Paragraph(da.disease_name, styles["subsection"]))
            story.append(
                Paragraph(
                    f"Pathogenic variants: {da.pathogenic_variant_count}",
                    styles["body"],
                )
            )
            if da.key_variants:
                story.append(
                    Paragraph(
                        f"Key variants: {', '.join(da.key_variants[:5])}",
                        styles["body_small"],
                    )
                )
            story.append(Spacer(1, 6))

        story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 5: Population Frequencies
    # ══════════════════════════════════════════
    if report.population_frequencies:
        story.append(Paragraph("5. Population Frequency Analysis", styles["section_heading"]))

        display_pf = report.population_frequencies[:20]
        header = [
            Paragraph("Variant", styles["table_header"]),
            Paragraph("HGVS", styles["table_header"]),
            Paragraph("Max Pop", styles["table_header"]),
            Paragraph("Max AF", styles["table_header"]),
            Paragraph("Min Pop", styles["table_header"]),
            Paragraph("Min AF", styles["table_header"]),
        ]
        pf_data = [header]
        for pf in display_pf:
            pf_data.append([
                Paragraph(pf.variant_id, styles["table_cell_mono"]),
                Paragraph(pf.hgvs[:25], styles["table_cell_mono"]),
                Paragraph(pf.max_population, styles["table_cell"]),
                Paragraph(f"{pf.max_af:.2e}", styles["table_cell_mono"]),
                Paragraph(pf.min_population, styles["table_cell"]),
                Paragraph(f"{pf.min_af:.2e}", styles["table_cell_mono"]),
            ])

        pf_table = Table(pf_data, colWidths=[70, 90, 55, 60, 55, 60], repeatRows=1)
        pf_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [DARK_BG, TABLE_ROW_ALT]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ])
        )
        story.append(pf_table)
        story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 6: Protein Impact
    # ══════════════════════════════════════════
    if report.protein_impact:
        pi = report.protein_impact
        story.append(Paragraph("6. Protein Impact Analysis", styles["section_heading"]))

        if pi.domains:
            story.append(Paragraph("Protein Domains:", styles["subsection"]))
            for d in pi.domains:
                count = pi.domain_variant_counts.get(f"{d.name} ({d.start}-{d.end})", 0)
                story.append(
                    Paragraph(
                        f"{d.name} (aa {d.start}-{d.end}): {count} variants",
                        styles["body"],
                    )
                )

        if pi.hotspot_regions:
            story.append(Spacer(1, 8))
            story.append(Paragraph("Variant Hotspots:", styles["subsection"]))
            for hs in pi.hotspot_regions:
                story.append(Paragraph(f"  {hs}", styles["body"]))

        story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 7: Research Context
    # ══════════════════════════════════════════
    if report.research_context:
        rc = report.research_context
        story.append(Paragraph("7. Research Context", styles["section_heading"]))
        story.append(
            Paragraph(
                f"Publications in last 5 years: {rc.total_publications_5yr}",
                styles["body"],
            )
        )

        if rc.key_references:
            story.append(Spacer(1, 8))
            story.append(Paragraph("Key References:", styles["subsection"]))
            for ref in rc.key_references:
                story.append(
                    Paragraph(
                        f"{ref.authors} ({ref.year}). {ref.title}. <i>{ref.journal}</i>. "
                        f"PMID: {ref.pmid}",
                        styles["body_small"],
                    )
                )
                story.append(Spacer(1, 3))

        story.append(PageBreak())

    # ══════════════════════════════════════════
    # SECTION 8: Methodology
    # ══════════════════════════════════════════
    if report.methodology:
        meth = report.methodology
        story.append(Paragraph("8. Methodology & Data Sources", styles["section_heading"]))

        story.append(Paragraph(f"Genome Build: {meth.genome_build}", styles["body"]))
        story.append(Paragraph(f"Data Access Date: {meth.access_date}", styles["body"]))
        story.append(Spacer(1, 6))

        story.append(Paragraph("Data Sources:", styles["subsection"]))
        for source, version in meth.data_sources.items():
            story.append(Paragraph(f"  {source}: {version}", styles["body"]))

        if meth.filtering_criteria:
            story.append(Spacer(1, 6))
            story.append(Paragraph("Filtering Criteria:", styles["subsection"]))
            for fc in meth.filtering_criteria:
                story.append(Paragraph(f"  {fc}", styles["body"]))

        if meth.limitations:
            story.append(Spacer(1, 6))
            story.append(Paragraph("Limitations:", styles["subsection"]))
            for lim in meth.limitations:
                story.append(Paragraph(f"  {lim}", styles["body"]))

        story.append(Spacer(1, 20))

    # ── Final disclaimer page ──
    story.append(Spacer(1, 30))
    story.append(Paragraph("Disclaimer", styles["section_heading"]))
    story.append(Spacer(1, 10))
    disclaimer_lines = [
        "FOR RESEARCH USE ONLY",
        "",
        "This report is auto-generated from public databases and has not been "
        "reviewed by a certified clinical geneticist.",
        "",
        "Not intended for clinical decision-making or diagnostic use.",
        "",
        "Variants should be independently verified before clinical use.",
        "",
    ]
    if report.methodology:
        sources = ", ".join(report.methodology.data_sources.keys())
        disclaimer_lines.append(
            f"Data sourced from: {sources} (accessed {report.methodology.access_date})"
        )

    for line in disclaimer_lines:
        if line:
            story.append(Paragraph(line, styles["disclaimer"]))
        else:
            story.append(Spacer(1, 6))

    doc.build(story)
    return buf.getvalue()
