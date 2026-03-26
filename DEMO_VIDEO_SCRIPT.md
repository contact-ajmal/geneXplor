# GeneXplor Demo Video Script

**Target length:** 8-10 minutes
**Resolution:** 1920x1080 (Full HD)
**Browser:** Chrome, zoom to 90% for best fit
**Font size in terminal:** 14px+

---

## Setup Before Recording

### Tools
- **Screen recorder:** OBS Studio (free) or ScreenFlow (Mac)
- **Microphone:** Any decent USB mic or AirPods — record in a quiet room
- **Browser:** Chrome, clear cache, disable extensions toolbar
- **URL bar:** Hide bookmarks bar (Cmd+Shift+B)
- **Notifications:** Turn on Do Not Disturb
- **Cursor:** Use a cursor highlighter (e.g., "Cursor Pro" or OBS cursor plugin)

### App Prep
1. Start backend + frontend (`docker compose up` or dev servers)
2. Open `http://localhost:5173` in Chrome
3. Pre-search a few genes so search history shows: TP53, BRCA1, EGFR
4. Add 3-4 genes to watchlist with notes/tags (TP53, BRCA1, EGFR, CFTR)
5. Keep a second tab ready at `/gene/TP53` so data is cached (faster transitions)

---

## Script

### INTRO (0:00 - 0:25)

**[Screen: Homepage, freshly loaded]**

> "GeneXplor is a genomics research platform that lets you search any human gene and instantly get a comprehensive dashboard — pulling data from Ensembl, ClinVar, gnomAD, UniProt, PubMed, AlphaFold, STRING, and Reactome, all in one place."

**Action:** Slowly scroll down the homepage to show the hero section and stats strip.

> "Let me walk you through everything it can do."

---

### SMART SEARCH (0:25 - 1:15)

**[Screen: Homepage, scroll back to top]**

> "The search bar supports genes, diseases, variants, and chromosomal locations — with real-time autocomplete."

**Action:** Click the search bar. Type `TP5` slowly — show autocomplete dropdown populating with categorized results (Gene, Alias, Gene Name).

> "Results are grouped by category — genes, aliases, gene names, diseases, locations. You can arrow-key through them."

**Action:** Press ArrowDown twice, then Enter to select TP53. Watch it navigate to the gene dashboard.

**Action:** Press browser back. Click search bar again. Type `breast cancer` — show disease category results appearing.

> "You can also search by disease name, and it shows matching genes."

**Action:** Press Escape. Show `Cmd+K` shortcut by pressing it — search focuses.

> "Cmd+K focuses search from anywhere."

---

### GENE DASHBOARD - OVERVIEW (1:15 - 2:15)

**[Screen: Navigate to /gene/TP53]**

> "Here's the TP53 dashboard. The header shows the gene symbol, full name, chromosomal location, biotype, and Ensembl ID."

**Action:** Point out the header card, aliases, and quick stats badges.

> "On the left, twelve analysis tabs. Let's start with the Overview."

**Action:** Hover over the overview stats cards — variants count, diseases, publications, pathways, interactions, reconciliation score. Let the CountUp animations play.

> "Each card summarizes a different data dimension — variants found in ClinVar, associated diseases, recent publications, known pathways, protein interactions, and a cross-database concordance score."

---

### VARIANTS TAB (2:15 - 3:15)

**Action:** Click "Variants" tab in sidebar.

> "The Variants tab shows every known variant for this gene — filterable by clinical significance and consequence type."

**Action:** Click the significance filter dropdown, select "Pathogenic". Show the table filtering.

> "You can filter to pathogenic variants only. Each row shows the variant ID, position, consequence, significance, allele frequency, and condition."

**Action:** Click on a row to open the Variant Detail Modal.

> "Clicking a variant opens a detail modal with three views — Details, Impact, and Population."

**Action:** Show the Details tab (HGVS codes, allele frequency, linked conditions). Click the "Impact" tab to show the Variant Impact Simulator auto-playing. Then click "Population" tab to show the embedded PopulationMap.

> "You get the full clinical picture — HGVS notation, allele frequencies, and you can simulate the variant's impact or see how it distributes across world populations."

**Action:** Close the modal.

---

### VARIANT ANALYTICS (3:15 - 3:45)

> "Scrolling down, the Variant Analytics panel shows three charts."

**Action:** Scroll down to VariantAnalytics section.

> "A donut chart of clinical significance distribution, an allele frequency spectrum histogram, and consequence types stacked by significance. You can click any significance slice to filter the table above."

**Action:** Click on the "Pathogenic" slice in the donut chart.

---

### PROTEIN TAB (3:45 - 4:30)

**Action:** Click "Protein" tab.

> "The Protein tab shows the 3D structure from AlphaFold, rendered with PDBe Molstar."

**Action:** Rotate the 3D structure by clicking and dragging. Toggle between "Confidence" and "Variants" view modes.

> "You can switch between confidence coloring — showing AlphaFold's prediction quality — and variant mode, which highlights clinically significant variant positions on the structure."

**Action:** Toggle to "Surface" representation. Then back to "Cartoon".

> "Below the viewer, a protein domain map shows where variants cluster across functional domains."

**Action:** Scroll down to show ProteinVariantMap and ProteinInfoCard.

---

### POPULATION TAB (4:30 - 5:00)

**Action:** Click "Population" tab.

> "The Population tab shows allele frequency distribution across nine global populations from gnomAD."

**Action:** Hover over map markers to show tooltips with population names and frequencies. Select a different variant from the dropdown.

> "Each marker's size and color represents the allele frequency. You can select different variants to compare their global distribution."

---

### INTERACTIONS & PATHWAYS (5:00 - 5:40)

**Action:** Click "Interactions" tab.

> "The Interaction Network is a force-directed graph showing protein-protein interactions from STRING."

**Action:** Drag nodes around. Adjust the confidence threshold slider. Toggle evidence type filters.

> "You can adjust the confidence threshold, filter by evidence type, and click any partner to jump to its dashboard."

**Action:** Click "Pathways" tab.

> "The Pathways tab shows biological pathway memberships from Reactome and KEGG — organized by category."

---

### TIMELINE & PUBLICATIONS (5:40 - 6:10)

**Action:** Click "Timeline" tab.

> "The Discovery Timeline shows when variants were classified over time — stacked by significance. The line shows cumulative discoveries."

**Action:** Drag the brush slider to zoom into the last 5 years.

**Action:** Click "Publications" tab.

> "Publications shows recent research papers from PubMed, plus a Research Pulse card tracking publication trends — whether research activity is rising or declining."

---

### DISEASES & RECONCILIATION (6:10 - 6:40)

**Action:** Click "Diseases" tab.

> "Disease Associations shows all linked conditions with their variant counts."

**Action:** Click "Reconciliation" tab.

> "The Reconciliation tab is unique — it cross-references ClinVar classifications against gnomAD population data to detect conflicts. For example, a variant classified as pathogenic in ClinVar but common in gnomAD is flagged."

**Action:** Point out the concordance score ring and the conflict breakdown chart.

---

### VARIANT IMPACT SIMULATOR (6:40 - 7:15)

**Action:** Click "Simulator" tab. Select a pathogenic variant.

> "The Variant Impact Simulator animates how a specific mutation flows through the central dogma — from DNA to RNA to protein to structure to function to clinical outcome."

**Action:** Click Play. Let it animate through stages. Use speed control (2x). Skip forward.

> "Each stage shows what changes — the mutated base, the altered codon, the amino acid substitution, and ultimately the clinical significance."

---

### REPORT & EXPORT (7:15 - 7:45)

**Action:** Click "Report" tab.

> "From the Report tab, you can export data in multiple formats — CSV, PDF, JSON, or Markdown."

**Action:** Click "Clinical Report". Show the ACMG report modal — select format, choose sections, click Generate.

> "The Clinical Report generator creates ACMG-formatted reports. You choose the format, filter variants by significance, and select which sections to include."

---

### GENE STORY MODE (7:45 - 8:15)

**Action:** Navigate to `/gene/TP53/story` (click "Gene Story" link if visible, or type URL).

> "Gene Story mode presents the same data as a narrative — a scrollable, plain-language story about the gene."

**Action:** Scroll through slowly — show chapters animating in, embedded visualizations, plain-language descriptions.

> "It translates scientific data into readable sections — what the gene does, its variant landscape, population distribution, and disease connections."

---

### COMPARE, TRENDING, WATCHLIST (8:15 - 9:15)

**Action:** Click "Compare" in navbar.

> "The Compare feature lets you put two genes side by side."

**Action:** Type `TP53` and `BRCA1`, click Compare. Show the comparison dashboard loading with side-by-side stats, variant charts, disease overlaps.

**Action:** Click "Trending" in navbar.

> "The Trending page tracks which genes have the most research momentum — based on recent publication activity."

**Action:** Show the Gene of the Day card. Click a category filter (e.g., Oncogenes).

**Action:** Click "Watchlist" in navbar.

> "The Watchlist lets you save genes for tracking. You can add notes, tags, switch between card and table views, and even bulk-compare."

**Action:** Show cards view, switch to table view, click a tag to filter, show the export button.

---

### CLOSING (9:15 - 9:30)

**Action:** Navigate back to homepage.

> "That's GeneXplor — eight integrated data sources, twelve analysis views, interactive visualizations, clinical reports, and a complete search engine — all in one platform."

**Action:** Hold on the homepage for 3 seconds.

> "Check it out at [your-url]. Thanks for watching."

---

## Post-Production Tips

1. **Trim dead air** — Cut any loading pauses longer than 2 seconds
2. **Speed up transitions** — 1.5x speed during page navigations
3. **Add subtle zoom** — Zoom into specific UI elements when describing them (post-edit)
4. **Background music** — Low, ambient electronic track at ~10% volume (try Artlist or YouTube Audio Library: search "tech ambient")
5. **Intro/Outro cards** — Simple title card: "GeneXplor — Genomics Research Platform" with the logo
6. **Thumbnail** — Screenshot of the TP53 dashboard with "GeneXplor Demo" text overlay
7. **YouTube description** — Include timestamps for each section (copy the section headers + timestamps above)

## YouTube Timestamps (copy-paste for description)

```
0:00 Introduction
0:25 Smart Search & Autocomplete
1:15 Gene Dashboard Overview
2:15 Variant Explorer & Filters
3:15 Variant Analytics Charts
3:45 3D Protein Structure
4:30 Population Frequencies Map
5:00 Interaction Network & Pathways
5:40 Discovery Timeline & Publications
6:10 Disease Associations & Reconciliation
6:40 Variant Impact Simulator
7:15 Clinical Report Generator
7:45 Gene Story Mode
8:15 Compare, Trending & Watchlist
9:15 Closing
```
