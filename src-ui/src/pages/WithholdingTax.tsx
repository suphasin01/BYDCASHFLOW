import { useEffect, useState } from 'react'
import {
  Button, Card, CardBody, Input, Spinner, Textarea,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
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
import GradientButton from '../ui/GradientButton'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'
const LABEL_CLASS = 'block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5'

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

  const formTypeLabel = (value: string) => {
    const def = FORM_TYPES.find(f => f.value === value)
    return def ? t(def.key) : value
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-[13px] text-default-500">
          {list.length} {t('records_suffix')}
        </div>
        <GradientButton onPress={openCreate} startContent={<span className="text-base leading-none">+</span>}>{t('wht_btn_create')}</GradientButton>
      </div>

      {/* Table */}
      <Card className="bg-content1 border border-content3" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('wht_btn_create')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('wht_col_cert_no')}</TableColumn>
                <TableColumn>{t('wht_col_form_type')}</TableColumn>
                <TableColumn>{t('wht_col_issue_date')}</TableColumn>
                <TableColumn>{t('wht_col_payee')}</TableColumn>
                <TableColumn>{t('wht_col_total_amount')}</TableColumn>
                <TableColumn>{t('wht_col_total_tax')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500">
                  <div className="text-4xl mb-3.5 opacity-40">📋</div>
                  <p>{t('wht_no_data')}</p>
                  <p className="mt-1 text-[12px]" dangerouslySetInnerHTML={{ __html: t('wht_no_data_hint') }} />
                </div>
              }>
                {list.map(wht => (
                  <TableRow key={wht.id} className="hover:bg-content2/60 transition-colors">
                    <TableCell><span className="font-semibold text-primary">{wht.cert_no || `#${wht.id}`}</span></TableCell>
                    <TableCell className="text-default-500">{wht.form_type ? formTypeLabel(wht.form_type) : '—'}</TableCell>
                    <TableCell className="text-default-500">{fmtDate(wht.issue_date)}</TableCell>
                    <TableCell className="font-medium">{wht.payee_name || '—'}</TableCell>
                    <TableCell><span className="text-primary font-semibold">฿{fmt(wht.total_amount)}</span></TableCell>
                    <TableCell><span className="text-danger font-semibold">฿{fmt(wht.total_tax)}</span></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="flat" onPress={() => generatePDF(wht.id)}>PDF</Button>
                        <Button size="sm" variant="flat" onPress={() => openEdit(wht.id)}>{t('btn_edit')}</Button>
                        <Button size="sm" color="danger" variant="flat" onPress={() => doDelete(wht.id)}>{t('btn_delete')}</Button>
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
      <Modal isOpen={modal === 'create' || modal === 'edit'} onOpenChange={open => { if (!open) setModal('none') }} scrollBehavior="inside" size="3xl">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{modal === 'edit' ? t('wht_modal_edit') : t('wht_modal_new')}</ModalHeader>
              <ModalBody>

                {/* ── Section 1: Certificate Info ── */}
                <SectionLabel label={t('wht_sec_cert')} />
                <div className="grid grid-cols-2 gap-4">
                  <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_book_no')}
                    placeholder="เล่มที่..." value={fBookNo} onChange={e => setFBookNo(e.target.value)} />
                  <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_cert_no')}
                    placeholder="เลขที่..." value={fCertNo} onChange={e => setFCertNo(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4 items-start">
                  <Input size="sm" variant="flat" labelPlacement="outside" type="date" label={t('wht_lbl_issue_date')}
                    value={fIssueDate} onChange={e => setFIssueDate(e.target.value)} />
                  <div>
                    <label className={LABEL_CLASS}>{t('wht_lbl_form_type')}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FORM_TYPES.map(f => {
                        const on = fFormType === f.value
                        return (
                          <button key={f.value} type="button"
                            onClick={() => setFFormType(on ? '' : f.value)}
                            className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors select-none ${on ? 'border-primary/60 bg-primary/15' : 'border-content3 bg-content2'}`}>
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] text-white flex-shrink-0 border-[1.5px] ${on ? 'border-primary bg-primary' : 'border-default-400 bg-transparent'}`}>{on ? '✓' : ''}</span>
                            {t(f.key)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <SectionLabel label={t('wht_sec_payer')} />
                <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_payer_name')}
                  placeholder="ชื่อบริษัท / บุคคล / นิติบุคคล..." value={fPayerName} onChange={e => setFPayerName(e.target.value)} />
                <Textarea size="sm" variant="flat" labelPlacement="outside" minRows={2} label={t('wht_lbl_payer_address')}
                  placeholder="ที่อยู่ อาคาร/หมู่บ้าน เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด..."
                  value={fPayerAddress} onChange={e => setFPayerAddress(e.target.value)} />
                <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_payer_tax_id')}
                  placeholder="0000000000000 (13 หลัก)" maxLength={13} value={fPayerTaxId} onChange={e => setFPayerTaxId(e.target.value)} />

                <SectionLabel label={t('wht_sec_payee')} />
                <div>
                  <label className={LABEL_CLASS}>{t('wht_lbl_payee_contact')}</label>
                  <select value={fPayeeId} onChange={e => handlePayeeContactChange(e.target.value)} className={SELECT_CLASS}>
                    <option value="">{t('lbl_select')}</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_payee_name')}
                  placeholder="ชื่อบริษัท / บุคคล / นิติบุคคล..." value={fPayeeName} onChange={e => setFPayeeName(e.target.value)} />
                <Textarea size="sm" variant="flat" labelPlacement="outside" minRows={2} label={t('wht_lbl_payee_address')}
                  placeholder="ที่อยู่ อาคาร/หมู่บ้าน เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด..."
                  value={fPayeeAddress} onChange={e => setFPayeeAddress(e.target.value)} />
                <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_payee_tax_id')}
                  placeholder="0000000000000 (13 หลัก)" maxLength={13} value={fPayeeTaxId} onChange={e => setFPayeeTaxId(e.target.value)} />

                {/* ── Section 4: Income types ── */}
                <SectionLabel label={t('wht_sec_income')} />
                <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px' }}>
                  {[t('wht_lbl_income_type'), t('wht_lbl_pay_date'), t('wht_lbl_amount'), t('wht_lbl_tax_withheld'), ''].map((h, i) => (
                    <span key={i} className="text-[10px] font-medium text-default-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {fItems.map((item, idx) => {
                    const def = INCOME_TYPE_KEYS.find(d => d.value === item.income_type)
                    return (
                      <div key={idx}>
                        <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr 28px' }}>
                          <select value={item.income_type} onChange={e => updateItem(idx, 'income_type', e.target.value)}
                            className={`${SELECT_CLASS} text-[11px] py-1.5`}>
                            {INCOME_TYPE_KEYS.map(opt => (
                              <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
                            ))}
                          </select>
                          <Input size="sm" variant="flat" type="date" value={item.pay_date || ''}
                            onChange={e => updateItem(idx, 'pay_date', e.target.value)} />
                          <Input size="sm" variant="flat" type="number" min={0} value={item.amount ? String(item.amount) : ''}
                            onChange={e => updateItem(idx, 'amount', e.target.value === '' ? 0 : Number(e.target.value))} />
                          <Input size="sm" variant="flat" type="number" min={0} value={item.tax_withheld ? String(item.tax_withheld) : ''}
                            onChange={e => updateItem(idx, 'tax_withheld', e.target.value === '' ? 0 : Number(e.target.value))} />
                          <Button isIconOnly size="sm" color="danger" variant="flat" onPress={() => setFItems(prev => prev.filter((_, j) => j !== idx))}>✕</Button>
                        </div>
                        {def?.hasDesc && (
                          <Input size="sm" variant="flat" className="mt-1 w-[60%]" placeholder={t('wht_lbl_income_desc')}
                            value={item.income_type_desc || ''} onChange={e => updateItem(idx, 'income_type_desc', e.target.value)} />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div>
                  <Button size="sm" variant="flat" onPress={() => setFItems(prev => [...prev, emptyItem()])}>{t('wht_btn_add_income')}</Button>
                </div>

                {/* Totals summary */}
                <div className="bg-content2 border border-content3 rounded-lg px-4 py-3">
                  <div className="flex justify-between text-[13px] py-0.5">
                    <span className="text-default-500">{t('wht_lbl_total_amount')}</span>
                    <span className="text-primary font-semibold">฿{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] py-0.5">
                    <span className="text-default-500">{t('wht_lbl_total_tax')}</span>
                    <span className="text-danger font-semibold">฿{fmt(totalTax)}</span>
                  </div>
                </div>

                {/* ── Section 5: Payer type ── */}
                <SectionLabel label={t('wht_sec_payer_type')} />
                <div className="flex gap-2 flex-wrap">
                  {(['1', '2', '3', '4'] as const).map(pt => (
                    <label key={pt}
                      className={`flex items-center gap-1.5 cursor-pointer text-[13px] px-3 py-1.5 rounded-lg border ${fPayerType === pt ? 'border-primary/50 bg-primary/15' : 'border-content3 bg-content2'}`}>
                      <input type="radio" name="payer_type" value={pt} checked={fPayerType === pt} onChange={() => setFPayerType(pt)}
                        style={{ accentColor: '#7c6df3' }} />
                      {t(`wht_payer_type_${pt}`)}
                    </label>
                  ))}
                </div>
                {fPayerType === '4' && (
                  <Input size="sm" variant="flat" labelPlacement="outside" label={t('wht_lbl_payer_type_other')}
                    placeholder="ระบุ..." value={fPayerTypeOther} onChange={e => setFPayerTypeOther(e.target.value)} />
                )}

                {/* ── Section 6: Funds ── */}
                <SectionLabel label={t('wht_sec_funds')} />
                <Input size="sm" variant="flat" labelPlacement="outside" type="number" min={0} label={t('wht_lbl_fund_gpf')}
                  value={fFundGpf ? String(fFundGpf) : ''} onChange={e => setFFundGpf(e.target.value === '' ? 0 : Number(e.target.value))} />
                <Input size="sm" variant="flat" labelPlacement="outside" type="number" min={0} label={t('wht_lbl_fund_sso')}
                  value={fFundSso ? String(fFundSso) : ''} onChange={e => setFFundSso(e.target.value === '' ? 0 : Number(e.target.value))} />
                <Input size="sm" variant="flat" labelPlacement="outside" type="number" min={0} label={t('wht_lbl_fund_pvd')}
                  value={fFundPvd ? String(fFundPvd) : ''} onChange={e => setFFundPvd(e.target.value === '' ? 0 : Number(e.target.value))} />

              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose}>{t('btn_cancel')}</Button>
                <GradientButton onPress={save}>{t('btn_save')}</GradientButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wide mt-2">
      <div className="flex-1 h-px bg-primary/20" />
      {label}
      <div className="flex-1 h-px bg-primary/20" />
    </div>
  )
}
