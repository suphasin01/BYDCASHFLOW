import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.local-api');
const DB_PATH = path.join(DB_DIR, 'data.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ── Schema ──────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL DEFAULT 'customer',
    name        TEXT    NOT NULL,
    tax_id      TEXT,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    branch      TEXT,
    note        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    UNIQUE,
    name        TEXT    NOT NULL,
    description TEXT,
    unit        TEXT,
    price       REAL    NOT NULL DEFAULT 0,
    vat_type    TEXT    NOT NULL DEFAULT 'excluded',
    category    TEXT,
    product_usage TEXT  NOT NULL DEFAULT 'both',
    image_url   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT    NOT NULL,
    number       TEXT    UNIQUE,
    contact_id   INTEGER REFERENCES contacts(id),
    contact_name TEXT,
    date         TEXT    NOT NULL DEFAULT (date('now','localtime')),
    due_date     TEXT,
    status       TEXT    NOT NULL DEFAULT 'draft',
    subtotal     REAL    NOT NULL DEFAULT 0,
    discount     REAL    NOT NULL DEFAULT 0,
    vat          REAL    NOT NULL DEFAULT 0,
    total        REAL    NOT NULL DEFAULT 0,
    notes        TEXT,
    meta         TEXT,
    ref_doc_id   INTEGER REFERENCES documents(id),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS document_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES products(id),
    description  TEXT    NOT NULL,
    item_note    TEXT,
    qty          REAL    NOT NULL DEFAULT 1,
    unit         TEXT,
    price        REAL    NOT NULL DEFAULT 0,
    discount     REAL    NOT NULL DEFAULT 0,
    amount       REAL    NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0
    ,color       TEXT
    ,size        TEXT
    ,fabric_width TEXT
    ,chest       TEXT
    ,length      TEXT
    ,sleeve_length TEXT
    ,cut_qty     REAL NOT NULL DEFAULT 0
    ,received_qty REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    amount       REAL    NOT NULL DEFAULT 0,
    date         TEXT    NOT NULL DEFAULT (date('now','localtime')),
    method       TEXT    NOT NULL DEFAULT 'transfer',
    reference    TEXT,
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS companies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL DEFAULT 'บริษัทของฉัน',
    tax_id       TEXT,
    address      TEXT,
    phone        TEXT,
    email        TEXT,
    website      TEXT,
    branch       TEXT,
    logo_url     TEXT,
    note         TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key          TEXT PRIMARY KEY,
    value        TEXT
  );

  INSERT OR IGNORE INTO companies (id, name) VALUES (1, 'บริษัทของฉัน');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('active_company_id', '1');

  CREATE TABLE IF NOT EXISTS withholding_tax (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    book_no          TEXT,
    cert_no          TEXT,
    issue_date       TEXT NOT NULL DEFAULT (date('now','localtime')),
    form_type        TEXT NOT NULL DEFAULT 'nd53',
    payer_name       TEXT NOT NULL DEFAULT '',
    payer_address    TEXT,
    payer_tax_id     TEXT,
    payee_id         INTEGER REFERENCES contacts(id),
    payee_name       TEXT NOT NULL DEFAULT '',
    payee_address    TEXT,
    payee_tax_id     TEXT,
    payer_type       TEXT NOT NULL DEFAULT '1',
    payer_type_other TEXT,
    fund_gpf         REAL NOT NULL DEFAULT 0,
    fund_sso         REAL NOT NULL DEFAULT 0,
    fund_pvd         REAL NOT NULL DEFAULT 0,
    total_amount     REAL NOT NULL DEFAULT 0,
    total_tax        REAL NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS withholding_tax_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    wht_id           INTEGER NOT NULL REFERENCES withholding_tax(id) ON DELETE CASCADE,
    income_type      TEXT NOT NULL,
    income_type_desc TEXT,
    pay_date         TEXT,
    amount           REAL NOT NULL DEFAULT 0,
    tax_withheld     REAL NOT NULL DEFAULT 0,
    sort_order       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS employees (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no  TEXT,
    name         TEXT NOT NULL,
    nickname     TEXT,
    department   TEXT,
    position     TEXT,
    start_date   TEXT,
    salary       REAL NOT NULL DEFAULT 0,
    phone        TEXT,
    email        TEXT,
    id_card      TEXT,
    bank_name    TEXT,
    bank_account TEXT,
    photo_url    TEXT,
    notes        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pay_slips (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name    TEXT NOT NULL DEFAULT '',
    contact_id       INTEGER REFERENCES contacts(id),
    department       TEXT,
    period           TEXT,
    pay_date         TEXT NOT NULL DEFAULT (date('now','localtime')),
    salary           REAL NOT NULL DEFAULT 0,
    cost_of_living   REAL NOT NULL DEFAULT 0,
    position_allow   REAL NOT NULL DEFAULT 0,
    meal_allow       REAL NOT NULL DEFAULT 0,
    overtime         REAL NOT NULL DEFAULT 0,
    shift_allow      REAL NOT NULL DEFAULT 0,
    travel_allow     REAL NOT NULL DEFAULT 0,
    subsidy          REAL NOT NULL DEFAULT 0,
    welfare          REAL NOT NULL DEFAULT 0,
    bonus            REAL NOT NULL DEFAULT 0,
    total_income     REAL NOT NULL DEFAULT 0,
    tax_withheld     REAL NOT NULL DEFAULT 0,
    social_security  REAL NOT NULL DEFAULT 0,
    late_deduct      REAL NOT NULL DEFAULT 0,
    absent_deduct    REAL NOT NULL DEFAULT 0,
    loan_deduct      REAL NOT NULL DEFAULT 0,
    advance_deduct   REAL NOT NULL DEFAULT 0,
    other_deduct     REAL NOT NULL DEFAULT 0,
    total_deductions REAL NOT NULL DEFAULT 0,
    net_income       REAL NOT NULL DEFAULT 0,
    cum_income       REAL NOT NULL DEFAULT 0,
    cum_tax          REAL NOT NULL DEFAULT 0,
    cum_social_sec   REAL NOT NULL DEFAULT 0,
    cum_provident    REAL NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS employee_payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period       TEXT,
    amount       REAL NOT NULL DEFAULT 0,
    pay_date     TEXT NOT NULL DEFAULT (date('now','localtime')),
    method       TEXT NOT NULL DEFAULT 'transfer',
    notes        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'other',
    amount       REAL,
    doc_date     TEXT,
    contact_name TEXT,
    reference    TEXT,
    image_url    TEXT,
    notes        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// Migration: add company column to contacts if it doesn't exist
try { db.exec('ALTER TABLE contacts ADD COLUMN company TEXT'); } catch {}
try { db.exec('ALTER TABLE withholding_tax ADD COLUMN payer_tin TEXT'); } catch {}
try { db.exec('ALTER TABLE withholding_tax ADD COLUMN payee_tin TEXT'); } catch {}
try { db.exec('ALTER TABLE employees ADD COLUMN photo_url TEXT'); } catch {}
try { db.exec('ALTER TABLE employee_payments ADD COLUMN receipt_image TEXT'); } catch {}
try { db.exec('CREATE TABLE IF NOT EXISTS evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT \'other\', amount REAL, doc_date TEXT, contact_name TEXT, reference TEXT, image_url TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\',\'localtime\')))'); } catch {}
try { db.exec('ALTER TABLE pay_slips ADD COLUMN receipt_image TEXT'); } catch {}
try { db.exec('ALTER TABLE products ADD COLUMN image_url TEXT'); } catch {}
try { db.exec("ALTER TABLE products ADD COLUMN product_usage TEXT NOT NULL DEFAULT 'both'"); } catch {}
try { db.exec('ALTER TABLE documents ADD COLUMN meta TEXT'); } catch {}
for (const col of ['item_note TEXT','color TEXT','size TEXT','fabric_width TEXT','chest TEXT','length TEXT','sleeve_length TEXT','cut_qty REAL NOT NULL DEFAULT 0','received_qty REAL NOT NULL DEFAULT 0']) {
  try { db.exec(`ALTER TABLE document_items ADD COLUMN ${col}`); } catch {}
}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_invoice_per_delivery
    ON documents(ref_doc_id) WHERE type='delivery_tax_invoice' AND status!='cancelled' AND ref_doc_id IS NOT NULL`);
} catch {}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Strip leading colon/at/dollar from named param keys:
//   { ':id': 5 } → { id: 5 }  (node:sqlite → better-sqlite3 compat)
function np(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k.replace(/^[:@$]/, '')] = v;
  }
  return out;
}

function run(sql: string, params: Record<string, unknown> = {}) {
  return db.prepare(sql).run(np(params));
}

function get<T = unknown>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function all<T = unknown>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

// ── Auto-number generator ──────────────────────────────────────────────────────────────

const prefixMap: Record<string, string> = {
  delivery_tax_invoice: 'DTI', delivery_note: 'DN', work_order: 'WO',
  quotation: 'QT', invoice: 'INV', receipt: 'REC',
  billing_note: 'BN', cash_invoice: 'CI', purchase_order: 'PO', expense: 'EXP',
};

export function generateDocNumber(type: string): string {
  const prefix = prefixMap[type] ?? 'DOC';
  const year  = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const row = get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM documents WHERE type = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now','localtime')`,
    type
  );
  const seq = String((row?.cnt ?? 0) + 1).padStart(4, '0');
  return `${prefix}${year}${month}-${seq}`;
}

function ensureTaxInvoicePoNumber(data: Record<string, unknown>): void {
  if (data.type !== 'delivery_tax_invoice') return;
  let meta: Record<string, unknown> = {};
  try {
    meta = typeof data.meta === 'string' ? JSON.parse(data.meta) : (data.meta as Record<string, unknown> || {});
  } catch {
    meta = {};
  }
  if (String(meta.po_number || '').trim()) return;
  const documentNumber = String(data.number || '').trim();
  if (!documentNumber) return;
  meta.po_number = documentNumber.startsWith('DTI')
    ? documentNumber.replace(/^DTI/, 'PO')
    : documentNumber.startsWith('PO') ? documentNumber : `PO-${documentNumber}`;
  data.meta = JSON.stringify(meta);
}

// ── Contacts ─────────────────────────────────────────────────────────────────────

export const contactRepo = {
  list: (type?: string) => type
    ? all('SELECT * FROM contacts WHERE type = ? ORDER BY name', type)
    : all('SELECT * FROM contacts ORDER BY name'),
  get: (id: number) => get('SELECT * FROM contacts WHERE id = ?', id),
  create: (data: Record<string, unknown>) => {
    const r = run(`INSERT INTO contacts (type,name,company,tax_id,email,phone,address,branch,note) VALUES (:type,:name,:company,:tax_id,:email,:phone,:address,:branch,:note)`, {
      ':type': data.type ?? 'customer', ':name': data.name ?? '', ':company': data.company ?? null, ':tax_id': data.tax_id ?? null,
      ':email': data.email ?? null, ':phone': data.phone ?? null,
      ':address': data.address ?? null, ':branch': data.branch ?? null, ':note': data.note ?? null,
    });
    return get('SELECT * FROM contacts WHERE id = ?', r.lastInsertRowid);
  },
  update: (id: number, data: Record<string, unknown>) => {
    const allowed = ['type','name','company','tax_id','email','phone','address','branch','note'];
    const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => allowed.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE contacts SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    return get('SELECT * FROM contacts WHERE id = ?', id);
  },
  delete: (id: number) => db.prepare('DELETE FROM contacts WHERE id = ?').run(id),
  search: (q: string) => all(`SELECT * FROM contacts WHERE name LIKE ? OR company LIKE ? OR tax_id LIKE ? OR email LIKE ? ORDER BY name`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`),
};

// ── Products ───────────────────────────────────────────────────────────────────

export const productRepo = {
  list: () => all('SELECT * FROM products ORDER BY name'),
  get: (id: number) => get('SELECT * FROM products WHERE id = ?', id),
  create: (data: Record<string, unknown>) => {
    const r = run(`INSERT INTO products (code,name,description,unit,price,vat_type,category,product_usage,image_url) VALUES (:code,:name,:description,:unit,:price,:vat_type,:category,:product_usage,:image_url)`, {
      ':code': data.code ?? null, ':name': data.name ?? '', ':description': data.description ?? null,
      ':unit': data.unit ?? null, ':price': data.price ?? 0, ':vat_type': data.vat_type ?? 'excluded', ':category': data.category ?? null,
      ':product_usage': data.product_usage ?? 'both',
      ':image_url': data.image_url ?? null,
    });
    return get('SELECT * FROM products WHERE id = ?', r.lastInsertRowid);
  },
  update: (id: number, data: Record<string, unknown>) => {
    const allowed = ['code','name','description','unit','price','vat_type','category','product_usage','image_url'];
    const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => allowed.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE products SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    return get('SELECT * FROM products WHERE id = ?', id);
  },
  delete: (id: number) => db.prepare('DELETE FROM products WHERE id = ?').run(id),
  search: (q: string) => all(`SELECT * FROM products WHERE name LIKE ? OR code LIKE ? ORDER BY name`, `%${q}%`, `%${q}%`),
};

// ── Documents ─────────────────────────────────────────────────────────────────────

const workflowItemKey = (item: Record<string, unknown>) => {
  const size = String(item.size || item.unit || '').trim().toLowerCase();
  return item.product_id
    ? `product:${item.product_id}|size:${size}`
    : `text:${String(item.description || '').trim().toLowerCase()}|size:${size}`;
};

function validateDocumentWorkflow(data: Record<string, unknown>, items: Record<string, unknown>[], updatingId?: number) {
  const refId = Number(data.ref_doc_id || 0);
  if (!refId) return;
  const source = get<Record<string, unknown>>('SELECT * FROM documents WHERE id = ?', refId);
  if (!source) throw new Error('ไม่พบเอกสารต้นทาง');

  if (data.type === 'delivery_note') {
    if (source.type !== 'work_order') throw new Error('ใบส่งของต้องเชื่อมจากใบสั่งงานเท่านั้น');
    if (updatingId) {
      const billed = get<{ id: number }>(
        `SELECT id FROM documents WHERE type='delivery_tax_invoice' AND ref_doc_id=? AND status!='cancelled'`,
        updatingId
      );
      if (billed) throw new Error('แก้ไขใบส่งของไม่ได้ เนื่องจากนำไปวางบิลแล้ว');
    }
    const sourceItems = all<Record<string, unknown>>('SELECT * FROM document_items WHERE document_id = ?', refId);
    const delivered = all<Record<string, unknown>>(
      `SELECT di.* FROM document_items di JOIN documents d ON d.id = di.document_id
       WHERE d.type = 'delivery_note' AND d.ref_doc_id = ? AND d.status != 'cancelled' AND d.id != ?`,
      refId, updatingId ?? -1
    );
    for (const item of items) {
      const key = workflowItemKey(item);
      const ordered = sourceItems.filter(row => workflowItemKey(row) === key).reduce((sum, row) => sum + Number(row.qty || 0), 0);
      const alreadyDelivered = delivered.filter(row => workflowItemKey(row) === key).reduce((sum, row) => sum + Number(row.qty || 0), 0);
      const requested = Number(item.qty || 0);
      if (!ordered) throw new Error(`รายการ "${String(item.description || '')}" ไม่อยู่ในใบสั่งงานต้นทาง`);
      if (requested <= 0 || requested > ordered - alreadyDelivered) {
        throw new Error(`จำนวนส่งของ "${String(item.description || '')}" เกินยอดคงเหลือ ${Math.max(0, ordered - alreadyDelivered)}`);
      }
    }
  } else if (data.type === 'delivery_tax_invoice') {
    if (source.type !== 'delivery_note') throw new Error('ใบส่งสินค้า/ใบกำกับภาษีต้องเชื่อมจากใบส่งของเท่านั้น');
    const duplicate = get<{ id: number }>(
      `SELECT id FROM documents WHERE type = 'delivery_tax_invoice' AND ref_doc_id = ? AND status != 'cancelled' AND id != ?`,
      refId, updatingId ?? -1
    );
    if (duplicate) throw new Error('ใบส่งของนี้ถูกนำไปวางบิลแล้ว');
    const sourceItems = all<Record<string, unknown>>('SELECT * FROM document_items WHERE document_id = ?', refId);
    for (const item of items) {
      const key = workflowItemKey(item);
      const deliveredQty = sourceItems.filter(row => workflowItemKey(row) === key).reduce((sum, row) => sum + Number(row.qty || 0), 0);
      const billedQty = Number(item.qty || 0);
      if (!deliveredQty || billedQty <= 0 || billedQty > deliveredQty) {
        throw new Error(`จำนวนวางบิลของ "${String(item.description || '')}" เกินจำนวนส่ง ${deliveredQty}`);
      }
    }
  } else {
    throw new Error('ประเภทเอกสารไม่รองรับการเชื่อมต่อ');
  }
}

export const documentRepo = {
  list: (filters: { type?: string; status?: string; contact_id?: number; limit?: number; offset?: number; q?: string; month?: string } = {}) => {
    let sql = 'SELECT d.*, c.name as contact_display FROM documents d LEFT JOIN contacts c ON d.contact_id = c.id WHERE 1=1';
    const params: unknown[] = [];
    if (filters.type)       { sql += ' AND d.type = ?';       params.push(filters.type); }
    if (filters.status)     { sql += ' AND d.status = ?';     params.push(filters.status); }
    if (filters.contact_id) { sql += ' AND d.contact_id = ?'; params.push(filters.contact_id); }
    if (filters.q) { sql += ' AND (d.number LIKE ? OR d.contact_name LIKE ?)'; params.push(`%${filters.q}%`, `%${filters.q}%`); }
    // Month filter (YYYY-MM) — scopes documents to a single month by issue date.
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) { sql += " AND strftime('%Y-%m', d.date) = ?"; params.push(filters.month); }
    sql += ` ORDER BY d.created_at DESC LIMIT ${filters.limit ?? 50} OFFSET ${filters.offset ?? 0}`;
    return all(sql, ...params);
  },
  get: (id: number) => {
    const doc = get<Record<string, unknown>>('SELECT * FROM documents WHERE id = ?', id);
    if (!doc) return null;
    const items = all(
      `SELECT di.*, p.image_url AS product_image
       FROM document_items di
       LEFT JOIN products p ON p.id = di.product_id
       WHERE di.document_id = ?
       ORDER BY di.sort_order`,
      id
    );
    const payments = all('SELECT * FROM payments WHERE document_id = ? ORDER BY date', id);
    const linked_documents = all<Record<string, unknown>>('SELECT id,type,number,date,status,total FROM documents WHERE ref_doc_id = ? ORDER BY created_at', id);
    const source_document = doc.ref_doc_id
      ? get<Record<string, unknown>>('SELECT id,type,number,date,status,total FROM documents WHERE id = ?', doc.ref_doc_id)
      : null;
    let workflow_status: string | null = null;
    if (doc.type === 'work_order') {
      const ordered = (items as Record<string, unknown>[]).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const delivered = get<{ qty: number }>(
        `SELECT COALESCE(SUM(di.qty),0) qty FROM document_items di JOIN documents d ON d.id=di.document_id
         WHERE d.type='delivery_note' AND d.ref_doc_id=? AND d.status!='cancelled'`, id
      )?.qty || 0;
      workflow_status = delivered <= 0 ? 'not_delivered' : delivered < ordered ? 'partially_delivered' : 'delivered';
      for (const item of items as Record<string, unknown>[]) {
        const deliveredForItem = all<Record<string, unknown>>(
          `SELECT di.* FROM document_items di JOIN documents d ON d.id=di.document_id
           WHERE d.type='delivery_note' AND d.ref_doc_id=? AND d.status!='cancelled'`, id
        ).filter(row => workflowItemKey(row) === workflowItemKey(item))
          .reduce((sum, row) => sum + Number(row.qty || 0), 0);
        item.remaining_qty = Math.max(0, Number(item.qty || 0) - deliveredForItem);
      }
    } else if (doc.type === 'delivery_note') {
      workflow_status = linked_documents.some(linked => linked.type === 'delivery_tax_invoice' && linked.status !== 'cancelled') ? 'billed' : 'not_billed';
    }
    return { ...doc, items, payments, linked_documents, source_document, workflow_status };
  },
  create: (data: Record<string, unknown>, items: Record<string, unknown>[] = []) => {
    validateDocumentWorkflow(data, items);
    if (!data.number) data.number = generateDocNumber(data.type as string);
    ensureTaxInvoicePoNumber(data);
    const r = run(`INSERT INTO documents (type,number,contact_id,contact_name,date,due_date,status,subtotal,discount,vat,total,notes,meta,ref_doc_id) VALUES (:type,:number,:contact_id,:contact_name,:date,:due_date,:status,:subtotal,:discount,:vat,:total,:notes,:meta,:ref_doc_id)`, {
      ':type': data.type, ':number': data.number, ':contact_id': data.contact_id ?? null,
      ':contact_name': data.contact_name ?? null, ':date': data.date ?? new Date().toISOString().slice(0,10),
      ':due_date': data.due_date ?? null, ':status': data.status ?? 'draft',
      ':subtotal': data.subtotal ?? 0, ':discount': data.discount ?? 0, ':vat': data.vat ?? 0,
      ':total': data.total ?? 0, ':notes': data.notes ?? null, ':meta': data.meta ?? null, ':ref_doc_id': data.ref_doc_id ?? null,
    });
    const docId = r.lastInsertRowid as number;
    items.forEach((item, idx) => {
      run(`INSERT INTO document_items (document_id,product_id,description,item_note,qty,unit,price,discount,amount,sort_order,color,size,fabric_width,chest,length,sleeve_length,cut_qty,received_qty) VALUES (:document_id,:product_id,:description,:item_note,:qty,:unit,:price,:discount,:amount,:sort_order,:color,:size,:fabric_width,:chest,:length,:sleeve_length,:cut_qty,:received_qty)`, {
        ':document_id': docId, ':product_id': item.product_id ?? null,
        ':description': item.description ?? '', ':item_note': item.item_note ?? null, ':qty': item.qty ?? 1, ':unit': item.unit ?? null,
        ':price': item.price ?? 0, ':discount': item.discount ?? 0, ':amount': item.amount ?? 0, ':sort_order': idx,
        ':color': item.color ?? null, ':size': item.size ?? null, ':fabric_width': item.fabric_width ?? null,
        ':chest': item.chest ?? null, ':length': item.length ?? null, ':sleeve_length': item.sleeve_length ?? null, ':cut_qty': item.cut_qty ?? 0, ':received_qty': item.received_qty ?? 0,
      });
    });
    return documentRepo.get(docId);
  },
  update: (id: number, data: Record<string, unknown>, items?: Record<string, unknown>[]) => {
    const current = get<Record<string, unknown>>('SELECT * FROM documents WHERE id = ?', id);
    if (!current) throw new Error('ไม่พบเอกสาร');
    const merged = { ...current, ...data };
    ensureTaxInvoicePoNumber(merged);
    if (merged.meta !== current.meta) data.meta = merged.meta;
    if (items !== undefined) validateDocumentWorkflow(merged, items, id);
    const allowed = ['number','contact_id','contact_name','date','due_date','status','subtotal','discount','vat','total','notes','meta','ref_doc_id'];
    const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => allowed.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE documents SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    if (items !== undefined) {
      db.prepare('DELETE FROM document_items WHERE document_id = ?').run(id);
      items.forEach((item, idx) => {
        run(`INSERT INTO document_items (document_id,product_id,description,item_note,qty,unit,price,discount,amount,sort_order,color,size,fabric_width,chest,length,sleeve_length,cut_qty,received_qty) VALUES (:document_id,:product_id,:description,:item_note,:qty,:unit,:price,:discount,:amount,:sort_order,:color,:size,:fabric_width,:chest,:length,:sleeve_length,:cut_qty,:received_qty)`, {
          ':document_id': id, ':product_id': item.product_id ?? null,
          ':description': item.description ?? '', ':item_note': item.item_note ?? null, ':qty': item.qty ?? 1, ':unit': item.unit ?? null,
          ':price': item.price ?? 0, ':discount': item.discount ?? 0, ':amount': item.amount ?? 0, ':sort_order': idx,
          ':color': item.color ?? null, ':size': item.size ?? null, ':fabric_width': item.fabric_width ?? null,
          ':chest': item.chest ?? null, ':length': item.length ?? null, ':sleeve_length': item.sleeve_length ?? null, ':cut_qty': item.cut_qty ?? 0, ':received_qty': item.received_qty ?? 0,
        });
      });
    }
    return documentRepo.get(id);
  },
  delete: (id: number) => {
    const linked = get<{ id: number }>('SELECT id FROM documents WHERE ref_doc_id = ? LIMIT 1', id);
    if (linked) throw new Error('ลบเอกสารนี้ไม่ได้ เนื่องจากมีเอกสารถัดไปเชื่อมอยู่');
    return db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  },
  updateStatus: (id: number, status: string) => {
    db.prepare(`UPDATE documents SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, id);
    return documentRepo.get(id);
  },
  // Documents that involve money flow, with how much has been paid against each.
  // direction 'in'  = money we collect from customers (invoice, billing note, ...)
  // direction 'out' = money we pay to vendors (purchase order, expense)
  listForPayments: (direction?: 'in' | 'out') => {
    // A `receipt` is issued AFTER money is received — it is proof of payment,
    // not an amount still owed — so it is intentionally excluded from receivables.
    const IN_TYPES = ['delivery_tax_invoice', 'invoice', 'billing_note', 'cash_invoice'];
    const OUT_TYPES = ['purchase_order', 'expense'];
    const types = direction === 'in' ? IN_TYPES : direction === 'out' ? OUT_TYPES : [...IN_TYPES, ...OUT_TYPES];
    const placeholders = types.map(() => '?').join(',');
    return all(
      `SELECT d.*, c.name as contact_display, c.type as contact_type,
        COALESCE((SELECT SUM(amount) FROM payments WHERE document_id = d.id), 0) as paid_amount
       FROM documents d LEFT JOIN contacts c ON d.contact_id = c.id
       WHERE d.type IN (${placeholders}) AND d.status != 'cancelled'
       ORDER BY (d.due_date IS NULL), d.due_date ASC, d.date DESC`,
      ...types
    );
  },
};

// ── Payments ───────────────────────────────────────────────────────────────────

export const paymentRepo = {
  list: (document_id?: number) => document_id
    ? all('SELECT p.*, d.number as doc_number, d.contact_name FROM payments p LEFT JOIN documents d ON d.id = p.document_id WHERE p.document_id = ? ORDER BY p.date DESC', document_id)
    : all('SELECT p.*, d.number as doc_number, d.contact_name FROM payments p LEFT JOIN documents d ON d.id = p.document_id ORDER BY p.date DESC'),
  create: (data: Record<string, unknown>) => {
    const r = run(`INSERT INTO payments (document_id,amount,date,method,reference,notes) VALUES (:document_id,:amount,:date,:method,:reference,:notes)`, {
      ':document_id': data.document_id, ':amount': data.amount ?? 0,
      ':date': data.date ?? new Date().toISOString().slice(0,10),
      ':method': data.method ?? 'transfer', ':reference': data.reference ?? null, ':notes': data.notes ?? null,
    });
    // Auto-mark paid if fully paid
    const doc = get<{ total: number }>('SELECT total FROM documents WHERE id = ?', data.document_id as number);
    const paid = get<{ s: number }>('SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE document_id = ?', data.document_id as number);
    if (doc && paid && paid.s >= doc.total) {
      db.prepare(`UPDATE documents SET status = 'paid', updated_at = datetime('now','localtime') WHERE id = ?`).run(data.document_id as number);
    }
    return get('SELECT * FROM payments WHERE id = ?', r.lastInsertRowid);
  },
  delete: (id: number) => db.prepare('DELETE FROM payments WHERE id = ?').run(id),
};

// ── Companies ───────────────────────────────────────────────────────────────────

export const companyRepo = {
  list: () => all('SELECT * FROM companies ORDER BY id'),

  get: (id: number) => get('SELECT * FROM companies WHERE id = ?', id),

  getActive: () => {
    const setting = get<{ key: string; value: string }>('SELECT * FROM settings WHERE key = ?', 'active_company_id');
    const activeId = setting ? Number(setting.value) : 1;
    return get('SELECT * FROM companies WHERE id = ?', activeId) ?? get('SELECT * FROM companies ORDER BY id LIMIT 1');
  },

  setActive: (id: number) => {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('active_company_id', ?)`).run(String(id));
    return companyRepo.getActive();
  },

  create: (data: Record<string, unknown>) => {
    const r = run(
      `INSERT INTO companies (name,tax_id,address,phone,email,website,branch,note,logo_url)
       VALUES (:name,:tax_id,:address,:phone,:email,:website,:branch,:note,:logo_url)`,
      {
        ':name':     data.name     ?? 'บริษัทใหม่',
        ':tax_id':   data.tax_id   ?? null,
        ':address':  data.address  ?? null,
        ':phone':    data.phone    ?? null,
        ':email':    data.email    ?? null,
        ':website':  data.website  ?? null,
        ':branch':   data.branch   ?? null,
        ':note':     data.note     ?? null,
        ':logo_url': data.logo_url ?? null,
      }
    );
    return get('SELECT * FROM companies WHERE id = ?', r.lastInsertRowid);
  },

  update: (id: number, data: Record<string, unknown>) => {
    const allowed = ['name','tax_id','address','phone','email','website','branch','note','logo_url'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (keys.length) {
      const fields = keys.map(k => `${k} = :${k}`).join(', ');
      const params: Record<string, unknown> = { ':id': id };
      keys.forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE companies SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    return companyRepo.get(id);
  },

  delete: (id: number) => {
    const active = companyRepo.getActive() as any;
    db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    // ถ้าลบบริษัท active ให้เปลี่ยนไปตัวแรก
    if (active?.id === id) {
      const first = get<{ id: number }>('SELECT id FROM companies ORDER BY id LIMIT 1');
      if (first) companyRepo.setActive(first.id);
    }
    return { success: true };
  },
};

// ── Business compat (proxy to active company) ─────────────────────────────────────
export const businessRepo = {
  get: () => companyRepo.getActive(),
  update: (data: Record<string, unknown>) => {
    const active = companyRepo.getActive() as any;
    if (!active) return null;
    return companyRepo.update(active.id, data);
  },
};

// ── Withholding Tax ──────────────────────────────────────────────────────────────

export const withholdingTaxRepo = {
  list: () => all('SELECT * FROM withholding_tax ORDER BY created_at DESC'),

  get: (id: number) => {
    const wht = get<Record<string, unknown>>('SELECT * FROM withholding_tax WHERE id = ?', id);
    if (!wht) return null;
    const items = all('SELECT * FROM withholding_tax_items WHERE wht_id = ? ORDER BY sort_order', id);
    return { ...wht, items };
  },

  create: (data: Record<string, unknown>, items: Record<string, unknown>[] = []) => {
    const r = run(
      `INSERT INTO withholding_tax (book_no,cert_no,issue_date,form_type,payer_name,payer_address,payer_tax_id,payer_tin,payee_id,payee_name,payee_address,payee_tax_id,payee_tin,payer_type,payer_type_other,fund_gpf,fund_sso,fund_pvd,total_amount,total_tax)
       VALUES (:book_no,:cert_no,:issue_date,:form_type,:payer_name,:payer_address,:payer_tax_id,:payer_tin,:payee_id,:payee_name,:payee_address,:payee_tax_id,:payee_tin,:payer_type,:payer_type_other,:fund_gpf,:fund_sso,:fund_pvd,:total_amount,:total_tax)`,
      {
        ':book_no': data.book_no ?? null, ':cert_no': data.cert_no ?? null,
        ':issue_date': data.issue_date ?? new Date().toISOString().slice(0, 10),
        ':form_type': data.form_type ?? 'nd53',
        ':payer_name': data.payer_name ?? '', ':payer_address': data.payer_address ?? null,
        ':payer_tax_id': data.payer_tax_id ?? null, ':payer_tin': data.payer_tin ?? null,
        ':payee_id': data.payee_id ?? null, ':payee_name': data.payee_name ?? '',
        ':payee_address': data.payee_address ?? null, ':payee_tax_id': data.payee_tax_id ?? null,
        ':payee_tin': data.payee_tin ?? null,
        ':payer_type': data.payer_type ?? '1', ':payer_type_other': data.payer_type_other ?? null,
        ':fund_gpf': data.fund_gpf ?? 0, ':fund_sso': data.fund_sso ?? 0, ':fund_pvd': data.fund_pvd ?? 0,
        ':total_amount': data.total_amount ?? 0, ':total_tax': data.total_tax ?? 0,
      }
    );
    const whtId = r.lastInsertRowid as number;
    items.forEach((item, idx) => {
      run(
        `INSERT INTO withholding_tax_items (wht_id,income_type,income_type_desc,pay_date,amount,tax_withheld,sort_order)
         VALUES (:wht_id,:income_type,:income_type_desc,:pay_date,:amount,:tax_withheld,:sort_order)`,
        {
          ':wht_id': whtId, ':income_type': item.income_type ?? '',
          ':income_type_desc': item.income_type_desc ?? null,
          ':pay_date': item.pay_date ?? null,
          ':amount': item.amount ?? 0, ':tax_withheld': item.tax_withheld ?? 0, ':sort_order': idx,
        }
      );
    });
    return withholdingTaxRepo.get(whtId);
  },

  update: (id: number, data: Record<string, unknown>, items?: Record<string, unknown>[]) => {
    const allowed = ['book_no','cert_no','issue_date','form_type','payer_name','payer_address','payer_tax_id','payer_tin','payee_id','payee_name','payee_address','payee_tax_id','payee_tin','payer_type','payer_type_other','fund_gpf','fund_sso','fund_pvd','total_amount','total_tax'];
    const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => allowed.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE withholding_tax SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    if (items !== undefined) {
      db.prepare('DELETE FROM withholding_tax_items WHERE wht_id = ?').run(id);
      items.forEach((item, idx) => {
        run(
          `INSERT INTO withholding_tax_items (wht_id,income_type,income_type_desc,pay_date,amount,tax_withheld,sort_order)
           VALUES (:wht_id,:income_type,:income_type_desc,:pay_date,:amount,:tax_withheld,:sort_order)`,
          {
            ':wht_id': id, ':income_type': item.income_type ?? '',
            ':income_type_desc': item.income_type_desc ?? null,
            ':pay_date': item.pay_date ?? null,
            ':amount': item.amount ?? 0, ':tax_withheld': item.tax_withheld ?? 0, ':sort_order': idx,
          }
        );
      });
    }
    return withholdingTaxRepo.get(id);
  },

  delete: (id: number) => db.prepare('DELETE FROM withholding_tax WHERE id = ?').run(id),
};

// ── Employees ─────────────────────────────────────────────────────────────────────

const EMP_FIELDS = ['employee_no','name','nickname','department','position','start_date','salary','phone','email','id_card','bank_name','bank_account','photo_url','notes'];

export const employeeRepo = {
  list: (q?: string) => q
    ? all(`SELECT * FROM employees WHERE name LIKE ? OR employee_no LIKE ? OR department LIKE ? OR position LIKE ? ORDER BY name`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : all('SELECT * FROM employees ORDER BY name'),
  get: (id: number) => get('SELECT * FROM employees WHERE id = ?', id),
  create: (data: Record<string, unknown>) => {
    const r = run(
      `INSERT INTO employees (employee_no,name,nickname,department,position,start_date,salary,phone,email,id_card,bank_name,bank_account,photo_url,notes)
       VALUES (:employee_no,:name,:nickname,:department,:position,:start_date,:salary,:phone,:email,:id_card,:bank_name,:bank_account,:photo_url,:notes)`,
      {
        ':employee_no': data.employee_no ?? null, ':name': data.name ?? '',
        ':nickname': data.nickname ?? null, ':department': data.department ?? null,
        ':position': data.position ?? null, ':start_date': data.start_date ?? null,
        ':salary': data.salary ?? 0, ':phone': data.phone ?? null,
        ':email': data.email ?? null, ':id_card': data.id_card ?? null,
        ':bank_name': data.bank_name ?? null, ':bank_account': data.bank_account ?? null,
        ':photo_url': data.photo_url ?? null, ':notes': data.notes ?? null,
      }
    );
    return get('SELECT * FROM employees WHERE id = ?', r.lastInsertRowid);
  },
  update: (id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).filter(k => EMP_FIELDS.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => EMP_FIELDS.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE employees SET ${fields}, updated_at = datetime('now','localtime') WHERE id = :id`).run(np(params));
    }
    return get('SELECT * FROM employees WHERE id = ?', id);
  },
  delete: (id: number) => db.prepare('DELETE FROM employees WHERE id = ?').run(id),
};

// ── Pay Slips ─────────────────────────────────────────────────────────────────────

const PS_FIELDS = ['employee_name','contact_id','department','period','pay_date','salary','cost_of_living','position_allow','meal_allow','overtime','shift_allow','travel_allow','subsidy','welfare','bonus','total_income','tax_withheld','social_security','late_deduct','absent_deduct','loan_deduct','advance_deduct','other_deduct','total_deductions','net_income','cum_income','cum_tax','cum_social_sec','cum_provident','notes','receipt_image'];

export const paySlipRepo = {
  list: (q?: string) => q
    ? all(`SELECT * FROM pay_slips WHERE employee_name LIKE ? OR department LIKE ? OR period LIKE ? ORDER BY pay_date DESC, created_at DESC`, `%${q}%`, `%${q}%`, `%${q}%`)
    : all('SELECT * FROM pay_slips ORDER BY pay_date DESC, created_at DESC'),
  get: (id: number) => get('SELECT * FROM pay_slips WHERE id = ?', id),
  deleteByEmployeePeriod: (employee_name: string, period: string) =>
    db.prepare('DELETE FROM pay_slips WHERE employee_name = ? AND period = ?').run(employee_name, period),
  create: (data: Record<string, unknown>) => {
    // Replace any existing slip for the same employee + period so paying salary
    // and creating a slip for the same month never produces duplicates.
    if (data.employee_name && data.period) {
      db.prepare('DELETE FROM pay_slips WHERE employee_name = ? AND period = ?').run(data.employee_name, data.period);
    }
    const r = run(
      `INSERT INTO pay_slips (employee_name,contact_id,department,period,pay_date,salary,cost_of_living,position_allow,meal_allow,overtime,shift_allow,travel_allow,subsidy,welfare,bonus,total_income,tax_withheld,social_security,late_deduct,absent_deduct,loan_deduct,advance_deduct,other_deduct,total_deductions,net_income,cum_income,cum_tax,cum_social_sec,cum_provident,notes,receipt_image)
       VALUES (:employee_name,:contact_id,:department,:period,:pay_date,:salary,:cost_of_living,:position_allow,:meal_allow,:overtime,:shift_allow,:travel_allow,:subsidy,:welfare,:bonus,:total_income,:tax_withheld,:social_security,:late_deduct,:absent_deduct,:loan_deduct,:advance_deduct,:other_deduct,:total_deductions,:net_income,:cum_income,:cum_tax,:cum_social_sec,:cum_provident,:notes,:receipt_image)`,
      {
        ':employee_name': data.employee_name ?? '', ':contact_id': data.contact_id ?? null,
        ':department': data.department ?? null, ':period': data.period ?? null,
        ':pay_date': data.pay_date ?? new Date().toISOString().slice(0,10),
        ':salary': data.salary ?? 0, ':cost_of_living': data.cost_of_living ?? 0,
        ':position_allow': data.position_allow ?? 0, ':meal_allow': data.meal_allow ?? 0,
        ':overtime': data.overtime ?? 0, ':shift_allow': data.shift_allow ?? 0,
        ':travel_allow': data.travel_allow ?? 0, ':subsidy': data.subsidy ?? 0,
        ':welfare': data.welfare ?? 0, ':bonus': data.bonus ?? 0,
        ':total_income': data.total_income ?? 0, ':tax_withheld': data.tax_withheld ?? 0,
        ':social_security': data.social_security ?? 0, ':late_deduct': data.late_deduct ?? 0,
        ':absent_deduct': data.absent_deduct ?? 0, ':loan_deduct': data.loan_deduct ?? 0,
        ':advance_deduct': data.advance_deduct ?? 0, ':other_deduct': data.other_deduct ?? 0,
        ':total_deductions': data.total_deductions ?? 0, ':net_income': data.net_income ?? 0,
        ':cum_income': data.cum_income ?? 0, ':cum_tax': data.cum_tax ?? 0,
        ':cum_social_sec': data.cum_social_sec ?? 0, ':cum_provident': data.cum_provident ?? 0,
        ':notes': data.notes ?? null,
        ':receipt_image': data.receipt_image ?? null,
      }
    );
    return get('SELECT * FROM pay_slips WHERE id = ?', r.lastInsertRowid);
  },
  update: (id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).filter(k => PS_FIELDS.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => PS_FIELDS.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE pay_slips SET ${fields} WHERE id = :id`).run(np(params));
    }
    return get('SELECT * FROM pay_slips WHERE id = ?', id);
  },
  delete: (id: number) => db.prepare('DELETE FROM pay_slips WHERE id = ?').run(id),
};

// ── Employee Salary Payments ───────────────────────────────────────────────────────

export const employeePaymentRepo = {
  list: (employee_id?: number) => employee_id
    ? all('SELECT * FROM employee_payments WHERE employee_id = ? ORDER BY pay_date DESC, id DESC', employee_id)
    : all('SELECT ep.*, e.name as employee_name FROM employee_payments ep LEFT JOIN employees e ON e.id = ep.employee_id ORDER BY ep.pay_date DESC, ep.id DESC'),
  get: (id: number) => get('SELECT * FROM employee_payments WHERE id = ?', id),
  create: (data: Record<string, unknown>) => {
    // Replace any existing payment for the same employee + period to avoid
    // duplicate salary-payment rows for one month.
    if (data.employee_id && data.period) {
      db.prepare('DELETE FROM employee_payments WHERE employee_id = ? AND period = ?').run(data.employee_id, data.period);
    }
    const r = run(
      `INSERT INTO employee_payments (employee_id,period,amount,pay_date,method,notes,receipt_image)
       VALUES (:employee_id,:period,:amount,:pay_date,:method,:notes,:receipt_image)`,
      {
        ':employee_id': data.employee_id, ':period': data.period ?? null,
        ':amount': data.amount ?? 0,
        ':pay_date': data.pay_date ?? new Date().toISOString().slice(0,10),
        ':method': data.method ?? 'transfer', ':notes': data.notes ?? null,
        ':receipt_image': data.receipt_image ?? null,
      }
    );
    return get('SELECT * FROM employee_payments WHERE id = ?', r.lastInsertRowid);
  },
  delete: (id: number) => db.prepare('DELETE FROM employee_payments WHERE id = ?').run(id),
  deleteByEmployeePeriod: (employee_id: number, period: string) =>
    db.prepare('DELETE FROM employee_payments WHERE employee_id = ? AND period = ?').run(employee_id, period),
};

// ── Evidence ──────────────────────────────────────────────────────────────────

const EVIDENCE_FIELDS = ['title','category','amount','doc_date','contact_name','reference','image_url','notes'];

export const evidenceRepo = {
  list: (q?: string, category?: string) => {
    if (q && category) return all('SELECT * FROM evidence WHERE (title LIKE ? OR contact_name LIKE ? OR reference LIKE ?) AND category = ? ORDER BY doc_date DESC, created_at DESC', `%${q}%`, `%${q}%`, `%${q}%`, category);
    if (q) return all('SELECT * FROM evidence WHERE title LIKE ? OR contact_name LIKE ? OR reference LIKE ? ORDER BY doc_date DESC, created_at DESC', `%${q}%`, `%${q}%`, `%${q}%`);
    if (category) return all('SELECT * FROM evidence WHERE category = ? ORDER BY doc_date DESC, created_at DESC', category);
    return all('SELECT * FROM evidence ORDER BY doc_date DESC, created_at DESC');
  },
  create: (data: Record<string, unknown>) => {
    const r = run(
      `INSERT INTO evidence (title,category,amount,doc_date,contact_name,reference,image_url,notes)
       VALUES (:title,:category,:amount,:doc_date,:contact_name,:reference,:image_url,:notes)`,
      {
        ':title': data.title ?? '', ':category': data.category ?? 'other',
        ':amount': data.amount ?? null, ':doc_date': data.doc_date ?? null,
        ':contact_name': data.contact_name ?? null, ':reference': data.reference ?? null,
        ':image_url': data.image_url ?? null, ':notes': data.notes ?? null,
      }
    );
    return get('SELECT * FROM evidence WHERE id = ?', r.lastInsertRowid);
  },
  update: (id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).filter(k => EVIDENCE_FIELDS.includes(k)).map(k => `${k} = :${k}`).join(', ');
    if (fields) {
      const params: Record<string, unknown> = { ':id': id };
      Object.keys(data).filter(k => EVIDENCE_FIELDS.includes(k)).forEach(k => { params[`:${k}`] = data[k]; });
      db.prepare(`UPDATE evidence SET ${fields} WHERE id = :id`).run(np(params));
    }
    return get('SELECT * FROM evidence WHERE id = ?', id);
  },
  delete: (id: number) => db.prepare('DELETE FROM evidence WHERE id = ?').run(id),
};

// ── Export / Import ──────────────────────────────────────────────────────────────

export function exportAll(): Record<string, unknown> {
  return {
    app: 'fruitbiz',
    exported_at: new Date().toISOString(),
    companies: all('SELECT * FROM companies ORDER BY id'),
    settings: all('SELECT * FROM settings'),
    contacts: all('SELECT * FROM contacts ORDER BY id'),
    products: all('SELECT * FROM products ORDER BY id'),
    documents: all('SELECT * FROM documents ORDER BY id'),
    document_items: all('SELECT * FROM document_items ORDER BY id'),
    payments: all('SELECT * FROM payments ORDER BY id'),
    withholding_tax: all('SELECT * FROM withholding_tax ORDER BY id'),
    withholding_tax_items: all('SELECT * FROM withholding_tax_items ORDER BY id'),
    employees: all('SELECT * FROM employees ORDER BY id'),
    pay_slips: all('SELECT * FROM pay_slips ORDER BY id'),
    employee_payments: all('SELECT * FROM employee_payments ORDER BY id'),
    evidence: all('SELECT * FROM evidence ORDER BY id'),
  };
}

export function importAll(data: Record<string, unknown[]>): void {
  db.exec('PRAGMA foreign_keys = OFF');

  const doImport = db.transaction(() => {
    db.exec('DELETE FROM evidence');
    db.exec('DELETE FROM employee_payments');
    db.exec('DELETE FROM pay_slips');
    db.exec('DELETE FROM withholding_tax_items');
    db.exec('DELETE FROM withholding_tax');
    db.exec('DELETE FROM payments');
    db.exec('DELETE FROM document_items');
    db.exec('DELETE FROM documents');
    db.exec('DELETE FROM contacts');
    db.exec('DELETE FROM products');
    db.exec('DELETE FROM employees');
    db.exec('DELETE FROM settings');
    db.exec('DELETE FROM companies');

    const insert = (table: string, rows: Record<string, unknown>[]) => {
      if (!rows?.length) return;
      const keys = Object.keys(rows[0]);
      const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
      for (const row of rows) stmt.run(Object.values(row));
    };

    insert('companies', (data.companies || []) as Record<string, unknown>[]);
    for (const row of (data.settings || []) as Record<string, unknown>[]) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(row.key as string, row.value as string);
    }
    insert('contacts', (data.contacts || []) as Record<string, unknown>[]);
    insert('products', (data.products || []) as Record<string, unknown>[]);
    insert('documents', (data.documents || []) as Record<string, unknown>[]);
    insert('document_items', (data.document_items || []) as Record<string, unknown>[]);
    insert('payments', (data.payments || []) as Record<string, unknown>[]);
    insert('withholding_tax', (data.withholding_tax || []) as Record<string, unknown>[]);
    insert('withholding_tax_items', (data.withholding_tax_items || []) as Record<string, unknown>[]);
    insert('employees', (data.employees || []) as Record<string, unknown>[]);
    insert('pay_slips', (data.pay_slips || []) as Record<string, unknown>[]);
    insert('employee_payments', (data.employee_payments || []) as Record<string, unknown>[]);
    insert('evidence', (data.evidence || []) as Record<string, unknown>[]);

    for (const table of ['companies', 'contacts', 'products', 'documents', 'document_items', 'payments', 'withholding_tax', 'withholding_tax_items', 'employees', 'pay_slips', 'employee_payments', 'evidence']) {
      const r = db.prepare(`SELECT COALESCE(MAX(id), 0) as m FROM ${table}`).get() as { m: number };
      if (r.m > 0) db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, r.m);
    }
  });

  doImport();
  db.exec('PRAGMA foreign_keys = ON');
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const reportRepo = {
  summary: (period?: string) => {
    // Validate period to YYYY-MM format to prevent injection
    const safePeriod = period && /^\d{4}-\d{2}$/.test(period) ? period : null;
    const whereClause = safePeriod
      ? 'AND strftime(\'%Y-%m\', date) = ?'
      : '';
    const params = safePeriod ? [safePeriod] : [];
    const revenue = (get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM documents WHERE type IN ('delivery_tax_invoice','invoice','receipt','cash_invoice') AND status NOT IN ('cancelled','draft') ${whereClause}`, ...params) ?? { v: 0 }).v;
    const expense = (get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM documents WHERE type IN ('expense','purchase_order') AND status NOT IN ('cancelled','draft') ${whereClause}`, ...params) ?? { v: 0 }).v;
    const pending = (get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM documents WHERE ((type IN ('delivery_tax_invoice','invoice','billing_note') AND status = 'sent') OR (type IN ('expense','purchase_order') AND status = 'approved')) ${whereClause}`, ...params) ?? { v: 0 }).v;
    const counts = all<{ type: string; cnt: number }>(`SELECT type, COUNT(*) as cnt FROM documents WHERE 1=1 ${whereClause} GROUP BY type`, ...params);
    const countMap: Record<string, number> = {};
    counts.forEach(r => { countMap[r.type] = r.cnt; });
    return { revenue, expense, profit: revenue - expense, pending, document_counts: countMap };
  },
  monthly: (year?: number) => {
    // Validate year is a reasonable 4-digit integer
    const y = (typeof year === 'number' && year >= 1900 && year <= 2200)
      ? year
      : new Date().getFullYear();
    return all<{ month: string; revenue: number; expense: number }>(`
      SELECT strftime('%m', date) as month,
             COALESCE(SUM(CASE WHEN type IN ('invoice','receipt','cash_invoice') AND status NOT IN ('cancelled','draft') THEN total ELSE 0 END),0) as revenue,
             COALESCE(SUM(CASE WHEN type IN ('expense','purchase_order') AND status NOT IN ('cancelled','draft') THEN total ELSE 0 END),0) as expense
      FROM documents WHERE strftime('%Y', date) = ?
      GROUP BY month ORDER BY month`, String(y));
  },
  topContacts: (limit = 10, period?: string) => {
    // Optionally scope to a single month (YYYY-MM) by document date.
    const safePeriod = period && /^\d{4}-\d{2}$/.test(period) ? period : null;
    const dateClause = safePeriod ? "AND strftime('%Y-%m', d.date) = ?" : '';
    const params: unknown[] = safePeriod ? [safePeriod, limit] : [limit];
    return all(`
      SELECT c.id, c.name, c.type, COUNT(d.id) as doc_count, COALESCE(SUM(d.total),0) as total_amount
      FROM contacts c LEFT JOIN documents d ON d.contact_id = c.id AND d.status NOT IN ('cancelled','draft') ${dateClause}
      GROUP BY c.id HAVING doc_count > 0 ORDER BY total_amount DESC LIMIT ?`, ...params);
  },
};
