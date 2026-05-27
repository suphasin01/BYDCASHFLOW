import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getDocuments, getDocument, createDocument, updateDocument, deleteDocument, patchDocumentStatus, getContacts, getActiveCompany } from '../api'
import type { Document, DocumentItem, Contact, Company } from '../types'
import { fmt, fmtDate, today } from '../utils'

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(139,148,158,0.12)', color: '#8b949e' },
  sent: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
  approved: { bg: 'rgba(34,211,160,0.12)', color: '#22d3a0' },
  paid: { bg: 'rgba(34,211,160,0.18)', color: '#6ee7b7' },
  cancelled: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
}

export default function Documents() {
  const { t } = useI18n()
  const { toast } = useToast()

  const [docs, setDocs] = useState<Document[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'none' | 'create' | 'edit' | 'view'>('none')
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])

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

  const DOC_TYPES: Record<string, string> = {
    quotation: t('type_quotation'), invoice: t('type_invoice'), receipt: t('type_receipt'),
    billing_note: t('type_billing_note'), cash_invoice: t('type_cash_invoice'),
    purchase_order: t('type_purchase_order'), expense: t('type_expense'),
  }
  const STATUS_LABELS: Record<string, string> = {
    draft: t('status_draft'), sent: t('status_sent'), approved: t('status_approved'),
    paid: t('status_paid'), cancelled: t('status_cancelled'),
  }

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterType) params.type = filterType
      if (filterStatus) params.status = filterStatus
      const { data } = await getDocuments(params)
      setDocs(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [filterType, filterStatus])

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
    const { data: cs } = await getContacts()
    setContacts(cs)
    setEditDoc(null)
    setFType('quotation'); setFNumber(''); setFContactId(''); setFContactName('')
    setFDate(today()); setFDue(''); setFDiscount(0); setFDiscountMode('amount'); setFVat(7); setFVatMode('percent'); setFNotes('')
    setItems([{ description: '', qty: 1, unit: '', price: 0, amount: 0 }])
    setModal('create')
  }

  const openEdit = async (id: number) => {
    const doc = await getDocument(id)
    const { data: cs } = await getContacts()
    setContacts(cs)
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

  const doChangeStatus = async (id: number) => {
    try {
      await patchDocumentStatus(id, statusChange)
      toast(t('toast_update_status'))
      const updated = await getDocument(id)
      setViewDoc(updated)
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const generatePDF = async (docId: number) => {
    try {
      const [doc, company] = await Promise.all([getDocument(docId), getActiveCompany()])
      const html = buildPDFHtml(doc, company, t)
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelectStyle}>
            <option value="">{t('all_types')}</option>
            {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterSelectStyle}>
            <option value="">{t('all_statuses')}</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('btn_create_doc')}</button>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('col_number'), t('col_type'), t('col_contact'), t('col_date'), t('col_due_date'), t('col_amount'), t('col_status'), t('col_actions')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 7 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#8892a4' }}>{t('loading')}</td></tr>
              ) : docs.length > 0 ? docs.map(doc => {
                const badge = STATUS_BADGE[doc.status] || STATUS_BADGE.draft
                return (
                  <tr key={doc.id}>
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: '#7c6df3' }}>{doc.number || '—'}</span></td>
                    <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{DOC_TYPES[doc.type] || doc.type}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{doc.contact_name || '—'}</td>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{fmtDate(doc.date)}</td>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{fmtDate(doc.due_date)}</td>
                    <td style={tdStyle}><span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(doc.total)}</span></td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: badge.bg, color: badge.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: badge.color, display: 'inline-block' }} />
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => openView(doc.id)} style={btnGhostSmStyle}>{t('btn_view')}</button>
                      {' '}
                      <button onClick={() => generatePDF(doc.id)} style={{ ...btnGhostSmStyle, margin: '0 4px' }}>PDF</button>
                      {' '}
                      <button onClick={() => openEdit(doc.id)} style={{ ...btnGhostSmStyle, marginRight: 4 }}>{t('btn_edit')}</button>
                      {' '}
                      <button onClick={() => doDelete(doc.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>📄</div>
                  <p>{t('no_documents')}</p>
                  <p style={{ marginTop: 4, fontSize: 12 }} dangerouslySetInnerHTML={{ __html: t('no_documents_hint') }} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <ModalOverlay onClose={() => setModal('none')}>
          <ModalContainer>
            <ModalHeader title={modal === 'edit' ? t('modal_edit_doc') : t('modal_new_doc')} onClose={() => setModal('none')} />
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={formRowStyle}>
                <FormGroup label={t('lbl_doc_type')}>
                  <StyledSelect value={fType} onChange={e => setFType(e.target.value)}>
                    {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </StyledSelect>
                </FormGroup>
                <FormGroup label={t('lbl_doc_number')}>
                  <StyledInput value={fNumber} onChange={e => setFNumber(e.target.value)} placeholder={t('lbl_auto_number')} />
                </FormGroup>
              </div>
              <div style={formRowStyle}>
                <FormGroup label={t('lbl_contact_select')}>
                  <StyledSelect value={fContactId} onChange={e => setFContactId(e.target.value)}>
                    <option value="">{t('lbl_select')}</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </StyledSelect>
                </FormGroup>
                <FormGroup label={t('lbl_contact_name')}>
                  <StyledInput value={fContactName} onChange={e => setFContactName(e.target.value)} placeholder={t('lbl_name_ph')} />
                </FormGroup>
              </div>
              <div style={formRowStyle}>
                <FormGroup label={t('lbl_date')}>
                  <StyledInput type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
                </FormGroup>
                <FormGroup label={t('lbl_due_date')}>
                  <StyledInput type="date" value={fDue} onChange={e => setFDue(e.target.value)} />
                </FormGroup>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />

              {/* Items */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 56px 100px 90px 32px', gap: 6, marginBottom: 4, padding: '0 2px' }}>
                {[t('lbl_items_col'), t('lbl_qty'), t('lbl_unit'), t('lbl_price_per'), t('lbl_total_col'), ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 56px 100px 90px 32px', gap: 6, alignItems: 'center' }}>
                    <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder={t('lbl_item_ph')}
                      style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                    <input type="number" value={item.qty === 0 ? '' : item.qty} onChange={e => updateItem(i, 'qty', e.target.value === '' ? 0 : Number(e.target.value))} min={0}
                      style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                    <input value={item.unit || ''} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder={t('lbl_unit_ph')}
                      style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                    <input type="number" value={item.price === 0 ? '' : item.price} onChange={e => updateItem(i, 'price', e.target.value === '' ? 0 : Number(e.target.value))} min={0}
                      style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                    <span style={{ fontSize: 13, textAlign: 'right', padding: '0 4px' }}>฿{fmt(item.amount)}</span>
                    <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, cursor: 'pointer', padding: '5px', color: '#f87171', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setItems(prev => [...prev, { description: '', qty: 1, unit: '', price: 0, amount: 0 }])}
                style={{ ...btnGhostSmStyle, marginTop: 10 }}>{t('btn_add_item')}</button>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />

              <div style={formRowStyle}>
                <FormGroup label={t('lbl_discount')}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <StyledInput type="number" value={fDiscount === 0 ? '' : fDiscount} onChange={e => setFDiscount(e.target.value === '' ? 0 : Number(e.target.value))} style={{ flex: 1 }} min={0} />
                    <ModeToggle mode={fDiscountMode} onChange={setFDiscountMode} />
                  </div>
                </FormGroup>
                <FormGroup label="VAT">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <StyledInput type="number" value={fVat === 0 ? '' : fVat} onChange={e => setFVat(e.target.value === '' ? 0 : Number(e.target.value))} style={{ flex: 1 }} min={0} />
                    <ModeToggle mode={fVatMode} onChange={setFVatMode} />
                  </div>
                </FormGroup>
              </div>

              {/* Totals */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '14px 16px', marginTop: 8 }}>
                {[
                  { label: t('lbl_subtotal'), value: `฿${fmt(subtotal)}`, color: undefined },
                  { label: `${t('lbl_discount')}${fDiscountMode === 'percent' ? ` (${fDiscount}%)` : ''}`, value: `-฿${fmt(discountAmt)}`, color: '#f87171' },
                  { label: `VAT${fVatMode === 'percent' ? ` (${fVat}%)` : ''}`, value: `฿${fmt(vatAmt)}`, color: undefined },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                    <span style={{ color: '#8892a4' }}>{row.label}</span>
                    <span style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 6, paddingTop: 10 }}>
                  <span>{t('lbl_grand_total')}</span>
                  <span style={{ color: '#22d3a0' }}>฿{fmt(total)}</span>
                </div>
              </div>

              <FormGroup label={t('lbl_notes')} style={{ marginTop: 14 }}>
                <StyledTextarea value={fNotes} onChange={e => setFNotes(e.target.value)} />
              </FormGroup>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal('none')} style={btnGhostStyle}>{t('btn_cancel')}</button>
              <button onClick={save} style={btnPrimaryStyle}>{t('btn_save')}</button>
            </div>
          </ModalContainer>
        </ModalOverlay>
      )}

      {/* View Modal */}
      {modal === 'view' && viewDoc && (
        <ModalOverlay onClose={() => setModal('none')}>
          <ModalContainer wide>
            <ModalHeader title={`${DOC_TYPES[viewDoc.type] || viewDoc.type} — ${viewDoc.number || ''}`} onClose={() => setModal('none')} />
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><label style={labelStyle}>{t('lbl_contact_select')}</label><div style={{ fontWeight: 600 }}>{viewDoc.contact_name || '—'}</div></div>
                <div>
                  <label style={labelStyle}>{t('col_status')}</label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: STATUS_BADGE[viewDoc.status]?.bg, color: STATUS_BADGE[viewDoc.status]?.color }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_BADGE[viewDoc.status]?.color, display: 'inline-block' }} />
                    {STATUS_LABELS[viewDoc.status] || viewDoc.status}
                  </span>
                </div>
                <div><label style={labelStyle}>{t('lbl_date')}</label><div>{fmtDate(viewDoc.date)}</div></div>
                <div><label style={labelStyle}>{t('lbl_due_date')}</label><div>{fmtDate(viewDoc.due_date)}</div></div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {[t('lbl_items_col'), t('lbl_qty'), t('lbl_unit'), t('lbl_price_per'), t('lbl_total_col')].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(viewDoc.items || []).length > 0 ? viewDoc.items!.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{item.description}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{item.qty}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#8892a4' }}>{item.unit || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>฿{fmt(item.price)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>฿{fmt(item.amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#8892a4' }}>{t('no_items')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: '#8892a4' }}>{t('lbl_subtotal')}</span><span>฿{fmt(viewDoc.subtotal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: '#8892a4' }}>{t('lbl_discount')}</span><span style={{ color: '#f87171' }}>-฿{fmt(viewDoc.discount)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: '#8892a4' }}>VAT</span><span>฿{fmt(viewDoc.vat)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 6, paddingTop: 10 }}>
                  <span>{t('lbl_grand_total')}</span><span style={{ color: '#22d3a0' }}>฿{fmt(viewDoc.total)}</span>
                </div>
                {((viewDoc.payments || []).reduce((s, p) => s + p.amount, 0)) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span style={{ color: '#8892a4' }}>{t('paid_amount')}</span>
                    <span style={{ color: '#22d3a0' }}>฿{fmt((viewDoc.payments || []).reduce((s, p) => s + p.amount, 0))}</span>
                  </div>
                )}
              </div>

              {viewDoc.notes && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: '#8892a4', marginBottom: 16 }}>💬 {viewDoc.notes}</div>
              )}

              {/* Payment History */}
              {(viewDoc.payments || []).length > 0 && (
                <div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 12px' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>{t('payment_history')}</div>
                  {viewDoc.payments!.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 13 }}>
                      <span style={{ color: '#8892a4' }}>{fmtDate(p.date)} · {p.method}</span>
                      <span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Change Status */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, textTransform: 'none' }}>{t('change_status')}</label>
                <select value={statusChange} onChange={e => setStatusChange(e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => doChangeStatus(viewDoc.id)} style={btnPrimarySmStyle}>{t('btn_update')}</button>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal('none')} style={btnGhostStyle}>{t('btn_close')}</button>
              <button onClick={() => generatePDF(viewDoc.id)} style={btnPrimaryStyle}>{t('btn_print_pdf')}</button>
            </div>
          </ModalContainer>
        </ModalOverlay>
      )}
    </div>
  )
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function buildPDFHtml(doc: Document, company: Company | null, t: (k: string) => string): string {
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
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'contents' }}>{children}</div>
    </div>
  )
}

function ModalContainer({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: wide ? 640 : 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', padding: '5px 11px', color: '#8892a4', fontSize: 13, fontFamily: 'inherit' }}>✕</button>
    </div>
  )
}

function FormGroup({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />
}

function StyledSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...props.style }}>{children}</select>
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5, ...props.style }} />
}

function ModeToggle({ mode, onChange }: { mode: 'amount' | 'percent'; onChange: (m: 'amount' | 'percent') => void }) {
  const base: React.CSSProperties = { border: 'none', cursor: 'pointer', padding: '0 9px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', height: '100%', transition: 'all .15s', borderRadius: 0 }
  return (
    <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <button onClick={() => onChange('amount')} style={{ ...base, borderRadius: '7px 0 0 7px', background: mode === 'amount' ? 'rgba(124,109,243,0.4)' : 'rgba(255,255,255,0.04)', color: mode === 'amount' ? '#c4b5fd' : '#8892a4' }}>฿</button>
      <button onClick={() => onChange('percent')} style={{ ...base, borderRadius: '0 7px 7px 0', background: mode === 'percent' ? 'rgba(124,109,243,0.4)' : 'rgba(255,255,255,0.04)', color: mode === 'percent' ? '#c4b5fd' : '#8892a4' }}>%</button>
    </div>
  )
}

const filterSelectStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', minWidth: 130, colorScheme: 'inherit' as React.CSSProperties['colorScheme'] }
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', colorScheme: 'inherit' as React.CSSProperties['colorScheme'] }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }
const formRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnPrimarySmStyle: React.CSSProperties = { ...btnPrimaryStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnGhostStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#8892a4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostSmStyle: React.CSSProperties = { ...btnGhostStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnDangerSmStyle: React.CSSProperties = { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
