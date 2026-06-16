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
  await ss(page, '01-initial');

  // Click the WHT nav item specifically
  const clicked = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, a, li, div, span')];
    const el = all.find(e => e.textContent?.trim() === 'ภาษีหัก ณ ที่จ่าย');
    if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok: ' + el.tagName; }
    // fallback: find by partial text
    const el2 = all.find(e => (e.textContent?.trim() || '').startsWith('ภาษีหัก'));
    if (el2) { el2.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'partial: ' + el2.textContent?.trim(); }
    return 'NOT_FOUND';
  });
  console.log('WHT nav click:', clicked);
  await new Promise(r => setTimeout(r, 2500));
  await ss(page, '02-wht-list');

  const btns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(Boolean)
  );
  console.log('Buttons:', btns);

  // Try to click preview on first row
  const previewClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(btn => (btn.textContent?.trim() || '').includes('ตัวอย่าง'));
    if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
    return null;
  });
  console.log('Preview:', previewClicked);

  if (!previewClicked) {
    // Create sample record
    const createBtn = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(btn => btn.textContent?.trim().includes('สร้าง'));
      if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
      return null;
    });
    console.log('Create:', createBtn);
    await new Promise(r => setTimeout(r, 1500));
    await ss(page, '03-modal');

    // Fill cert no
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')];
      for (const inp of inputs) {
        if (inp.placeholder?.includes('เลขที่')) {
          inp.value = '2567-001';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    });

    // Set issue date
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="date"]');
      if (inp) {
        inp.value = '2567-01-15';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Fill payer name
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
      const nameInp = inputs.find(i => i.placeholder?.includes('ชื่อ'));
      if (nameInp) {
        nameInp.value = 'บริษัท ตัวอย่าง จำกัด';
        nameInp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 500));
    await ss(page, '03b-modal-filled');

    // Save
    const saved = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(btn => btn.textContent?.trim() === 'บันทึก');
      if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok'; }
      return 'not found';
    });
    console.log('Save:', saved);
    await new Promise(r => setTimeout(r, 1500));
    await ss(page, '04-saved');

    // Click preview again
    const preview2 = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(btn => (btn.textContent?.trim() || '').includes('ตัวอย่าง'));
      if (b) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return b.textContent?.trim(); }
      return null;
    });
    console.log('Preview2:', preview2);
  }

  await new Promise(r => setTimeout(r, 3000));
  await ss(page, '05-preview-modal');

  // Screenshot iframe
  try {
    const iframeEl = await page.$('iframe');
    const frame = await iframeEl?.contentFrame();
    if (frame) {
      await frame.screenshot({ path: path.join(SHOT_DIR, '06-pdf-form.png') });
      console.log('screenshot: 06-pdf-form.png');
    }
  } catch(e) { console.log('iframe screenshot err:', e.message); }

  await app.close();
  console.log('Done.');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
