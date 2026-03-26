/**
 * Automated screenshot capture for the GeneXplor demo video.
 *
 * Usage:
 *   npm run capture
 *   — or —
 *   BASE_URL=http://localhost:3000 node scripts/capture-screenshots.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const VIEWPORT = { width: 1920, height: 1080 };
const GENE = 'BRCA1';

/** Wait for network to settle */
async function waitForIdle(page, ms = 2000) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Scroll to bottom to trigger lazy elements, then scroll back */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 400) {
      window.scrollTo(0, y);
      await delay(100);
    }
    window.scrollTo(0, 0);
    await delay(300);
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Seed search history and watchlist
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem(
      'genexplor-search-history',
      JSON.stringify(['BRCA1', 'TP53', 'EGFR', 'CFTR'])
    );
    localStorage.setItem(
      'genexplor-watchlist',
      JSON.stringify([
        { symbol: 'BRCA1', note: 'Breast/ovarian cancer risk — BRCA1/2 panel', tags: ['oncology', 'hereditary', 'priority'], addedAt: Date.now() },
        { symbol: 'TP53', note: 'Key tumor suppressor — Li-Fraumeni syndrome', tags: ['oncology', 'priority'], addedAt: Date.now() - 86400000 },
        { symbol: 'EGFR', note: 'Lung cancer target — watch TKI resistance variants', tags: ['oncology', 'therapy'], addedAt: Date.now() - 172800000 },
        { symbol: 'CFTR', note: 'Cystic fibrosis — F508del tracking', tags: ['rare-disease'], addedAt: Date.now() - 259200000 },
        { symbol: 'APOE', note: 'Alzheimer risk factor — e4 allele frequency', tags: ['neurological'], addedAt: Date.now() - 345600000 },
      ])
    );
  });

  const screenshots = [
    {
      name: 'homepage-hero.png',
      url: '/',
      setup: null,
    },
    {
      name: 'homepage-full.png',
      url: '/',
      setup: async (p) => {
        await scrollThrough(p);
        // Scroll to show data sources section
        await p.evaluate(() => window.scrollTo(0, 650));
        await p.waitForTimeout(500);
      },
    },
    {
      name: 'search-autocomplete.png',
      url: '/',
      setup: async (p) => {
        const input = p.locator('input[type="text"]').first();
        await input.click();
        await input.fill('BRCA');
        await p.waitForTimeout(1500);
      },
    },
    {
      name: 'search-results.png',
      url: '/search?q=breast+cancer',
      setup: null,
    },
    {
      name: 'dashboard-overview.png',
      url: `/gene/${GENE}`,
      setup: null,
    },
    {
      name: 'dashboard-overview-scrolled.png',
      url: `/gene/${GENE}`,
      setup: async (p) => {
        await p.evaluate(() => window.scrollTo(0, 500));
        await p.waitForTimeout(800);
      },
    },
    {
      name: 'variants-tab.png',
      url: `/gene/${GENE}/variants`,
      setup: null,
    },
    {
      name: 'variant-detail-modal.png',
      url: `/gene/${GENE}/variants`,
      setup: async (p) => {
        const row = p.locator('table tbody tr').first();
        if (await row.isVisible()) {
          await row.click();
          await p.waitForTimeout(1000);
        }
      },
    },
    {
      name: 'variant-analytics.png',
      url: `/gene/${GENE}/variants`,
      setup: async (p) => {
        await p.evaluate(() => window.scrollTo(0, 600));
        await p.waitForTimeout(500);
      },
    },
    {
      name: 'protein-3d.png',
      url: `/gene/${GENE}/protein`,
      setup: async (p) => { await p.waitForTimeout(4000); },
    },
    {
      name: 'population-map.png',
      url: `/gene/${GENE}/population`,
      setup: async (p) => { await p.waitForTimeout(2000); },
    },
    {
      name: 'interactions.png',
      url: `/gene/${GENE}/interactions`,
      setup: async (p) => { await p.waitForTimeout(3000); },
    },
    {
      name: 'pathways.png',
      url: `/gene/${GENE}/pathways`,
      setup: null,
    },
    {
      name: 'timeline.png',
      url: `/gene/${GENE}/timeline`,
      setup: async (p) => { await p.waitForTimeout(1500); },
    },
    {
      name: 'publications.png',
      url: `/gene/${GENE}/publications`,
      setup: null,
    },
    {
      name: 'diseases.png',
      url: `/gene/${GENE}/diseases`,
      setup: null,
    },
    {
      name: 'reconciliation.png',
      url: `/gene/${GENE}/reconciliation`,
      setup: async (p) => { await p.waitForTimeout(1500); },
    },
    {
      name: 'simulator.png',
      url: `/gene/${GENE}/simulator`,
      setup: async (p) => { await p.waitForTimeout(2500); },
    },
    {
      name: 'report.png',
      url: `/gene/${GENE}/report`,
      setup: null,
    },
    {
      name: 'gene-story.png',
      url: `/gene/${GENE}/story`,
      setup: async (p) => { await p.waitForTimeout(1500); },
    },
    {
      name: 'gene-story-scrolled.png',
      url: `/gene/${GENE}/story`,
      setup: async (p) => {
        await p.evaluate(() => window.scrollTo(0, 800));
        await p.waitForTimeout(1000);
      },
    },
    {
      name: 'compare.png',
      url: '/compare/BRCA1/TP53',
      setup: async (p) => { await p.waitForTimeout(2000); },
    },
    {
      name: 'trending.png',
      url: '/trending',
      setup: null,
    },
    {
      name: 'watchlist.png',
      url: '/watchlist',
      setup: null,
    },
  ];

  for (const shot of screenshots) {
    const url = `${BASE}${shot.url}`;
    console.log(`📸  Capturing ${shot.name} — ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await waitForIdle(page, 2500);

      if (shot.setup) {
        await shot.setup(page);
      }

      await page.screenshot({
        path: join(OUT_DIR, shot.name),
        fullPage: false,
      });
      console.log(`   ✅ ${shot.name}`);
    } catch (err) {
      console.error(`   ❌ ${shot.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\n🎬  Done! ${screenshots.length} screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
