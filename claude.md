# CLAUDE.md

## Project: GeneXplor
Gene knowledge platform — search any human gene, get a comprehensive
dashboard aggregating data from Ensembl, ClinVar, gnomAD, UniProt, and PubMed.

## Design System (MUST MATCH GeneMapr)

### Visual Identity — Dark Sci-Fi Genomics
- Primary dark theme (dark-first, light mode secondary)
- Color palette:
  * Background: #0a0e1a (deep space navy), #0f1628 (panels)
  * Surface: #141b2d (cards), #1a2332 (elevated)
  * DNA Cyan accent: #00d4ff (primary interactive)
  * DNA Magenta accent: #ff3366 (alerts/critical findings)
  * Helix Green: #00ff88 (benign/success)
  * Amber Warning: #ffaa00 (caution)
  * Text Primary: #e2e8f0, Secondary: #94a3b8
  * Subtle glow: rgba(0, 212, 255, 0.1) for hover states

### Typography
- Headlines: "Outfit" (Google Fonts)
- Body/UI text: "Plus Jakarta Sans"
- Scientific data / gene symbols / variant IDs: "JetBrains Mono"
- NEVER use Inter, Roboto, Arial, or system fonts

### Components
- GlassCard: bg rgba(20, 27, 45, 0.7) + backdrop-blur-xl + subtle cyan border
- AnimatedButton: gradient bg with glow hover
- GlowBadge: colored pill with pulsing glow
- DecodeText: characters cycle before resolving (DNA decoding effect)
- DNA Helix animated background (subtle, CSS-only)
- Particle field (CSS @keyframes, low opacity)

### Animation
- framer-motion for all React animations
- Page transitions: fade + slide (200ms)
- Cards: staggered reveal (50ms delay between)
- Numbers: count-up animation
- Data loading: "decode" shimmer effect (not gray pulse)
- Hover: subtle glow increase
- All animations respect prefers-reduced-motion

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
