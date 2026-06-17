import { _electron as electron, chromium } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_DIR = '/home/user/fruit';
const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/electron');
fs.mkdirSync('/tmp/shots', { recursive: true });

async function run() {
  const app = await electron.launch({
    executablePath: electronBin,
    args: ['--no-sandbox', APP_DIR],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
    timeout: 40_000,
  });
  await new Promise(r => setTimeout(r, 8000));
  const page = app.windows()[0] ?? await app.firstWindow();

  // Create a full-data WHT record via API
  const res = await page.evaluate(async () => {
    const r = await fetch('http://localhost:3737/api/withholding-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 1, cert_no: 'VER-UP', book_no: '1', issue_date: '2026-06-17',
        form_type: 'nd53',
        payer_name: 'บริษัท ตัวอย่าง จำกัด', payer_address: '123 ถนนสุขุมวิท แขวงคลองตัน กรุงเทพฯ 10110',
        payer_tax_id: '0105537000012', payer_tin: '0105537000',
        payee_name: 'นาย สมชาย ใจดี', payee_address: '456 ถนนพระราม 4 แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
        payee_tax_id: '1234567890123', payee_tin: '1234567890',
        payer_type: '1', total_amount: 50000, total_tax: 5000,
        items: [
          { income_type: '40_1', income_type_desc: '', pay_date: '2026-06-17', amount: 50000, tax_withheld: 5000 },
        ]
      })
    });
    return r.json();
  });
  console.log('Created id:', res?.id);

  // Navigate to WHT page
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 2500));

  // Open preview
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('ดูตัวอย่าง'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 3000));

  // Get the HTML from the iframe
  const html = await page.evaluate(() => {
    const f = document.querySelector('iframe');
    return f?.contentDocument?.documentElement?.outerHTML ?? '';
  });

  if (!html) { console.log('No iframe HTML found'); await app.close(); return; }

  // Take screenshot of form
  const box = await page.evaluate(() => {
    const f = document.querySelector('iframe');
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (box) {
    await page.screenshot({ path: '/tmp/shots/form-comb.png',
      clip: { x: box.x, y: box.y, width: box.w, height: box.h * 0.30 } });
    console.log('Screenshot: form-comb.png');
  }

  await app.close();

  // Write HTML and generate PDF via Chromium
  const htmlFile = '/tmp/shots/wht-form.html';
  fs.writeFileSync(htmlFile, html);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'], headless: true });
  const ctx = await browser.newContext();
  const pdfPage = await ctx.newPage();
  await pdfPage.goto(`file://${htmlFile}`, { waitUntil: 'networkidle' });
  const pdfBuf = await pdfPage.pdf({ format: 'A4', printBackground: true, pageRanges: '1' });
  fs.writeFileSync('/tmp/shots/wht-form.pdf', pdfBuf);
  console.log('PDF written to /tmp/shots/wht-form.pdf');
  await browser.close();

  if (res?.id) {
    // Re-open briefly to delete
    const app2 = await electron.launch({
      executablePath: electronBin, args: ['--no-sandbox', APP_DIR],
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' }, timeout: 20_000,
    });
    await new Promise(r => setTimeout(r, 5000));
    const p2 = app2.windows()[0] ?? await app2.firstWindow();
    await p2.evaluate(async id => { await fetch(`http://localhost:3737/api/withholding-tax/${id}`, { method: 'DELETE' }); }, res.id);
    await app2.close();
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });
