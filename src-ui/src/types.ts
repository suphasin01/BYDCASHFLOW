export interface Contact {
  id: number
  type: 'customer' | 'vendor'
  name: string
  company?: string | null
  tax_id?: string | null
  branch?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  note?: string | null
  created_at?: string
}

export interface Product {
  id: number
  code?: string | null
  name: string
  price: number
  unit?: string | null
  vat_type: 'excluded' | 'included' | 'none'
  category?: string | null
  description?: string | null
  created_at?: string
}

export interface DocumentItem {
  id?: number
  product_id?: number | null
  description: string
  qty: number
  unit?: string
  price: number
  discount?: number
  amount: number
}

export interface Payment {
  id: number
  document_id: number
  amount: number
  date: string
  method: 'cash' | 'transfer' | 'cheque' | 'credit_card'
  reference?: string | null
  notes?: string | null
  doc_number?: string | null
  contact_name?: string | null
  created_at?: string
}

export interface Document {
  id: number
  type: 'quotation' | 'invoice' | 'receipt' | 'billing_note' | 'cash_invoice' | 'purchase_order' | 'expense'
  number?: string | null
  contact_id?: number | null
  contact_name?: string | null
  date: string
  due_date?: string | null
  subtotal: number
  discount: number
  vat: number
  total: number
  status: 'draft' | 'sent' | 'approved' | 'paid' | 'cancelled'
  notes?: string | null
  items?: DocumentItem[]
  payments?: Payment[]
  created_at?: string
}

export interface Company {
  id: number
  name: string
  tax_id?: string | null
  branch?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  note?: string | null
  logo_url?: string | null
  is_active?: number
  created_at?: string
}

export interface Settings {
  name?: string
  tax_id?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
}

export interface WithholdingTaxItem {
  id?: number
  wht_id?: number
  income_type: string
  income_type_desc?: string | null
  pay_date?: string | null
  amount: number
  tax_withheld: number
  sort_order?: number
}

export interface WithholdingTax {
  id: number
  book_no?: string | null
  cert_no?: string | null
  issue_date: string
  form_type?: string | null
  payer_name: string
  payer_address?: string | null
  payer_tax_id?: string | null
  payer_tin?: string | null
  payee_id?: number | null
  payee_name: string
  payee_address?: string | null
  payee_tax_id?: string | null
  payee_tin?: string | null
  payer_type: '1' | '2' | '3' | '4'
  payer_type_other?: string | null
  fund_gpf?: number
  fund_sso?: number
  fund_pvd?: number
  total_amount: number
  total_tax: number
  items?: WithholdingTaxItem[]
  created_at?: string
}

export interface ReportSummary {
  revenue: number
  expense: number
  profit: number
  pending: number
}

export interface MonthlyData {
  month: string
  revenue: number
  expense: number
}

export interface TopContact {
  id: number
  name: string
  type: 'customer' | 'vendor'
  doc_count: number
  total_amount: number
}
