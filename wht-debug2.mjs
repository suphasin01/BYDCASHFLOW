import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');

// Extract background data URI
const raw = fs.readFileSync('src-ui/src/whtFormBg.ts', 'utf8');
const m = raw.match(/= "(data:image\/png[^"]+)"/);
const bgUri = m ? m[1] : '';
console.log('bg uri found:', bgUri.length > 100);

// Extract fields
const fieldsRaw = fs.readFileSync('src-ui/src/whtFormFields.ts', 'utf8');
const F = {};
for (const [,key,body] of fieldsRaw.matchAll(/'([^']+)':\s*\{([^}]+)\}/g)) {
  const nums = {};
  for (const [,k,v] of body.matchAll(/(\w+):\s*([\d.]+)/g)) nums[k] = parseFloat(v);
  F[key] = nums;
}

const MM = 25.4/72;
const PAGE_W = 595, PAGE_H = 842;

// Debug overlay: blue semi-transparent boxes + key label
const boxes = Object.entries(F).map(([key,b]) =>
  `<div style="position:absolute;left:${(b.l*MM).toFixed(2)}mm;top:${(b.t*MM).toFixed(2)}mm;` +
  `width:${(b.w*MM).toFixed(2)}mm;height:${(b.h*MM).toFixed(2)}mm;` +
  `border:1.5px solid rgba(255,0,0,0.8);background:rgba(255,255,0,0.15);box-sizing:border-box;` +
  `overflow:hidden;font-size:3.5px;color:red;line-height:1;">${key}</div>`
).join('');

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:A4 portrait;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#888;margin:0}
.page{position:relative;width:${(PAGE_W*MM).toFixed(2)}mm;height:${(PAGE_H*MM).toFixed(2)}mm;margin:0 auto;background:#fff;overflow:hidden}
.page img.bg{position:absolute;inset:0;width:100%;height:100%;display:block}
</style></head><body>
<div class="page"><img class="bg" src="${bgUri}" alt="">${boxes}</div>
</body></html>`;

async function run() {
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 8000));
  const page = app.windows()[0] ?? await app.firstWindow();

  // Write debug html and load it
  fs.writeFileSync('/tmp/wht-debug.html', html);
  await page.evaluate(async (h) => { document.open(); document.write(h); document.close(); }, html);
  await new Promise(r => setTimeout(r, 3000));

  // Get form page bounding box
  const pageBox = await page.evaluate(() => {
    const el = document.querySelector('.page');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('page box (px):', JSON.stringify(pageBox));

  // Screenshot top half (header + payer/payee section)
  if (pageBox) {
    await page.screenshot({ path: '/tmp/shots/dbg-top.png',
      clip: { x: pageBox.x, y: pageBox.y, width: pageBox.w, height: Math.min(pageBox.h/2, 600) } });
    console.log('ss: dbg-top.png');

    // Income table area (roughly middle of form)
    const midY = pageBox.y + pageBox.h * 0.38;
    await page.screenshot({ path: '/tmp/shots/dbg-income.png',
      clip: { x: pageBox.x, y: midY, width: pageBox.w, height: Math.min(pageBox.h * 0.45, 550) } });
    console.log('ss: dbg-income.png');

    // Bottom (totals + signature)
    const botY = pageBox.y + pageBox.h * 0.78;
    await page.screenshot({ path: '/tmp/shots/dbg-bottom.png',
      clip: { x: pageBox.x, y: botY, width: pageBox.w, height: pageBox.h * 0.22 } });
    console.log('ss: dbg-bottom.png');
  }

  await app.close();
}
run().catch(e => { console.error(e.message, e.stack); process.exit(1); });
