const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const puppeteer = require('puppeteer');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function capture(name, url, width, height) {
  const outDir = path.resolve(process.cwd(), 'docs', 'screenshots');
  await ensureDir(outDir);
  const outFile = path.join(outDir, name);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();
  return outFile;
}

(async () => {
  const baseUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`;
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/list`
  ];

  const outputs = [];
  for (const url of urls) {
    outputs.push(await capture(`after-light-${url.endsWith('/list') ? 'list' : 'kanban'}-desktop.png`, url, 1440, 900));
    outputs.push(await capture(`after-light-${url.endsWith('/list') ? 'list' : 'kanban'}-mobile.png`, url, 375, 812));
  }
  console.log('Screenshots saved:', outputs);
})();