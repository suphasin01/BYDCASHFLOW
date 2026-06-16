import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const SHOT_DIR = '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');
const ss = async (page, name) => { await page.screenshot({ path: path.join(SHOT_DIR, name+'.png') }); console.log('ss:', name); };

async function run() {
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 9000));
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();

  // Create test record with current month date (June 2026)
  const created = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3737/api/withholding-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 1, cert_no: 'PREVIEW-001', book_no: '1',
        issue_date: '2026-06-15',   // current period!
        form_type: 'nd53',
        payer_name: 'บริษัท ตัวอย่าง จำกัด', payer_address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110',
        payer_tax_id: '0105537000012', payer_tin: '0105537000',
        payee_name: 'นาย สมชาย ใจดี', payee_address: '456 ถนนพระราม 4 แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
        payee_tax_id: '1234567890123', payee_tin: '1234567890',
        payer_type: '1', total_amount: 50000, total_tax: 5000,
        items: [{ income_type: '40_1', income_type_desc: '', pay_date: '2026-06-15', amount: 50000, tax_withheld: 5000 }]
      })
    });
    return res.json();
  });
  console.log('Created:', created?.cert_no, 'id:', created?.id);

  // Navigate to WHT page
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 2500));
  await ss(page, '01-wht-list');

  const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent?.trim()));
  console.log('Buttons:', btns.filter(t => t && t.length < 30));

  // Find and click preview button
  const previewBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(btn => {
      const t = btn.textContent || '';
      return t.includes('ดูตัวอย่าง') || t.includes('Preview') || t.includes('👁');
    });
    if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
    return null;
  });
  console.log('Preview btn:', previewBtn);
  await new Promise(r => setTimeout(r, 3000));
  await ss(page, '02-preview-modal');

  // Screenshot iframe
  const iframeEl = await page.$('iframe');
  console.log('iframe found:', !!iframeEl);
  if (iframeEl) {
    const frame = await iframeEl.contentFrame();
    if (frame) {
      await new Promise(r => setTimeout(r, 2000));
      await frame.screenshot({ path: path.join(SHOT_DIR, '03-pdf-form.png') });
      console.log('ss: 03-pdf-form');
    }
  }

  // Clean up
  if (created?.id) await page.evaluate(async id => { await fetch(`http://localhost:3737/api/withholding-tax/${id}`, { method: 'DELETE' }); }, created.id);

  await app.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
