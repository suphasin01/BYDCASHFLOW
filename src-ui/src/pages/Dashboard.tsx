import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useI18n } from '../i18n'
import { getReportSummary, getReportMonthly, getDocuments, getReportTopContacts } from '../api'
import type { ReportSummary, MonthlyData, Document, TopContact } from '../types'
import { fmt, fmtShort, fmtDate } from '../utils'

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'companies' | 'settings'
interface Props { onNavigate: (p: Page) => void }

const STATUS_BADGE_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  draft: { bg: 'rgba(139,148,158,0.12)', color: '#8b949e', dot: '#8b949e' },
  sent: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', dot: '#60a5fa' },
  approved: { bg: 'rgba(34,211,160,0.12)', color: '#22d3a0', dot: '#22d3a0' },
  paid: { bg: 'rgba(34,211,160,0.18)', color: '#6ee7b7', dot: '#6ee7b7' },
  cancelled: { bg: 'rgba(248,113,113,0.12)', color: '#f87171', dot: '#f87171' },
}

export default function Dashboard({ onNavigate }: Props) {
  const { t, tArr } = useI18n()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [recent, setRecent] = useState<Document[]>([])
  const [topContacts, setTopContacts] = useState<TopContact[]>([])
  const [loading, setLoading] = useState(true)

  const MONTHS = tArr('months')

  const DOC_TYPES: Record<string, string> = {
    quotation: t('type_quotation'), invoice: t('type_invoice'), receipt: t('type_receipt'),
    billing_note: t('type_billing_note'), cash_invoice: t('type_cash_invoice'),
    purchase_order: t('type_purchase_order'), expense: t('type_expense'),
  }
  const STATUS_LABELS: Record<string, string> = {
    draft: t('status_draft'), sent: t('status_sent'), approved: t('status_approved'),
    paid: t('status_paid'), cancelled: t('status_cancelled'),
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sum, mon, rec, top] = await Promise.all([
          getReportSummary(),
          getReportMonthly(),
          getDocuments({ limit: '6' }),
          getReportTopContacts(5),
        ])
        setSummary(sum)
        const mData = Array.from({ length: 12 }, (_, i) => {
          const m = String(i + 1).padStart(2, '0')
          const found = mon.data?.find(r => r.month === m)
          return { month: MONTHS[i] || m, revenue: found?.revenue || 0, expense: found?.expense || 0 }
        })
        setMonthly(mData)
        setRecent(rec.data || [])
        setTopContacts(top.data || [])
      } catch {}
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#8892a4' }}>⏳ {t('loading')}</div>
  }

  const statCards = [
    { color: '#22d3a0', icon: '💰', label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, sub: t('dash_all_docs'), glow: 'rgba(34,211,160,0.12)' },
    { color: '#f87171', icon: '📤', label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, sub: t('dash_all_docs'), glow: 'rgba(248,113,113,0.12)' },
    { color: (summary?.profit || 0) >= 0 ? '#22d3a0' : '#f87171', icon: '📊', label: t('dash_profit'), value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, sub: (summary?.profit || 0) >= 0 ? t('dash_profit_label') : t('dash_loss_label'), glow: 'rgba(96,165,250,0.12)' },
    { color: '#fbbf24', icon: '⏳', label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, sub: t('dash_overdue_label'), glow: 'rgba(251,191,36,0.12)' },
  ]

  return (
    <div>
      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: card.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color, letterSpacing: '-0.5px' }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#8892a4', marginTop: 5 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + Top Contacts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>📈 {t('dash_chart_title')}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
              <Tooltip
                contentStyle={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f4ff', fontSize: 12 }}
                formatter={(v: number) => [`฿${fmt(v)}`, '']}
              />
              <Legend wrapperStyle={{ color: '#8892a4', fontSize: 12 }} />
              <Bar dataKey="revenue" name={t('dash_revenue')} fill="rgba(124,109,243,0.7)" radius={[5,5,0,0]} />
              <Bar dataKey="expense" name={t('dash_expense')} fill="rgba(248,113,113,0.45)" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>🏆 {t('dash_top_contacts')}</div>
          {topContacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topContacts.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(124,109,243,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#8892a4' }}>{c.doc_count} {t('dash_doc_count')}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#22d3a0' }}>฿{fmtShort(c.total_amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#8892a4' }}>{t('no_data')}</div>
          )}
        </div>
      </div>

      {/* Recent Documents */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🕐 {t('dash_recent_docs')}</div>
          <button onClick={() => onNavigate('documents')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', padding: '5px 11px', color: '#8892a4', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}>
            {t('dash_view_all')}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('col_number'), t('col_type'), t('col_customer'), t('col_date'), t('col_amount'), t('col_status')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length > 0 ? recent.map(doc => {
                const badge = STATUS_BADGE_STYLE[doc.status] || STATUS_BADGE_STYLE.draft
                return (
                  <tr key={doc.id} onClick={() => onNavigate('documents')} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontWeight: 600, color: '#7c6df3' }}>{doc.number || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#8892a4', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{DOC_TYPES[doc.type] || doc.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{doc.contact_name || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#8892a4', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmtDate(doc.date)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(doc.total)}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: badge.bg, color: badge.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: badge.dot, display: 'inline-block' }} />
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#8892a4' }}>
                    <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>📄</div>
                    <p>{t('no_documents')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
