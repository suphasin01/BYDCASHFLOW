import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useI18n } from '../i18n'
import { getReportSummary, getReportMonthly, getReportTopContacts } from '../api'
import type { ReportSummary, MonthlyData, TopContact } from '../types'
import { fmt, fmtShort } from '../utils'

export default function Reports() {
  const { t, tArr } = useI18n()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [topContacts, setTopContacts] = useState<TopContact[]>([])
  const [loading, setLoading] = useState(true)

  const MONTHS = tArr('months')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sum, mon, top] = await Promise.all([getReportSummary(), getReportMonthly(), getReportTopContacts(8)])
        setSummary(sum)
        const mData = Array.from({ length: 12 }, (_, i) => {
          const m = String(i + 1).padStart(2, '0')
          const found = mon.data?.find(r => r.month === m)
          return { month: MONTHS[i] || m, revenue: found?.revenue || 0, expense: found?.expense || 0 }
        })
        setMonthly(mData)
        setTopContacts(top.data || [])
      } catch {}
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</div>

  const CONTACT_BADGE: Record<string, { bg: string; color: string }> = {
    customer: { bg: 'rgba(124,109,243,0.12)', color: '#a78bfa' },
    vendor: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { color: '#22d3a0', icon: '💰', label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, glow: 'rgba(34,211,160,0.12)' },
          { color: '#f87171', icon: '📤', label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, glow: 'rgba(248,113,113,0.12)' },
          { color: (summary?.profit || 0) >= 0 ? '#22d3a0' : '#f87171', icon: '📊', label: t('dash_profit'), value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, glow: 'rgba(96,165,250,0.12)' },
          { color: '#fbbf24', icon: '⏳', label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, glow: 'rgba(251,191,36,0.12)' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: card.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color, letterSpacing: '-0.5px' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>📈 {t('report_monthly_title')} ({new Date().getFullYear()})</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthly} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
            <Tooltip
              contentStyle={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f4ff', fontSize: 12 }}
              formatter={(v: number) => [`฿${fmt(v)}`, '']}
            />
            <Legend wrapperStyle={{ color: '#8892a4', fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" name={t('dash_revenue')} stroke="#7c6df3" strokeWidth={2} dot={{ fill: '#7c6df3', r: 4 }} />
            <Line type="monotone" dataKey="expense" name={t('dash_expense')} stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Contacts */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>🏆 {t('dash_top_contacts')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['#', t('col_name'), t('lbl_type'), t('col_count'), t('col_total')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topContacts.length > 0 ? topContacts.map((c, i) => {
                const badge = CONTACT_BADGE[c.type] || CONTACT_BADGE.customer
                return (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: badge.bg, color: badge.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: badge.color, display: 'inline-block' }} />
                        {c.type === 'customer' ? t('contact_customer') : t('contact_vendor')}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{c.doc_count} {t('records_suffix')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(c.total_amount)}</span></td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#8892a4' }}>{t('no_data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
