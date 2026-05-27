import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getPayments, createPayment, deletePayment, getDocuments } from '../api'
import type { Payment, Document } from '../types'
import { fmt, fmtDate, today } from '../utils'

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('btn_record_payment')}</button>
      </div>

      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('col_date'), t('col_document'), t('col_method'), t('col_amount'), t('col_reference'), t('lbl_notes'), t('col_actions')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 6 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</td></tr>
              ) : payments.length > 0 ? payments.map(p => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, color: '#8892a4' }}>{fmtDate(p.date)}</td>
                  <td style={tdStyle}><span style={{ color: '#7c6df3', fontWeight: 600 }}>#{p.document_id}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                      {METHODS[p.method] || p.method}
                    </span>
                  </td>
                  <td style={tdStyle}><span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(p.amount)}</span></td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{p.reference || '—'}</td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{p.notes || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => doDelete(p.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>💳</div>
                  <p>{t('no_payments')}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t('modal_record_payment')}</h2>
              <button onClick={() => setModal(false)} style={btnGhostSmStyle}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_doc_select')}</label>
                <select value={fDocId} onChange={e => setFDocId(e.target.value)} style={inputStyle}>
                  <option value="">{t('lbl_select_doc')}</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.number} — {d.contact_name || ''} (฿{fmt(d.total)})</option>)}
                </select>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_amount')}</label>
                  <input type="number" value={fAmount} onChange={e => setFAmount(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('col_date')}</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_pay_method')}</label>
                  <select value={fMethod} onChange={e => setFMethod(e.target.value as typeof fMethod)} style={inputStyle}>
                    <option value="transfer">{t('method_transfer')}</option>
                    <option value="cash">{t('method_cash')}</option>
                    <option value="cheque">{t('method_cheque')}</option>
                    <option value="credit_card">{t('method_credit_card')}</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_reference')}</label>
                  <input value={fRef} onChange={e => setFRef(e.target.value)} placeholder={t('lbl_ref_ph')} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_notes')}</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(false)} style={btnGhostStyle}>{t('btn_cancel')}</button>
              <button onClick={save} style={btnPrimaryStyle}>{t('btn_save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#f0f4ff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }
const formRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#8892a4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostSmStyle: React.CSSProperties = { ...btnGhostStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnDangerSmStyle: React.CSSProperties = { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
