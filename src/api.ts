import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { contactRepo, productRepo, documentRepo, paymentRepo, businessRepo, companyRepo, reportRepo, withholdingTaxRepo, employeeRepo, paySlipRepo, employeePaymentRepo, exportAll, importAll } from './db';

const app = express();
const PORT = process.env.PORT ?? 3737;

const appVersion: string = (require('../package.json') as { version: string }).version;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve Web UI
app.use(express.static(path.join(__dirname, '..', 'web')));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: appVersion, timestamp: new Date().toISOString() });
});

// ── Export / Import ───────────────────────────────────────────────────────────

app.get('/api/export', (_req, res) => {
  try { res.json(exportAll()); }
  catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/import', (req, res) => {
  try {
    if (!req.body || req.body.app !== 'fruitbiz') return res.status(400).json({ error: 'Invalid backup file' });
    importAll(req.body);
    res.json({ success: true });
  } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

// ── Contacts ──────────────────────────────────────────────────────────────────

app.get('/api/contacts', (req, res) => {
  try {
    const { type, q } = req.query as Record<string, string>;
    const data = q ? contactRepo.search(q) : contactRepo.list(type);
    res.json({ data });
  } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/contacts/:id', (req, res) => {
  const row = contactRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/contacts', (req, res) => {
  try {
    const row = contactRepo.create(req.body);
    res.status(201).json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const row = contactRepo.update(Number(req.params.id), req.body);
    res.json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/contacts/:id', (req, res) => {
  contactRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Products ──────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  try {
    const { q } = req.query as Record<string, string>;
    const data = q ? productRepo.search(q) : productRepo.list();
    res.json({ data });
  } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/products/:id', (req, res) => {
  const row = productRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/products', (req, res) => {
  try {
    const row = productRepo.create(req.body);
    res.status(201).json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const row = productRepo.update(Number(req.params.id), req.body);
    res.json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/products/:id', (req, res) => {
  productRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Documents ─────────────────────────────────────────────────────────────────

app.get('/api/documents', (req, res) => {
  try {
    const { type, status, contact_id, limit, offset, q } = req.query as Record<string, string>;
    const data = documentRepo.list({
      type,
      status,
      contact_id: contact_id ? Number(contact_id) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      q,
    });
    res.json({ data });
  } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/documents/:id', (req, res) => {
  const row = documentRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/documents', (req, res) => {
  try {
    const { items, ...docData } = req.body;
    const row = documentRepo.create(docData, items ?? []);
    res.status(201).json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/documents/:id', (req, res) => {
  try {
    const { items, ...docData } = req.body;
    const row = documentRepo.update(Number(req.params.id), docData, items);
    res.json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.patch('/api/documents/:id/status', (req, res) => {
  try {
    const row = documentRepo.updateStatus(Number(req.params.id), req.body.status);
    res.json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/documents/:id', (req, res) => {
  documentRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Payments ──────────────────────────────────────────────────────────────────

app.get('/api/payments', (req, res) => {
  const { document_id } = req.query as Record<string, string>;
  res.json({ data: paymentRepo.list(document_id ? Number(document_id) : undefined) });
});

// Documents that carry a balance (receivables / payables) with paid totals
app.get('/api/payments/documents', (req, res) => {
  try {
    const { direction } = req.query as Record<string, string>;
    const dir = direction === 'in' || direction === 'out' ? direction : undefined;
    res.json({ data: documentRepo.listForPayments(dir) });
  } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/payments', (req, res) => {
  try {
    const row = paymentRepo.create(req.body);
    res.status(201).json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/payments/:id', (req, res) => {
  paymentRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Companies ─────────────────────────────────────────────────────────────────

app.get('/api/companies', (_req, res) => {
  res.json({ data: companyRepo.list() });
});

app.get('/api/companies/active', (_req, res) => {
  res.json(companyRepo.getActive());
});

app.get('/api/companies/:id', (req, res) => {
  const row = companyRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/companies', (req, res) => {
  try {
    res.status(201).json(companyRepo.create(req.body));
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/companies/:id', (req, res) => {
  try {
    res.json(companyRepo.update(Number(req.params.id), req.body));
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.post('/api/companies/:id/activate', (req, res) => {
  try {
    res.json(companyRepo.setActive(Number(req.params.id)));
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/companies/:id', (req, res) => {
  try {
    res.json(companyRepo.delete(Number(req.params.id)));
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

// ── Business Info (proxy to active company) ───────────────────────────────────

app.get('/api/business', (_req, res) => {
  res.json(businessRepo.get());
});

app.put('/api/business', (req, res) => {
  try {
    res.json(businessRepo.update(req.body));
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

// ── Reports ───────────────────────────────────────────────────────────────────

app.get('/api/reports/summary', (req, res) => {
  const { period } = req.query as Record<string, string>;
  res.json(reportRepo.summary(period));
});

app.get('/api/reports/monthly', (req, res) => {
  const { year } = req.query as Record<string, string>;
  res.json({ data: reportRepo.monthly(year ? Number(year) : undefined) });
});

app.get('/api/reports/top-contacts', (req, res) => {
  const { limit } = req.query as Record<string, string>;
  res.json({ data: reportRepo.topContacts(limit ? Number(limit) : 10) });
});

// ── Withholding Tax ───────────────────────────────────────────────────────────

app.get('/api/withholding-tax', (_req, res) => {
  try { res.json({ data: withholdingTaxRepo.list() }); }
  catch (e: unknown) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/withholding-tax/:id', (req, res) => {
  const row = withholdingTaxRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/withholding-tax', (req, res) => {
  try {
    const { items, ...data } = req.body;
    const row = withholdingTaxRepo.create(data, items ?? []);
    res.status(201).json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/withholding-tax/:id', (req, res) => {
  try {
    const { items, ...data } = req.body;
    const row = withholdingTaxRepo.update(Number(req.params.id), data, items);
    res.json(row);
  } catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/withholding-tax/:id', (req, res) => {
  withholdingTaxRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Employees ─────────────────────────────────────────────────────────────────

app.get('/api/employees', (req, res) => {
  const { q } = req.query as Record<string, string>;
  res.json({ data: employeeRepo.list(q) });
});

app.get('/api/employees/:id', (req, res) => {
  const row = employeeRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/employees', (req, res) => {
  try { res.status(201).json(employeeRepo.create(req.body)); }
  catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/employees/:id', (req, res) => {
  try { res.json(employeeRepo.update(Number(req.params.id), req.body)); }
  catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/employees/:id', (req, res) => {
  employeeRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── Pay Slips ──────────────────────────────────────────────────────────────────

app.get('/api/pay-slips', (req, res) => {
  const { q } = req.query as Record<string, string>;
  res.json({ data: paySlipRepo.list(q) });
});

app.get('/api/pay-slips/:id', (req, res) => {
  const row = paySlipRepo.get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/pay-slips', (req, res) => {
  try { res.status(201).json(paySlipRepo.create(req.body)); }
  catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.put('/api/pay-slips/:id', (req, res) => {
  try { res.json(paySlipRepo.update(Number(req.params.id), req.body)); }
  catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/pay-slips/:id', (req, res) => {
  const id = Number(req.params.id);
  // Cascade: remove the matching employee_payment so the employee's paid status resets
  const slip = paySlipRepo.get(id) as Record<string, unknown> | undefined;
  if (slip?.employee_name && slip?.period) {
    const emps = employeeRepo.list('') as { id: number; name: string }[];
    const emp = emps.find(e => e.name === slip.employee_name);
    if (emp) employeePaymentRepo.deleteByEmployeePeriod(emp.id, slip.period as string);
  }
  paySlipRepo.delete(id);
  res.json({ success: true });
});

// ── Employee Salary Payments ────────────────────────────────────────────────────

app.get('/api/employee-payments', (req, res) => {
  const { employee_id } = req.query as Record<string, string>;
  res.json({ data: employeePaymentRepo.list(employee_id ? Number(employee_id) : undefined) });
});

app.post('/api/employee-payments', (req, res) => {
  try { res.status(201).json(employeePaymentRepo.create(req.body)); }
  catch (e: unknown) { res.status(400).json({ error: String(e) }); }
});

app.delete('/api/employee-payments/:id', (req, res) => {
  employeePaymentRepo.delete(Number(req.params.id));
  res.json({ success: true });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Local API running at http://localhost:${PORT}`);
  console.log(`📊 Web UI: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});

export default app;
