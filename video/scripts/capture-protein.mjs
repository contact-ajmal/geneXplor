/**
 * Capture the protein 3D screenshot with WebGL enabled.
 * Uses headed Chromium (non-headless) to get WebGL support for PDBe Molstar.
 *
 * Usage: node scripts/capture-protein.mjs
 */

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const GENE = process.env.GENE || 'BRCA1';

async function main() {
  // Launch with headed mode for WebGL support
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  const url = `${BASE}/gene/${GENE}/protein`;
  console.log(`📸  Navigating to ${url} (with WebGL)...`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Wait for the 3D viewer to render
  console.log('   ⏳ Waiting 8s for PDBe Molstar to load...');
  await page.waitForTimeout(8000);

  await page.screenshot({
    path: join(OUT_DIR, 'protein-3d.png'),
    fullPage: false,
  });

  console.log('   ✅ protein-3d.png captured with WebGL');

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
