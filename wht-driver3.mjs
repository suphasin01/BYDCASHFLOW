import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const SHOT_DIR = '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');

async function ss(page, name) {
  const f = path.join(SHOT_DIR, name + '.png');
  await page.screenshot({ path: f });
  console.log('screenshot:', f);
}

async function run() {
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 9000));
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();

  // Create test record via API
  await page.evaluate(async () => {
    await fetch('http://localhost:3737/api/withholding-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 1, cert_no: 'TEST-001', book_no: '1', issue_date: '2024-01-15',
        form_type: 'nd53', payer_name: 'บริษัท ตัวอย่าง จำกัด',
        payer_address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
        payer_tax_id: '1234567890123', payer_tin: '1234567890',
        payee_name: 'นาย สมชาย ใจดี',
        payee_address: '456 ถนนพระราม 4 กรุงเทพฯ 10120',
        payee_tax_id: '9876543210123', payee_tin: '9876543210',
        payer_type: '1', total_amount: 50000, total_tax: 5000,
        items: [{ income_type: '40_1', income_type_desc: '', pay_date: '2024-01-15', amount: 50000, tax_withheld: 5000 }]
      })
    });
  });
  console.log('Created record');

  // Go to WHT page
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 2500));
  await ss(page, '01-wht-list');

  // Log all buttons including emoji
  const allBtns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => JSON.stringify(b.textContent?.trim()))
  );
  console.log('All buttons:', allBtns.join(', '));

  // Click the preview button — has emoji 👁
  const previewOk = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    // match by textContent containing 'ดูตัวอย่าง' or 'Preview' or '👁'
    const b = btns.find(btn => {
      const t = btn.textContent?.trim() || '';
      return t.includes('ดูตัวอย่าง') || t.includes('Preview') || t.includes('👁');
    });
    if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
    return null;
  });
  console.log('Preview btn:', previewOk);
  await new Promise(r => setTimeout(r, 3000));
  await ss(page, '02-preview-modal');

  // Screenshot iframe
  const iframes = await page.$$('iframe');
  console.log('Iframes found:', iframes.length);
  for (let i = 0; i < iframes.length; i++) {
    try {
      const frame = await iframes[i].contentFrame();
      if (frame) {
        await new Promise(r => setTimeout(r, 1500));
        await frame.screenshot({ path: path.join(SHOT_DIR, `0${3+i}-pdf-iframe.png`) });
        console.log(`screenshot: 0${3+i}-pdf-iframe.png`);
      }
    } catch(e) { console.log('iframe err:', e.message); }
  }

  await app.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
