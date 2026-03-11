# GeneXplor

A gene knowledge platform — search any human gene and get a comprehensive dashboard aggregating data from five major genomic databases.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ HomePage  │  │ GeneDashboard    │  │ UI Components │ │
│  │ (Search)  │  │ (7 sections +   │  │ GlassCard,    │ │
│  │           │  │  analytics)     │  │ GlowBadge...  │ │
│  └──────────┘  └──────────────────┘  └───────────────┘ │
│         │               │                               │
│         └───────┬───────┘                               │
│                 ▼                                        │
│          React Query (client cache)                      │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP/JSON
┌─────────────────▼───────────────────────────────────────┐
│                  Backend (FastAPI)                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Gene Aggregator Service                    │ │
│  │  ┌─────────┐ ┌───────┐ ┌───────┐ ┌─────┐ ┌─────┐│ │
│  │  │ Ensembl │ │UniProt│ │ClinVar│ │gnomAD│ │PubMed││ │
│  │  └────┬────┘ └───┬───┘ └───┬───┘ └──┬──┘ └──┬──┘│ │
│  └───────┼──────────┼────────┼────────┼────────┼────┘ │
│          ▼          ▼        ▼        ▼        ▼       │
│     ┌──────────┐  ┌──────────────┐                     │
│     │  Redis   │  │  PostgreSQL  │                     │
│     │ (cache)  │  │  (fallback)  │                     │
│     └──────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Gene Search** — Autocomplete suggestions, search history, keyboard shortcuts (Cmd/Ctrl+K)
- **Gene Dashboard** — Comprehensive view with 7+ data sections
- **Variant Analytics** — Interactive donut chart, allele frequency histogram, consequence type breakdown
- **Protein Visualization** — Interactive SVG lollipop chart mapping variants to protein domains
- **Variant Table** — Filterable, sortable, paginated clinical variant data (TanStack Table)
- **Disease Associations** — ClinVar-linked clinical conditions
- **Research Publications** — Latest PubMed articles with expandable abstracts
- **Dark/Light Mode** — Persistent theme toggle with smooth transitions
- **Loading Experience** — Full-screen loading page with per-source progress tracking

## Tech Stack

### Frontend
- React 19 + TypeScript (strict mode)
- Vite 7 (build + dev server)
- Tailwind CSS 4 (design system)
- Framer Motion (animations)
- Recharts (charts/visualizations)
- TanStack Query (data fetching + caching)
- TanStack Table (variant table)

### Backend
- FastAPI (async Python)
- SQLAlchemy 2.0 (async, mapped_column)
- Pydantic v2 (validation)
- Redis (24hr cache layer)
- PostgreSQL (persistent fallback cache)
- httpx + tenacity (resilient HTTP client)

### Infrastructure
- Docker Compose (4 services with health checks)

## Setup

### Prerequisites
- Docker & Docker Compose

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd GeneXplor

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up
```

The app will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Health**: http://localhost:8000/health

### Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check (DB, Redis) |
| GET | `/gene/{symbol}` | Full gene dashboard data |

### Example

```bash
curl http://localhost:8000/gene/TP53
```

Returns aggregated data from all 5 sources: gene info (Ensembl), protein data (UniProt), clinical variants (ClinVar), allele frequencies (gnomAD), and publications (PubMed).

## Data Sources

| Source | Data | URL |
|--------|------|-----|
| **Ensembl** | Gene coordinates, transcripts, biotype | https://rest.ensembl.org |
| **UniProt** | Protein info, domains, function | https://rest.uniprot.org |
| **ClinVar** | Clinical variants, disease associations | https://eutils.ncbi.nlm.nih.gov |
| **gnomAD** | Population allele frequencies | https://gnomad.broadinstitute.org |
| **PubMed** | Research literature | https://eutils.ncbi.nlm.nih.gov |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Focus search bar |
| `Escape` | Blur search / close dropdown |
| `Tab` | Navigate between sections |
| `Arrow keys` | Navigate autocomplete suggestions |

## Design System

Dark sci-fi genomics theme with:
- **Fonts**: Outfit (headings), Plus Jakarta Sans (body), JetBrains Mono (data)
- **Colors**: Deep space navy backgrounds, cyan/magenta/green/amber accents
- **Components**: Glass cards, glow badges, DNA helix animation, particle field
- **Animations**: Framer Motion with `prefers-reduced-motion` support

## License

MIT
