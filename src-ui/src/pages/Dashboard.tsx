import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Chip, Spinner } from '@heroui/react'
import {
  Banknote, ArrowUpRight, BarChart2, Clock, TrendingUp, Trophy, History,
  AlertTriangle, RefreshCw, FilePlus, UserPlus, CreditCard, BarChart as BarChartIcon,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { useActiveCompany } from '../App'
import Btn from '../ui/Btn'
import { getReportSummary, getReportMonthly, getDocuments, getReportTopContacts } from '../api'
import type { ReportSummary, MonthlyData, Document, TopContact } from '../types'
import { fmt, fmtShort, fmtDate } from '../utils'

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'employees' | 'evidence' | 'reports' | 'withholding_tax' | 'pay_slips' | 'companies' | 'settings'
interface Props { onNavigate: (p: Page) => void }

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
const STATUS_COLOR: Record<string, ChipColor> = {
  draft: 'default', sent: 'primary', approved: 'success', paid: 'success', cancelled: 'danger',
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const start = prev.current
    const diff = target - start
    if (diff === 0) return
    const startTime = performance.now()
    const frame = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const cur = start + diff * ease
      setVal(cur)
      if (t < 1) requestAnimationFrame(frame)
      else { prev.current = target; setVal(target) }
    }
    requestAnimationFrame(frame)
  }, [target, duration])
  return val
}

// ── 3D tilt hook ──────────────────────────────────────────────────────────────
function useTiltRef() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(8px) scale(1.015)`
      el.style.transition = 'transform .05s ease'
    }
    const onLeave = () => {
      el.style.transform = 'perspective(700px) rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)'
      el.style.transition = 'transform .4s cubic-bezier(.34,1.56,.64,1)'
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [])
  return ref
}

// ── Section header ─────────────────────────────────────────────────────────────
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

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ Icon, label, value, rawValue, sub, color, glow, gradient, pulse }: {
  Icon: LucideIcon; label: string; value: string; rawValue: number; sub: string
  color: string; glow: string; gradient: string; pulse?: boolean
}) {
  const ref = useTiltRef()
  const animated = useCountUp(rawValue)
  const displayValue = value.startsWith('฿') ? `฿${fmtShort(animated)}` : String(animated)

  return (
    <div ref={ref} className={`relative bg-content1 border border-content3 rounded-2xl p-5 cursor-default overflow-hidden
      hover:border-primary/30 hover:shadow-[0_16px_48px_rgba(0,0,0,.3)] transition-shadow duration-300`}
      style={{ transformStyle: 'preserve-3d' }}>
      {/* Glow orb */}
      <div className={`absolute -top-5 -right-5 w-24 h-24 rounded-full blur-3xl opacity-30 pointer-events-none ${gradient}`} />
      {/* Top shimmer line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl opacity-60 ${gradient}`} />

      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${glow} shadow-md relative z-10 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={22} className={color} strokeWidth={1.8} />
      </div>
      <div className="text-[11px] font-semibold text-default-400 uppercase tracking-widest mb-1.5 relative z-10">{label}</div>
      <div className={`text-[28px] font-black tracking-tight ${color} relative z-10`}>{displayValue}</div>
      <div className="text-[11px] text-default-500 mt-1.5 relative z-10">{sub}</div>
    </div>
  )
}

// ── Quick action button ────────────────────────────────────────────────────────
function QuickBtn({ Icon, label, onClick, color }: { Icon: LucideIcon; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-content3 bg-content1
        hover:scale-105 hover:border-primary/40 hover:shadow-[0_8px_32px_rgba(0,0,0,.3)]
        transition-all duration-200 cursor-pointer group`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-200`}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <span className="text-[12px] font-medium text-default-500 group-hover:text-foreground transition-colors whitespace-nowrap">{label}</span>
    </button>
  )
}

export default function Dashboard({ onNavigate }: Props) {
  const { t, tArr } = useI18n()
  const { activeCompany } = useActiveCompany()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [recent, setRecent] = useState<Document[]>([])
  const [topContacts, setTopContacts] = useState<TopContact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
    else setRefreshing(true)
    try {
      const [sum, mon, rec, top] = await Promise.all([
        getReportSummary(),
        getReportMonthly(),
        getDocuments({ limit: '8' }),
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
      setLastUpdated(new Date())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    load()
    const onFocus = () => load(false)
    const onVisible = () => { if (!document.hidden) load(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => load(false), 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [load])

  // Reload when active company changes
  useEffect(() => { if (activeCompany?.id) load(false) }, [activeCompany?.id])

  // Derived: overdue documents from recent
  const overdueCount = recent.filter(d =>
    d.due_date && d.due_date < new Date().toISOString().slice(0, 10) &&
    !['paid', 'cancelled'].includes(d.status)
  ).length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative">
          <Spinner size="lg" color="primary" />
          <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 scale-150 animate-pulse" />
        </div>
        <div className="text-sm text-default-400">{t('loading')}</div>
      </div>
    )
  }

  const statCards = [
    { color: 'text-emerald-400', Icon: Banknote,     label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, rawValue: summary?.revenue || 0, sub: t('dash_all_docs'), glow: 'bg-emerald-500/15', gradient: 'bg-emerald-500' },
    { color: 'text-rose-400',   Icon: ArrowUpRight,  label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, rawValue: summary?.expense || 0, sub: t('dash_all_docs'), glow: 'bg-rose-500/15', gradient: 'bg-rose-500' },
    {
      color: (summary?.profit || 0) >= 0 ? 'text-sky-400' : 'text-rose-400',
      Icon: BarChart2, label: t('dash_profit'),
      value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, rawValue: Math.abs(summary?.profit || 0),
      sub: (summary?.profit || 0) >= 0 ? t('dash_profit_label') : t('dash_loss_label'),
      glow: 'bg-sky-500/15', gradient: 'bg-sky-500',
    },
    { color: 'text-amber-400',  Icon: Clock,         label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, rawValue: summary?.pending || 0, sub: t('dash_overdue_label'), glow: 'bg-amber-500/15', gradient: 'bg-amber-500', pulse: (summary?.pending || 0) > 0 },
  ]

  const timeAgo = lastUpdated
    ? `${t('dash_updated')} ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <div className="flex flex-col gap-6">

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="w-8 h-8 rounded-xl bg-danger/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-danger" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-danger">{t('dash_overdue_alert').replace('{n}', String(overdueCount))}</span>
            <span className="text-[12px] text-danger/70 ml-2">{t('dash_overdue_sub')}</span>
          </div>
          <Btn size="sm" variant="danger" onClick={() => onNavigate('payments')}>{t('dash_view_payments')}</Btn>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 stagger">
        {statCards.map((card, i) => (
          <StatCard key={i} Icon={card.Icon} label={card.label} value={card.value} rawValue={card.rawValue}
            sub={card.sub} color={card.color} glow={card.glow} gradient={card.gradient} pulse={card.pulse} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
        <SectionHeader Icon={FilePlus} title={t('dash_quick_actions')}
          action={
            <div className="flex items-center gap-2">
              {timeAgo && <span className="text-[11px] text-default-400">{timeAgo}</span>}
              <button onClick={() => load(false)} title={t('dash_refresh')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-default-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer ${refreshing ? 'pointer-events-none' : ''}`}>
                <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin text-primary' : ''} />
              </button>
            </div>
          } />
        <div className="px-5 pb-5 grid grid-cols-4 gap-3">
          <QuickBtn Icon={FilePlus}      label={t('dash_qa_new_doc')}    onClick={() => onNavigate('documents')} color="bg-primary/15 text-primary" />
          <QuickBtn Icon={CreditCard}    label={t('dash_qa_payments')}   onClick={() => onNavigate('payments')}  color="bg-warning/15 text-warning" />
          <QuickBtn Icon={UserPlus}      label={t('dash_qa_contacts')}   onClick={() => onNavigate('contacts')}  color="bg-success/15 text-success" />
          <QuickBtn Icon={BarChartIcon}  label={t('dash_qa_reports')}    onClick={() => onNavigate('reports')}   color="bg-sky-500/15 text-sky-400" />
        </div>
      </div>

      {/* Chart + Top Contacts */}
      <div className="grid grid-cols-2 gap-5">
        {/* Revenue vs Expense chart */}
        <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
          <SectionHeader Icon={TrendingUp} title={t('dash_chart_title')} />
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c6df3" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c6df3" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7685', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7685', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                <Tooltip
                  contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f0f4ff', fontSize: 12, padding: '8px 12px' }}
                  formatter={(v: number) => [`฿${fmt(v)}`, '']}
                  cursor={{ stroke: 'rgba(124,109,243,0.2)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="revenue" name={t('dash_revenue')} stroke="#7c6df3" strokeWidth={2} fill="url(#gradRev)" dot={false} activeDot={{ r: 4, fill: '#7c6df3' }} />
                <Area type="monotone" dataKey="expense" name={t('dash_expense')} stroke="#f87171" strokeWidth={2} fill="url(#gradExp)" dot={false} activeDot={{ r: 4, fill: '#f87171' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-1 px-1">
              <div className="flex items-center gap-1.5 text-[11px] text-default-500">
                <span className="w-3 h-1 rounded-full bg-primary inline-block" />{t('dash_revenue')}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-default-500">
                <span className="w-3 h-1 rounded-full bg-rose-400 inline-block" />{t('dash_expense')}
              </div>
            </div>
          </div>
        </div>

        {/* Top Contacts */}
        <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
          <SectionHeader Icon={Trophy} title={t('dash_top_contacts')} />
          <div className="px-5 pb-5 flex flex-col gap-3">
            {topContacts.length > 0 ? topContacts.map((c, i) => {
              const maxAmt = topContacts[0].total_amount || 1
              const pct = Math.round((c.total_amount / maxAmt) * 100)
              const medalColors = ['from-amber-400 to-amber-600', 'from-slate-300 to-slate-500', 'from-amber-600 to-amber-800']
              return (
                <div key={c.id} className="group">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white
                      ${i < 3 ? `bg-gradient-to-br ${medalColors[i]}` : 'bg-primary/20 text-primary'}`}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{c.name}</span>
                        <span className="text-[13px] font-bold text-emerald-400 ml-2 flex-shrink-0">฿{fmtShort(c.total_amount)}</span>
                      </div>
                      <div className="text-[10px] text-default-500">{c.doc_count} {t('dash_doc_count')}</div>
                    </div>
                  </div>
                  <div className="h-[3px] bg-content3 rounded-full overflow-hidden ml-10">
                    <div className="h-full bg-gradient-to-r from-primary to-violet-400 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-8 text-default-500 text-[13px]">{t('no_data')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-content1 border border-content3 rounded-2xl overflow-hidden">
        <SectionHeader Icon={History} title={t('dash_recent_docs')}
          action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('documents')}>{t('dash_view_all')}</Btn>} />
        <div className="px-4 pb-4">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-default-400 gap-3">
              <span className="text-4xl opacity-30">📄</span>
              <p className="text-[13px]">{t('no_documents')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {recent.map(doc => {
                const isOverdue = doc.due_date && doc.due_date < new Date().toISOString().slice(0, 10) && !['paid','cancelled'].includes(doc.status)
                return (
                  <div key={doc.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-content2 transition-all duration-150 cursor-pointer group"
                    onClick={() => onNavigate('documents')}>
                    {/* Type badge */}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <span className="text-[9px] font-bold text-primary uppercase leading-none text-center">
                        {(DOC_TYPES[doc.type] || doc.type).slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-primary">{doc.number || '—'}</span>
                        <span className="text-[11px] text-default-400 truncate">{doc.contact_name || '—'}</span>
                        {isOverdue && <span className="text-[9px] px-1.5 py-0.5 bg-danger/15 text-danger rounded-md font-semibold flex-shrink-0">เกินกำหนด</span>}
                      </div>
                      <div className="text-[11px] text-default-500">{fmtDate(doc.date)}{doc.due_date ? ` · ครบ ${fmtDate(doc.due_date)}` : ''}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[14px] font-bold text-emerald-400">฿{fmt(doc.total)}</div>
                      <Chip size="sm" variant="flat" color={STATUS_COLOR[doc.status] || 'default'}
                        className="text-[9px] h-4 min-h-4 mt-0.5">
                        {STATUS_LABELS[doc.status] || doc.status}
                      </Chip>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
