import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');

// Load whtFormBg as data URI
const bgModule = fs.readFileSync('src-ui/src/whtFormBg.ts', 'utf8');
const bgMatch = bgModule.match(/`(data:image\/png[^`]+)`/);
const bgDataUri = bgMatch ? bgMatch[1] : '';
console.log('bg found:', bgDataUri.length > 0, bgDataUri.slice(0,50));

// Load field defs
const fieldsRaw = fs.readFileSync('src-ui/src/whtFormFields.ts', 'utf8');
const entries = [...fieldsRaw.matchAll(/'([^']+)':\s*\{([^}]+)\}/g)];
const F = {};
for (const [,key,body] of entries) {
  const nums = {};
  for (const [,k,v] of body.matchAll(/(\w+):\s*([\d.]+)/g)) nums[k] = parseFloat(v);
  F[key] = nums;
}

const MM = 25.4/72;
const PAGE_W = 595, PAGE_H = 842;

// Build debug overlay: red boxes + field name label
const boxes = Object.entries(F).map(([key,b]) =>
  `<div style="position:absolute;left:${(b.l*MM).toFixed(2)}mm;top:${(b.t*MM).toFixed(2)}mm;` +
  `width:${(b.w*MM).toFixed(2)}mm;height:${(b.h*MM).toFixed(2)}mm;` +
  `border:1px solid red;box-sizing:border-box;overflow:hidden;font-size:4px;color:red;">${key}</div>`
).join('');

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:A4 portrait;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#888}
.page{position:relative;width:${(PAGE_W*MM).toFixed(2)}mm;height:${(PAGE_H*MM).toFixed(2)}mm;margin:4px auto;background:#fff;overflow:hidden}
.page img.bg{position:absolute;inset:0;width:100%;height:100%;display:block}
</style></head><body>
<div class="page"><img class="bg" src="${bgDataUri}" alt="">${boxes}</div>
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

  // Navigate to a data URL via the webContents
  await page.evaluate(async (h) => {
    document.open(); document.write(h); document.close();
  }, html);
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot top portion (header area where name/id fields are)
  await page.screenshot({ path: '/tmp/shots/debug-top.png', clip: { x: 0, y: 0, width: 860, height: 430 } });
  console.log('ss: debug-top.png');

  // Screenshot middle (income table area)
  await page.screenshot({ path: '/tmp/shots/debug-mid.png', clip: { x: 0, y: 380, width: 860, height: 430 } });
  console.log('ss: debug-mid.png');

  // Full page
  await page.screenshot({ path: '/tmp/shots/debug-full.png' });
  console.log('ss: debug-full.png');

  await app.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
