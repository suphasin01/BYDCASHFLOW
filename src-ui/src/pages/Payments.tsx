import { useEffect, useState } from 'react'
import {
  Card, CardBody, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getPayments, createPayment, deletePayment, getDocuments } from '../api'
import type { Payment, Document } from '../types'
import { fmt, fmtDate, today } from '../utils'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

export default function Payments() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])

  // Form
  const [fDocId, setFDocId] = useState('')
  const [fAmount, setFAmount] = useState(0)
  const [fDate, setFDate] = useState(today())
  const [fMethod, setFMethod] = useState<'cash' | 'transfer' | 'cheque' | 'credit_card'>('transfer')
  const [fRef, setFRef] = useState('')
  const [fNotes, setFNotes] = useState('')

  const METHODS: Record<string, string> = {
    cash: t('method_cash'), transfer: t('method_transfer'), cheque: t('method_cheque'), credit_card: t('method_credit_card'),
  }

  const load = async () => {
    setLoading(true)
    try { const { data } = await getPayments(); setPayments(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = async () => {
    try {
      const { data } = await getDocuments({ status: 'sent', limit: '100' })
      setDocs(data)
    } catch { setDocs([]) }
    setFDocId(''); setFAmount(0); setFDate(today()); setFMethod('transfer'); setFRef(''); setFNotes('')
    setModal(true)
  }

  const save = async () => {
    try {
      await createPayment({ document_id: Number(fDocId), amount: fAmount, date: fDate, method: fMethod, reference: fRef || null, notes: fNotes || null })
      toast(t('toast_payment_saved'))
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_payment'))) return
    try { await deletePayment(id); toast(t('toast_payment_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Btn variant="primary" onClick={openCreate} startContent={<span className="text-base leading-none">+</span>}>{t('btn_record_payment')}</Btn>
      </div>

      <Card className="bg-content1 border border-content3" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('btn_record_payment')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('col_date')}</TableColumn>
                <TableColumn>{t('col_document')}</TableColumn>
                <TableColumn>{t('col_method')}</TableColumn>
                <TableColumn>{t('col_amount')}</TableColumn>
                <TableColumn>{t('col_reference')}</TableColumn>
                <TableColumn>{t('lbl_notes')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500">
                  <div className="text-4xl mb-3.5 opacity-40">💳</div>
                  <p>{t('no_payments')}</p>
                </div>
              }>
                {payments.map(p => (
                  <TableRow key={p.id} className="hover:bg-content2/60 transition-colors">
                    <TableCell className="text-default-500">{fmtDate(p.date)}</TableCell>
                    <TableCell><span className="text-primary font-semibold">#{p.document_id}</span></TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="primary">{METHODS[p.method] || p.method}</Chip>
                    </TableCell>
                    <TableCell><span className="text-success font-semibold">฿{fmt(p.amount)}</span></TableCell>
                    <TableCell className="text-default-500">{p.reference || '—'}</TableCell>
                    <TableCell className="text-default-500">{p.notes || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Btn size="sm" variant="danger" onClick={() => doDelete(p.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} size="xl"
        title={t('modal_record_payment')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal(false)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_doc_select')}</label>
                  <select value={fDocId} onChange={e => setFDocId(e.target.value)} className={SELECT_CLASS}>
                    <option value="">{t('lbl_select_doc')}</option>
                    {docs.map(d => <option key={d.id} value={d.id}>{d.number} — {d.contact_name || ''} (฿{fmt(d.total)})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField type="number" label={t('lbl_amount')}
                    value={fAmount === 0 ? '' : String(fAmount)} onChange={e => setFAmount(e.target.value === '' ? 0 : Number(e.target.value))} />
                  <TextField type="date" label={t('col_date')}
                    value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_pay_method')}</label>
                    <select value={fMethod} onChange={e => setFMethod(e.target.value as typeof fMethod)} className={SELECT_CLASS}>
                      <option value="transfer">{t('method_transfer')}</option>
                      <option value="cash">{t('method_cash')}</option>
                      <option value="cheque">{t('method_cheque')}</option>
                      <option value="credit_card">{t('method_credit_card')}</option>
                    </select>
                  </div>
                  <TextField label={t('lbl_reference')}
                    placeholder={t('lbl_ref_ph')} value={fRef} onChange={e => setFRef(e.target.value)} />
                </div>
                <TextAreaField label={t('lbl_notes')}
                  value={fNotes} onChange={e => setFNotes(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
