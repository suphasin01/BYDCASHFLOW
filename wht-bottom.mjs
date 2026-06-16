import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');

async function run() {
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 8000));
  const page = app.windows()[0] ?? await app.firstWindow();

  await page.evaluate(async () => {
    const r = await fetch('http://localhost:3737/api/withholding-tax', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 1, cert_no: 'FULL-002', book_no: '2', issue_date: '2026-06-16',
        form_type: 'nd53', payer_name: 'บริษัท ตัวอย่าง จำกัด',
        payer_address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110',
        payer_tax_id: '0105537000012', payer_tin: '0105537000',
        payee_name: 'นาย สมชาย ใจดี', payee_address: '456 ถนนพระราม 4 แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
        payee_tax_id: '1234567890123', payee_tin: '1234567890',
        payer_type: '1', total_amount: 50000, total_tax: 5000, fund_sso: 750, fund_pvd: 1000,
        items: [{ income_type: '40_1', income_type_desc: '', pay_date: '2026-06-16', amount: 50000, tax_withheld: 5000 }]
      })
    });
    return r.json();
  });

  await page.evaluate(() => { [...document.querySelectorAll('button')].find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('ดูตัวอย่าง'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await new Promise(r => setTimeout(r, 3000));

  const box = await page.evaluate(() => { const f = document.querySelector('iframe'); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

  // Full iframe screenshot (scrolled portion)
  await page.screenshot({ path: '/tmp/shots/form-full.png', clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  console.log('ss: form-full (visible portion)');

  // Now scroll the iframe to see bottom
  await page.evaluate(() => { const f = document.querySelector('iframe'); if (f) f.scrollTop = 99999; });
  await new Promise(r => setTimeout(r, 500));
  // Actually need to scroll inside the iframe's scrollable parent (the modal body)
  await page.evaluate(() => {
    const modal = document.querySelector('.overflow-y-auto, [class*="overflow-y"], [class*="modal"] [class*="body"]');
    if (modal) modal.scrollTop = 99999;
    document.querySelectorAll('[class*="overflow"]').forEach(el => { el.scrollTop = 99999; });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/shots/form-bottom.png', clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  console.log('ss: form-bottom (scrolled)');

  await app.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
