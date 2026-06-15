import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { Banknote, ArrowUpRight, BarChart2, Clock, TrendingUp, Trophy, History, type LucideIcon } from 'lucide-react'
import { useI18n } from '../i18n'
import Btn from '../ui/Btn'
import { getReportSummary, getReportMonthly, getDocuments, getReportTopContacts } from '../api'
import type { ReportSummary, MonthlyData, Document, TopContact } from '../types'
import { fmt, fmtShort, fmtDate } from '../utils'

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'companies' | 'settings'
interface Props { onNavigate: (p: Page) => void }

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
const STATUS_COLOR: Record<string, ChipColor> = {
  draft: 'default', sent: 'primary', approved: 'success', paid: 'success', cancelled: 'danger',
}

// 3D tilt hook for a single card element
function useTiltRef() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(10px) scale(1.02)`
      el.style.transition = 'transform .05s ease'
    }
    const onLeave = () => {
      el.style.transform = 'perspective(700px) rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)'
      el.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1)'
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [])
  return ref
}

// Section header component with gradient accent
function SectionHeader({ Icon, title, action }: { Icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shadow-[0_0_12px_rgba(124,109,243,.2)]">
          <Icon size={18} className="text-primary" strokeWidth={2} />
        </div>
        <div>
          <div className="text-[16px] font-bold tracking-tight">{title}</div>
          <div className="h-[2px] mt-1 w-10 rounded-full bg-gradient-to-r from-primary to-violet-400 opacity-70" />
        </div>
      </div>
      {action}
    </div>
  )
}

// Individual tilt stat card
function StatCard({ Icon, label, value, sub, color, glow, gradient }: {
  Icon: LucideIcon; label: string; value: string; sub: string
  color: string; glow: string; gradient: string
}) {
  const ref = useTiltRef()
  return (
    <div ref={ref} className={`relative bg-content1 border border-content3 rounded-2xl p-5 cursor-default overflow-hidden
      hover:border-primary/30 hover:shadow-[0_16px_48px_rgba(0,0,0,.3)] transition-shadow duration-300`}
      style={{ transformStyle: 'preserve-3d' }}>
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-40 pointer-events-none ${gradient}`} />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${glow} shadow-md relative z-10`}>
        <Icon size={22} className={color} strokeWidth={1.8} />
      </div>
      <div className="text-[11px] font-semibold text-default-400 uppercase tracking-widest mb-2 relative z-10">{label}</div>
      <div className={`text-[28px] font-black tracking-tight stat-value ${color} relative z-10`}>{value}</div>
      <div className="text-[11px] text-default-500 mt-1.5 relative z-10">{sub}</div>
    </div>
  )
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

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    load()
    // Refetch when the user returns to the app/tab so the dashboard never goes stale.
    const onFocus = () => load(false)
    const onVisible = () => { if (!document.hidden) load(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" color="primary" />
        <div className="text-sm text-default-400">{t('loading')}</div>
      </div>
    )
  }

  const statCards = [
    { color: 'text-emerald-400', Icon: Banknote,      label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, sub: t('dash_all_docs'), glow: 'bg-emerald-500/15', gradient: 'bg-emerald-500' },
    { color: 'text-rose-400',    Icon: ArrowUpRight,  label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, sub: t('dash_all_docs'), glow: 'bg-rose-500/15', gradient: 'bg-rose-500' },
    { color: (summary?.profit || 0) >= 0 ? 'text-sky-400' : 'text-rose-400', Icon: BarChart2, label: t('dash_profit'), value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, sub: (summary?.profit || 0) >= 0 ? t('dash_profit_label') : t('dash_loss_label'), glow: 'bg-sky-500/15', gradient: 'bg-sky-500' },
    { color: 'text-amber-400',   Icon: Clock,         label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, sub: t('dash_overdue_label'), glow: 'bg-amber-500/15', gradient: 'bg-amber-500' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => <StatCard key={i} Icon={card.Icon} label={card.label} value={card.value} sub={card.sub} color={card.color} glow={card.glow} gradient={card.gradient} />)}
      </div>

      {/* Chart + Top Contacts */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
          <SectionHeader Icon={TrendingUp} title={t('dash_chart_title')} />
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7685', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                <Tooltip
                  contentStyle={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#f0f4ff', fontSize: 12 }}
                  formatter={(v: number) => [`฿${fmt(v)}`, '']}
                />
                <Legend wrapperStyle={{ color: '#8892a4', fontSize: 12 }} />
                <Bar dataKey="revenue" name={t('dash_revenue')} fill="rgba(124,109,243,0.75)" radius={[6,6,0,0]} />
                <Bar dataKey="expense" name={t('dash_expense')} fill="rgba(248,113,113,0.5)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
          <SectionHeader Icon={Trophy} title={t('dash_top_contacts')} />
          <div className="px-5 pb-5">
            {topContacts.length > 0 ? (
              <div className="flex flex-col gap-3">
                {topContacts.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-primary/30 text-primary'}`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{c.name}</div>
                      <div className="text-[11px] text-default-500">{c.doc_count} {t('dash_doc_count')}</div>
                    </div>
                    <div className="text-[14px] font-bold text-emerald-400">฿{fmtShort(c.total_amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 text-default-500">{t('no_data')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
        <SectionHeader Icon={History} title={t('dash_recent_docs')}
          action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('documents')}>{t('dash_view_all')}</Btn>} />
        <div className="px-5 pb-5">
          <Table removeWrapper aria-label={t('dash_recent_docs')}
            classNames={{ th: 'bg-transparent text-default-500 uppercase text-[10px] tracking-wider', td: 'text-[13px]' }}>
            <TableHeader>
              <TableColumn>{t('col_number')}</TableColumn>
              <TableColumn>{t('col_type')}</TableColumn>
              <TableColumn>{t('col_customer')}</TableColumn>
              <TableColumn>{t('col_date')}</TableColumn>
              <TableColumn>{t('col_amount')}</TableColumn>
              <TableColumn>{t('col_status')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent={
              <div className="py-10 text-default-500">
                <div className="text-4xl mb-3.5 opacity-40">📄</div>
                <p>{t('no_documents')}</p>
              </div>
            }>
              {recent.map(doc => (
                <TableRow key={doc.id} className="cursor-pointer hover:bg-content2 transition-colors" onClick={() => onNavigate('documents')}>
                  <TableCell><span className="font-semibold text-primary">{doc.number || '—'}</span></TableCell>
                  <TableCell className="text-default-500">{DOC_TYPES[doc.type] || doc.type}</TableCell>
                  <TableCell className="font-medium">{doc.contact_name || '—'}</TableCell>
                  <TableCell className="text-default-500">{fmtDate(doc.date)}</TableCell>
                  <TableCell><span className="text-emerald-400 font-bold">฿{fmt(doc.total)}</span></TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={STATUS_COLOR[doc.status] || 'default'}>
                      {STATUS_LABELS[doc.status] || doc.status}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
