import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, CardBody, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { CreditCard, ArrowDownLeft, ArrowUpRight, History, AlertCircle, Camera, X } from 'lucide-react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import { getPaymentDocuments, getPayments, createPayment, deletePayment, createEvidence } from '../api'
import type { PayableDoc, Payment } from '../types'
import { fmt, fmtDate, today } from '../utils'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'
const LABEL_CLASS = 'block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5'

type PayStatus = 'unpaid' | 'partial' | 'paid'
type Method = 'cash' | 'transfer' | 'cheque' | 'credit_card'

const TYPE_KEY: Record<string, string> = {
  delivery_tax_invoice: 'type_delivery_tax_invoice',
  invoice: 'type_invoice', billing_note: 'type_billing_note', cash_invoice: 'type_cash_invoice',
  receipt: 'type_receipt', purchase_order: 'type_purchase_order', expense: 'type_expense',
}

export default function Payments() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeCompany } = useActiveCompany()

  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [docs, setDocs] = useState<PayableDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | PayStatus>('all')

  // Record-payment modal
  const [payDoc, setPayDoc] = useState<PayableDoc | null>(null)
  const [fAmount, setFAmount] = useState(0)
  const [fDate, setFDate] = useState(today())
  const [fMethod, setFMethod] = useState<Method>('transfer')
  const [fRef, setFRef] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fImage, setFImage] = useState<string | null>(null)
  const payImageRef = useRef<HTMLInputElement>(null)

  // History modal
  const [histDoc, setHistDoc] = useState<PayableDoc | null>(null)
  const [history, setHistory] = useState<Payment[]>([])

  const METHODS: Record<string, string> = {
    cash: t('method_cash'), transfer: t('method_transfer'), cheque: t('method_cheque'), credit_card: t('method_credit_card'),
  }

  const load = async () => {
    setLoading(true)
    try { const { data } = await getPaymentDocuments(direction); setDocs(data) } catch {}
    setLoading(false)
  }

  // Reload on direction change and whenever the active company switches.
  useEffect(() => { load() }, [direction, activeCompany?.id])

  // ── Derived helpers ─────────────────────────────────────────────────────────
  // A document marked 'paid' (e.g. a receipt or fully-settled invoice) has no balance,
  // even if it has no individual payment records logged.
  const outstanding = (d: PayableDoc) => d.status === 'paid' ? 0 : Math.max(0, (d.total || 0) - (d.paid_amount || 0))
  const statusOf = (d: PayableDoc): PayStatus => {
    if (outstanding(d) <= 0.01) return 'paid'
    if ((d.paid_amount || 0) > 0) return 'partial'
    return 'unpaid'
  }
  const isOverdue = (d: PayableDoc) => !!d.due_date && outstanding(d) > 0.01 && d.due_date < today()

  const filtered = useMemo(
    () => docs.filter(d => filter === 'all' ? true : statusOf(d) === filter),
    [docs, filter]
  )

  const summary = useMemo(() => {
    let totalOutstanding = 0, openDocs = 0, overdue = 0
    for (const d of docs) {
      const o = outstanding(d)
      if (o > 0.01) { totalOutstanding += o; openDocs++; if (isOverdue(d)) overdue++ }
    }
    return { totalOutstanding, openDocs, overdue }
  }, [docs])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handlePayImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 5MB', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setFImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const openPay = (d: PayableDoc) => {
    setPayDoc(d)
    setFAmount(outstanding(d))
    setFDate(today()); setFMethod('transfer'); setFRef(''); setFNotes(''); setFImage(null)
  }

  const savePayment = async () => {
    if (!payDoc) return
    try {
      await createPayment({ document_id: payDoc.id, amount: fAmount, date: fDate, method: fMethod, reference: fRef || null, notes: fNotes || null })
      // Auto-create Evidence if image attached
      if (fImage) {
        try {
          await createEvidence({
            title: `ชำระเงิน - ${payDoc.number || ''} · ${payDoc.contact_name || payDoc.contact_display || ''}`.trim().replace(/·\s*$/, ''),
            category: 'bank_slip',
            amount: fAmount,
            doc_date: fDate,
            contact_name: payDoc.contact_name || payDoc.contact_display || '',
            reference: fRef || null,
            image_url: fImage,
            notes: fNotes || null,
          })
        } catch {}
      }
      toast(t('toast_payment_saved'))
      setPayDoc(null); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const openHistory = async (d: PayableDoc) => {
    setHistDoc(d); setHistory([])
    try {
      const { data } = await getPayments()
      setHistory(data.filter(p => p.document_id === d.id))
    } catch {}
  }

  const deleteHistoryItem = async (id: number) => {
    if (!confirm(t('confirm_delete_payment'))) return
    try {
      await deletePayment(id)
      toast(t('toast_payment_deleted'))
      if (histDoc) {
        const { data } = await getPayments()
        setHistory(data.filter(p => p.document_id === histDoc.id))
      }
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const statusChip = (d: PayableDoc) => {
    const s = statusOf(d)
    const overdue = isOverdue(d)
    if (s === 'paid') return <Chip size="sm" variant="flat" color="success">{t('pay_st_paid')}</Chip>
    if (overdue) return <Chip size="sm" variant="flat" color="danger">{t('pay_overdue')}</Chip>
    if (s === 'partial') return <Chip size="sm" variant="flat" color="warning">{t('pay_st_partial')}</Chip>
    return <Chip size="sm" variant="flat" color="default">{t('pay_st_unpaid')}</Chip>
  }

  const filterBtns: Array<{ key: 'all' | PayStatus; label: string }> = [
    { key: 'all', label: t('pay_f_all') },
    { key: 'unpaid', label: t('pay_f_unpaid') },
    { key: 'partial', label: t('pay_f_partial') },
    { key: 'paid', label: t('pay_f_paid') },
  ]

  const accent = direction === 'in' ? 'success' : 'warning'

  return (
    <div className="flex flex-col gap-4">
      {/* Direction tabs */}
      <div className="flex items-center flex-wrap gap-2">
        <button onClick={() => { setDirection('in'); setFilter('all') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border ${
            direction === 'in' ? 'bg-success/15 border-success/40 text-success' : 'bg-content2 border-content3 text-default-500 hover:text-foreground'}`}>
          <ArrowDownLeft size={16} strokeWidth={2} /> {t('pay_tab_in')}
        </button>
        <button onClick={() => { setDirection('out'); setFilter('all') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border ${
            direction === 'out' ? 'bg-warning/15 border-warning/40 text-warning' : 'bg-content2 border-content3 text-default-500 hover:text-foreground'}`}>
          <ArrowUpRight size={16} strokeWidth={2} /> {t('pay_tab_out')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger">
        <Card className="bg-content1 border border-content3 card-lift sheen hover:border-primary/40" shadow="none">
          <CardBody className="py-3.5 px-4">
            <div className="text-[11px] text-default-500 uppercase tracking-wide mb-1">
              {direction === 'in' ? t('pay_sum_in') : t('pay_sum_out')}
            </div>
            <div className={`text-xl font-bold stat-value ${accent === 'success' ? 'text-success' : 'text-warning'}`}>฿{fmt(summary.totalOutstanding)}</div>
          </CardBody>
        </Card>
        <Card className="bg-content1 border border-content3 card-lift sheen hover:border-primary/40" shadow="none">
          <CardBody className="py-3.5 px-4">
            <div className="text-[11px] text-default-500 uppercase tracking-wide mb-1">{t('pay_sum_docs')}</div>
            <div className="text-xl font-bold text-foreground stat-value">{summary.openDocs}</div>
          </CardBody>
        </Card>
        <Card className="bg-content1 border border-content3 card-lift sheen hover:border-primary/40" shadow="none">
          <CardBody className="py-3.5 px-4">
            <div className="text-[11px] text-default-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              {summary.overdue > 0 && <AlertCircle size={12} className="text-danger" />} {t('pay_sum_overdue')}
            </div>
            <div className={`text-xl font-bold stat-value ${summary.overdue > 0 ? 'text-danger' : 'text-foreground'}`}>{summary.overdue}</div>
          </CardBody>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex items-center flex-wrap gap-1.5">
        {filterBtns.map(b => (
          <button key={b.key} onClick={() => setFilter(b.key)}
            className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
              filter === b.key ? 'bg-primary/15 text-primary font-medium' : 'text-default-500 hover:bg-content2'}`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Documents table */}
      <Card className="bg-content1 border border-content3 glow-hover" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <div className="overflow-x-auto">
            <Table removeWrapper aria-label="payments"
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('col_number')}</TableColumn>
                <TableColumn>{t('col_contact')}</TableColumn>
                <TableColumn>{t('col_due_date')}</TableColumn>
                <TableColumn>{t('col_total')}</TableColumn>
                <TableColumn>{t('col_paid')}</TableColumn>
                <TableColumn>{t('col_outstanding')}</TableColumn>
                <TableColumn>{t('col_status')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500 flex flex-col items-center">
                  <CreditCard size={40} className="mb-3.5 opacity-30" strokeWidth={1.2} />
                  <p>{t('pay_no_docs')}</p>
                </div>
              }>
                {filtered.map(d => {
                  const o = outstanding(d)
                  const overdue = isOverdue(d)
                  return (
                    <TableRow key={d.id} className="hover:bg-content2/60 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-primary">{d.number || `#${d.id}`}</div>
                        <div className="text-[11px] text-default-500 mt-0.5">{t(TYPE_KEY[d.type] || 'type_invoice')}</div>
                      </TableCell>
                      <TableCell className="text-foreground">{d.contact_name || d.contact_display || '—'}</TableCell>
                      <TableCell className={overdue ? 'text-danger font-medium' : 'text-default-500'}>
                        {d.due_date ? fmtDate(d.due_date) : '—'}
                      </TableCell>
                      <TableCell className="text-foreground">฿{fmt(d.total || 0)}</TableCell>
                      <TableCell className="text-success">฿{fmt(d.paid_amount || 0)}</TableCell>
                      <TableCell className={o > 0.01 ? 'font-semibold text-warning' : 'text-default-400'}>฿{fmt(o)}</TableCell>
                      <TableCell>{statusChip(d)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {o > 0.01 && (
                            <Btn size="sm" variant="primary" onClick={() => openPay(d)}>
                              {direction === 'in' ? t('btn_receive') : t('btn_pay_now')}
                            </Btn>
                          )}
                          <Btn size="sm" variant="ghost" onClick={() => openHistory(d)}
                            startContent={<History size={13} strokeWidth={2} />}>
                            {t('btn_view_history')}
                          </Btn>
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

      {/* Record payment modal */}
      <Modal open={!!payDoc} onClose={() => setPayDoc(null)} size="lg"
        title={`${direction === 'in' ? t('btn_receive') : t('btn_pay_now')} — ${payDoc?.number || ''}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setPayDoc(null)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={savePayment}>{t('btn_save')}</Btn>
        </>}>
        {payDoc && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-content2 rounded-lg px-3.5 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-foreground">{payDoc.contact_name || payDoc.contact_display || '—'}</div>
                <div className="text-[11px] text-default-500 mt-0.5">{t('col_total')}: ฿{fmt(payDoc.total || 0)} · {t('col_paid')}: ฿{fmt(payDoc.paid_amount || 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-default-500">{t('pay_remaining')}</div>
                <div className="text-lg font-bold text-warning">฿{fmt(outstanding(payDoc))}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>{t('lbl_amount')}</label>
                <TextField type="number"
                  value={fAmount === 0 ? '' : String(fAmount)} onChange={e => setFAmount(e.target.value === '' ? 0 : Number(e.target.value))} />
                <button onClick={() => setFAmount(outstanding(payDoc))}
                  className="text-[11px] text-primary mt-1 hover:underline cursor-pointer">{t('pay_full_amount')}</button>
              </div>
              <TextField type="date" label={t('col_date')} value={fDate} onChange={e => setFDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>{t('lbl_pay_method')}</label>
                <select value={fMethod} onChange={e => setFMethod(e.target.value as Method)} className={SELECT_CLASS}>
                  <option value="transfer">{t('method_transfer')}</option>
                  <option value="cash">{t('method_cash')}</option>
                  <option value="cheque">{t('method_cheque')}</option>
                  <option value="credit_card">{t('method_credit_card')}</option>
                </select>
              </div>
              <TextField label={t('lbl_reference')} placeholder={t('lbl_ref_ph')} value={fRef} onChange={e => setFRef(e.target.value)} />
            </div>
            <TextAreaField label={t('lbl_notes')} value={fNotes} onChange={e => setFNotes(e.target.value)} />

            {/* Receipt image */}
            <div>
              <div className="text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">แนบสลิป / หลักฐาน</div>
              <input type="file" ref={payImageRef} accept="image/*" className="hidden" onChange={handlePayImage} />
              {fImage ? (
                <div className="relative rounded-xl overflow-hidden border border-content3 bg-content2">
                  <img src={fImage} alt="slip" className="w-full max-h-48 object-contain" />
                  <button onClick={() => setFImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-danger/80 text-white cursor-pointer hover:bg-danger transition-colors">
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button onClick={() => payImageRef.current?.click()}
                  className="w-full border-2 border-dashed border-content3 rounded-xl py-4 flex flex-col items-center gap-2 text-default-400 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                  <Camera size={18} strokeWidth={1.6} />
                  <span className="text-[12px]">แนบรูปสลิปโอนเงิน</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment history modal */}
      <Modal open={!!histDoc} onClose={() => setHistDoc(null)} size="lg"
        title={`${t('pay_history_title')} — ${histDoc?.number || ''}`}
        footer={<Btn variant="ghost" onClick={() => setHistDoc(null)}>{t('btn_close')}</Btn>}>
        {history.length === 0 ? (
          <div className="py-8 text-center text-default-500">{t('pay_no_history')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-content2 rounded-lg px-3.5 py-2.5">
                <div>
                  <div className="text-[13px] font-semibold text-success">฿{fmt(p.amount)}</div>
                  <div className="text-[11px] text-default-500 mt-0.5">
                    {fmtDate(p.date)} · {METHODS[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ''}
                  </div>
                  {p.notes && <div className="text-[11px] text-default-400 mt-0.5">{p.notes}</div>}
                </div>
                <Btn size="sm" variant="danger" onClick={() => deleteHistoryItem(p.id)}>{t('btn_delete')}</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
