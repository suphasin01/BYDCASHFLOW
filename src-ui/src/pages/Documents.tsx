import { useEffect, useState } from 'react'
import {
  Card, CardBody, Chip, Divider, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany, usePeriod } from '../App'
import {
  getDocuments, getDocument, createDocument, updateDocument, deleteDocument, patchDocumentStatus,
  getContacts, getActiveCompany, getContact, getProducts, getEmployees,
  getWithholdingTaxList, getWithholdingTax, createWithholdingTax, updateWithholdingTax, deleteWithholdingTax,
  getPaySlips, createPaySlip, updatePaySlip, deletePaySlip,
} from '../api'
import type { Document, DocumentItem, Contact, Company, Product, WithholdingTax, WithholdingTaxItem, PaySlip, Employee, WorkOrderMeta } from '../types'
import { fmt, fmtDate, today } from '../utils'
import { buildWHTForm } from '../whtForm'
import { buildPaySlipHtml } from './PaySlip'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import PreviewModal from '../ui/PreviewModal'

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
const STATUS_COLOR: Record<string, ChipColor> = {
  draft: 'default', sent: 'primary', approved: 'success', paid: 'success', cancelled: 'danger',
}

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'
const LABEL_CLASS = 'block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5'

const emptyDocumentItem = (): DocumentItem => ({ description: '', qty: 1, unit: '', price: 0, amount: 0 })

function copyDocumentItems(source: DocumentItem[] | undefined, products: Product[]): DocumentItem[] {
  if (!source?.length) return [emptyDocumentItem()]
  return source.map(item => ({
    ...item,
    id: undefined,
    product_query: products.find(product => product.id === item.product_id)?.name || item.description || '',
  }))
}

function readWorkMeta(meta: Document['meta']): WorkOrderMeta {
  if (!meta) return {}
  if (typeof meta !== 'string') return meta
  try { return JSON.parse(meta) as WorkOrderMeta } catch { return {} }
}

// ─── WHT constants ────────────────────────────────────────────────────────────
const WHT_INCOME_TYPES = [
  { value: '40_1', key: 'wht_income_40_1', hasDesc: false },
  { value: '40_2', key: 'wht_income_40_2', hasDesc: false },
  { value: '40_3', key: 'wht_income_40_3', hasDesc: false },
  { value: '40_4a', key: 'wht_income_40_4a', hasDesc: false },
  { value: '40_4b_1_1', key: 'wht_income_40_4b_1_1', hasDesc: false },
  { value: '40_4b_1_2', key: 'wht_income_40_4b_1_2', hasDesc: false },
  { value: '40_4b_1_3', key: 'wht_income_40_4b_1_3', hasDesc: false },
  { value: '40_4b_1_4', key: 'wht_income_40_4b_1_4', hasDesc: true },
  { value: '40_4b_2_1', key: 'wht_income_40_4b_2_1', hasDesc: false },
  { value: '40_4b_2_2', key: 'wht_income_40_4b_2_2', hasDesc: false },
  { value: '40_4b_2_3', key: 'wht_income_40_4b_2_3', hasDesc: false },
  { value: '40_4b_2_4', key: 'wht_income_40_4b_2_4', hasDesc: false },
  { value: '40_4b_2_5', key: 'wht_income_40_4b_2_5', hasDesc: true },
  { value: '3tres', key: 'wht_income_3tres', hasDesc: false },
  { value: 'other', key: 'wht_income_other', hasDesc: true },
]
const WHT_FORM_TYPES = [
  { value: 'nd1k', key: 'wht_form_nd1k' },
  { value: 'nd1k_s', key: 'wht_form_nd1k_s' },
  { value: 'nd2', key: 'wht_form_nd2' },
  { value: 'nd3', key: 'wht_form_nd3' },
  { value: 'nd2k', key: 'wht_form_nd2k' },
  { value: 'nd3k', key: 'wht_form_nd3k' },
  { value: 'nd53', key: 'wht_form_nd53' },
]
const emptyWHTItem = (): WithholdingTaxItem => ({ income_type: '40_1', income_type_desc: '', pay_date: '', amount: 0, tax_withheld: 0 })
const WHT_FORM_LABELS: Record<string, string> = {
  nd53: 'ภ.ง.ด.53', nd3: 'ภ.ง.ด.3', nd1: 'ภ.ง.ด.1ก',
  nd1_special: 'ภ.ง.ด.1กพิเศษ', nd2: 'ภ.ง.ด.2', nd2k: 'ภ.ง.ด.2ก', nd3k: 'ภ.ง.ด.3ก',
  nd1k: 'ภ.ง.ด.1ก', nd1k_s: 'ภ.ง.ด.1กพิเศษ',
}

// ─── PaySlip form state shape ─────────────────────────────────────────────────
const PS_ZERO = {
  employee_name: '', contact_id: '', department: '', period: '', pay_date: today(),
  salary: 0, cost_of_living: 0, position_allow: 0, meal_allow: 0, overtime: 0,
  shift_allow: 0, travel_allow: 0, subsidy: 0, welfare: 0, bonus: 0,
  tax_withheld: 0, social_security: 0, late_deduct: 0, absent_deduct: 0,
  loan_deduct: 0, advance_deduct: 0, other_deduct: 0,
  cum_income: 0, cum_tax: 0, cum_social_sec: 0, cum_provident: 0, notes: '',
}
type PSForm = typeof PS_ZERO
const PS_INCOME_KEYS = ['salary','cost_of_living','position_allow','meal_allow','overtime','shift_allow','travel_allow','subsidy','welfare','bonus'] as const
const PS_DEDUCT_KEYS = ['tax_withheld','social_security','late_deduct','absent_deduct','loan_deduct','advance_deduct','other_deduct'] as const

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'withholding_tax' | 'pay_slips' | 'companies' | 'settings'
type SortKey = 'num' | 'type' | 'contact' | 'date' | 'due' | 'amount'

export default function Documents({ onNavigate: _onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeCompany } = useActiveCompany()
  const { period } = usePeriod()

  const DOC_TYPES: Record<string, string> = {
    delivery_tax_invoice: t('type_delivery_tax_invoice'),
    delivery_note: t('type_delivery_note'),
    work_order: t('type_work_order'),
  }
  const STATUS_LABELS: Record<string, string> = {
    draft: t('status_draft'), sent: t('status_sent'), approved: t('status_approved'),
    paid: t('status_paid'), cancelled: t('status_cancelled'),
  }

  // ── List state ──────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<Document[]>([])
  const [whts, setWhts] = useState<WithholdingTax[]>([])
  const [paySlips, setPaySlips] = useState<PaySlip[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<'none' | 'create' | 'edit' | 'view'>('none')
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [preview, setPreview] = useState<{ html: string; id: number } | null>(null)
  const [whtPreview, setWhtPreview] = useState<{ html: string; id: number } | null>(null)

  // ── Standard doc form ───────────────────────────────────────────────────────
  const [fType, setFType] = useState('delivery_tax_invoice')
  const [fNumber, setFNumber] = useState('')
  const [fContactId, setFContactId] = useState('')
  const [fContactName, setFContactName] = useState('')
  const [fDate, setFDate] = useState(today())
  const [fDue, setFDue] = useState('')
  const [fDiscount, setFDiscount] = useState(0)
  const [fDiscountMode, setFDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [fVat, setFVat] = useState(0)
  const [fVatMode, setFVatMode] = useState<'amount' | 'percent'>('percent')
  const [fNotes, setFNotes] = useState('')
  const [fRefDocId, setFRefDocId] = useState<number | null>(null)
  const [items, setItems] = useState<DocumentItem[]>([{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
  const [workMeta, setWorkMeta] = useState<WorkOrderMeta>({})
  const [statusChange, setStatusChange] = useState('')
  const [convertType, setConvertType] = useState('')

  // ── WHT form state ──────────────────────────────────────────────────────────
  const [wfEditId, setWfEditId] = useState<number | null>(null)
  const [wfBookNo, setWfBookNo] = useState('')
  const [wfCertNo, setWfCertNo] = useState('')
  const [wfIssueDate, setWfIssueDate] = useState(today())
  const [wfFormType, setWfFormType] = useState('')
  const [wfPayerName, setWfPayerName] = useState('')
  const [wfPayerAddress, setWfPayerAddress] = useState('')
  const [wfPayerTaxId, setWfPayerTaxId] = useState('')
  const [wfPayerTin, setWfPayerTin] = useState('')
  const [wfPayeeId, setWfPayeeId] = useState('')
  const [wfPayeeName, setWfPayeeName] = useState('')
  const [wfPayeeAddress, setWfPayeeAddress] = useState('')
  const [wfPayeeTaxId, setWfPayeeTaxId] = useState('')
  const [wfPayeeTin, setWfPayeeTin] = useState('')
  const [wfPayerType, setWfPayerType] = useState<'1' | '2' | '3' | '4'>('1')
  const [wfPayerTypeOther, setWfPayerTypeOther] = useState('')
  const [wfFundGpf, setWfFundGpf] = useState(0)
  const [wfFundSso, setWfFundSso] = useState(0)
  const [wfFundPvd, setWfFundPvd] = useState(0)
  const [wfItems, setWfItems] = useState<WithholdingTaxItem[]>([emptyWHTItem()])

  // ── PaySlip form state ──────────────────────────────────────────────────────
  const [psEditId, setPsEditId] = useState<number | null>(null)
  const [psForm, setPsForm] = useState<PSForm>({ ...PS_ZERO })
  const setPs = (field: keyof PSForm, value: string | number) => setPsForm(prev => ({ ...prev, [field]: value }))

  // ── Derived ─────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const discountAmt = fType === 'delivery_tax_invoice' ? (fDiscountMode === 'percent' ? subtotal * fDiscount / 100 : fDiscount) : 0
  const vatAmt = fType === 'delivery_tax_invoice' ? (fVatMode === 'percent' ? (subtotal - discountAmt) * fVat / 100 : fVat) : 0
  const total = subtotal - discountAmt + vatAmt
  const availableProducts = products.filter(product => {
    const usage = product.product_usage || 'both'
    return fType === 'work_order' ? usage === 'order' || usage === 'both' : usage === 'delivery' || usage === 'both'
  })
  const selectableProducts = products.filter(product =>
    availableProducts.some(available => available.id === product.id) ||
    items.some(item => item.product_id === product.id)
  )

  const wfTotalAmount = wfItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const wfTotalTax = wfItems.reduce((s, i) => s + (Number(i.tax_withheld) || 0), 0)

  const psTotalIncome = PS_INCOME_KEYS.reduce((s, k) => s + (Number((psForm as Record<string, unknown>)[k]) || 0), 0)
  const psTotalDeductions = PS_DEDUCT_KEYS.reduce((s, k) => s + (Number((psForm as Record<string, unknown>)[k]) || 0), 0)
  const psNetIncome = psTotalIncome - psTotalDeductions

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { month: period }
      if (filterType) params.type = filterType
      if (filterStatus) params.status = filterStatus
      if (search) params.q = search
      const docsRes = await getDocuments(params)
      setDocs(docsRes.data.filter(d => ['delivery_tax_invoice', 'delivery_note', 'work_order'].includes(d.type)))
      setWhts([])
      setPaySlips([])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [filterType, filterStatus, search, period])

  // ── Standard doc helpers ─────────────────────────────────────────────────────
  const updateItem = (i: number, field: keyof DocumentItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[i], [field]: value }
      if (field === 'qty' || field === 'price') {
        item.amount = (field === 'qty' ? Number(value) : item.qty) * (field === 'price' ? Number(value) : item.price)
      }
      next[i] = item
      return next
    })
  }

  const fillItemFromProduct = (i: number, product: Product, productQuery?: string) => {
    setItems(prev => {
      const next = [...prev]
      const current = next[i]
      next[i] = {
        ...current,
        product_id: product.id,
        product_query: productQuery ?? product.name,
        description: product.description || product.name,
        unit: product.unit || '',
        price: product.price,
        product_image: product.image_url || null,
        amount: (current.qty || 1) * product.price,
      }
      return next
    })
  }

  const selectLabelImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('กรุณาเลือกไฟล์รูปภาพ', 'err'); return }
    if (file.size > 5 * 1024 * 1024) { toast('รูปต้องมีขนาดไม่เกิน 5 MB', 'err'); return }
    const reader = new FileReader()
    reader.onload = () => setWorkMeta(meta => ({ ...meta, label_image: String(reader.result || '') }))
    reader.onerror = () => toast('อ่านไฟล์รูปไม่สำเร็จ', 'err')
    reader.readAsDataURL(file)
  }

  // ── WHT helpers ─────────────────────────────────────────────────────────────
  const resetWHTForm = () => {
    setWfEditId(null)
    setWfBookNo(''); setWfCertNo(''); setWfIssueDate(today()); setWfFormType('')
    setWfPayerName(activeCompany?.name || ''); setWfPayerAddress(activeCompany?.address || '')
    setWfPayerTaxId(activeCompany?.tax_id || ''); setWfPayerTin('')
    setWfPayeeId(''); setWfPayeeName(''); setWfPayeeAddress(''); setWfPayeeTaxId(''); setWfPayeeTin('')
    setWfPayerType('1'); setWfPayerTypeOther('')
    setWfFundGpf(0); setWfFundSso(0); setWfFundPvd(0)
    setWfItems([emptyWHTItem()])
  }

  const openEditWHT = async (id: number) => {
    const [wht, { data: cs }, { data: ps }] = await Promise.all([getWithholdingTax(id), getContacts(), getProducts()])
    setContacts(cs); setProducts(ps)
    setFType('withholding_tax')
    setWfEditId(id)
    setWfBookNo(wht.book_no || ''); setWfCertNo(wht.cert_no || '')
    setWfIssueDate(wht.issue_date?.slice(0, 10) || today()); setWfFormType(wht.form_type || '')
    setWfPayerName(wht.payer_name || ''); setWfPayerAddress(wht.payer_address || '')
    setWfPayerTaxId(wht.payer_tax_id || ''); setWfPayerTin(wht.payer_tin || '')
    setWfPayeeId(wht.payee_id ? String(wht.payee_id) : ''); setWfPayeeName(wht.payee_name || '')
    setWfPayeeAddress(wht.payee_address || ''); setWfPayeeTaxId(wht.payee_tax_id || ''); setWfPayeeTin(wht.payee_tin || '')
    setWfPayerType((wht.payer_type as '1' | '2' | '3' | '4') || '1'); setWfPayerTypeOther(wht.payer_type_other || '')
    setWfFundGpf(wht.fund_gpf || 0); setWfFundSso(wht.fund_sso || 0); setWfFundPvd(wht.fund_pvd || 0)
    setWfItems(wht.items?.length ? wht.items : [emptyWHTItem()])
    setModal('edit')
  }

  const saveWHT = async () => {
    if (!wfPayerName.trim()) { toast(t('wht_lbl_payer_name') + ' required', 'err'); return }
    if (!wfPayeeName.trim()) { toast(t('wht_lbl_payee_name') + ' required', 'err'); return }
    const payload: Partial<WithholdingTax> = {
      book_no: wfBookNo || null, cert_no: wfCertNo || null,
      issue_date: wfIssueDate, form_type: wfFormType,
      payer_name: wfPayerName, payer_address: wfPayerAddress || null,
      payer_tax_id: wfPayerTaxId || null, payer_tin: wfPayerTin || null,
      payee_id: wfPayeeId ? Number(wfPayeeId) : null, payee_name: wfPayeeName,
      payee_address: wfPayeeAddress || null, payee_tax_id: wfPayeeTaxId || null, payee_tin: wfPayeeTin || null,
      payer_type: wfPayerType, payer_type_other: wfPayerTypeOther || null,
      fund_gpf: wfFundGpf, fund_sso: wfFundSso, fund_pvd: wfFundPvd,
      total_amount: wfTotalAmount, total_tax: wfTotalTax,
      items: wfItems.map((item, idx) => ({ ...item, sort_order: idx })) as WithholdingTaxItem[],
    }
    try {
      if (wfEditId !== null) { await updateWithholdingTax(wfEditId, payload); toast(t('wht_toast_edited')) }
      else { await createWithholdingTax(payload); toast(t('wht_toast_saved')) }
      setModal('none'); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const updateWHTItem = (idx: number, field: keyof WithholdingTaxItem, value: string | number) => {
    setWfItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: value }; return next })
  }

  const handleWHTPayeeChange = (contactId: string) => {
    setWfPayeeId(contactId)
    if (contactId) {
      const c = contacts.find(c => String(c.id) === contactId)
      if (c) { setWfPayeeName(c.name); setWfPayeeAddress(c.address || ''); setWfPayeeTaxId(c.tax_id || '') }
    }
  }

  const generateWHTPDF = async (id: number) => {
    try {
      const wht = await getWithholdingTax(id)
      const html = buildWHTForm(wht)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) await api.exportPDF(html, `WHT_${wht.cert_no || id}.pdf`)
      else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const openWHTPreview = async (id: number) => {
    try { const wht = await getWithholdingTax(id); setWhtPreview({ html: buildWHTForm(wht), id }) }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  // ── PaySlip helpers ──────────────────────────────────────────────────────────
  const resetPSForm = () => { setPsEditId(null); setPsForm({ ...PS_ZERO }) }

  const openEditPS = async (slip: PaySlip) => {
    if (employees.length === 0) { const { data: emps } = await getEmployees(); setEmployees(emps) }
    setFType('pay_slips')
    setPsEditId(slip.id)
    setPsForm({
      employee_name: slip.employee_name, contact_id: slip.contact_id ? String(slip.contact_id) : '',
      department: slip.department || '', period: slip.period || '',
      pay_date: slip.pay_date?.slice(0, 10) || today(),
      salary: slip.salary, cost_of_living: slip.cost_of_living, position_allow: slip.position_allow,
      meal_allow: slip.meal_allow, overtime: slip.overtime, shift_allow: slip.shift_allow,
      travel_allow: slip.travel_allow, subsidy: slip.subsidy, welfare: slip.welfare, bonus: slip.bonus,
      tax_withheld: slip.tax_withheld, social_security: slip.social_security, late_deduct: slip.late_deduct,
      absent_deduct: slip.absent_deduct, loan_deduct: slip.loan_deduct, advance_deduct: slip.advance_deduct,
      other_deduct: slip.other_deduct, cum_income: slip.cum_income, cum_tax: slip.cum_tax,
      cum_social_sec: slip.cum_social_sec, cum_provident: slip.cum_provident, notes: slip.notes || '',
    })
    setModal('edit')
  }

  const savePS = async () => {
    const payload = {
      employee_name: psForm.employee_name,
      contact_id: psForm.contact_id ? Number(psForm.contact_id) : null,
      department: psForm.department || null, period: psForm.period || null, pay_date: psForm.pay_date,
      salary: Number(psForm.salary), cost_of_living: Number(psForm.cost_of_living),
      position_allow: Number(psForm.position_allow), meal_allow: Number(psForm.meal_allow),
      overtime: Number(psForm.overtime), shift_allow: Number(psForm.shift_allow),
      travel_allow: Number(psForm.travel_allow), subsidy: Number(psForm.subsidy),
      welfare: Number(psForm.welfare), bonus: Number(psForm.bonus),
      total_income: psTotalIncome,
      tax_withheld: Number(psForm.tax_withheld), social_security: Number(psForm.social_security),
      late_deduct: Number(psForm.late_deduct), absent_deduct: Number(psForm.absent_deduct),
      loan_deduct: Number(psForm.loan_deduct), advance_deduct: Number(psForm.advance_deduct),
      other_deduct: Number(psForm.other_deduct),
      total_deductions: psTotalDeductions, net_income: psNetIncome,
      cum_income: Number(psForm.cum_income), cum_tax: Number(psForm.cum_tax),
      cum_social_sec: Number(psForm.cum_social_sec), cum_provident: Number(psForm.cum_provident),
      notes: psForm.notes || null,
    }
    try {
      if (psEditId !== null) { await updatePaySlip(psEditId, payload) }
      else { await createPaySlip(payload) }
      toast(t('toast_ps_saved')); setModal('none'); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const generatePSPdf = async (slip: PaySlip) => {
    try {
      const company = await getActiveCompany().catch(() => null)
      const html = buildPaySlipHtml(slip, company)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) await api.exportPDF(html, `payslip_${slip.employee_name}_${slip.period || slip.pay_date}.pdf`)
      else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const generatePSPdfFromForm = async () => {
    try {
      const company = await getActiveCompany().catch(() => null)
      const slip = {
        id: psEditId || 0, employee_name: psForm.employee_name,
        contact_id: psForm.contact_id ? Number(psForm.contact_id) : null,
        department: psForm.department, period: psForm.period, pay_date: psForm.pay_date,
        salary: Number(psForm.salary), cost_of_living: Number(psForm.cost_of_living),
        position_allow: Number(psForm.position_allow), meal_allow: Number(psForm.meal_allow),
        overtime: Number(psForm.overtime), shift_allow: Number(psForm.shift_allow),
        travel_allow: Number(psForm.travel_allow), subsidy: Number(psForm.subsidy),
        welfare: Number(psForm.welfare), bonus: Number(psForm.bonus),
        total_income: psTotalIncome,
        tax_withheld: Number(psForm.tax_withheld), social_security: Number(psForm.social_security),
        late_deduct: Number(psForm.late_deduct), absent_deduct: Number(psForm.absent_deduct),
        loan_deduct: Number(psForm.loan_deduct), advance_deduct: Number(psForm.advance_deduct),
        other_deduct: Number(psForm.other_deduct),
        total_deductions: psTotalDeductions, net_income: psNetIncome,
        cum_income: Number(psForm.cum_income), cum_tax: Number(psForm.cum_tax),
        cum_social_sec: Number(psForm.cum_social_sec), cum_provident: Number(psForm.cum_provident),
        notes: psForm.notes, created_at: '', updated_at: '',
      } as PaySlip
      const html = buildPaySlipHtml(slip, company)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) await api.exportPDF(html, `payslip_${slip.employee_name}.pdf`)
      else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  // ── Open modal helpers ───────────────────────────────────────────────────────
  const openCreate = async () => {
    const [{ data: cs }, { data: ps }, { data: emps }] = await Promise.all([getContacts(), getProducts(), getEmployees()])
    setContacts(cs); setProducts(ps); setEmployees(emps)
    setEditDoc(null)
    setFType('delivery_tax_invoice'); setFNumber(''); setFContactId(''); setFContactName('')
    setFDate(today()); setFDue(''); setFDiscount(0); setFDiscountMode('amount')
    setFVat(7); setFVatMode('percent'); setFNotes('')
    setFRefDocId(null)
    setWorkMeta({})
    setItems([{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    resetWHTForm(); resetPSForm()
    setModal('create')
  }

  const openEdit = async (id: number) => {
    const [doc, { data: cs }, { data: ps }] = await Promise.all([getDocument(id), getContacts(), getProducts()])
    setContacts(cs); setProducts(ps)
    setEditDoc(doc)
    setFType(doc.type); setFNumber(doc.number || ''); setFContactId(doc.contact_id ? String(doc.contact_id) : ''); setFContactName(doc.contact_name || '')
    setFDate(doc.date?.slice(0, 10) || today()); setFDue(doc.due_date?.slice(0, 10) || '')
    setFDiscount(doc.discount || 0); setFDiscountMode('amount'); setFVat(doc.vat || 0); setFVatMode('amount'); setFNotes(doc.notes || '')
    setFRefDocId(doc.ref_doc_id || null)
    setWorkMeta(readWorkMeta(doc.meta))
    setItems(copyDocumentItems(doc.items, ps))
    setModal('edit')
  }

  const openView = async (id: number) => {
    const doc = await getDocument(id)
    setViewDoc(doc); setStatusChange(doc.status); setConvertType(''); setModal('view')
  }

  // ── Save (routes by type) ────────────────────────────────────────────────────
  const save = async () => {
    if (fType === 'withholding_tax') { await saveWHT(); return }
    if (fType === 'pay_slips') { await savePS(); return }
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length === 0) { toast(t('no_items'), 'err'); return }
    try {
      const payload = {
        type: fType as Document['type'], number: fNumber || undefined,
        contact_id: fContactId ? Number(fContactId) : null,
        contact_name: fContactName || null, date: fDate, due_date: fDue || null,
        subtotal, discount: discountAmt, vat: vatAmt, total, notes: fNotes || null,
        meta: fType === 'work_order' ? JSON.stringify(workMeta) : null,
        ref_doc_id: fRefDocId, items: validItems,
      }
      if (modal === 'edit' && editDoc) { await updateDocument(editDoc.id, payload); toast(t('toast_doc_edited')) }
      else { await createDocument(payload); toast(t('toast_doc_saved')) }
      setModal('none'); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_doc'))) return
    try { await deleteDocument(id); toast(t('toast_doc_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDeleteWht = async (id: number) => {
    if (!confirm(t('confirm_delete_doc'))) return
    try { await deleteWithholdingTax(id); toast(t('toast_doc_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDeletePS = async (id: number) => {
    if (!confirm(t('confirm_delete_doc'))) return
    try { await deletePaySlip(id); toast(t('toast_doc_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doChangeStatus = async (id: number) => {
    try {
      await patchDocumentStatus(id, statusChange); toast(t('toast_update_status'))
      const updated = await getDocument(id); setViewDoc(updated); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doConvert = async () => {
    if (!viewDoc || !convertType) return
    const [{ data: cs }, { data: ps }] = await Promise.all([getContacts(), getProducts()])
    setContacts(cs); setProducts(ps); setEditDoc(null)
    setFType(convertType); setFNumber('')
    setFRefDocId(viewDoc.id)
    setFContactId(viewDoc.contact_id ? String(viewDoc.contact_id) : ''); setFContactName(viewDoc.contact_name || '')
    setFDate(today()); setFDue(viewDoc.due_date?.slice(0, 10) || '')
    setFDiscount(viewDoc.discount || 0); setFDiscountMode('amount')
    setFVat(viewDoc.vat || 0); setFVatMode('amount'); setFNotes(viewDoc.notes || '')
    setWorkMeta(readWorkMeta(viewDoc.meta))
    if (viewDoc.type === 'work_order' && convertType === 'delivery_note') {
      setItems((viewDoc.items || []).filter(item => (item.remaining_qty || 0) > 0).map(item => ({
        ...item,
        id: undefined,
        qty: item.remaining_qty || 0,
        unit: item.unit || '',
        size: item.size || '',
        amount: (item.remaining_qty || 0) * Number(item.price || 0),
        product_query: ps.find(product => product.id === item.product_id)?.name || item.description,
      })))
    } else {
      setItems(copyDocumentItems(viewDoc.items, ps))
    }
    setModal('create')
  }

  const doDuplicate = async (docId: number) => {
    const [doc, { data: cs }, { data: ps }] = await Promise.all([getDocument(docId), getContacts(), getProducts()])
    setContacts(cs); setProducts(ps); setEditDoc(null)
    setFType(doc.type); setFNumber('')
    setFRefDocId(null)
    setFContactId(doc.contact_id ? String(doc.contact_id) : ''); setFContactName(doc.contact_name || '')
    setFDate(today()); setFDue(doc.due_date?.slice(0, 10) || '')
    setFDiscount(doc.discount || 0); setFDiscountMode('amount')
    setFVat(doc.vat || 0); setFVatMode('amount'); setFNotes(doc.notes || '')
    setWorkMeta(readWorkMeta(doc.meta))
    setItems(copyDocumentItems(doc.items, ps))
    setModal('create')
  }

  const generatePDF = async (docId: number) => {
    try {
      const [doc, company] = await Promise.all([getDocument(docId), getActiveCompany()])
      const contact = doc.contact_id ? await getContact(doc.contact_id).catch(() => null) : null
      const html = buildPDFHtml(doc, company, contact, t)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) { await api.exportPDF(html, `${doc.type}_${doc.number || doc.id}.pdf`) }
      else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const openPreview = async (docId: number) => {
    try {
      const [doc, company] = await Promise.all([getDocument(docId), getActiveCompany()])
      const contact = doc.contact_id ? await getContact(doc.contact_id).catch(() => null) : null
      setPreview({ html: buildPDFHtml(doc, company, contact, t), id: docId })
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const paidAmount = viewDoc ? (viewDoc.payments || []).reduce((s, p) => s + p.amount, 0) : 0

  const modalTitle = () => {
    if (fType === 'withholding_tax') return wfEditId !== null ? t('wht_modal_edit') : t('wht_modal_new')
    if (fType === 'pay_slips') return psEditId !== null ? t('ps_modal_edit') : t('ps_modal_create')
    return modal === 'edit' ? t('modal_edit_doc') : t('modal_new_doc')
  }

  // Clickable, sortable column header
  const sortBtn = (k: SortKey, label: string) => (
    <button onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 cursor-pointer transition-colors select-none uppercase ${sortKey === k ? 'text-primary' : 'hover:text-foreground'}`}>
      {label}
      <span className="text-[8px] leading-none">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-2">
        <TextField className="flex-1 min-w-0 sm:min-w-[200px]" placeholder={t('search_doc')}
          value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-content2 border border-content3 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark] w-full sm:w-[148px] flex-shrink-0">
          <option value="">{t('all_types')}</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-content2 border border-content3 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark] w-full sm:w-[120px] flex-shrink-0">
          <option value="">{t('all_statuses')}</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Btn size="sm" variant="primary" onClick={openCreate} className="w-full sm:w-auto flex-shrink-0">{t('btn_create_doc')}</Btn>
      </div>

      {/* Table */}
      <Card className="bg-content1 border border-content3 rounded-xl glow-hover" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <div className="overflow-x-auto">
            <Table removeWrapper aria-label={t('btn_create_doc')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{sortBtn('num', t('col_number'))}</TableColumn>
                <TableColumn>{sortBtn('type', t('col_type'))}</TableColumn>
                <TableColumn>{sortBtn('contact', t('col_contact'))}</TableColumn>
                <TableColumn>{sortBtn('date', t('col_date'))}</TableColumn>
                <TableColumn>{sortBtn('due', t('col_due_date'))}</TableColumn>
                <TableColumn>{sortBtn('amount', t('col_amount'))}</TableColumn>
                <TableColumn>{t('col_status')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500">
                  <div className="text-4xl mb-3.5 opacity-40">📄</div>
                  <p>{t('no_documents')}</p>
                  <p className="mt-1 text-[12px]" dangerouslySetInnerHTML={{ __html: t('no_documents_hint') }} />
                </div>
              }>
                {[
                  ...docs.map(doc => ({ kind: 'doc' as const, id: `d-${doc.id}`, doc,
                    s_num: doc.number || '', s_type: DOC_TYPES[doc.type] || doc.type, s_contact: doc.contact_name || '',
                    s_date: doc.date || '', s_due: doc.due_date || '', s_amount: doc.total || 0 })),
                  ...whts.map(wht => ({ kind: 'wht' as const, id: `w-${wht.id}`, wht,
                    s_num: wht.cert_no || `WHT-${wht.id}`, s_type: DOC_TYPES.withholding_tax, s_contact: wht.payee_name || '',
                    s_date: wht.issue_date || '', s_due: '', s_amount: wht.total_amount || 0 })),
                  ...paySlips.map(ps => ({ kind: 'ps' as const, id: `p-${ps.id}`, ps,
                    s_num: ps.period || `PS-${ps.id}`, s_type: DOC_TYPES.pay_slips, s_contact: ps.employee_name || '',
                    s_date: ps.pay_date || '', s_due: '', s_amount: ps.net_income || 0 })),
                ].sort((a, b) => {
                  let cmp: number
                  if (sortKey === 'amount') cmp = a.s_amount - b.s_amount
                  else if (sortKey === 'num') cmp = a.s_num.localeCompare(b.s_num, undefined, { numeric: true })
                  else {
                    const key = ('s_' + sortKey) as 's_type' | 's_contact' | 's_date' | 's_due'
                    cmp = String(a[key]).localeCompare(String(b[key]), 'th')
                  }
                  return sortDir === 'asc' ? cmp : -cmp
                }).map(row => {
                  if (row.kind === 'wht') return (
                    <TableRow key={row.id} className="hover:bg-content2/60 transition-colors">
                      <TableCell>
                        <span className="font-semibold text-primary">{row.wht.cert_no || `WHT-${row.wht.id}`}</span>
                        {row.wht.book_no && <span className="text-[11px] text-default-400 ml-1.5">เล่ม {row.wht.book_no}</span>}
                      </TableCell>
                      <TableCell><Chip size="sm" variant="flat" color="secondary">{DOC_TYPES.withholding_tax}</Chip></TableCell>
                      <TableCell className="font-medium">{row.wht.payee_name || '—'}</TableCell>
                      <TableCell className="text-default-500">{fmtDate(row.wht.issue_date)}</TableCell>
                      <TableCell className="text-default-500">—</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-success font-semibold">฿{fmt(row.wht.total_amount)}</span>
                          <span className="text-[11px] text-default-400 ml-1">ภาษี ฿{fmt(row.wht.total_tax)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color="warning">
                          {WHT_FORM_LABELS[row.wht.form_type || ''] || row.wht.form_type || '—'}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Btn size="sm" variant="ghost" onClick={() => openWHTPreview(row.wht.id)}>{t('btn_preview')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => generateWHTPDF(row.wht.id)}>PDF</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => openEditWHT(row.wht.id)}>{t('btn_edit')}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => doDeleteWht(row.wht.id)}>{t('btn_delete')}</Btn>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  if (row.kind === 'ps') return (
                    <TableRow key={row.id} className="hover:bg-content2/60 transition-colors">
                      <TableCell>
                        <span className="font-semibold text-primary">{row.ps.period || `PS-${row.ps.id}`}</span>
                      </TableCell>
                      <TableCell><Chip size="sm" variant="flat" color="primary">{DOC_TYPES.pay_slips}</Chip></TableCell>
                      <TableCell className="font-medium">{row.ps.employee_name || '—'}</TableCell>
                      <TableCell className="text-default-500">{fmtDate(row.ps.pay_date)}</TableCell>
                      <TableCell className="text-default-500">—</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-success font-semibold">฿{fmt(row.ps.net_income)}</span>
                          <span className="text-[11px] text-default-400 ml-1">หัก ฿{fmt(row.ps.total_deductions)}</span>
                        </div>
                      </TableCell>
                      <TableCell><Chip size="sm" variant="flat" color="default">เงินเดือน</Chip></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Btn size="sm" variant="ghost" onClick={() => generatePSPdf(row.ps)}>PDF</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => openEditPS(row.ps)}>{t('btn_edit')}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => doDeletePS(row.ps.id)}>{t('btn_delete')}</Btn>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  return (
                    <TableRow key={row.id} className="hover:bg-content2/60 transition-colors">
                      <TableCell><span className="font-semibold text-primary">{row.doc.number || '—'}</span></TableCell>
                      <TableCell className="text-default-500">{DOC_TYPES[row.doc.type] || row.doc.type}</TableCell>
                      <TableCell className="font-medium">{row.doc.contact_name || '—'}</TableCell>
                      <TableCell className="text-default-500">{fmtDate(row.doc.date)}</TableCell>
                      <TableCell className="text-default-500">{fmtDate(row.doc.due_date)}</TableCell>
                      <TableCell><span className="text-success font-semibold">฿{fmt(row.doc.total)}</span></TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color={STATUS_COLOR[row.doc.status] || 'default'}>
                          {STATUS_LABELS[row.doc.status] || row.doc.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Btn size="sm" variant="ghost" onClick={() => openView(row.doc.id)}>{t('btn_update')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => doDuplicate(row.doc.id)}>{t('btn_duplicate')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => openPreview(row.doc.id)}>{t('btn_preview')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => generatePDF(row.doc.id)}>PDF</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => openEdit(row.doc.id)}>{t('btn_edit')}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => doDelete(row.doc.id)}>{t('btn_delete')}</Btn>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal('none')} size="xl"
        title={modalTitle()}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal('none')}>{t('btn_cancel')}</Btn>
          {fType === 'withholding_tax' && wfEditId !== null && (
            <Btn variant="ghost" onClick={() => openWHTPreview(wfEditId)}>{t('btn_preview')}</Btn>
          )}
          {fType === 'withholding_tax' && wfEditId !== null && (
            <Btn variant="ghost" onClick={() => generateWHTPDF(wfEditId)}>PDF</Btn>
          )}
          {fType === 'pay_slips' && (
            <Btn variant="ghost" onClick={generatePSPdfFromForm}>PDF</Btn>
          )}
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">

          {/* Type selector — always visible */}
          <div>
            <label className={LABEL_CLASS}>{t('lbl_doc_type')}</label>
            <select
              value={fType}
              disabled={modal === 'edit' || fRefDocId !== null}
              className={SELECT_CLASS}
              onChange={e => {
                const v = e.target.value
                setFType(v)
                if (v === 'withholding_tax' && modal === 'create') resetWHTForm()
                if (v === 'pay_slips' && modal === 'create') resetPSForm()
              }}>
              {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* ── WHT form ── */}
          {fType === 'withholding_tax' && (
            <div className="flex flex-col gap-4">
              <SectionLabel label={t('wht_sec_cert')} />
              <div className="grid grid-cols-2 gap-4">
                <TextField label={t('wht_lbl_book_no')} placeholder="เล่มที่..." value={wfBookNo} onChange={e => setWfBookNo(e.target.value)} />
                <TextField label={t('wht_lbl_cert_no')} placeholder="เลขที่..." value={wfCertNo} onChange={e => setWfCertNo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <TextField type="date" label={t('wht_lbl_issue_date')} value={wfIssueDate} onChange={e => setWfIssueDate(e.target.value)} />
                <div>
                  <label className={LABEL_CLASS}>{t('wht_lbl_form_type')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WHT_FORM_TYPES.map(f => {
                      const on = wfFormType === f.value
                      return (
                        <button key={f.value} type="button" onClick={() => setWfFormType(on ? '' : f.value)}
                          className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${on ? 'border-primary/60 bg-primary/15' : 'border-content3 bg-content2'}`}>
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] text-white flex-shrink-0 border-[1.5px] ${on ? 'border-primary bg-primary' : 'border-default-400 bg-transparent'}`}>{on ? '✓' : ''}</span>
                          {t(f.key)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <SectionLabel label={t('wht_sec_payer')} />
              <TextField label={t('wht_lbl_payer_name')} placeholder="ชื่อบริษัท / บุคคล..." value={wfPayerName} onChange={e => setWfPayerName(e.target.value)} />
              <TextAreaField label={t('wht_lbl_payer_address')} placeholder="ที่อยู่..." value={wfPayerAddress} onChange={e => setWfPayerAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <TextField label={t('wht_lbl_payer_tax_id')} placeholder="0000000000000 (13 หลัก)" maxLength={13} value={wfPayerTaxId} onChange={e => setWfPayerTaxId(e.target.value)} />
                <TextField label={t('wht_lbl_payer_tin')} placeholder="0000000000 (10 หลัก)" maxLength={10} value={wfPayerTin} onChange={e => setWfPayerTin(e.target.value)} />
              </div>
              <SectionLabel label={t('wht_sec_payee')} />
              <div>
                <label className={LABEL_CLASS}>{t('wht_lbl_payee_contact')}</label>
                <select value={wfPayeeId} onChange={e => handleWHTPayeeChange(e.target.value)} className={SELECT_CLASS}>
                  <option value="">{t('lbl_select')}</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <TextField label={t('wht_lbl_payee_name')} placeholder="ชื่อบริษัท / บุคคล..." value={wfPayeeName} onChange={e => setWfPayeeName(e.target.value)} />
              <TextAreaField label={t('wht_lbl_payee_address')} placeholder="ที่อยู่..." value={wfPayeeAddress} onChange={e => setWfPayeeAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <TextField label={t('wht_lbl_payee_tax_id')} placeholder="0000000000000 (13 หลัก)" maxLength={13} value={wfPayeeTaxId} onChange={e => setWfPayeeTaxId(e.target.value)} />
                <TextField label={t('wht_lbl_payee_tin')} placeholder="0000000000 (10 หลัก)" maxLength={10} value={wfPayeeTin} onChange={e => setWfPayeeTin(e.target.value)} />
              </div>
              <SectionLabel label={t('wht_sec_income')} />
              <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px' }}>
                {[t('wht_lbl_income_type'), t('wht_lbl_pay_date'), t('wht_lbl_amount'), t('wht_lbl_tax_withheld'), ''].map((h, i) => (
                  <span key={i} className="text-[10px] font-medium text-default-500 uppercase tracking-wide">{h}</span>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {wfItems.map((item, idx) => {
                  const def = WHT_INCOME_TYPES.find(d => d.value === item.income_type)
                  return (
                    <div key={idx}>
                      <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px' }}>
                        <select value={item.income_type} onChange={e => updateWHTItem(idx, 'income_type', e.target.value)}
                          className={`${SELECT_CLASS} text-[11px] py-1.5`}>
                          {WHT_INCOME_TYPES.map(opt => <option key={opt.value} value={opt.value}>{t(opt.key)}</option>)}
                        </select>
                        <TextField type="date" value={item.pay_date || ''} onChange={e => updateWHTItem(idx, 'pay_date', e.target.value)} />
                        <TextField type="number" min={0} value={item.amount ? String(item.amount) : ''} onChange={e => updateWHTItem(idx, 'amount', e.target.value === '' ? 0 : Number(e.target.value))} />
                        <TextField type="number" min={0} value={item.tax_withheld ? String(item.tax_withheld) : ''} onChange={e => updateWHTItem(idx, 'tax_withheld', e.target.value === '' ? 0 : Number(e.target.value))} />
                        <Btn size="sm" variant="danger" className="px-0 w-8 h-8" onClick={() => setWfItems(prev => prev.filter((_, j) => j !== idx))}>✕</Btn>
                      </div>
                      {def?.hasDesc && (
                        <TextField className="mt-1 w-[60%]" placeholder={t('wht_lbl_income_desc')}
                          value={item.income_type_desc || ''} onChange={e => updateWHTItem(idx, 'income_type_desc', e.target.value)} />
                      )}
                    </div>
                  )
                })}
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setWfItems(prev => [...prev, emptyWHTItem()])}>{t('wht_btn_add_income')}</Btn>
              <div className="bg-content2 border border-content3 rounded-lg px-4 py-3">
                <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('wht_lbl_total_amount')}</span><span className="text-primary font-semibold">฿{fmt(wfTotalAmount)}</span></div>
                <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('wht_lbl_total_tax')}</span><span className="text-danger font-semibold">฿{fmt(wfTotalTax)}</span></div>
              </div>
              <SectionLabel label={t('wht_sec_payer_type')} />
              <div className="flex gap-2 flex-wrap">
                {(['1', '2', '3', '4'] as const).map(pt => (
                  <label key={pt} className={`flex items-center gap-1.5 cursor-pointer text-[13px] px-3 py-1.5 rounded-lg border ${wfPayerType === pt ? 'border-primary/50 bg-primary/15' : 'border-content3 bg-content2'}`}>
                    <input type="radio" name="wf_payer_type" value={pt} checked={wfPayerType === pt} onChange={() => setWfPayerType(pt)} style={{ accentColor: '#7c6df3' }} />
                    {t(`wht_payer_type_${pt}`)}
                  </label>
                ))}
              </div>
              {wfPayerType === '4' && (
                <TextField label={t('wht_lbl_payer_type_other')} placeholder="ระบุ..." value={wfPayerTypeOther} onChange={e => setWfPayerTypeOther(e.target.value)} />
              )}
              <SectionLabel label={t('wht_sec_funds')} />
              <div className="grid grid-cols-3 gap-4">
                <TextField type="number" min={0} label={t('wht_lbl_fund_gpf')} value={wfFundGpf ? String(wfFundGpf) : ''} onChange={e => setWfFundGpf(e.target.value === '' ? 0 : Number(e.target.value))} />
                <TextField type="number" min={0} label={t('wht_lbl_fund_sso')} value={wfFundSso ? String(wfFundSso) : ''} onChange={e => setWfFundSso(e.target.value === '' ? 0 : Number(e.target.value))} />
                <TextField type="number" min={0} label={t('wht_lbl_fund_pvd')} value={wfFundPvd ? String(wfFundPvd) : ''} onChange={e => setWfFundPvd(e.target.value === '' ? 0 : Number(e.target.value))} />
              </div>
            </div>
          )}

          {/* ── PaySlip form ── */}
          {fType === 'pay_slips' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>{t('ps_lbl_employee')}</label>
                  <select value={psForm.employee_name} onChange={e => {
                    const name = e.target.value; setPs('employee_name', name)
                    if (name) {
                      const emp = employees.find(em => em.name === name)
                      if (emp) { if (emp.department) setPs('department', emp.department); if (emp.salary) setPs('salary', emp.salary) }
                    }
                  }} className={SELECT_CLASS}>
                    <option value="">— เลือกพนักงาน —</option>
                    {employees.map(em => <option key={em.id} value={em.name}>{em.name}{em.department ? ` (${em.department})` : ''}{em.employee_no ? ` #${em.employee_no}` : ''}</option>)}
                  </select>
                  <input className="mt-1.5 w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="หรือพิมพ์ชื่อโดยตรง..." value={psForm.employee_name} onChange={e => setPs('employee_name', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <TextField label={t('ps_lbl_dept')} value={psForm.department} onChange={e => setPs('department', e.target.value)} placeholder="แผนก..." />
                  <div className="grid grid-cols-2 gap-2">
                    <TextField label={t('ps_lbl_period')} value={psForm.period} onChange={e => setPs('period', e.target.value)} placeholder="เช่น เมษายน 2568" />
                    <TextField type="date" label={t('ps_lbl_pay_date')} value={psForm.pay_date} onChange={e => setPs('pay_date', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-content2/50 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">{t('ps_income_title')}</div>
                  {([
                    [t('ps_salary'), 'salary', 1], [t('ps_cost_living'), 'cost_of_living', 2],
                    [t('ps_pos_allow'), 'position_allow', 3], [t('ps_meal_allow'), 'meal_allow', 4],
                    [t('ps_overtime'), 'overtime', 5], [t('ps_shift_allow'), 'shift_allow', 6],
                    [t('ps_travel_allow'), 'travel_allow', 7], [t('ps_subsidy'), 'subsidy', 8],
                    [t('ps_welfare'), 'welfare', 9], [t('ps_bonus'), 'bonus', 10],
                  ] as [string, keyof PSForm, number][]).map(([lbl, field, idx]) => (
                    <PSNumRow key={field} label={lbl} idx={idx} value={(psForm as Record<string, unknown>)[field] as number} onChange={v => setPs(field, v)} />
                  ))}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-primary/30">
                    <span className="text-[12px] font-bold text-primary">{t('ps_total_income')}</span>
                    <span className="text-[15px] font-bold text-primary">฿{fmt(psTotalIncome)}</span>
                  </div>
                </div>
                <div className="bg-content2/50 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-danger uppercase tracking-wider mb-2">{t('ps_deduct_title')}</div>
                  {([
                    [t('ps_tax_withheld'), 'tax_withheld', 11], [t('ps_social_sec'), 'social_security', 12],
                    [t('ps_late_deduct'), 'late_deduct', 13], [t('ps_absent_deduct'), 'absent_deduct', 14],
                    [t('ps_loan_deduct'), 'loan_deduct', 15], [t('ps_advance_deduct'), 'advance_deduct', 16],
                    [t('ps_other_deduct'), 'other_deduct', 17],
                  ] as [string, keyof PSForm, number][]).map(([lbl, field, idx]) => (
                    <PSNumRow key={field} label={lbl} idx={idx} value={(psForm as Record<string, unknown>)[field] as number} onChange={v => setPs(field, v)} />
                  ))}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-danger/30">
                    <span className="text-[12px] font-bold text-danger">{t('ps_total_deduct')}</span>
                    <span className="text-[15px] font-bold text-danger">-฿{fmt(psTotalDeductions)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-success/10 border border-success/30 rounded-xl px-5 py-3 flex justify-between items-center">
                <span className="text-[14px] font-bold text-success">{t('ps_net_income')}</span>
                <span className="text-[22px] font-bold text-success">฿{fmt(psNetIncome)}</span>
              </div>
              <div className="bg-content2/50 rounded-xl p-3">
                <div className="text-[11px] font-bold text-default-500 uppercase tracking-wider mb-2">{t('ps_cum_title')}</div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField type="number" label={t('ps_cum_income')} value={psForm.cum_income === 0 ? '' : String(psForm.cum_income)} onChange={e => setPs('cum_income', e.target.value === '' ? 0 : Number(e.target.value))} />
                  <TextField type="number" label={t('ps_cum_tax')} value={psForm.cum_tax === 0 ? '' : String(psForm.cum_tax)} onChange={e => setPs('cum_tax', e.target.value === '' ? 0 : Number(e.target.value))} />
                  <TextField type="number" label={t('ps_cum_social')} value={psForm.cum_social_sec === 0 ? '' : String(psForm.cum_social_sec)} onChange={e => setPs('cum_social_sec', e.target.value === '' ? 0 : Number(e.target.value))} />
                  <TextField type="number" label={t('ps_cum_provident')} value={psForm.cum_provident === 0 ? '' : String(psForm.cum_provident)} onChange={e => setPs('cum_provident', e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
              </div>
              <TextAreaField label={t('lbl_notes')} value={psForm.notes} onChange={e => setPs('notes', e.target.value)} />
            </div>
          )}

          {/* ── Standard doc form ── */}
          {fType !== 'withholding_tax' && fType !== 'pay_slips' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>{t('lbl_contact_select')}</label>
                  <select value={fContactId} onChange={e => {
                    const id = e.target.value; setFContactId(id)
                    if (id) { const found = contacts.find(c => String(c.id) === id); if (found) setFContactName(found.name) }
                    else setFContactName('')
                  }} className={SELECT_CLASS}>
                    <option value="">{t('lbl_select')}</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <TextField label={t('lbl_contact_name')} placeholder={t('lbl_name_ph')} value={fContactName} onChange={e => setFContactName(e.target.value)} />
                  {fContactId && contacts.find(c => String(c.id) === fContactId)?.company && (
                    <div className="text-[12px] text-default-500 mt-1 px-1">🏢 {contacts.find(c => String(c.id) === fContactId)?.company}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField type="text" label={t('lbl_doc_number')} placeholder={t('lbl_auto_number')} value={fNumber} onChange={e => setFNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField type="date" label={t('lbl_date')} value={fDate} onChange={e => setFDate(e.target.value)} />
                <TextField type="date" label={fType === 'delivery_tax_invoice' ? t('lbl_due_date') : 'กำหนดส่ง'} value={fDue} onChange={e => setFDue(e.target.value)} />
              </div>
              <Divider className="my-1" />
              {fType === 'work_order' && <>
                <SectionLabel label="ข้อมูลใบสั่งงานตัด" />
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ['ทรง','style'], ['ผ้า','fabric'], ['หมายเหตุงานตัด','cutting_note'],
                  ] as [string, keyof WorkOrderMeta][]).map(([label, field]) =>
                    <TextField key={field} label={label} value={workMeta[field] || ''} onChange={e => setWorkMeta(m => ({ ...m, [field]: e.target.value }))} />
                  )}
                </div>
              </>}
              <div className="text-[11px] font-semibold text-default-500 uppercase tracking-wide">{fType === 'work_order' ? 'รายการสั่งผลิต' : 'รายการสินค้า / บริการ'}</div>
              {fType === 'work_order' ? <>
                <div className="grid gap-1 px-0.5" style={{ gridTemplateColumns: '112px 52px 52px 55px 55px 55px 55px 65px 65px 65px 32px' }}>
                  {['สินค้า','สี','ไซส์','หน้าผ้า','รอบอก','เสื้อยาว','แขนยาว','จำนวนสั่ง','จำนวนตัด','จำนวนได้',''].map((h, i) =>
                    <span key={i} className="text-[9px] font-medium text-default-500 text-center">{h}</span>)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: '112px 52px 52px 55px 55px 55px 55px 65px 65px 65px 32px' }}>
                      <select className={SELECT_CLASS + ' text-[11px] px-1'} value={item.product_id ? String(item.product_id) : ''} onChange={e => {
                        const p = availableProducts.find(pr => String(pr.id) === e.target.value)
                        if (p) fillItemFromProduct(i, p)
                      }}><option value="">เลือก</option>{selectableProducts.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}</select>
                      {(['color','size','fabric_width','chest','length','sleeve_length'] as (keyof DocumentItem)[]).map(field =>
                        <TextField key={field} value={String(item[field] || '')} onChange={e => updateItem(i,field,e.target.value)} />)}
                      <TextField type="number" min={0} value={item.qty ? String(item.qty) : ''} onChange={e => updateItem(i,'qty',Number(e.target.value)||0)} />
                      <TextField type="number" min={0} value={item.cut_qty ? String(item.cut_qty) : ''} onChange={e => updateItem(i,'cut_qty',Number(e.target.value)||0)} />
                      <TextField type="number" min={0} value={item.received_qty ? String(item.received_qty) : ''} onChange={e => updateItem(i,'received_qty',Number(e.target.value)||0)} />
                      <Btn size="sm" variant="danger" className="px-0 w-8 h-8" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>×</Btn>
                    </div>
                  ))}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setItems(prev => [...prev, { description:'',qty:1,unit:'',price:0,amount:0 }])}>เพิ่มรายการสั่งผลิต</Btn>
                <SectionLabel label="งานเย็บ / งานเพิ่มเติม" />
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ['คอเสื้อ','collar'], ['ไหล่','shoulder'], ['ชายเสื้อ','hem'], ['แขน','sleeve'],
                    ['ตำแหน่งป้ายคอ','label_position'], ['อื่นๆ','other_sewing'],
                    ['ตรวจ QC','qc'], ['จัดส่ง','delivery'],
                  ] as [string, keyof WorkOrderMeta][]).map(([label, field]) =>
                    <TextField key={field} label={label} value={workMeta[field] || ''} onChange={e => setWorkMeta(m => ({ ...m, [field]: e.target.value }))} />
                  )}
                </div>
                <div className="border border-content3 bg-content2 rounded-md p-3">
                  <label className={LABEL_CLASS}>รูปแบบป้าย</label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <label className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-success text-white text-[12px] font-semibold cursor-pointer">
                      เลือกรูปแบบป้าย
                      <input type="file" accept="image/*" className="hidden" onChange={e => selectLabelImage(e.target.files?.[0])} />
                    </label>
                    {workMeta.label_image ? (
                      <div className="flex items-start gap-2">
                        <img src={workMeta.label_image} alt="รูปแบบป้าย" className="w-40 h-28 object-contain bg-white border border-content3" />
                        <Btn size="sm" variant="danger" onClick={() => setWorkMeta(meta => ({ ...meta, label_image: undefined }))}>ลบรูป</Btn>
                      </div>
                    ) : <span className="text-[11px] text-default-400 pt-2">รองรับ JPG, PNG และรูปจากโทรศัพท์ ขนาดไม่เกิน 5 MB</span>}
                  </div>
                </div>
              </> : fType === 'delivery_note' ? <>
                <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: '130px 70px 1fr 70px 105px 95px 32px' }}>
                  {['สินค้า','Size','รายการ','จำนวน','ราคา','จำนวนเงิน',''].map((h, i) => (
                    <span key={i} className="text-[10px] font-medium text-default-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '130px 70px 1fr 70px 105px 95px 32px' }}>
                      <div>
                        <input
                          list={`delivery-products-${i}`}
                          className={SELECT_CLASS + ' text-[12px]'}
                          placeholder="พิมพ์ชื่อหรือรหัส"
                          value={item.product_query ?? products.find(p => p.id === item.product_id)?.name ?? ''}
                          onChange={e => {
                            const query = e.target.value
                            const normalized = query.trim().toLocaleLowerCase('th')
                            const p = availableProducts.find(pr =>
                              pr.name.toLocaleLowerCase('th') === normalized ||
                              (pr.code || '').toLocaleLowerCase('th') === normalized
                            )
                            if (p) fillItemFromProduct(i, p, query)
                            else setItems(prev => {
                              const next = [...prev]
                              next[i] = { ...next[i], product_query: query, product_id: null, product_image: null }
                              return next
                            })
                          }}
                        />
                        <datalist id={`delivery-products-${i}`}>
                          {selectableProducts.map(p => <option key={p.id} value={p.name}>{p.code ? `${p.code} · ` : ''}{p.name} · {p.category || 'ไม่ระบุหมวด'} · ฿{fmt(p.price)}</option>)}
                        </datalist>
                      </div>
                      <TextField placeholder="S/M/L/XL" value={item.size || ''} onChange={e => updateItem(i,'size',e.target.value)} />
                      <TextField placeholder="รายละเอียดสินค้า" value={item.description} onChange={e => updateItem(i,'description',e.target.value)} />
                      <TextField type="number" min={0} value={item.qty ? String(item.qty) : ''} onChange={e => updateItem(i,'qty',Number(e.target.value)||0)} />
                      <TextField type="number" min={0} value={item.price ? String(item.price) : ''} onChange={e => updateItem(i,'price',Number(e.target.value)||0)} />
                      <span className="text-[13px] text-right px-1">฿{fmt(item.amount)}</span>
                      <Btn size="sm" variant="danger" className="px-0 w-8 h-8" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>×</Btn>
                    </div>
                  ))}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setItems(prev => [...prev, { description:'',qty:1,unit:'',price:0,amount:0 }])}>เพิ่มรายการ</Btn>
              </> : <>
              <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: '130px 1fr 64px 56px 100px 90px 32px' }}>
                {[t('lbl_product_col'), t('lbl_item_with_note'), t('lbl_qty'), t('lbl_unit'), t('lbl_price_per'), t('lbl_total_col'), ''].map((h, i) => (
                  <span key={i} className="text-[10px] font-medium text-default-500 uppercase tracking-wide">{h}</span>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((item, i) => (
                  <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '130px 1fr 64px 56px 100px 90px 32px' }}>
                    <select className={SELECT_CLASS + ' text-[12px]'} value={item.product_id ? String(item.product_id) : ''} onChange={e => {
                      const pid = e.target.value
                      if (pid) {
                        const p = availableProducts.find(pr => String(pr.id) === pid)
                        if (p) fillItemFromProduct(i, p)
                      }
                    }}>
                      <option value="">{t('lbl_select')}</option>
                      {selectableProducts.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
                    </select>
                    <div className="flex flex-col gap-1">
                      <TextField placeholder={t('lbl_item_ph')} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      <TextField placeholder={t('lbl_item_note')} value={item.item_note || ''} onChange={e => updateItem(i, 'item_note', e.target.value)} />
                    </div>
                    <TextField type="number" min={0} value={item.qty === 0 ? '' : String(item.qty)} onChange={e => updateItem(i, 'qty', e.target.value === '' ? 0 : Number(e.target.value))} />
                    <TextField placeholder={t('lbl_unit_ph')} value={item.unit || ''} onChange={e => updateItem(i, 'unit', e.target.value)} />
                    <TextField type="number" min={0} value={item.price === 0 ? '' : String(item.price)} onChange={e => updateItem(i, 'price', e.target.value === '' ? 0 : Number(e.target.value))} />
                    <span className="text-[13px] text-right px-1">฿{fmt(item.amount)}</span>
                    <Btn size="sm" variant="danger" className="px-0 w-8 h-8" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>✕</Btn>
                  </div>
                ))}
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setItems(prev => [...prev, { description: '', qty: 1, unit: '', price: 0, amount: 0 }])}>{t('btn_add_item')}</Btn>
              </>}
              <Divider className="my-1" />
              {fType === 'delivery_tax_invoice' && <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>{t('lbl_discount')}</label>
                  <div className="flex gap-1.5">
                    <TextField type="number" min={0} className="flex-1" value={fDiscount === 0 ? '' : String(fDiscount)} onChange={e => setFDiscount(e.target.value === '' ? 0 : Number(e.target.value))} />
                    <ModeToggle mode={fDiscountMode} onChange={setFDiscountMode} />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLASS}>VAT</label>
                  <div className="flex gap-1.5">
                    <TextField type="number" min={0} className="flex-1" value={fVat === 0 ? '' : String(fVat)} onChange={e => setFVat(e.target.value === '' ? 0 : Number(e.target.value))} />
                    <ModeToggle mode={fVatMode} onChange={setFVatMode} />
                  </div>
                </div>
              </div>
              <div className="bg-content2 border border-content3 rounded-lg px-4 py-3.5">
                {[
                  { label: t('lbl_subtotal'), value: `฿${fmt(subtotal)}`, color: '' },
                  { label: `${t('lbl_discount')}${fDiscountMode === 'percent' ? ` (${fDiscount}%)` : ''}`, value: `-฿${fmt(discountAmt)}`, color: 'text-danger' },
                  { label: `VAT${fVatMode === 'percent' ? ` (${fVat}%)` : ''}`, value: `฿${fmt(vatAmt)}`, color: '' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-[13px] py-0.5">
                    <span className="text-default-500">{row.label}</span><span className={row.color}>{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[16px] font-bold border-t border-content3 mt-1.5 pt-2.5">
                  <span>{t('lbl_grand_total')}</span><span className="text-success">฿{fmt(total)}</span>
                </div>
              </div>
              </>}
              {fType === 'delivery_note' && (
                <div className="bg-content2 border border-content3 rounded-lg px-4 py-3.5 flex justify-between text-[16px] font-bold">
                  <span>รวม</span><span className="text-success">฿{fmt(total)}</span>
                </div>
              )}
              {fType !== 'work_order' && <TextAreaField label={t('lbl_notes')} value={fNotes} onChange={e => setFNotes(e.target.value)} />}
            </div>
          )}
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={modal === 'view' && !!viewDoc} onClose={() => setModal('none')} size="xl"
        title={viewDoc ? `${DOC_TYPES[viewDoc.type] || viewDoc.type} — ${viewDoc.number || ''}` : ''}
        footer={viewDoc ? <>
          <Btn variant="ghost" onClick={() => setModal('none')}>{t('btn_close')}</Btn>
          <Btn variant="ghost" onClick={() => openPreview(viewDoc.id)}>{t('btn_preview')}</Btn>
          <Btn variant="primary" onClick={() => generatePDF(viewDoc.id)}>{t('btn_print_pdf')}</Btn>
        </> : undefined}>
        {viewDoc && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_contact_select')}</label><div className="font-semibold">{viewDoc.contact_name || '—'}</div></div>
              <div><label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('col_status')}</label><Chip size="sm" variant="flat" color={STATUS_COLOR[viewDoc.status] || 'default'}>{STATUS_LABELS[viewDoc.status] || viewDoc.status}</Chip></div>
              <div><label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_date')}</label><div>{fmtDate(viewDoc.date)}</div></div>
              <div><label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_due_date')}</label><div>{fmtDate(viewDoc.due_date)}</div></div>
            </div>
            <Card className="bg-content2 border border-content3" shadow="none">
              <CardBody className="p-0">
                <Table removeWrapper aria-label={t('lbl_items_col')} classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
                  <TableHeader>
                    <TableColumn>{t('lbl_items_col')}</TableColumn><TableColumn>{t('lbl_qty')}</TableColumn>
                    <TableColumn>{t('lbl_unit')}</TableColumn><TableColumn>{t('lbl_price_per')}</TableColumn>
                    <TableColumn align="end">{t('lbl_total_col')}</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={<div className="py-5 text-default-500">{t('no_items')}</div>}>
                    {(viewDoc.items || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <div>{item.description}</div>
                          {item.item_note && <div className="text-[11px] font-normal text-default-500 mt-0.5">{t('lbl_notes')}: {item.item_note}</div>}
                        </TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell className="text-default-500">{item.unit || '—'}</TableCell>
                        <TableCell>฿{fmt(item.price)}</TableCell>
                        <TableCell><div className="text-right font-semibold">฿{fmt(item.amount)}</div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
            <div className="bg-content2 border border-content3 rounded-lg px-4 py-3.5">
              <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('lbl_subtotal')}</span><span>฿{fmt(viewDoc.subtotal)}</span></div>
              <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('lbl_discount')}</span><span className="text-danger">-฿{fmt(viewDoc.discount)}</span></div>
              <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">VAT</span><span>฿{fmt(viewDoc.vat)}</span></div>
              <div className="flex justify-between text-[16px] font-bold border-t border-content3 mt-1.5 pt-2.5"><span>{t('lbl_grand_total')}</span><span className="text-success">฿{fmt(viewDoc.total)}</span></div>
              {paidAmount > 0 && <div className="flex justify-between text-[12px] mt-1.5"><span className="text-default-500">{t('paid_amount')}</span><span className="text-success">฿{fmt(paidAmount)}</span></div>}
            </div>
            {viewDoc.notes && <div className="px-3 py-2.5 bg-content2 rounded-lg text-[12px] text-default-500">💬 {viewDoc.notes}</div>}
            {(viewDoc.source_document || viewDoc.workflow_status) && (
              <div className="bg-content2 border border-content3 rounded-lg px-4 py-3 text-[12px]">
                {viewDoc.source_document && (
                  <div className="flex justify-between gap-3">
                    <span className="text-default-500">เชื่อมจาก</span>
                    <span className="font-semibold">{DOC_TYPES[viewDoc.source_document.type] || viewDoc.source_document.type} {viewDoc.source_document.number || ''}</span>
                  </div>
                )}
                {viewDoc.workflow_status && (
                  <div className="flex justify-between gap-3 mt-1">
                    <span className="text-default-500">สถานะงาน</span>
                    <span className="font-semibold text-success">{({
                      not_delivered: 'ยังไม่ส่ง',
                      partially_delivered: 'ส่งบางส่วน',
                      delivered: 'ส่งครบแล้ว',
                      not_billed: 'ยังไม่วางบิล',
                      billed: 'วางบิลแล้ว',
                    } as Record<string, string>)[viewDoc.workflow_status]}</span>
                  </div>
                )}
              </div>
            )}
            {(viewDoc.payments || []).length > 0 && (
              <div>
                <Divider className="mb-3" />
                <div className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-2.5">{t('payment_history')}</div>
                {viewDoc.payments!.map((p, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-content3 text-[13px]">
                    <span className="text-default-500">{fmtDate(p.date)} · {p.method}</span>
                    <span className="text-success font-semibold">฿{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <Divider className="my-1" />
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-medium">{t('change_status')}</label>
              <select value={statusChange} onChange={e => setStatusChange(e.target.value)} className={`${SELECT_CLASS} flex-1`}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Btn size="sm" variant="primary" onClick={() => doChangeStatus(viewDoc.id)}>{t('btn_update')}</Btn>
            </div>
            {((viewDoc.type === 'work_order' && viewDoc.workflow_status !== 'delivered') ||
              (viewDoc.type === 'delivery_note' && viewDoc.workflow_status !== 'billed')) && <>
              <Divider className="my-1" />
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-medium whitespace-nowrap">สร้างเอกสารถัดไป</label>
                <select value={convertType} onChange={e => setConvertType(e.target.value)} className={`${SELECT_CLASS} flex-1`}>
                  <option value="">{t('lbl_select')}</option>
                  {viewDoc.type === 'work_order' && <option value="delivery_note">{DOC_TYPES.delivery_note}</option>}
                  {viewDoc.type === 'delivery_note' && <option value="delivery_tax_invoice">{DOC_TYPES.delivery_tax_invoice}</option>}
                </select>
                <Btn size="sm" variant="primary" onClick={doConvert} disabled={!convertType}>สร้าง</Btn>
              </div>
            </>}
          </div>
        )}
      </Modal>

      <PreviewModal open={!!preview} onClose={() => setPreview(null)}
        title={t('btn_preview')} html={preview?.html || ''}
        onDownload={() => { if (preview) generatePDF(preview.id) }}
        downloadLabel={t('btn_print_pdf')} closeLabel={t('btn_close')} />

      <PreviewModal open={!!whtPreview} onClose={() => setWhtPreview(null)}
        title={t('btn_preview')} html={whtPreview?.html || ''}
        onDownload={() => { if (whtPreview) generateWHTPDF(whtPreview.id) }}
        downloadLabel={t('btn_print_pdf')} closeLabel={t('btn_close')} />
    </div>
  )
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function buildPDFHtml(doc: Document, company: Company | null, contact: Contact | null, t: (k: string) => string): string {
  const fmtN = (n: number | undefined | null) =>
    new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
  const fmtD = (d: string | undefined | null) => d ? d.slice(0, 10) : '-'
  if (doc.type === 'delivery_note') return buildDeliveryNoteHtml(doc, company, fmtN, fmtD)
  if (doc.type === 'work_order') return buildWorkOrderHtml(doc, company, fmtN, fmtD)
  if (doc.type === 'delivery_tax_invoice') return buildTaxInvoiceHtml(doc, company, contact, fmtN, fmtD)
  const PDF_TL: Record<string, string> = {
    delivery_tax_invoice: t('type_delivery_tax_invoice'),
    delivery_note: t('type_delivery_note'),
    work_order: t('type_work_order'),
  }
  const PDF_SL: Record<string, string> = {
    draft: t('status_draft_f'), sent: t('status_sent_f'), approved: t('status_approved_f'),
    paid: t('status_paid_f'), cancelled: t('status_cancelled_f'),
  }
  const docTitle = PDF_TL[doc.type] || doc.type
  const statusColor: Record<string, string> = { draft: '#94a3b8', sent: '#60a5fa', approved: '#34d399', paid: '#10b981', cancelled: '#f87171' }
  const logoHtml = company?.logo_url
    ? `<img src="${company.logo_url}" style="max-height:64px;max-width:140px;object-fit:contain" />`
    : `<div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff">${(company?.name || 'B').slice(0, 2)}</div>`
  const itemsRows = (doc.items || []).map((item, i) =>
    `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 8px;font-size:13px;color:#374151">${i + 1}</td>
      <td style="padding:7px 8px;text-align:center">${item.product_image
        ? `<img src="${item.product_image}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:7px;border:1px solid #e5e7eb;display:inline-block" />`
        : `<div style="width:48px;height:48px;border-radius:7px;border:1px dashed #d1d5db;background:#f9fafb;display:inline-flex;align-items:center;justify-content:center;color:#9ca3af;font-size:9px">${t('pdf_no_image')}</div>`}
      </td>
      <td style="padding:10px 8px;font-size:13px;color:#111827;font-weight:500">${item.description || '-'}${item.item_note ? `<div style="font-size:11px;color:#6b7280;font-weight:400;margin-top:2px">${item.item_note}</div>` : ''}</td>
      <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:center">${item.qty}</td>
      <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:center">${item.unit || '-'}</td>
      <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:right">${fmtN(item.price)}</td>
      <td style="padding:10px 8px;font-size:13px;color:#111827;font-weight:600;text-align:right">${fmtN(item.amount)}</td>
    </tr>`
  ).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${docTitle} ${doc.number || ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Sarabun',sans-serif;background:#fff;color:#111827;font-size:14px;line-height:1.6}@page{size:A4;margin:16mm 16mm 20mm}@media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}.page{max-width:800px;margin:0 auto;padding:32px}.print-btn{position:fixed;top:16px;right:16px;background:#6366f1;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.35)}</style></head>
<body>
<button class="no-print print-btn" onclick="window.print()">${t('pdf_print_btn')}</button>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #6366f1">
    <div style="display:flex;align-items:center;gap:16px">${logoHtml}<div>
      <div style="font-size:18px;font-weight:700;color:#111827">${company?.name || 'BYD CASHFLOW'}</div>
      ${company?.branch ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${company.branch}</div>` : ''}
      ${company?.tax_id ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tax_prefix')}${company.tax_id}</div>` : ''}
      ${company?.address ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;max-width:240px">${company.address}</div>` : ''}
      ${company?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tel_prefix')}${company.phone}</div>` : ''}
      ${company?.email ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${company.email}</div>` : ''}
    </div></div>
    <div style="text-align:right">
      <div style="font-size:26px;font-weight:700;color:#111827;margin-bottom:6px">${docTitle}</div>
      <div style="background:#f8f9ff;border:1px solid #e0e7ff;border-radius:8px;padding:12px 16px;min-width:200px">
        <div style="font-size:13px;color:#6b7280;margin-bottom:4px">${t('pdf_doc_no')}</div>
        <div style="font-size:17px;font-weight:700;color:#111827">${doc.number || '-'}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <span style="width:8px;height:8px;border-radius:50%;background:${statusColor[doc.status] || '#94a3b8'};display:inline-block"></span>
          <span style="font-size:12px;color:#6b7280">${PDF_SL[doc.status] || doc.status}</span>
        </div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div style="background:#f9fafb;border-radius:10px;padding:16px">
      <div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">${t('pdf_customer_label')}</div>
      <div style="font-size:15px;font-weight:600;color:#111827">${doc.contact_name || '-'}</div>
      ${contact?.company ? `<div style="font-size:13px;color:#374151;margin-top:2px">${contact.company}</div>` : ''}
      ${contact?.tax_id ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tax_prefix')}${contact.tax_id}</div>` : ''}
      ${contact?.address ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;max-width:220px">${contact.address}</div>` : ''}
      ${contact?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tel_prefix')}${contact.phone}</div>` : ''}
    </div>
    <div style="background:#f9fafb;border-radius:10px;padding:16px">
      <div style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">${t('pdf_dates_label')}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#6b7280">${t('pdf_issue_date')}</span><span style="font-weight:500;color:#111827">${fmtD(doc.date)}</span></div>
        ${doc.due_date ? `<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#6b7280">${t('pdf_due_date')}</span><span style="font-weight:500;color:#ef4444">${fmtD(doc.due_date)}</span></div>` : ''}
      </div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr>
      <th style="padding:11px 12px;text-align:left;font-size:12px;font-weight:600;color:#111827;width:40px;border:1px solid #9ca3af;background:#fff">${t('pdf_item_no')}</th>
      <th style="padding:11px 8px;text-align:center;font-size:12px;font-weight:600;color:#111827;width:66px;border:1px solid #9ca3af;background:#fff">${t('pdf_image')}</th>
      <th style="padding:11px 12px;text-align:left;font-size:12px;font-weight:600;color:#111827;border:1px solid #9ca3af;background:#fff">${t('pdf_item_desc')}</th>
      <th style="padding:11px 12px;text-align:center;font-size:12px;font-weight:600;color:#111827;width:70px;border:1px solid #9ca3af;background:#fff">${t('pdf_qty')}</th>
      <th style="padding:11px 12px;text-align:center;font-size:12px;font-weight:600;color:#111827;width:70px;border:1px solid #9ca3af;background:#fff">${t('pdf_unit')}</th>
      <th style="padding:11px 12px;text-align:right;font-size:12px;font-weight:600;color:#111827;width:110px;border:1px solid #9ca3af;background:#fff">${t('pdf_unit_price')}</th>
      <th style="padding:11px 12px;text-align:right;font-size:12px;font-weight:600;color:#111827;width:110px;border:1px solid #9ca3af;background:#fff">${t('pdf_amount')}</th>
    </tr></thead>
    <tbody>${itemsRows || `<tr><td colspan="7" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">${t('pdf_no_items')}</td></tr>`}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:300px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_subtotal')}</span><span style="color:#111827">฿${fmtN(doc.subtotal)}</span></div>
      ${(doc.discount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_discount')}</span><span style="color:#ef4444">-฿${fmtN(doc.discount)}</span></div>` : ''}
      ${(doc.vat || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_vat')}</span><span style="color:#111827">฿${fmtN(doc.vat)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 14px;background:#fff;border:1px solid #111827;border-radius:8px;margin-top:8px"><span style="font-size:15px;font-weight:700;color:#111827">${t('pdf_grand_total')}</span><span style="font-size:15px;font-weight:700;color:#111827">฿${fmtN(doc.total)}</span></div>
    </div>
  </div>
  ${doc.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px"><div style="font-size:11px;font-weight:600;color:#92400e;margin-bottom:4px">${t('pdf_notes_label')}</div><div style="font-size:13px;color:#78350f">${doc.notes}</div></div>` : ''}
  <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:32px">
    <div style="text-align:center"><div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px"><div style="font-size:12px;color:#6b7280">${t('pdf_auth_sig')}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${company?.name || ''}</div></div></div>
    <div style="text-align:center"><div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px"><div style="font-size:12px;color:#6b7280">${t('pdf_recv_sig')}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${doc.contact_name || ''}</div></div></div>
  </div>
</div></body></html>`
}

function buildTaxInvoiceHtml(
  doc: Document, company: Company | null, contact: Contact | null,
  fmtN: (n: number | undefined | null) => string,
  fmtD: (d: string | undefined | null) => string,
): string {
  const lineItems = doc.items || []
  const fmtQty = (value: number | undefined | null) => Number.isInteger(Number(value)) ? String(Number(value || 0)) : fmtN(value)
  const rows = lineItems.map((item, index) => `<tr>
    <td class="center">${index + 1}</td>
    <td class="desc">${item.description || '-'}${item.item_note ? `<div class="item-note">${item.item_note}</div>` : ''}</td>
    <td class="center">${fmtQty(item.qty)}</td><td class="center">${item.unit || '-'}</td>
    <td class="right">${fmtN(item.price)}</td><td class="right">${fmtN(item.discount || 0)}</td><td class="right">${fmtN(item.amount)}</td>
  </tr>`).join('')
  const blanks = Array.from({ length: Math.max(0, 16 - lineItems.length) }, () =>
    '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const beforeTax = Number(doc.subtotal || 0) - Number(doc.discount || 0)
  const vatRate = beforeTax > 0 ? Number(doc.vat || 0) / beforeTax * 100 : 0
  const customerName = contact?.company || doc.contact_name || contact?.name || '-'
  const logo = company?.logo_url ? `<img class="logo" src="${company.logo_url}" alt="" />` : ''
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบส่งสินค้า/ใบกำกับภาษี ${doc.number || ''}</title>
  <style>
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:Tahoma,"Sarabun",sans-serif;font-size:10px;line-height:1.25}
  @page{size:A4 portrait;margin:7mm}.page{width:100%;max-width:196mm;min-height:283mm;margin:auto;padding:2mm}
  .logo{max-width:28mm;max-height:20mm;object-fit:contain;margin-right:3mm}.header{display:flex;justify-content:space-between;align-items:flex-start;min-height:27mm;margin-bottom:2mm}
  .company{display:flex;max-width:126mm;font-size:9.5px;line-height:1.35}.company-name{font-size:16px;font-weight:700;margin-bottom:.6mm}
  .title-box{text-align:center;color:#315f5f;width:58mm;flex:0 0 58mm}.title{border:2px solid #4f8f8f;border-radius:8px;padding:1.5mm 2mm;font-size:14px;line-height:1.2;font-weight:700}.copy{font-size:10px;line-height:1.35;font-weight:700;margin-top:1mm}
  .info-grid{display:grid;grid-template-columns:58% 42%;border:1px solid #4f8f8f;border-radius:9px 9px 0 0;overflow:hidden}
  .customer{padding:2.4mm;min-height:36mm;border-right:1px solid #4f8f8f;font-size:9.5px}.customer-row{display:grid;grid-template-columns:30mm 1fr;margin-bottom:1.2mm}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #4f8f8f;padding:.9mm 1mm;vertical-align:top;font-size:9px}th{font-weight:700}.meta td{height:5.2mm;line-height:1.15}.meta td:first-child{width:47%;color:#315f5f}
  .center{text-align:center}.right{text-align:right}.desc{font-size:9.5px;font-weight:600}.item-note{font-size:8.5px;font-weight:400;color:#444;margin-top:.5mm}
  .items th{background:#edf7f5;text-align:center;font-size:8.5px;line-height:1.1;vertical-align:middle}.items tbody tr{height:6.6mm}.items th:nth-child(1){width:7%}.items th:nth-child(2){width:39%}
  .items th:nth-child(3),.items th:nth-child(4){width:8%}.items th:nth-child(5){width:13%}.items th:nth-child(6){width:11%}.items th:nth-child(7){width:14%}
  .summary{display:grid;grid-template-columns:61% 39%}.terms{border:1px solid #4f8f8f;border-top:0;padding:2mm;min-height:31mm;display:flex;flex-direction:column;justify-content:flex-end;gap:3mm}.amount-words{text-align:center;font-weight:700;font-size:10px}
  .totals td{font-size:8.7px;vertical-align:middle}.totals td:first-child{font-weight:700;background:#edf7f5}.totals td:last-child{text-align:right;font-weight:600}.grand td{font-size:10.5px;font-weight:700}
  .signatures{display:grid;grid-template-columns:repeat(4,1fr);border-left:1px solid #4f8f8f}.sign{height:40mm;border-right:1px solid #4f8f8f;border-bottom:1px solid #4f8f8f;padding:1.5mm;text-align:center;font-size:8px;display:flex;flex-direction:column;justify-content:space-between}
  .payment{text-align:left;font-size:7.5px;line-height:1.35}.line{border-top:1px solid #4f8f8f;padding-top:1mm}
  @media print{.page{padding:0}}
  </style></head><body><div class="page">
    <div class="header"><div class="company">${logo}<div>
      <div class="company-name">${company?.name || 'BYD CASHFLOW'}</div>
      ${company?.branch ? `<div>${company.branch}</div>` : ''}${company?.tax_id ? `<div>เลขประจำตัวผู้เสียภาษี Tax ID: ${company.tax_id}</div>` : ''}
      ${company?.address ? `<div>${company.address}</div>` : ''}<div>${company?.phone ? `โทร. ${company.phone}` : ''}${company?.email ? ` · ${company.email}` : ''}</div>
    </div></div><div class="title-box"><div class="title">ใบส่งสินค้า/ใบกำกับภาษี<br><span style="font-size:11px">DELIVERY ORDER / TAX INVOICE</span></div><div class="copy">ต้นฉบับ / ORIGINAL<br>สำหรับลูกค้า</div></div></div>
    <div class="info-grid"><div class="customer">
      <div class="customer-row"><b>ลูกค้า Customer</b><span>${customerName}</span></div><div class="customer-row"><b>สาขา Branch</b><span>${contact?.branch || 'สำนักงานใหญ่'}</span></div>
      <div class="customer-row"><b>เลขประจำตัวผู้เสียภาษี Tax ID</b><span>${contact?.tax_id || '-'}</span></div><div class="customer-row"><b>ที่อยู่ Address</b><span>${contact?.address || '-'}</span></div>
    </div><table class="meta"><tbody>
      <tr><td>เลขที่ No.</td><td>${doc.number || '-'}</td></tr><tr><td>วันที่ Date</td><td>${fmtD(doc.date)}</td></tr><tr><td>กำหนดชำระ Due Date</td><td>${fmtD(doc.due_date)}</td></tr>
      <tr><td>เงื่อนไขชำระ Credit Term</td><td></td></tr><tr><td>อ้างอิง Reference</td><td>${doc.source_document?.number || ''}</td></tr><tr><td>พนักงานขาย Employee</td><td></td></tr><tr><td>เลขที่ใบสั่งซื้อ PO No.</td><td></td></tr>
    </tbody></table></div>
    <table class="items"><thead><tr><th>ลำดับ<br>Item</th><th>รายการสินค้า<br>Description</th><th>จำนวน<br>Qty</th><th>หน่วย<br>Unit</th><th>ราคาต่อหน่วย<br>Unit Price</th><th>ส่วนลด<br>Discount</th><th>จำนวนเงิน<br>Amount</th></tr></thead><tbody>${rows}${blanks}</tbody></table>
    <div class="summary"><div class="terms"><div class="amount-words">(${thaiBahtText(Number(doc.total || 0))})</div><div>สินค้าตามรายการข้างต้นได้รับในสภาพเรียบร้อยและถูกต้อง / RECEIVED THE ABOVE GOODS IN GOOD ORDER AND CONDITION</div></div>
      <table class="totals"><tbody><tr><td>รวมจำนวนเงิน Total Amount</td><td>${fmtN(doc.subtotal)}</td></tr><tr><td>ส่วนลด Discount</td><td>${fmtN(doc.discount)}</td></tr>
      <tr><td>จำนวนเงินก่อนภาษี Amount not include tax</td><td>${fmtN(beforeTax)}</td></tr><tr><td>ภาษีมูลค่าเพิ่ม V.A.T. ${vatRate ? `${fmtN(vatRate)}%` : ''}</td><td>${fmtN(doc.vat)}</td></tr>
      <tr class="grand"><td>จำนวนเงินรวมทั้งสิ้น Grand Total</td><td>${fmtN(doc.total)}</td></tr></tbody></table>
    </div>
    <div class="signatures">
      <div class="sign"><div class="payment">ชำระโดย PAY BY<br>□ เงินสด CASH &nbsp; □ เช็ค CHEQUE<br>□ เงินโอน TRANSFER<br><br>ธนาคาร __________ สาขา __________<br>จำนวนเงิน __________</div><div class="line">ผู้รับเงิน / COLLECTOR<br>วันที่ DATE ____/____/____</div></div>
      <div class="sign"><div></div><div class="line">ผู้รับสินค้า / RECEIVED BY<br>วันที่ DATE ____/____/____</div></div><div class="sign"><div></div><div class="line">ผู้ส่งสินค้า / DELIVERY BY<br>วันที่ DATE ____/____/____</div></div>
      <div class="sign"><div></div><div class="line">ผู้มีอำนาจลงนาม / AUTHORIZED SIGNATURE<br>วันที่ DATE ____/____/____</div></div>
    </div>
  </div></body></html>`
}

function thaiBahtText(amount: number): string {
  const digitWords = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const positionWords = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
  const readGroup = (value: number): string => {
    if (value === 0) return ''
    const digits = String(value)
    return digits.split('').map((char, index) => {
      const digit = Number(char)
      if (digit === 0) return ''
      const position = digits.length - index - 1
      if (position === 1) return digit === 1 ? 'สิบ' : digit === 2 ? 'ยี่สิบ' : `${digitWords[digit]}สิบ`
      if (position === 0 && digit === 1 && digits.length > 1) return 'เอ็ด'
      return `${digitWords[digit]}${positionWords[position]}`
    }).join('')
  }
  const readInteger = (value: number): string => {
    if (value === 0) return digitWords[0]
    if (value >= 1_000_000) {
      return `${readInteger(Math.floor(value / 1_000_000))}ล้าน${value % 1_000_000 ? readGroup(value % 1_000_000) : ''}`
    }
    return readGroup(value)
  }
  const absolute = Math.abs(amount)
  let baht = Math.floor(absolute)
  let satang = Math.round((absolute - baht) * 100)
  if (satang === 100) { baht += 1; satang = 0 }
  return `${amount < 0 ? 'ลบ' : ''}${readInteger(baht)}บาท${satang ? `${readGroup(satang)}สตางค์` : 'ถ้วน'}`
}

function printShell(title: string, body: string, landscape = false): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Tahoma,"Sarabun",sans-serif;font-size:12px}
  @page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm}.page{margin:auto;padding:10mm;max-width:${landscape ? '1120px' : '794px'}}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:5px;vertical-align:middle}th{font-weight:700}
  .center{text-align:center}.right{text-align:right}.bold{font-weight:700}.no-border{border:0}.print{position:fixed;right:16px;top:16px;border:0;border-radius:7px;padding:9px 18px;background:#111;color:#fff;cursor:pointer}
  @media print{.print{display:none}.page{padding:0}}
  </style></head><body><button class="print" onclick="window.print()">พิมพ์ / บันทึก PDF</button><div class="page">${body}</div></body></html>`
}

function buildDeliveryNoteHtml(
  doc: Document, company: Company | null,
  fmtN: (n: number | undefined | null) => string,
  fmtD: (d: string | undefined | null) => string,
): string {
  const rows = (doc.items || []).map((item, i) => `<tr>
    <td class="center">${i + 1}</td><td class="center">${item.size || '-'}</td>
    <td>${item.description || '-'}</td><td class="center">${item.qty || 0}</td>
    <td class="right">${fmtN(item.price)}</td><td class="right">${fmtN(item.amount)}</td>
  </tr>`).join('')
  const blanks = Array.from({ length: Math.max(5, 18 - (doc.items || []).length) }, () =>
    '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  return printShell(`ใบส่งของ ${doc.number || ''}`, `
    <div class="center bold" style="font-size:23px;margin:12px 0 20px">ใบส่งของ</div>
    <table style="margin-bottom:14px"><tr>
      <td style="width:13%" class="bold">นาม</td><td style="width:57%">${doc.contact_name || '-'}</td>
      <td style="width:12%" class="bold">เลขที่</td><td>${doc.number || '-'}</td>
    </tr><tr><td class="bold">บริษัท</td><td>${company?.name || '-'}</td><td class="bold">วันที่</td><td>${fmtD(doc.date)}</td></tr></table>
    <table><thead><tr><th style="width:9%">ลำดับ</th><th style="width:10%">Size</th><th>รายการ</th><th style="width:11%">จำนวน</th><th style="width:11%">ราคา</th><th style="width:15%">จำนวนเงิน</th></tr></thead>
    <tbody>${rows}${blanks}<tr style="background:#f4cc18"><td></td><td colspan="2" class="center bold">รวม</td><td class="center bold">${(doc.items || []).reduce((s,i)=>s+(Number(i.qty)||0),0)}</td><td></td><td class="right bold">${fmtN(doc.total)}</td></tr></tbody></table>
    ${doc.notes ? `<div style="margin-top:10px"><b>หมายเหตุ:</b> ${doc.notes}</div>` : ''}
  `)
}

function buildWorkOrderHtml(
  doc: Document, company: Company | null,
  _fmtN: (n: number | undefined | null) => string,
  fmtD: (d: string | undefined | null) => string,
): string {
  let meta: WorkOrderMeta = {}
  try { meta = typeof doc.meta === 'string' ? JSON.parse(doc.meta) : (doc.meta || {}) } catch {}
  const rows = (doc.items || []).map((item, i) => `<tr>
    <td class="center">${i + 1}</td><td class="center">${item.color || ''}</td><td class="center">${item.size || ''}</td>
    <td class="center">${item.fabric_width || ''}</td><td class="center">${item.chest || ''}</td><td class="center">${item.length || ''}</td><td class="center">${item.sleeve_length || ''}</td>
    <td class="center">${item.qty || 0}</td><td class="center">${item.cut_qty || ''}</td><td class="center">${item.received_qty || ''}</td>
  </tr>`).join('')
  const blanks = Array.from({ length: Math.max(0, 10 - (doc.items || []).length) }, (_, i) =>
    `<tr><td class="center">${(doc.items || []).length + i + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')
  return printShell(`ใบสั่งงาน ${doc.number || ''}`, `
    <div class="center bold" style="font-size:58px;line-height:1.2;margin:20px 0 24px">No:${doc.number || '-'}</div>
    <table>
      <tr><th style="width:11%">ลูกค้า</th><td style="width:39%">${doc.contact_name || '-'}</td><th colspan="2" style="width:50%;background:#f4dede;font-size:22px">ใบสั่งงานตัด</th></tr>
      <tr><th>วันที่</th><td>${fmtD(doc.date)}</td><th style="width:14%">ทรง</th><td>${meta.style || ''}</td></tr>
      <tr><th>กำหนดส่ง</th><td>${fmtD(doc.due_date)}</td><th>ผ้า</th><td>${meta.fabric || ''}</td></tr>
      <tr><td colspan="2" style="border:0"></td><th>หมายเหตุ</th><td style="background:#fff900">${meta.cutting_note || doc.notes || ''}</td></tr>
    </table>
    <table><thead><tr style="background:#e5e7eb"><th>No.</th><th>สี</th><th>ไซส์</th><th>หน้าผ้า</th><th>รอบอก</th><th>เสื้อยาว</th><th>แขนยาว</th><th>จำนวน(สั่ง)</th><th>จำนวน(ตัด)</th><th>จำนวน(ได้)</th></tr></thead>
    <tbody>${rows}${blanks}<tr><td colspan="7" class="right bold">รวม</td><td class="center bold">${(doc.items || []).reduce((s,i)=>s+(Number(i.qty)||0),0)}</td><td colspan="2"></td></tr></tbody></table>
    <div style="display:grid;grid-template-columns:1fr 1fr;align-items:stretch">
    <div style="border:1px solid #000;border-right:0;min-height:300px;padding:8px;text-align:center">
      <div class="bold" style="font-size:18px;margin-bottom:8px">แบบป้าย</div>
      ${meta.label_image
        ? `<img src="${meta.label_image}" alt="แบบป้าย" style="width:100%;height:250px;object-fit:contain;display:block" />`
        : `<div style="height:250px;display:flex;align-items:center;justify-content:center;color:#777">ไม่มีรูปแบบป้าย</div>`}
    </div>
    <table>
      <tr style="background:#dce9bd"><th colspan="2" style="font-size:20px">ใบสั่งเย็บ</th></tr>
      <tr><th style="width:36%">คอเสื้อ</th><td>${meta.collar || ''}</td></tr>
      <tr><th>ไหล่</th><td>${meta.shoulder || ''}</td></tr>
      <tr><th>ชายเสื้อ</th><td>${meta.hem || ''}</td></tr>
      <tr><th>แขน</th><td>${meta.sleeve || ''}</td></tr>
      <tr><th>ตำแหน่งป้ายคอ</th><td>${meta.label_position || ''}</td></tr>
      <tr><th>อื่นๆ</th><td>${meta.other_sewing || ''}</td></tr>
      <tr style="background:#fffde0"><th colspan="2" style="font-size:18px">ใบสั่งเพิ่มเติม</th></tr>
      <tr><th>ตรวจ QC</th><td>${meta.qc || ''}</td></tr>
      <tr><th>จัดส่ง</th><td>${meta.delivery || ''}</td></tr>
    </table>
    </div>
  `)
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }: { mode: 'amount' | 'percent'; onChange: (m: 'amount' | 'percent') => void }) {
  return (
    <div className="flex border border-content3 rounded-lg overflow-hidden flex-shrink-0">
      <button onClick={() => onChange('amount')} className={`px-2.5 text-[12px] font-semibold transition-colors ${mode === 'amount' ? 'bg-primary/40 text-primary-300' : 'bg-content2 text-default-500'}`}>฿</button>
      <button onClick={() => onChange('percent')} className={`px-2.5 text-[12px] font-semibold transition-colors ${mode === 'percent' ? 'bg-primary/40 text-primary-300' : 'bg-content2 text-default-500'}`}>%</button>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wide mt-2">
      <div className="flex-1 h-px bg-primary/20" />
      {label}
      <div className="flex-1 h-px bg-primary/20" />
    </div>
  )
}

function PSNumRow({ label, idx, value, onChange }: { label: string; idx: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-content3/50">
      <span className="text-[11px] text-default-400 w-4 flex-shrink-0">{idx}</span>
      <span className="text-[12px] text-default-600 flex-1">{label}</span>
      <input type="number" min={0} step="0.01"
        value={value === 0 ? '' : String(value)}
        onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-28 bg-content2 border border-content3 rounded-lg px-2 py-1 text-sm text-right text-foreground outline-none focus:border-primary transition-colors" />
    </div>
  )
}
