import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const OUTPUT_DIR = path.join(process.cwd(), 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const pages = [
  { name: 'overview', path: '/', waitFor: 3000 },
  { name: 'projects', path: '/projects', waitFor: 2000 },
  { name: 'sessions', path: '/sessions', waitFor: 2000 },
  { name: 'costs', path: '/costs', waitFor: 3000 },
  { name: 'data', path: '/data', waitFor: 2000 },
];

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();

  for (const p of pages) {
    console.log(`Capturing ${p.name}...`);
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, p.waitFor));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${p.name}.png`),
      fullPage: false,
    });
    console.log(`  Saved ${p.name}.png`);
  }

  // Also take a session detail screenshot - find a real session first
  console.log('Capturing session detail...');
  await page.goto(`${BASE_URL}/sessions`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Click the first session link
  const firstSessionLink = await page.$('a[href^="/sessions/"]');
  if (firstSessionLink) {
    await firstSessionLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'session-detail.png'),
      fullPage: false,
    });
    console.log('  Saved session-detail.png');
  }

  // Take a project detail screenshot
  console.log('Capturing project detail...');
  await page.goto(`${BASE_URL}/projects`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  const firstProjectLink = await page.$('a[href^="/projects/"]');
  if (firstProjectLink) {
    await firstProjectLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'project-detail.png'),
      fullPage: false,
    });
    console.log('  Saved project-detail.png');
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${OUTPUT_DIR}/`);
}

main().catch(console.error);
