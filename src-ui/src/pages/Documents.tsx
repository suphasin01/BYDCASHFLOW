import { useEffect, useState } from 'react'
import {
  Card, CardBody, Chip, Divider, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { ChevronDown, Receipt } from 'lucide-react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getDocuments, getDocument, createDocument, updateDocument, deleteDocument, patchDocumentStatus, getContacts, getActiveCompany, getContact, getProducts, getWithholdingTaxList, deleteWithholdingTax } from '../api'
import type { Document, DocumentItem, Contact, Company, Product, WithholdingTax } from '../types'
import { fmt, fmtDate, today } from '../utils'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import PreviewModal from '../ui/PreviewModal'

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
const STATUS_COLOR: Record<string, ChipColor> = {
  draft: 'default', sent: 'primary', approved: 'success', paid: 'success', cancelled: 'danger',
}

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'withholding_tax' | 'companies' | 'settings'

export default function Documents({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { t } = useI18n()
  const { toast } = useToast()

  const [docs, setDocs] = useState<Document[]>([])
  const [whts, setWhts] = useState<WithholdingTax[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'none' | 'create' | 'edit' | 'view'>('none')
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [preview, setPreview] = useState<{ html: string; id: number } | null>(null)

  // Form state
  const [fType, setFType] = useState('quotation')
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
  const [items, setItems] = useState<DocumentItem[]>([{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
  const [statusChange, setStatusChange] = useState('')
  const [convertType, setConvertType] = useState('')
  const [search, setSearch] = useState('')
  const [showDocMenu, setShowDocMenu] = useState(false)

  const DOC_TYPES: Record<string, string> = {
    quotation: t('type_quotation'), invoice: t('type_invoice'), receipt: t('type_receipt'),
    billing_note: t('type_billing_note'), cash_invoice: t('type_cash_invoice'),
    purchase_order: t('type_purchase_order'), expense: t('type_expense'),
    withholding_tax: t('nav_withholding_tax'),
  }
  const WHT_FORM_LABELS: Record<string, string> = {
    nd53: 'ภ.ง.ด.53', nd3: 'ภ.ง.ด.3', nd1: 'ภ.ง.ด.1ก',
    nd1_special: 'ภ.ง.ด.1กพิเศษ', nd2: 'ภ.ง.ด.2', nd2k: 'ภ.ง.ด.2ก', nd3k: 'ภ.ง.ด.3ก',
  }
  const STATUS_LABELS: Record<string, string> = {
    draft: t('status_draft'), sent: t('status_sent'), approved: t('status_approved'),
    paid: t('status_paid'), cancelled: t('status_cancelled'),
  }

  const load = async () => {
    setLoading(true)
    try {
      const showDocs = filterType !== 'withholding_tax'
      const showWhts = !filterType || filterType === 'withholding_tax'
      const params: Record<string, string> = {}
      if (filterType && showDocs) params.type = filterType
      if (filterStatus) params.status = filterStatus
      if (search) params.q = search
      const [docsRes, whtsRes] = await Promise.all([
        showDocs ? getDocuments(params) : Promise.resolve({ data: [] as Document[] }),
        showWhts ? getWithholdingTaxList() : Promise.resolve({ data: [] as WithholdingTax[] }),
      ])
      setDocs(docsRes.data)
      // client-side filter WHT by search
      const q = search.toLowerCase()
      setWhts(q
        ? whtsRes.data.filter(w =>
            (w.cert_no || '').toLowerCase().includes(q) ||
            w.payee_name.toLowerCase().includes(q) ||
            w.payer_name.toLowerCase().includes(q))
        : whtsRes.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [filterType, filterStatus, search])

  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const discountAmt = fDiscountMode === 'percent' ? subtotal * fDiscount / 100 : fDiscount
  const vatAmt = fVatMode === 'percent' ? (subtotal - discountAmt) * fVat / 100 : fVat
  const total = subtotal - discountAmt + vatAmt

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

  const openCreate = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([getContacts(), getProducts()])
    setContacts(cs)
    setProducts(ps)
    setEditDoc(null)
    setFType('quotation'); setFNumber(''); setFContactId(''); setFContactName('')
    setFDate(today()); setFDue(''); setFDiscount(0); setFDiscountMode('amount'); setFVat(7); setFVatMode('percent'); setFNotes('')
    setItems([{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    setModal('create')
  }

  const openEdit = async (id: number) => {
    const [doc, { data: cs }, { data: ps }] = await Promise.all([getDocument(id), getContacts(), getProducts()])
    setContacts(cs)
    setProducts(ps)
    setEditDoc(doc)
    setFType(doc.type); setFNumber(doc.number || ''); setFContactId(doc.contact_id ? String(doc.contact_id) : ''); setFContactName(doc.contact_name || '')
    setFDate(doc.date?.slice(0, 10) || today()); setFDue(doc.due_date?.slice(0, 10) || ''); setFDiscount(doc.discount || 0); setFDiscountMode('amount'); setFVat(doc.vat || 0); setFVatMode('amount'); setFNotes(doc.notes || '')
    setItems(doc.items?.length ? doc.items : [{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    setModal('edit')
  }

  const openView = async (id: number) => {
    const doc = await getDocument(id)
    setViewDoc(doc)
    setStatusChange(doc.status)
    setConvertType('')
    setModal('view')
  }

  const save = async () => {
    const validItems = items.filter(i => i.description.trim())
    if (validItems.length === 0) {
      toast(t('no_items'), 'err')
      return
    }
    try {
      const payload = {
        type: fType as Document['type'], number: fNumber || undefined,
        contact_id: fContactId ? Number(fContactId) : null,
        contact_name: fContactName || null,
        date: fDate, due_date: fDue || null,
        subtotal, discount: discountAmt, vat: vatAmt, total,
        notes: fNotes || null, items: validItems,
      }
      if (modal === 'edit' && editDoc) {
        await updateDocument(editDoc.id, payload)
        toast(t('toast_doc_edited'))
      } else {
        await createDocument(payload)
        toast(t('toast_doc_saved'))
      }
      setModal('none')
      load()
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

  const doChangeStatus = async (id: number) => {
    try {
      await patchDocumentStatus(id, statusChange)
      toast(t('toast_update_status'))
      const updated = await getDocument(id)
      setViewDoc(updated)
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doConvert = async () => {
    if (!viewDoc || !convertType) return
    const [{ data: cs }, { data: ps }] = await Promise.all([getContacts(), getProducts()])
    setContacts(cs)
    setProducts(ps)
    setEditDoc(null)
    setFType(convertType)
    setFNumber('')
    setFContactId(viewDoc.contact_id ? String(viewDoc.contact_id) : '')
    setFContactName(viewDoc.contact_name || '')
    setFDate(today())
    setFDue(viewDoc.due_date?.slice(0, 10) || '')
    setFDiscount(viewDoc.discount || 0); setFDiscountMode('amount')
    setFVat(viewDoc.vat || 0); setFVatMode('amount')
    setFNotes(viewDoc.notes || '')
    setItems(viewDoc.items?.length ? viewDoc.items.map(it => ({ description: it.description, qty: it.qty, unit: it.unit || '', price: it.price, amount: it.amount, product_id: it.product_id })) : [{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    setModal('create')
  }

  const doDuplicate = async (docId: number) => {
    const [doc, { data: cs }, { data: ps }] = await Promise.all([getDocument(docId), getContacts(), getProducts()])
    setContacts(cs)
    setProducts(ps)
    setEditDoc(null)
    setFType(doc.type)
    setFNumber('')
    setFContactId(doc.contact_id ? String(doc.contact_id) : '')
    setFContactName(doc.contact_name || '')
    setFDate(today())
    setFDue(doc.due_date?.slice(0, 10) || '')
    setFDiscount(doc.discount || 0); setFDiscountMode('amount')
    setFVat(doc.vat || 0); setFVatMode('amount')
    setFNotes(doc.notes || '')
    setItems(doc.items?.length ? doc.items.map(it => ({ description: it.description, qty: it.qty, unit: it.unit || '', price: it.price, amount: it.amount, product_id: it.product_id })) : [{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    setModal('create')
  }

  const generatePDF = async (docId: number) => {
    try {
      const [doc, company] = await Promise.all([getDocument(docId), getActiveCompany()])
      const contact = doc.contact_id ? await getContact(doc.contact_id).catch(() => null) : null
      const html = buildPDFHtml(doc, company, contact, t)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) {
        const filename = `${doc.type}_${doc.number || doc.id}.pdf`
        await api.exportPDF(html, filename)
      } else {
        // fallback for browser/dev mode
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
      }
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={`${SELECT_CLASS} min-w-[130px]`}>
            <option value="">{t('all_types')}</option>
            {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${SELECT_CLASS} min-w-[130px]`}>
            <option value="">{t('all_statuses')}</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <TextField className="min-w-[200px]" placeholder={t('search_doc')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative flex items-center gap-2">
          <Btn variant="ghost" size="sm" startContent={<Receipt size={14} strokeWidth={2} />}
            onClick={() => onNavigate?.('withholding_tax')}>
            {t('nav_withholding_tax')}
          </Btn>
          <Btn variant="primary" onClick={openCreate}>{t('btn_create_doc')}</Btn>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-content1 border border-content3 rounded-xl" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('btn_create_doc')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('col_number')}</TableColumn>
                <TableColumn>{t('col_type')}</TableColumn>
                <TableColumn>{t('col_contact')}</TableColumn>
                <TableColumn>{t('col_date')}</TableColumn>
                <TableColumn>{t('col_due_date')}</TableColumn>
                <TableColumn>{t('col_amount')}</TableColumn>
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
                  ...docs.map(doc => ({ kind: 'doc' as const, id: `d-${doc.id}`, doc })),
                  ...whts.map(wht => ({ kind: 'wht' as const, id: `w-${wht.id}`, wht })),
                ].sort((a, b) => {
                  const da = a.kind === 'doc' ? a.doc.date : a.wht.issue_date
                  const db = b.kind === 'doc' ? b.doc.date : b.wht.issue_date
                  return (db || '').localeCompare(da || '')
                }).map(row => row.kind === 'wht' ? (
                  <TableRow key={row.id} className="hover:bg-content2/60 transition-colors">
                    <TableCell>
                      <span className="font-semibold text-primary">{row.wht.cert_no || `WHT-${row.wht.id}`}</span>
                      {row.wht.book_no && <span className="text-[11px] text-default-400 ml-1.5">เล่ม {row.wht.book_no}</span>}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="secondary">{DOC_TYPES.withholding_tax}</Chip>
                    </TableCell>
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
                        {WHT_FORM_LABELS[row.wht.form_type || ''] || row.wht.form_type || 'ภ.ง.ด.53'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => onNavigate?.('withholding_tax')}>{t('btn_edit')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => doDeleteWht(row.wht.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal('none')} size="xl"
        title={modal === 'edit' ? t('modal_edit_doc') : t('modal_new_doc')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal('none')}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_doc_type')}</label>
                    <select value={fType} className={SELECT_CLASS} onChange={e => {
                      if (e.target.value === 'withholding_tax') { setModal('none'); onNavigate?.('withholding_tax'); return }
                      setFType(e.target.value)
                    }}>
                      {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <TextField label={t('lbl_doc_number')}
                    placeholder={t('lbl_auto_number')} value={fNumber} onChange={e => setFNumber(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_contact_select')}</label>
                    <select value={fContactId} onChange={e => {
                      const id = e.target.value
                      setFContactId(id)
                      if (id) {
                        const found = contacts.find(c => String(c.id) === id)
                        if (found) {
                          setFContactName(found.name)
                        }
                      } else {
                        setFContactName('')
                      }
                    }} className={SELECT_CLASS}>
                      <option value="">{t('lbl_select')}</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <TextField label={t('lbl_contact_name')}
                      placeholder={t('lbl_name_ph')} value={fContactName} onChange={e => setFContactName(e.target.value)} />
                    {fContactId && contacts.find(c => String(c.id) === fContactId)?.company && (
                      <div className="text-[12px] text-default-500 mt-1 px-1">
                        🏢 {contacts.find(c => String(c.id) === fContactId)?.company}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField type="date" label={t('lbl_date')}
                    value={fDate} onChange={e => setFDate(e.target.value)} />
                  <TextField type="date" label={t('lbl_due_date')}
                    value={fDue} onChange={e => setFDue(e.target.value)} />
                </div>

                <Divider className="my-1" />

                {/* Items */}
                <div className="text-[11px] font-semibold text-default-500 uppercase tracking-wide">รายการสินค้า / บริการ</div>
                <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: '130px 1fr 64px 56px 100px 90px 32px' }}>
                  {[t('lbl_product_col'), t('lbl_items_col'), t('lbl_qty'), t('lbl_unit'), t('lbl_price_per'), t('lbl_total_col'), ''].map((h, i) => (
                    <span key={i} className="text-[10px] font-medium text-default-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '130px 1fr 64px 56px 100px 90px 32px' }}>
                      <select className={SELECT_CLASS + ' text-[12px]'}
                        value={item.product_id ? String(item.product_id) : ''}
                        onChange={e => {
                          const pid = e.target.value
                          if (pid) {
                            const p = products.find(pr => String(pr.id) === pid)
                            setItems(prev => {
                              const next = [...prev]
                              const it = { ...next[i] }
                              if (p) { it.product_id = Number(pid); it.description = p.name; if (p.unit) it.unit = p.unit; it.price = p.price; it.amount = (it.qty || 1) * p.price }
                              next[i] = it
                              return next
                            })
                          }
                        }}>
                        <option value="">{t('lbl_select')}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
                      </select>
                      <TextField placeholder={t('lbl_item_ph')}
                        value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      <TextField type="number" min={0}
                        value={item.qty === 0 ? '' : String(item.qty)} onChange={e => updateItem(i, 'qty', e.target.value === '' ? 0 : Number(e.target.value))} />
                      <TextField placeholder={t('lbl_unit_ph')}
                        value={item.unit || ''} onChange={e => updateItem(i, 'unit', e.target.value)} />
                      <TextField type="number" min={0}
                        value={item.price === 0 ? '' : String(item.price)} onChange={e => updateItem(i, 'price', e.target.value === '' ? 0 : Number(e.target.value))} />
                      <span className="text-[13px] text-right px-1">฿{fmt(item.amount)}</span>
                      <Btn size="sm" variant="danger" className="px-0 w-8 h-8" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>✕</Btn>
                    </div>
                  ))}
                </div>
                <div>
                  <Btn size="sm" variant="ghost" onClick={() => setItems(prev => [...prev, { description: '', qty: 1, unit: '', price: 0, amount: 0 }])}>{t('btn_add_item')}</Btn>
                </div>

                <Divider className="my-1" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_discount')}</label>
                    <div className="flex gap-1.5">
                      <TextField type="number" min={0} className="flex-1"
                        value={fDiscount === 0 ? '' : String(fDiscount)} onChange={e => setFDiscount(e.target.value === '' ? 0 : Number(e.target.value))} />
                      <ModeToggle mode={fDiscountMode} onChange={setFDiscountMode} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">VAT</label>
                    <div className="flex gap-1.5">
                      <TextField type="number" min={0} className="flex-1"
                        value={fVat === 0 ? '' : String(fVat)} onChange={e => setFVat(e.target.value === '' ? 0 : Number(e.target.value))} />
                      <ModeToggle mode={fVatMode} onChange={setFVatMode} />
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-content2 border border-content3 rounded-lg px-4 py-3.5">
                  {[
                    { label: t('lbl_subtotal'), value: `฿${fmt(subtotal)}`, color: '' },
                    { label: `${t('lbl_discount')}${fDiscountMode === 'percent' ? ` (${fDiscount}%)` : ''}`, value: `-฿${fmt(discountAmt)}`, color: 'text-danger' },
                    { label: `VAT${fVatMode === 'percent' ? ` (${fVat}%)` : ''}`, value: `฿${fmt(vatAmt)}`, color: '' },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between text-[13px] py-0.5">
                      <span className="text-default-500">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[16px] font-bold border-t border-content3 mt-1.5 pt-2.5">
                    <span>{t('lbl_grand_total')}</span>
                    <span className="text-success">฿{fmt(total)}</span>
                  </div>
                </div>

                <TextAreaField label={t('lbl_notes')}
                  value={fNotes} onChange={e => setFNotes(e.target.value)} />
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
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_contact_select')}</label>
                    <div className="font-semibold">{viewDoc.contact_name || '—'}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('col_status')}</label>
                    <Chip size="sm" variant="flat" color={STATUS_COLOR[viewDoc.status] || 'default'}>
                      {STATUS_LABELS[viewDoc.status] || viewDoc.status}
                    </Chip>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_date')}</label>
                    <div>{fmtDate(viewDoc.date)}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{t('lbl_due_date')}</label>
                    <div>{fmtDate(viewDoc.due_date)}</div>
                  </div>
                </div>

                <Card className="bg-content2 border border-content3" shadow="none">
                  <CardBody className="p-0">
                    <Table removeWrapper aria-label={t('lbl_items_col')}
                      classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
                      <TableHeader>
                        <TableColumn>{t('lbl_items_col')}</TableColumn>
                        <TableColumn>{t('lbl_qty')}</TableColumn>
                        <TableColumn>{t('lbl_unit')}</TableColumn>
                        <TableColumn>{t('lbl_price_per')}</TableColumn>
                        <TableColumn align="end">{t('lbl_total_col')}</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent={<div className="py-5 text-default-500">{t('no_items')}</div>}>
                        {(viewDoc.items || []).map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.description}</TableCell>
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

                {/* Totals */}
                <div className="bg-content2 border border-content3 rounded-lg px-4 py-3.5">
                  <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('lbl_subtotal')}</span><span>฿{fmt(viewDoc.subtotal)}</span></div>
                  <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">{t('lbl_discount')}</span><span className="text-danger">-฿{fmt(viewDoc.discount)}</span></div>
                  <div className="flex justify-between text-[13px] py-0.5"><span className="text-default-500">VAT</span><span>฿{fmt(viewDoc.vat)}</span></div>
                  <div className="flex justify-between text-[16px] font-bold border-t border-content3 mt-1.5 pt-2.5">
                    <span>{t('lbl_grand_total')}</span><span className="text-success">฿{fmt(viewDoc.total)}</span>
                  </div>
                  {paidAmount > 0 && (
                    <div className="flex justify-between text-[12px] mt-1.5">
                      <span className="text-default-500">{t('paid_amount')}</span>
                      <span className="text-success">฿{fmt(paidAmount)}</span>
                    </div>
                  )}
                </div>

                {viewDoc.notes && (
                  <div className="px-3 py-2.5 bg-content2 rounded-lg text-[12px] text-default-500">💬 {viewDoc.notes}</div>
                )}

                {/* Payment History */}
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

                {/* Change Status */}
                <Divider className="my-1" />
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-medium">{t('change_status')}</label>
                  <select value={statusChange} onChange={e => setStatusChange(e.target.value)} className={`${SELECT_CLASS} flex-1`}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <Btn size="sm" variant="primary" onClick={() => doChangeStatus(viewDoc.id)}>{t('btn_update')}</Btn>
                </div>

                {/* Convert Document */}
                <Divider className="my-1" />
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-medium whitespace-nowrap">{t('btn_convert_label')}</label>
                  <select value={convertType} onChange={e => setConvertType(e.target.value)} className={`${SELECT_CLASS} flex-1`}>
                    <option value="">{t('lbl_select')}</option>
                    {Object.entries(DOC_TYPES).filter(([k]) => k !== viewDoc?.type && k !== 'withholding_tax').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <Btn size="sm" variant="ghost" onClick={doConvert} disabled={!convertType}>{t('btn_convert')}</Btn>
                </div>
          </div>
        )}
      </Modal>

      <PreviewModal open={!!preview} onClose={() => setPreview(null)}
        title={t('btn_preview')} html={preview?.html || ''}
        onDownload={() => { if (preview) generatePDF(preview.id) }}
        downloadLabel={t('btn_print_pdf')} closeLabel={t('btn_close')} />
    </div>
  )
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function buildPDFHtml(doc: Document, company: Company | null, contact: Contact | null, t: (k: string) => string): string {
  const fmtN = (n: number | undefined | null) =>
    new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
  const fmtD = (d: string | undefined | null) => d ? d.slice(0, 10) : '-'

  const PDF_TL: Record<string, string> = {
    quotation: t('type_quotation'), invoice: t('type_invoice'), receipt: t('type_receipt_f'),
    billing_note: t('type_billing_note_f'), cash_invoice: t('type_cash_invoice_f'),
    purchase_order: t('type_purchase_order'), expense: t('type_expense_f'),
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
    `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 12px;font-size:13px;color:#374151">${i + 1}</td><td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:500">${item.description || '-'}</td><td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center">${item.qty}</td><td style="padding:10px 12px;font-size:13px;color:#374151;text-align:center">${item.unit || '-'}</td><td style="padding:10px 12px;font-size:13px;color:#374151;text-align:right">${fmtN(item.price)}</td><td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:600;text-align:right">${fmtN(item.amount)}</td></tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${docTitle} ${doc.number || ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Sarabun',sans-serif;background:#fff;color:#111827;font-size:14px;line-height:1.6}@page{size:A4;margin:16mm 16mm 20mm}@media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}.page{max-width:800px;margin:0 auto;padding:32px}.print-btn{position:fixed;top:16px;right:16px;background:#6366f1;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.35)}</style></head>
<body>
<button class="no-print print-btn" onclick="window.print()">${t('pdf_print_btn')}</button>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #6366f1">
    <div style="display:flex;align-items:center;gap:16px">${logoHtml}<div>
      <div style="font-size:18px;font-weight:700;color:#111827">${company?.name || 'FruitBiz'}</div>
      ${company?.branch ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${company.branch}</div>` : ''}
      ${company?.tax_id ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tax_prefix')}${company.tax_id}</div>` : ''}
      ${company?.address ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;max-width:240px">${company.address}</div>` : ''}
      ${company?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t('pdf_tel_prefix')}${company.phone}</div>` : ''}
      ${company?.email ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${company.email}</div>` : ''}
    </div></div>
    <div style="text-align:right">
      <div style="font-size:26px;font-weight:700;color:#6366f1;margin-bottom:6px">${docTitle}</div>
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
    <thead><tr style="background:#6366f1">
      <th style="padding:11px 12px;text-align:left;font-size:12px;font-weight:600;color:#fff;width:40px">${t('pdf_item_no')}</th>
      <th style="padding:11px 12px;text-align:left;font-size:12px;font-weight:600;color:#fff">${t('pdf_item_desc')}</th>
      <th style="padding:11px 12px;text-align:center;font-size:12px;font-weight:600;color:#fff;width:70px">${t('pdf_qty')}</th>
      <th style="padding:11px 12px;text-align:center;font-size:12px;font-weight:600;color:#fff;width:70px">${t('pdf_unit')}</th>
      <th style="padding:11px 12px;text-align:right;font-size:12px;font-weight:600;color:#fff;width:110px">${t('pdf_unit_price')}</th>
      <th style="padding:11px 12px;text-align:right;font-size:12px;font-weight:600;color:#fff;width:110px">${t('pdf_amount')}</th>
    </tr></thead>
    <tbody>${itemsRows || `<tr><td colspan="6" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">${t('pdf_no_items')}</td></tr>`}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:300px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_subtotal')}</span><span style="color:#111827">฿${fmtN(doc.subtotal)}</span></div>
      ${(doc.discount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_discount')}</span><span style="color:#ef4444">-฿${fmtN(doc.discount)}</span></div>` : ''}
      ${(doc.vat || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#6b7280">${t('pdf_vat')}</span><span style="color:#111827">฿${fmtN(doc.vat)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 14px;background:#6366f1;border-radius:8px;margin-top:8px"><span style="font-size:15px;font-weight:700;color:#fff">${t('pdf_grand_total')}</span><span style="font-size:15px;font-weight:700;color:#fff">฿${fmtN(doc.total)}</span></div>
    </div>
  </div>
  ${doc.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px"><div style="font-size:11px;font-weight:600;color:#92400e;margin-bottom:4px">${t('pdf_notes_label')}</div><div style="font-size:13px;color:#78350f">${doc.notes}</div></div>` : ''}
  <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:32px">
    <div style="text-align:center"><div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px"><div style="font-size:12px;color:#6b7280">${t('pdf_auth_sig')}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${company?.name || ''}</div></div></div>
    <div style="text-align:center"><div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px"><div style="font-size:12px;color:#6b7280">${t('pdf_recv_sig')}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${doc.contact_name || ''}</div></div></div>
  </div>

</div></body></html>`

  return html
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }: { mode: 'amount' | 'percent'; onChange: (m: 'amount' | 'percent') => void }) {
  return (
    <div className="flex border border-content3 rounded-lg overflow-hidden flex-shrink-0">
      <button onClick={() => onChange('amount')}
        className={`px-2.5 text-[12px] font-semibold transition-colors ${mode === 'amount' ? 'bg-primary/40 text-primary-300' : 'bg-content2 text-default-500'}`}>฿</button>
      <button onClick={() => onChange('percent')}
        className={`px-2.5 text-[12px] font-semibold transition-colors ${mode === 'percent' ? 'bg-primary/40 text-primary-300' : 'bg-content2 text-default-500'}`}>%</button>
    </div>
  )
}
