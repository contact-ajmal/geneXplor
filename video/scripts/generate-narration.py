"""
Generate narration audio using Microsoft Edge TTS (free, natural voices).
Voice: en-US-GuyNeural (natural male voice)

Usage: /tmp/tts-env/bin/python scripts/generate-narration.py
"""

import asyncio
import os
import edge_tts

VOICE = "en-US-GuyNeural"
RATE = "-5%"  # slightly slower for clarity
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")

NARRATIONS = [
    (
        "intro",
        "GeneXplor. A comprehensive gene intelligence platform. "
        "Search any human gene, and get a complete dashboard — "
        "aggregating data from eight major genomics databases."
    ),
    (
        "homepage",
        "The home page is your starting point. "
        "Type any gene name, disease, variant, or chromosomal location. "
        "Suggestions appear instantly as you type. "
        "One click takes you to a full gene dashboard."
    ),
    (
        "homepage-sources",
        "Behind every search, GeneXplor queries eight databases at once. "
        "Ensembl for gene structure. ClinVar for clinical classifications. "
        "gnomAD for population frequencies. UniProt for protein data. "
        "PubMed for publications. AlphaFold for 3D structures. "
        "STRING for interactions. And Reactome for pathways."
    ),
    (
        "smart-search",
        "Smart search understands what you're looking for. "
        "Don't know the gene symbol? Search by disease name instead. "
        "Results are grouped by category — genes, aliases, diseases, or locations. "
        "Press Command K to search from any page."
    ),
    (
        "search-results",
        "Search results show each gene with its type, location, and match reasons — "
        "so you can see exactly why it appeared. "
        "Spelling corrections help if you make a typo."
    ),
    (
        "dashboard-overview",
        "Here's the BRCA1 dashboard. Everything known about this gene — in one place. "
        "You'll see the variant count, linked diseases, publication volume, "
        "and pathway memberships — all at a glance. "
        "An AI-generated summary explains what the gene does in plain language."
    ),
    (
        "variants",
        "The Variant Explorer shows every known variant for this gene. "
        "Filter by clinical significance — like pathogenic or benign. "
        "Filter by consequence type — like missense or frameshift. "
        "Click any row to see the full clinical picture."
    ),
    (
        "variant-detail",
        "The variant detail view shows clinical significance, HGVS notation, "
        "linked conditions, and allele frequency. "
        "You can simulate its biological impact step by step, "
        "or see how it distributes across world populations."
    ),
    (
        "variant-analytics",
        "Variant analytics gives you three views. "
        "How many variants are pathogenic versus benign? "
        "How common are they in the population? "
        "And which consequence types dominate?"
    ),
    (
        "protein-3d",
        "The 3D protein structure comes from AlphaFold. "
        "You can rotate, zoom, and explore the structure interactively. "
        "Switch to variant view to see pathogenic mutations highlighted in red. "
        "The domain map below shows functional regions like RING and BRCT."
    ),
    (
        "population-map",
        "The population map shows how common a variant is "
        "across nine world populations from gnomAD. "
        "Larger markers mean higher frequency. "
        "You can switch between variants to compare their global distribution."
    ),
    (
        "interactions",
        "The interaction network shows which proteins this gene works with. "
        "Adjust the confidence threshold to show only the strongest evidence. "
        "Click any partner protein to jump to its dashboard."
    ),
    (
        "pathways",
        "Biological pathways show which cellular processes this gene participates in. "
        "For BRCA1, that includes DNA repair, cell cycle regulation, "
        "and homologous recombination."
    ),
    (
        "timeline",
        "The discovery timeline shows when variants were classified over time, "
        "color-coded by significance. "
        "Drag the brush to zoom into a specific time period "
        "and see if discoveries are accelerating."
    ),
    (
        "publications",
        "The publications tab shows recent research papers with direct PubMed links. "
        "The Research Pulse card tracks whether this gene is getting "
        "more or less attention over time."
    ),
    (
        "diseases",
        "Disease associations show all conditions linked to this gene, "
        "with variant counts for each. "
        "For BRCA1, that includes breast cancer, ovarian cancer, and Fanconi anemia."
    ),
    (
        "reconciliation",
        "Cross-database reconciliation automatically flags variants "
        "where ClinVar and gnomAD disagree. "
        "For example — a variant classified as pathogenic, but common in the population. "
        "The concordance score tells you how consistent the data is overall."
    ),
    (
        "simulator",
        "The Variant Impact Simulator walks you through "
        "how a mutation affects biology. "
        "Step by step — from the mutated DNA base, through RNA and protein changes, "
        "to the clinical outcome. "
        "You can play, pause, and step through at your own pace."
    ),
    (
        "report",
        "Export your findings in any format. "
        "CSV for spreadsheets. PDF for reports. "
        "ACMG-formatted clinical reports for lab use. "
        "JSON and Markdown for technical workflows. "
        "Or share a direct link with colleagues."
    ),
    (
        "gene-story",
        "Gene Story mode presents the same data as a readable narrative. "
        "No jargon — plain-language chapters explain the gene's function, "
        "variant landscape, and disease connections. "
        "Great for students, patients, or sharing with non-specialist colleagues."
    ),
    (
        "compare",
        "Gene comparison puts two genes side by side. "
        "See how BRCA1 and TP53 differ in variant count, "
        "disease associations, and publication trends. "
        "Useful for panel design and differential analysis."
    ),
    (
        "trending",
        "The trending page shows which genes are gaining research momentum right now, "
        "based on publication activity. "
        "Filter by category — like oncology, cardiac, or neurological."
    ),
    (
        "watchlist",
        "The watchlist lets you save genes with personal notes and tags. "
        "Switch between card, table, and comparison views. "
        "Export your list as JSON to share with your team."
    ),
    (
        "outro",
        "GeneXplor. Eight data sources. Twelve analysis views. "
        "Five interactive visualizations. Six export formats. "
        "Your complete genomics research platform. "
        "Thanks for watching."
    ),
]


async def generate_all():
    os.makedirs(OUT_DIR, exist_ok=True)

    for scene_id, text in NARRATIONS:
        out_path = os.path.join(OUT_DIR, f"{scene_id}.mp3")
        print(f"🎙️  Generating {scene_id}...")

        communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
        await communicate.save(out_path)

        print(f"   ✅ {scene_id}.mp3")

    print(f"\n🎬  Done! {len(NARRATIONS)} audio files generated.")


asyncio.run(generate_all())
