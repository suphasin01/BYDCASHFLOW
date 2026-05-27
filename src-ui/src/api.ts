import type { Contact, Product, Document, Payment, Company, Settings, ReportSummary, MonthlyData, TopContact } from './types'

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

// Reports
export const getReportSummary = () => GET<ReportSummary>('/reports/summary')
export const getReportMonthly = () => GET<{ data: MonthlyData[] }>('/reports/monthly')
export const getReportTopContacts = (limit = 5) =>
  GET<{ data: TopContact[] }>('/reports/top-contacts?limit=' + limit)
