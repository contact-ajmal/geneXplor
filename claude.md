# CLAUDE.md

## Project: GeneXplor
Gene knowledge platform — search any human gene, get a comprehensive
dashboard aggregating data from Ensembl, ClinVar, gnomAD, UniProt, and PubMed.

## Design System — Ocean Depth

### Visual Identity — Professional Scientific Platform
- Light-first design (light primary, dark mode optional/secondary)
- Color palette:
  * Page background: #F0F4F8 (cool blue-gray)
  * Cards: #FFFFFF (white, clean)
  * Surface: #D9E2EC (blue-gray secondary)
  * Nav/Header: #243B53 (deep navy — only dark element)
  * Primary accent: #1B4965 (deep ocean blue)
  * Primary hover: #5294C4 (lighter blue)
  * Primary tint: #E6F0F6 (selected/active backgrounds)
  * Text heading: #102A43 (near-black navy)
  * Text body: #243B53 (deep navy)
  * Text secondary: #486581 (medium blue-gray)
  * Text muted: #829AB1 (light blue-gray)
  * Borders: #D9E2EC (default), #BCCCDC (hover), #829AB1 (strong)
  * Pathogenic: #D64045 | Likely Path: #E07A3A | VUS: #D4A843
  * Likely Benign: #5294C4 | Benign: #2B9F78
  * Success: #2B9F78 | Warning: #D4A843 | Error: #D64045

### Typography (UNCHANGED)
- Headlines: "Outfit" (Google Fonts)
- Body/UI text: "Plus Jakarta Sans"
- Scientific data / gene symbols / variant IDs: "JetBrains Mono"
- NEVER use Inter, Roboto, Arial, or system fonts

### Components
- Card: white bg, 1px #D9E2EC border, 12px radius, subtle shadow
- Badge: tint background + dark text from same color family
- Button: solid #1B4965 primary, white outlined secondary
- Inputs: white bg, #D9E2EC border, #1B4965 focus ring
- Tables: white bg, subtle alternating rows, #F0F4F8 hover
- Tabs: #E6F0F6 active bg, #1B4965 text + left border accent
- Toast: white card, colored left border, light shadow

### Animation (simplified)
- framer-motion for React animations
- Page transitions: fade (200ms)
- Cards: staggered fade-in (50ms delay)
- Numbers: count-up animation
- Hover: subtle shadow increase or 1px lift
- Loading: light shimmer skeleton
- All animations respect prefers-reduced-motion
- NO glow, NO particles, NO decode effects, NO neon

### Code Conventions
- Python: ruff linting, black formatting, type hints everywhere
- SQLAlchemy 2.0: mapped_column(), not Column()
- Pydantic v2: model_config dict, not inner Config class
- All backend I/O must be async
- React: functional components, TypeScript strict mode
- All API calls via centralized axios client with error interceptors
- All external API calls cached in Redis (TTL: 86400s / 24hr)

### Important Rules
- Never use placeholder/stub code — write real implementations
- Every file in the project structure must be created
- Docker services must have health checks
- Proper error handling with user-friendly messages for invalid gene queries
