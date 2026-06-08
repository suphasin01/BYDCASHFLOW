import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { useActiveCompany } from '../App'
import {
  getWithholdingTaxList, getWithholdingTax,
  createWithholdingTax, updateWithholdingTax, deleteWithholdingTax,
  getContacts,
} from '../api'
import type { WithholdingTax, WithholdingTaxItem, Contact } from '../types'
import { fmt, fmtDate, today } from '../utils'
import { buildWHTForm } from '../whtForm'

// ─── Income type definitions ────────────────────────────────────────────────────────────
const INCOME_TYPE_KEYS = [
  { value: '40_1',       key: 'wht_income_40_1',       hasDesc: false },
  { value: '40_2',       key: 'wht_income_40_2',       hasDesc: false },
  { value: '40_3',       key: 'wht_income_40_3',       hasDesc: false },
  { value: '40_4a',      key: 'wht_income_40_4a',      hasDesc: false },
  { value: '40_4b_1_1',  key: 'wht_income_40_4b_1_1',  hasDesc: false },
  { value: '40_4b_1_2',  key: 'wht_income_40_4b_1_2',  hasDesc: false },
  { value: '40_4b_1_3',  key: 'wht_income_40_4b_1_3',  hasDesc: false },
  { value: '40_4b_1_4',  key: 'wht_income_40_4b_1_4',  hasDesc: true },
  { value: '40_4b_2_1',  key: 'wht_income_40_4b_2_1',  hasDesc: false },
  { value: '40_4b_2_2',  key: 'wht_income_40_4b_2_2',  hasDesc: false },
  { value: '40_4b_2_3',  key: 'wht_income_40_4b_2_3',  hasDesc: false },
  { value: '40_4b_2_4',  key: 'wht_income_40_4b_2_4',  hasDesc: false },
  { value: '40_4b_2_5',  key: 'wht_income_40_4b_2_5',  hasDesc: true },
  { value: '3tres',      key: 'wht_income_3tres',      hasDesc: false },
  { value: 'other',      key: 'wht_income_other',      hasDesc: true },
]

const FORM_TYPES = [
  { value: 'nd1k',   key: 'wht_form_nd1k' },
  { value: 'nd1k_s', key: 'wht_form_nd1k_s' },
  { value: 'nd2',    key: 'wht_form_nd2' },
  { value: 'nd3',    key: 'wht_form_nd3' },
  { value: 'nd2k',   key: 'wht_form_nd2k' },
  { value: 'nd3k',   key: 'wht_form_nd3k' },
  { value: 'nd53',   key: 'wht_form_nd53' },
]

const emptyItem = (): WithholdingTaxItem => ({
  income_type: '40_1', income_type_desc: '', pay_date: '', amount: 0, tax_withheld: 0,
})

export default function WithholdingTax() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeCompany } = useActiveCompany()

  const [list, setList] = useState<WithholdingTax[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const [editId, setEditId] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])

  // Form fields
  const [fBookNo, setFBookNo] = useState('')
  const [fCertNo, setFCertNo] = useState('')
  const [fIssueDate, setFIssueDate] = useState(today())
  const [fFormType, setFFormType] = useState('')
  const [fPayerName, setFPayerName] = useState('')
  const [fPayerAddress, setFPayerAddress] = useState('')
  const [fPayerTaxId, setFPayerTaxId] = useState('')
  const [fPayeeId, setFPayeeId] = useState('')
  const [fPayeeName, setFPayeeName] = useState('')
  const [fPayeeAddress, setFPayeeAddress] = useState('')
  const [fPayeeTaxId, setFPayeeTaxId] = useState('')
  const [fPayerType, setFPayerType] = useState<'1' | '2' | '3' | '4'>('1')
  const [fPayerTypeOther, setFPayerTypeOther] = useState('')
  const [fFundGpf, setFFundGpf] = useState(0)
  const [fFundSso, setFFundSso] = useState(0)
  const [fFundPvd, setFFundPvd] = useState(0)
  const [fItems, setFItems] = useState<WithholdingTaxItem[]>([emptyItem()])

  const load = async () => {
    setLoading(true)
    try { const { data } = await getWithholdingTaxList(); setList(data) }
    catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalAmount = fItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalTax = fItems.reduce((s, i) => s + (Number(i.tax_withheld) || 0), 0)

  const resetForm = () => {
    setFBookNo(''); setFCertNo(''); setFIssueDate(today()); setFFormType('')
    setFPayerName(activeCompany?.name || ''); setFPayerAddress(activeCompany?.address || '')
    setFPayerTaxId(activeCompany?.tax_id || '')
    setFPayeeId(''); setFPayeeName(''); setFPayeeAddress(''); setFPayeeTaxId('')
    setFPayerType('1'); setFPayerTypeOther('')
    setFFundGpf(0); setFFundSso(0); setFFundPvd(0)
    setFItems([emptyItem()])
  }

  const openCreate = async () => {
    const { data: cs } = await getContacts()
    setContacts(cs)
    resetForm()
    setEditId(null)
    setModal('create')
  }

  const openEdit = async (id: number) => {
    const { data: cs } = await getContacts()
    setContacts(cs)
    const wht = await getWithholdingTax(id)
    setEditId(id)
    setFBookNo(wht.book_no || '')
    setFCertNo(wht.cert_no || '')
    setFIssueDate(wht.issue_date?.slice(0, 10) || today())
    setFFormType(wht.form_type || '')
    setFPayerName(wht.payer_name || '')
    setFPayerAddress(wht.payer_address || '')
    setFPayerTaxId(wht.payer_tax_id || '')
    setFPayeeId(wht.payee_id ? String(wht.payee_id) : '')
    setFPayeeName(wht.payee_name || '')
    setFPayeeAddress(wht.payee_address || '')
    setFPayeeTaxId(wht.payee_tax_id || '')
    setFPayerType((wht.payer_type as '1' | '2' | '3' | '4') || '1')
    setFPayerTypeOther(wht.payer_type_other || '')
    setFFundGpf(wht.fund_gpf || 0)
    setFFundSso(wht.fund_sso || 0)
    setFFundPvd(wht.fund_pvd || 0)
    setFItems(wht.items?.length ? wht.items : [emptyItem()])
    setModal('edit')
  }

  const handlePayeeContactChange = (contactId: string) => {
    setFPayeeId(contactId)
    if (contactId) {
      const c = contacts.find(c => String(c.id) === contactId)
      if (c) {
        setFPayeeName(c.name)
        setFPayeeAddress(c.address || '')
        setFPayeeTaxId(c.tax_id || '')
      }
    }
  }

  const updateItem = (idx: number, field: keyof WithholdingTaxItem, value: string | number) => {
    setFItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const save = async () => {
    if (!fPayerName.trim()) { toast(t('lbl_payer_name') + ' required', 'err'); return }
    if (!fPayeeName.trim()) { toast(t('wht_lbl_payee_name') + ' required', 'err'); return }
    const payload: Partial<WithholdingTax> = {
      book_no: fBookNo || null,
      cert_no: fCertNo || null,
      issue_date: fIssueDate,
      form_type: fFormType,
      payer_name: fPayerName,
      payer_address: fPayerAddress || null,
      payer_tax_id: fPayerTaxId || null,
      payee_id: fPayeeId ? Number(fPayeeId) : null,
      payee_name: fPayeeName,
      payee_address: fPayeeAddress || null,
      payee_tax_id: fPayeeTaxId || null,
      payer_type: fPayerType,
      payer_type_other: fPayerTypeOther || null,
      fund_gpf: fFundGpf,
      fund_sso: fFundSso,
      fund_pvd: fFundPvd,
      total_amount: totalAmount,
      total_tax: totalTax,
      items: fItems.map((item, idx) => ({ ...item, sort_order: idx })) as WithholdingTaxItem[],
    }
    try {
      if (modal === 'edit' && editId) {
        await updateWithholdingTax(editId, payload)
        toast(t('wht_toast_edited'))
      } else {
        await createWithholdingTax(payload)
        toast(t('wht_toast_saved'))
      }
      setModal('none')
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('wht_confirm_delete'))) return
    try { await deleteWithholdingTax(id); toast(t('wht_toast_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const generatePDF = async (id: number) => {
    try {
      const wht = await getWithholdingTax(id)
      const html = buildWHTForm(wht)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) {
        await api.exportPDF(html, `WHT_${wht.cert_no || id}.pdf`)
      } else {
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
      }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const incomeTypeLabel = (value: string) => {
    const def = INCOME_TYPE_KEYS.find(i => i.value === value)
    return def ? t(def.key) : value
  }

  const formTypeLabel = (value: string) => {
    const def = FORM_TYPES.find(f => f.value === value)
    return def ? t(def.key) : value
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: '#8892a4' }}>
          {list.length} {t('records_suffix')}
        </div>
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('wht_btn_create')}</button>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('wht_col_cert_no'), t('wht_col_form_type'), t('wht_col_issue_date'), t('wht_col_payee'), t('wht_col_total_amount'), t('wht_col_total_tax'), t('col_actions')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 6 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#8892a4' }}>{t('loading')}</td></tr>
              ) : list.length > 0 ? list.map(wht => (
                <tr key={wht.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 600, color: '#7c6df3' }}>{wht.cert_no || `#${wht.id}`}</span></td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{wht.form_type ? formTypeLabel(wht.form_type) : '—'}</td>
                  <td style={{ ...tdStyle, color: '#8892a4' }}>{fmtDate(wht.issue_date)}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{wht.payee_name || '—'}</td>
                  <td style={tdStyle}><span style={{ color: '#60a5fa', fontWeight: 600 }}>฿{fmt(wht.total_amount)}</span></td>
                  <td style={tdStyle}><span style={{ color: '#f87171', fontWeight: 600 }}>฿{fmt(wht.total_tax)}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => generatePDF(wht.id)} style={{ ...btnGhostSmStyle, marginRight: 4 }}>PDF</button>
                    <button onClick={() => openEdit(wht.id)} style={{ ...btnGhostSmStyle, marginRight: 4 }}>{t('btn_edit')}</button>
                    <button onClick={() => doDelete(wht.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>📋</div>
                  <p>{t('wht_no_data')}</p>
                  <p style={{ marginTop: 4, fontSize: 12 }} dangerouslySetInnerHTML={{ __html: t('wht_no_data_hint') }} />
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
            <ModalHeader
              title={modal === 'edit' ? t('wht_modal_edit') : t('wht_modal_new')}
              onClose={() => setModal('none')}
            />
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

              {/* ── Section 1: Certificate Info ── */}
              <SectionLabel label={t('wht_sec_cert')} />
              <div style={formRowStyle}>
                <FormGroup label={t('wht_lbl_book_no')}>
                  <StyledInput value={fBookNo} onChange={e => setFBookNo(e.target.value)} placeholder="เล่มที่..." />
                </FormGroup>
                <FormGroup label={t('wht_lbl_cert_no')}>
                  <StyledInput value={fCertNo} onChange={e => setFCertNo(e.target.value)} placeholder="เลขที่..." />
                </FormGroup>
              </div>
              <div style={formRowStyle}>
                <FormGroup label={t('wht_lbl_issue_date')}>
                  <StyledInput type="date" value={fIssueDate} onChange={e => setFIssueDate(e.target.value)} />
                </FormGroup>
                <FormGroup label={t('wht_lbl_form_type')}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {FORM_TYPES.map(f => {
                      const on = fFormType === f.value
                      return (
                        <label key={f.value}
                          onClick={() => setFFormType(on ? '' : f.value)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 8, border: `1px solid ${on ? 'rgba(124,109,243,0.6)' : 'rgba(255,255,255,0.12)'}`, background: on ? 'rgba(124,109,243,0.15)' : 'rgba(255,255,255,0.03)', userSelect: 'none', transition: 'all .15s' }}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${on ? '#7c6df3' : '#4a5568'}`, background: on ? '#7c6df3' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>{on ? '✓' : ''}</span>
                          {t(f.key)}
                        </label>
                      )
                    })}
                  </div>
                </FormGroup>
              </div>

              <Divider />

              {/* ── Section 2: Payer ── */}
              <SectionLabel label={t('wht_sec_payer')} />
              <FormGroup label={t('wht_lbl_payer_name')}>
                <StyledInput value={fPayerName} onChange={e => setFPayerName(e.target.value)}
                  placeholder="ชื่อบริษัท / บุคคล / นิติบุคคล..." />
              </FormGroup>
              <FormGroup label={t('wht_lbl_payer_address')}>
                <StyledTextarea value={fPayerAddress} onChange={e => setFPayerAddress(e.target.value)}
                  placeholder="ที่อยู่ อาคาร/หมู่บ้าน เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด..." />
              </FormGroup>
              <FormGroup label={t('wht_lbl_payer_tax_id')}>
                <StyledInput value={fPayerTaxId} onChange={e => setFPayerTaxId(e.target.value)}
                  placeholder="0000000000000 (13 หลัก)" maxLength={13} />
              </FormGroup>

              <Divider />

              {/* ── Section 3: Payee ── */}
              <SectionLabel label={t('wht_sec_payee')} />
              <FormGroup label={t('wht_lbl_payee_contact')}>
                <StyledSelect value={fPayeeId} onChange={e => handlePayeeContactChange(e.target.value)}>
                  <option value="">{t('lbl_select')}</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </StyledSelect>
              </FormGroup>
              <FormGroup label={t('wht_lbl_payee_name')}>
                <StyledInput value={fPayeeName} onChange={e => setFPayeeName(e.target.value)}
                  placeholder="ชื่อบริษัท / บุคคล / นิติบุคคล..." />
              </FormGroup>
              <FormGroup label={t('wht_lbl_payee_address')}>
                <StyledTextarea value={fPayeeAddress} onChange={e => setFPayeeAddress(e.target.value)}
                  placeholder="ที่อยู่ อาคาร/หมู่บ้าน เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด..." />
              </FormGroup>
              <FormGroup label={t('wht_lbl_payee_tax_id')}>
                <StyledInput value={fPayeeTaxId} onChange={e => setFPayeeTaxId(e.target.value)}
                  placeholder="0000000000000 (13 หลัก)" maxLength={13} />
              </FormGroup>

              <Divider />

              {/* ── Section 4: Income types ── */}
              <SectionLabel label={t('wht_sec_income')} />
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px', gap: 6, marginBottom: 4, padding: '0 2px' }}>
                {[t('wht_lbl_income_type'), t('wht_lbl_pay_date'), t('wht_lbl_amount'), t('wht_lbl_tax_withheld'), ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fItems.map((item, idx) => {
                  const def = INCOME_TYPE_KEYS.find(d => d.value === item.income_type)
                  return (
                    <div key={idx}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                        <select value={item.income_type} onChange={e => updateItem(idx, 'income_type', e.target.value)}
                          style={{ ...inputStyle, padding: '7px 8px', fontSize: 11 }}>
                          {INCOME_TYPE_KEYS.map(opt => (
                            <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
                          ))}
                        </select>
                        <input type="date" value={item.pay_date || ''} onChange={e => updateItem(idx, 'pay_date', e.target.value)}
                          style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                        <input type="number" value={item.amount || ''} min={0}
                          onChange={e => updateItem(idx, 'amount', e.target.value === '' ? 0 : Number(e.target.value))}
                          style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                        <input type="number" value={item.tax_withheld || ''} min={0}
                          onChange={e => updateItem(idx, 'tax_withheld', e.target.value === '' ? 0 : Number(e.target.value))}
                          style={{ ...inputStyle, padding: '7px 8px', fontSize: 12 }} />
                        <button onClick={() => setFItems(prev => prev.filter((_, j) => j !== idx))}
                          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, cursor: 'pointer', padding: '5px', color: '#f87171', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
                      </div>
                      {def?.hasDesc && (
                        <input value={item.income_type_desc || ''} onChange={e => updateItem(idx, 'income_type_desc', e.target.value)}
                          placeholder={t('wht_lbl_income_desc')}
                          style={{ ...inputStyle, padding: '6px 8px', fontSize: 11, marginTop: 4, width: '60%' }} />
                      )}
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setFItems(prev => [...prev, emptyItem()])}
                style={{ ...btnGhostSmStyle, marginTop: 10 }}>{t('wht_btn_add_income')}</button>

              {/* Totals summary */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: '#8892a4' }}>{t('wht_lbl_total_amount')}</span>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>฿{fmt(totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: '#8892a4' }}>{t('wht_lbl_total_tax')}</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>฿{fmt(totalTax)}</span>
                </div>
              </div>

              <Divider />

              {/* ── Section 5: Payer type ── */}
              <SectionLabel label={t('wht_sec_payer_type')} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
                {(['1', '2', '3', '4'] as const).map(pt => (
                  <label key={pt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 8, border: `1px solid ${fPayerType === pt ? 'rgba(124,109,243,0.5)' : 'rgba(255,255,255,0.12)'}`, background: fPayerType === pt ? 'rgba(124,109,243,0.15)' : 'rgba(255,255,255,0.03)' }}>
                    <input type="radio" name="payer_type" value={pt} checked={fPayerType === pt} onChange={() => setFPayerType(pt)}
                      style={{ accentColor: '#7c6df3' }} />
                    {t(`wht_payer_type_${pt}`)}
                  </label>
                ))}
              </div>
              {fPayerType === '4' && (
                <FormGroup label={t('wht_lbl_payer_type_other')}>
                  <StyledInput value={fPayerTypeOther} onChange={e => setFPayerTypeOther(e.target.value)} placeholder="ระบุ..." />
                </FormGroup>
              )}

              <Divider />

              {/* ── Section 6: Funds ── */}
              <SectionLabel label={t('wht_sec_funds')} />
              <FormGroup label={t('wht_lbl_fund_gpf')}>
                <StyledInput type="number" value={fFundGpf || ''} min={0}
                  onChange={e => setFFundGpf(e.target.value === '' ? 0 : Number(e.target.value))} />
              </FormGroup>
              <FormGroup label={t('wht_lbl_fund_sso')}>
                <StyledInput type="number" value={fFundSso || ''} min={0}
                  onChange={e => setFFundSso(e.target.value === '' ? 0 : Number(e.target.value))} />
              </FormGroup>
              <FormGroup label={t('wht_lbl_fund_pvd')}>
                <StyledInput type="number" value={fFundPvd || ''} min={0}
                  onChange={e => setFFundPvd(e.target.value === '' ? 0 : Number(e.target.value))} />
              </FormGroup>

            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal('none')} style={btnGhostStyle}>{t('btn_cancel')}</button>
              <button onClick={save} style={btnPrimaryStyle}>{t('btn_save')}</button>
            </div>
          </ModalContainer>
        </ModalOverlay>
      )}
    </div>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'contents' }}>{children}</div>
    </div>
  )
}

function ModalContainer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 700, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
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

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#7c6df3', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(124,109,243,0.2)' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: 'rgba(124,109,243,0.2)' }} />
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
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
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', minHeight: 56, lineHeight: 1.5, ...props.style }} />
}

const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', colorScheme: 'inherit' as React.CSSProperties['colorScheme'] }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }
const formRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnGhostStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#8892a4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostSmStyle: React.CSSProperties = { ...btnGhostStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnDangerSmStyle: React.CSSProperties = { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
