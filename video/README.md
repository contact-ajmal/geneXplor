# GeneXplor Demo Video

Programmatic demo video built with [Remotion](https://www.remotion.dev/) — a React framework for creating videos in code.

## How It Works

1. **Capture screenshots** of the running app using Playwright
2. **Compose the video** in React — each scene displays a screenshot with animated titles, callout annotations, zoom effects, and transitions
3. **Render to MP4** at 1080p/30fps

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Start the GeneXplor app (in another terminal)
cd ../frontend && npm run dev
# or: cd .. && docker compose up

# 3. Capture all screenshots automatically
npm run capture

# 4. Preview the video in Remotion Studio
npm run studio

# 5. Render the final MP4
npm run render
# Output: out/demo.mp4
```

## Customizing

### Scene Configuration

Edit `src/scenes/config.ts` to:
- Reorder scenes
- Change duration per scene
- Add/remove callout annotations
- Set zoom targets for Ken Burns effects

### Adding a Scene

1. Capture the screenshot (or add to `scripts/capture-screenshots.mjs`)
2. Add a new entry to the `SCENES` array in `config.ts`
3. Preview in Studio

### Styling

- Colors/fonts: `src/theme.ts` (matches Ocean Depth design system)
- Background: `src/components/Background.tsx`
- Browser frame: `src/components/Screenshot.tsx`
- Title bar: `src/components/TitleCard.tsx`
- Callout pills: `src/components/Callout.tsx`

## Project Structure

```
video/
├── public/screenshots/     ← Captured app screenshots (auto-generated)
├── scripts/
│   └── capture-screenshots.mjs  ← Playwright screenshot automation
├── src/
│   ├── Root.tsx            ← Remotion composition registry
│   ├── GeneXplorDemo.tsx   ← Main video: sequences all scenes
│   ├── theme.ts            ← Ocean Depth color/font tokens
│   ├── scenes/
│   │   └── config.ts       ← Scene definitions (order, timing, callouts)
│   └── components/
│       ├── IntroScene.tsx   ← Animated intro (logo + data sources)
│       ├── OutroScene.tsx   ← Closing card (stats + CTA)
│       ├── FeatureScene.tsx ← Screenshot + title + callouts
│       ├── Screenshot.tsx   ← Browser frame + Ken Burns zoom
│       ├── TitleCard.tsx    ← Bottom title/subtitle bar
│       ├── Callout.tsx      ← Animated annotation pill
│       ├── SceneTransition.tsx ← Fade in/out wrapper
│       └── Background.tsx   ← Dark gradient + grid pattern
├── out/                    ← Rendered video output
└── package.json
```

## Tips

- **Render time**: ~2-5 minutes for the full ~2.5 min video
- **Add voiceover**: Place an audio file in `public/` and use Remotion's `<Audio>` component
- **Add background music**: Same approach — layer `<Audio volume={0.1}>` in `GeneXplorDemo.tsx`
- **Change resolution**: Edit `WIDTH`/`HEIGHT` in `Root.tsx`
- **Longer/shorter scenes**: Adjust `durationInSeconds` in `config.ts`
