import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');

// Load the actual WHT form HTML the same way the app does
// We'll build a standalone HTML that renders the full A4 form
const raw = fs.readFileSync('src-ui/src/whtFormBg.ts', 'utf8');
const bgUri = raw.match(/= "(data:image\/png[^"]+)"/)[1];

const fieldsRaw = fs.readFileSync('src-ui/src/whtFormFields.ts', 'utf8');
const F = {};
for (const [,key,body] of fieldsRaw.matchAll(/'([^']+)':\s*\{([^}]+)\}/g)) {
  const nums = {};
  for (const [,k,v] of body.matchAll(/(\w+):\s*([\d.]+)/g)) nums[k] = parseFloat(v);
  F[key] = nums;
}
const MM = 25.4/72;
const PAGE_W = 595, PAGE_H = 842;

// Generate the same kind of overlay the app would generate, with visible boxes
const testData = {
  book_no: '1', cert_no: 'TEST-001', issue_date: '2026-06-16',
  form_type: 'nd53',
  payer_name: 'บริษัท ตัวอย่าง จำกัด', payer_address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110',
  payer_tax_id: '0105537000012', payer_tin: '0105537000',
  payee_name: 'นาย สมชาย ใจดี', payee_address: '456 ถนนพระราม 4 แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
  payee_tax_id: '1234567890123', payee_tin: '1234567890',
  payer_type: '1', total_amount: 50000, total_tax: 5000,
  fund_sso: 750, fund_pvd: 1000,
  date_day: '16', date_month: 'มิถุนายน', date_year: '2569',
  income_date: '16/06/2569', income_amount: '50,000.00', income_tax: '5,000.00',
  total_amount_text: '50,000.00', total_tax_text: '5,000.00',
  baht_text: 'ห้าพันบาทถ้วน',
};

function makeField(key, val, {align='left', pad=1.2, bold=false, size=11}={}) {
  const b = F[key]; if (!b || !val) return '';
  const just = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return `<div style="position:absolute;left:${(b.l*MM).toFixed(2)}mm;top:${(b.t*MM).toFixed(2)}mm;`+
    `width:${(b.w*MM).toFixed(2)}mm;height:${(b.h*MM).toFixed(2)}mm;`+
    `display:flex;align-items:center;justify-content:${just};`+
    `font-family:'AngsanaUPC','Angsana New','Thonburi',sans-serif;font-size:${(size*MM).toFixed(2)}mm;`+
    `${bold?'font-weight:700;':''}line-height:1;white-space:nowrap;overflow:hidden;`+
    `padding:0 ${pad}px;box-sizing:border-box;border:0.5px dashed rgba(0,0,255,0.3)">${val}</div>`;
}

// Build all overlay fields
const overlay = [
  makeField('book_no', testData.book_no, {align:'center'}),
  makeField('run_no', testData.cert_no, {align:'center'}),
  makeField('name1', testData.payer_name),
  makeField('add1', testData.payer_address),
  makeField('name2', testData.payee_name),
  makeField('add2', testData.payee_address),
  // Comb: payer ID
  ...Array.from(testData.payer_tax_id.replace(/\D/g,'')).slice(0,13).map((ch,i) => {
    const b = F['id1']; if (!b) return '';
    const cells = 17; const cw = b.w/cells;
    const grp = `${testData.payer_tax_id[0]} ${testData.payer_tax_id.slice(1,5)} ${testData.payer_tax_id.slice(5,10)} ${testData.payer_tax_id.slice(10,12)} ${testData.payer_tax_id[12]}`;
    return '';
  }),
  // Simpler: use name for comb positions
  makeField('tin1', testData.payer_tin.slice(0,10), {align:'center'}),
  makeField('tin1_2', testData.payee_tin.slice(0,10), {align:'center'}),
  // Income row 1
  makeField('date1', testData.income_date, {align:'center', size:12.5}),
  makeField('pay1_0', testData.income_amount, {align:'right', pad:4, size:12.5}),
  makeField('tax1_0', testData.income_tax, {align:'right', pad:4, size:12.5}),
  // Totals
  makeField('pay1_14', testData.total_amount_text, {align:'right', pad:4, bold:true}),
  makeField('tax1_14', testData.total_tax_text, {align:'right', pad:4, bold:true}),
  makeField('total', testData.baht_text, {align:'center'}),
  // SSO/PVD
  makeField('Text1_0_1', '750.00', {align:'center'}),
  makeField('Text1_1_0', '1,000.00', {align:'center'}),
  // Payer type checkbox
  `<div style="position:absolute;left:${(F.chk8?.l*MM).toFixed(2)}mm;top:${(F.chk8?.t*MM).toFixed(2)}mm;`+
  `width:${(F.chk8?.w*MM).toFixed(2)}mm;height:${(F.chk8?.h*MM).toFixed(2)}mm;`+
  `display:flex;align-items:center;justify-content:center;font-size:${(F.chk8?.h*0.95*MM).toFixed(2)}mm;font-weight:700;line-height:1">✓</div>`,
  // Date
  makeField('date_pay', '16', {align:'center'}),
  makeField('month_pay', 'มิถุนายน', {align:'center'}),
  makeField('year_pay', '2569', {align:'center'}),
].join('');

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<style>
@page{size:A4 portrait;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#888;margin:0}
.page{position:relative;width:${(PAGE_W*MM).toFixed(2)}mm;height:${(PAGE_H*MM).toFixed(2)}mm;margin:0;background:#fff;overflow:hidden}
.page img.bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.page>div{color:#000;-webkit-text-stroke:0.25px currentColor}
</style></head><body>
<div class="page"><img class="bg" src="${bgUri}" alt="">${overlay}</div>
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

  await page.evaluate(h => { document.open(); document.write(h); document.close(); }, html);
  await new Promise(r => setTimeout(r, 2500));

  const pgBox = await page.evaluate(() => {
    const el = document.querySelector('.page');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  });
  console.log('page px:', JSON.stringify(pgBox));

  if (pgBox) {
    const halfH = pgBox.h / 2;
    await page.screenshot({ path: '/tmp/shots/full-top.png', clip: { x: pgBox.x, y: pgBox.y, width: pgBox.w, height: halfH } });
    await page.screenshot({ path: '/tmp/shots/full-bottom.png', clip: { x: pgBox.x, y: pgBox.y + halfH, width: pgBox.w, height: halfH } });
    console.log('ss: full-top, full-bottom');
  }

  await app.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
