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
  console.log('Launching...');
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 9000));
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();

  // Create sample WHT record via API
  const created = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3737/api/withholding-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 1,
        cert_no: 'TEST-001',
        book_no: '1',
        issue_date: '2024-01-15',
        form_type: 'nd53',
        payer_name: 'บริษัท ตัวอย่าง จำกัด',
        payer_address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
        payer_tax_id: '1234567890123',
        payer_tin: '1234567890',
        payee_name: 'นาย สมชาย ใจดี',
        payee_address: '456 ถนนพระราม 4 กรุงเทพฯ 10120',
        payee_tax_id: '9876543210123',
        payee_tin: '9876543210',
        payer_type: '1',
        total_amount: 50000,
        total_tax: 5000,
        items: [{
          income_type: '40_1',
          income_type_desc: '',
          pay_date: '2024-01-15',
          amount: 50000,
          tax_withheld: 5000,
        }]
      })
    });
    const data = await res.json();
    return data;
  });
  console.log('Created WHT:', JSON.stringify(created));

  // Navigate to WHT page
  const navClicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a')].find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย');
    if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok'; }
    return 'NOT_FOUND';
  });
  console.log('Nav WHT:', navClicked);
  await new Promise(r => setTimeout(r, 2500));
  await ss(page, '02-wht-list');

  // Click preview on the first record
  const preview = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    console.log('btns:', btns.map(b => b.textContent?.trim()));
    const b = btns.find(btn => (btn.textContent?.trim() || '').includes('ตัวอย่าง'));
    if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
    return null;
  });
  console.log('Preview clicked:', preview);
  await new Promise(r => setTimeout(r, 3000));
  await ss(page, '03-preview-modal');

  // Try iframe screenshot
  try {
    const iframeEl = await page.$('iframe');
    if (iframeEl) {
      const frame = await iframeEl.contentFrame();
      if (frame) {
        await new Promise(r => setTimeout(r, 2000));
        await frame.screenshot({ path: path.join(SHOT_DIR, '04-pdf-form.png') });
        console.log('screenshot: 04-pdf-form.png');
      } else {
        console.log('No contentFrame');
      }
    } else {
      console.log('No iframe found');
    }
  } catch(e) { console.log('iframe err:', e.message); }

  // Clean up the test record
  if (created?.data?.id) {
    await page.evaluate(async (id) => {
      await fetch(`http://localhost:3737/api/withholding-tax/${id}`, { method: 'DELETE' });
    }, created.data.id);
    console.log('Cleaned up test record');
  }

  await app.close();
  console.log('Done.');
}

run().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
