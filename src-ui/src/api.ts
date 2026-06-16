import type { Contact, Product, Document, Payment, PayableDoc, Company, Settings, ReportSummary, MonthlyData, TopContact, WithholdingTax, PaySlip, Employee, EmployeePayment, Evidence } from './types'

const BASE = 'http://localhost:3737/api'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json as T
}

const GET = <T>(path: string) => request<T>('GET', path)
const POST = <T>(path: string, body: unknown) => request<T>('POST', path, body)
const PUT = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
const PATCH = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const DEL = <T>(path: string) => request<T>('DELETE', path)

// Health
export const getHealth = () => GET<{ status: string }>('/health')

// Contacts
export const getContacts = (q?: string) =>
  GET<{ data: Contact[] }>('/contacts' + (q ? '?q=' + encodeURIComponent(q) : ''))
export const getContact = (id: number) => GET<Contact>('/contacts/' + id)
export const createContact = (data: Partial<Contact>) => POST<Contact>('/contacts', data)
export const updateContact = (id: number, data: Partial<Contact>) => PUT<Contact>('/contacts/' + id, data)
export const deleteContact = (id: number) => DEL<void>('/contacts/' + id)

// Products
export const getProducts = (q?: string) =>
  GET<{ data: Product[] }>('/products' + (q ? '?q=' + encodeURIComponent(q) : ''))
export const createProduct = (data: Partial<Product>) => POST<Product>('/products', data)
export const updateProduct = (id: number, data: Partial<Product>) => PUT<Product>('/products/' + id, data)
export const deleteProduct = (id: number) => DEL<void>('/products/' + id)

// Documents
export const getDocuments = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return GET<{ data: Document[] }>('/documents' + qs)
}
export const getDocument = (id: number) => GET<Document>('/documents/' + id)
export const createDocument = (data: Partial<Document>) => POST<Document>('/documents', data)
export const updateDocument = (id: number, data: Partial<Document>) => PUT<Document>('/documents/' + id, data)
export const patchDocumentStatus = (id: number, status: string) =>
  PATCH<Document>('/documents/' + id + '/status', { status })
export const deleteDocument = (id: number) => DEL<void>('/documents/' + id)

// Payments
export const getPayments = () => GET<{ data: Payment[] }>('/payments')
export const getPaymentDocuments = (direction?: 'in' | 'out') =>
  GET<{ data: PayableDoc[] }>('/payments/documents' + (direction ? '?direction=' + direction : ''))
export const createPayment = (data: Partial<Payment>) => POST<Payment>('/payments', data)
export const deletePayment = (id: number) => DEL<void>('/payments/' + id)

// Companies
export const getCompanies = () => GET<{ data: Company[] }>('/companies')
export const getActiveCompany = () => GET<Company>('/companies/active')
export const createCompany = (data: Partial<Company>) => POST<Company>('/companies', data)
export const updateCompany = (id: number, data: Partial<Company>) => PUT<Company>('/companies/' + id, data)
export const deleteCompany = (id: number) => DEL<void>('/companies/' + id)
export const activateCompany = (id: number) => POST<Company>('/companies/' + id + '/activate', {})

// Settings / Business
export const getSettings = () => GET<Settings>('/business')
export const updateSettings = (data: Partial<Settings>) => PUT<Settings>('/business', data)

// Withholding Tax
export const getWithholdingTaxList = () => GET<{ data: WithholdingTax[] }>('/withholding-tax')
export const getWithholdingTax = (id: number) => GET<WithholdingTax>('/withholding-tax/' + id)
export const createWithholdingTax = (data: Partial<WithholdingTax>) => POST<WithholdingTax>('/withholding-tax', data)
export const updateWithholdingTax = (id: number, data: Partial<WithholdingTax>) => PUT<WithholdingTax>('/withholding-tax/' + id, data)
export const deleteWithholdingTax = (id: number) => DEL<void>('/withholding-tax/' + id)

// Reports
export const getReportSummary = (period?: string) =>
  GET<ReportSummary>('/reports/summary' + (period ? '?period=' + period : ''))
export const getReportMonthly = (year?: number) =>
  GET<{ data: MonthlyData[] }>('/reports/monthly' + (year ? '?year=' + year : ''))
export const getReportTopContacts = (limit = 5, period?: string) =>
  GET<{ data: TopContact[] }>('/reports/top-contacts?limit=' + limit + (period ? '&period=' + period : ''))

// Pay Slips
export const getPaySlips = (q?: string) =>
  GET<{ data: PaySlip[] }>('/pay-slips' + (q ? '?q=' + encodeURIComponent(q) : ''))
export const getPaySlip = (id: number) => GET<PaySlip>('/pay-slips/' + id)
export const createPaySlip = (data: Partial<PaySlip>) => POST<PaySlip>('/pay-slips', data)
export const updatePaySlip = (id: number, data: Partial<PaySlip>) => PUT<PaySlip>('/pay-slips/' + id, data)
export const deletePaySlip = (id: number) => DEL<void>('/pay-slips/' + id)

// ── Employees ─────────────────────────────────────────────────────────────────
export const getEmployees = (q?: string) =>
  GET<{ data: Employee[] }>('/employees' + (q ? '?q=' + encodeURIComponent(q) : ''))
export const createEmployee = (data: Partial<Employee>) => POST<Employee>('/employees', data)
export const updateEmployee = (id: number, data: Partial<Employee>) => PUT<Employee>('/employees/' + id, data)
export const deleteEmployee = (id: number) => DEL<void>('/employees/' + id)

// ── Employee Salary Payments ────────────────────────────────────────────────────
export const getEmployeePayments = (employeeId?: number) =>
  GET<{ data: EmployeePayment[] }>('/employee-payments' + (employeeId ? '?employee_id=' + employeeId : ''))
export const createEmployeePayment = (data: Partial<EmployeePayment>) => POST<EmployeePayment>('/employee-payments', data)
export const deleteEmployeePayment = (id: number) => DEL<void>('/employee-payments/' + id)

// ── Evidence ──────────────────────────────────────────────────────────────────
export const getEvidence = (q?: string, category?: string) => {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const qs = params.toString()
  return GET<{ data: Evidence[] }>('/evidence' + (qs ? '?' + qs : ''))
}
export const createEvidence = (data: Partial<Evidence>) => POST<Evidence>('/evidence', data)
export const updateEvidence = (id: number, data: Partial<Evidence>) => PUT<Evidence>('/evidence/' + id, data)
export const deleteEvidence = (id: number) => DEL<void>('/evidence/' + id)
