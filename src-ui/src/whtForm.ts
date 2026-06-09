// Thai Withholding Tax (50 ทวิ) certificate.
// The printed page IS the official Revenue Department form: the blank form is
// used as a pixel-exact background image (whtFormBg) and the variable data is
// overlaid at the exact AcroForm field positions (whtFormFields). This makes
// every line, border, font and spacing identical to the original document.
import type { WithholdingTax, WithholdingTaxItem } from './types'
import { WHT_FORM_BG } from './whtFormBg'
import { F, type FieldBox } from './whtFormFields'

// ─── helpers ──────────────────────────────────────────────────────────────────
const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const fmtN = (n: number | null | undefined): string =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n) || 0)

// Buddhist-era dd/mm/yyyy
const fmtDateBE = (d: string | null | undefined): string => {
  if (!d) return ''
  const p = String(d).slice(0, 10).split('-')
  if (p.length !== 3) return ''
  return `${p[2]}/${p[1]}/${parseInt(p[0]) + 543}`
}

// Thai baht text
const BT_NUM = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า']
const BT_POS = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน']
function bahtText(amount: number): string {
  if (!amount || amount <= 0) return 'ศูนย์บาทถ้วน'
  const fixed = Math.round(amount * 100)
  const baht = Math.floor(fixed / 100)
  const satang = fixed % 100
  const readGroup = (numStr: string): string => {
    let out = ''
    const len = numStr.length
    for (let i = 0; i < len; i++) {
      const dig = parseInt(numStr[i])
      const pos = len - i - 1
      if (dig === 0) continue
      if (pos === 0 && dig === 1 && len > 1) out += 'เอ็ด'
      else if (pos === 1 && dig === 2) out += 'ยี่'
      else if (pos === 1 && dig === 1) out += ''
      else out += BT_NUM[dig]
      out += BT_POS[pos]
    }
    return out
  }
  const readNumber = (n: number): string => {
    if (n === 0) return ''
    const s = String(n)
    if (s.length <= 6) return readGroup(s)
    const millions = Math.floor(n / 1000000)
    const rest = n % 1000000
    let out = readNumber(millions) + 'ล้าน'
    if (rest > 0) out += readGroup(String(rest).padStart(6, '0').replace(/^0+/, ''))
    return out
  }
  let text = readNumber(baht) + 'บาท'
  if (satang === 0) text += 'ถ้วน'
  else text += readGroup(String(satang).padStart(2, '0').replace(/^0+/, '')) + 'สตางค์'
  return text
}

// ─── overlay rendering ──────────────────────────────────────────────────────
// pt → mm (CSS uses mm so it maps 1:1 onto the A4 print page)
const MM = 25.4 / 72
const PAGE_W = 595, PAGE_H = 842
const FONT = "'AngsanaUPC','Angsana New','TH Sarabun New','Sarabun','Loma',sans-serif"

type Align = 'left' | 'center' | 'right'
type Opts = { size?: number; align?: Align; bold?: boolean; pad?: number }

// Place a text value inside a field box (positions/sizes in pt → mm)
function field(key: string, value: string, o: Opts = {}): string {
  const b: FieldBox | undefined = F[key]
  if (!b || value === '' || value == null) return ''
  const size = o.size ?? Math.min(b.h * 0.78, 11)
  const align = o.align ?? 'left'
  const pad = o.pad ?? 1.2
  const just = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  return (
    `<div style="position:absolute;left:${(b.l * MM).toFixed(2)}mm;top:${(b.t * MM).toFixed(2)}mm;` +
    `width:${(b.w * MM).toFixed(2)}mm;height:${(b.h * MM).toFixed(2)}mm;` +
    `display:flex;align-items:center;justify-content:${just};` +
    `font-family:${FONT};font-size:${(size * MM).toFixed(2)}mm;` +
    `${o.bold ? 'font-weight:700;' : ''}line-height:1;white-space:nowrap;overflow:hidden;` +
    `padding:0 ${pad}px;box-sizing:border-box">${esc(value)}</div>`
  )
}

// Comb field: spread each character across `cells` equal columns (for boxed IDs)
function combField(key: string, value: string): string {
  const b: FieldBox | undefined = F[key]
  if (!b || !b.comb || !value) return ''
  const cells = b.comb
  const cw = b.w / cells
  const size = Math.min(b.h * 0.8, 11)
  let out = ''
  for (let i = 0; i < cells && i < value.length; i++) {
    const ch = value[i]
    if (ch === ' ') continue
    out +=
      `<div style="position:absolute;left:${((b.l + i * cw) * MM).toFixed(2)}mm;top:${(b.t * MM).toFixed(2)}mm;` +
      `width:${(cw * MM).toFixed(2)}mm;height:${(b.h * MM).toFixed(2)}mm;` +
      `display:flex;align-items:center;justify-content:center;` +
      `font-family:${FONT};font-size:${(size * MM).toFixed(2)}mm;line-height:1">${esc(ch)}</div>`
  }
  return out
}

// Format a 13-digit id into the 17-cell comb string "D DDDD DDDDD DD D"
const grp13 = (id: string | null | undefined): string => {
  const d = String(id ?? '').replace(/\D/g, '')
  if (d.length !== 13) return ''
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5, 10)} ${d.slice(10, 12)} ${d[12]}`
}

// Checkbox mark centered in a button field
function check(key: string, on: boolean): string {
  const b: FieldBox | undefined = F[key]
  if (!b || !on) return ''
  return (
    `<div style="position:absolute;left:${(b.l * MM).toFixed(2)}mm;top:${(b.t * MM).toFixed(2)}mm;` +
    `width:${(b.w * MM).toFixed(2)}mm;height:${(b.h * MM).toFixed(2)}mm;` +
    `display:flex;align-items:center;justify-content:center;` +
    `font-family:${FONT};font-size:${(b.h * 0.95 * MM).toFixed(2)}mm;font-weight:700;line-height:1">✓</div>`
  )
}

export function buildWHTForm(wht: WithholdingTax): string {
  const items: Record<string, WithholdingTaxItem> = {}
  for (const it of (wht.items || [])) items[it.income_type] = it

  const ft = wht.form_type || ''
  const pt = wht.payer_type || ''

  // income_type → [date, pay(amount), tax] field keys (from the official AcroForm)
  const ROWS: [string, string, string, string][] = [
    ['40_1', 'date1', 'pay1_0', 'tax1_0'],
    ['40_2', 'date2', 'pay1_1', 'tax1_1'],
    ['40_3', 'date3', 'pay1_2', 'tax1_2'],
    ['40_4a', 'date4', 'pay1_3', 'tax1_3'],
    ['40_4b_1_1', 'date5', 'pay1_4', 'tax1_4'],
    ['40_4b_1_2', 'date6', 'pay1_5', 'tax1_5'],
    ['40_4b_1_3', 'date7', 'pay1_6', 'tax1_6'],
    ['40_4b_1_4', 'date8', 'pay1_7', 'tax1_7'],
    ['40_4b_2_1', 'date9', 'pay1_8', 'tax1_8'],
    ['40_4b_2_2', 'date10', 'pay1_9', 'tax1_9'],
    ['40_4b_2_3', 'date11', 'pay1_10', 'tax1_10'],
    ['40_4b_2_4', 'date12', 'pay1_11', 'tax1_11'],
    ['40_4b_2_5', 'date13', 'pay1_12', 'tax1_12'],
    ['3tres', 'date14_0', 'pay1_13_0', 'tax1_13_0'],
    ['other', 'date14_1', 'pay1_13_1', 'tax1_13_1'],
  ]

  const parts: string[] = []

  // ── header / book & cert no ──
  parts.push(field('book_no', String(wht.book_no ?? ''), { align: 'center' }))
  parts.push(field('run_no', String(wht.cert_no ?? ''), { align: 'center' }))

  // ── payer (ผู้มีหน้าที่หักภาษี) ──
  parts.push(combField('id1', grp13(wht.payer_tax_id)))
  parts.push(field('name1', String(wht.payer_name ?? '')))
  parts.push(field('add1', String(wht.payer_address ?? '')))

  // ── payee (ผู้ถูกหักภาษี) ──
  parts.push(combField('id1_2', grp13(wht.payee_tax_id)))
  parts.push(field('name2', String(wht.payee_name ?? '')))
  parts.push(field('add2', String(wht.payee_address ?? '')))

  // ── ภ.ง.ด checkboxes (chk1..chk7 = 1ก,1กพิเศษ,2,3,2ก,3ก,53) ──
  parts.push(check('chk1', ft === 'nd1k'))
  parts.push(check('chk2', ft === 'nd1k_s'))
  parts.push(check('chk3', ft === 'nd2'))
  parts.push(check('chk4', ft === 'nd3'))
  parts.push(check('chk5', ft === 'nd2k'))
  parts.push(check('chk6', ft === 'nd3k'))
  parts.push(check('chk7', ft === 'nd53'))

  // ── income rows ──
  for (const [key, dk, pk, tk] of ROWS) {
    const it = items[key]
    if (!it) continue
    parts.push(field(dk, fmtDateBE(it.pay_date), { align: 'center' }))
    parts.push(field(pk, fmtN(it.amount), { align: 'right', pad: 3 }))
    parts.push(field(tk, fmtN(it.tax_withheld), { align: 'right', pad: 3 }))
  }
  // rate for 40(4)(ข)(1.4), and free-text descriptions for (2.5) and อื่นๆ
  parts.push(field('rate1', items['40_4b_1_4']?.income_type_desc || '', { align: 'center' }))
  parts.push(field('spec1', items['40_4b_2_5']?.income_type_desc || ''))
  parts.push(field('spec3', items['other']?.income_type_desc || ''))

  // ── totals row + amount in words ──
  parts.push(field('pay1_14', fmtN(wht.total_amount), { align: 'right', pad: 3, bold: true }))
  parts.push(field('tax1_14', fmtN(wht.total_tax), { align: 'right', pad: 3, bold: true }))
  parts.push(field('total', bahtText(Number(wht.total_tax) || 0), { align: 'center' }))

  // ── provident / social-security funds ──
  parts.push(field('Text1_0_1', wht.fund_sso ? fmtN(wht.fund_sso) : '', { align: 'center' }))
  parts.push(field('Text1_1_0', wht.fund_pvd ? fmtN(wht.fund_pvd) : '', { align: 'center' }))

  // ── payer type (chk8..chk11) + other text ──
  parts.push(check('chk8', pt === '1'))
  parts.push(check('chk9', pt === '2'))
  parts.push(check('chk10', pt === '3'))
  parts.push(check('chk11', pt === '4'))
  parts.push(field('spec4', wht.payer_type_other || ''))

  // ── issue date (day / month / year BE) ──
  const isd = String(wht.issue_date ?? '').slice(0, 10).split('-')
  if (isd.length === 3 && isd[0]) {
    const months = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    parts.push(field('date_pay', String(parseInt(isd[2])), { align: 'center' }))
    parts.push(field('month_pay', months[parseInt(isd[1])] || '', { align: 'center' }))
    parts.push(field('year_pay', String(parseInt(isd[0]) + 543), { align: 'center' }))
  }

  const overlay = parts.join('')

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>หนังสือรับรองการหักภาษี ณ ที่จ่าย${wht.cert_no ? ' ' + esc(wht.cert_no) : ''}</title>
<style>
@page{size:A4 portrait;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#e9e9e9}
@media print{html,body{background:#fff}.noprint{display:none}.page{box-shadow:none;margin:0}}
.noprint{text-align:center;padding:8px 0;font-family:sans-serif}
.noprint button{padding:7px 20px;background:#1565c0;color:#fff;border:none;border-radius:5px;font-size:13px;cursor:pointer}
.page{position:relative;width:${(PAGE_W * MM).toFixed(2)}mm;height:${(PAGE_H * MM).toFixed(2)}mm;margin:6px auto;background:#fff;overflow:hidden}
.page img.bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.page>div{color:#000}
</style></head><body>
<div class="noprint"><button onclick="window.print()">&#128424; พิมพ์ / บันทึก PDF</button></div>
<div class="page"><img class="bg" src="${WHT_FORM_BG}" alt="">${overlay}</div>
</body></html>`
}
