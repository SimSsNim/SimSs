// public/icon.svg → PNG 아이콘(192, 512, maskable, apple-touch). 아이콘을 바꿨을 때만 실행: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg', 'utf8');
const mask = readFileSync('public/icon-maskable.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, src, size] of [['icon-192.png', svg, 192], ['icon-512.png', svg, 512], ['icon-512-maskable.png', mask, 512], ['apple-touch-icon.png', mask, 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${src}`);
  await page.screenshot({ path: `public/${name}`, omitBackground: true });
}
await browser.close();
console.log('icons written');
