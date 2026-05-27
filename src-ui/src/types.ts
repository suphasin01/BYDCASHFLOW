export interface Contact {
  id: number
  type: 'customer' | 'vendor'
  name: string
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
