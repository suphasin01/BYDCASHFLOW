import { useEffect, useRef, useState } from 'react'
import { Bell, ArrowDownLeft, ArrowUpRight, Wallet, CalendarClock, CheckCircle2, ChevronRight } from 'lucide-react'
import { useI18n } from './i18n'
import { useActiveCompany } from './App'
import { getPaymentDocuments, getEmployees, getEmployeePayments } from './api'
import type { PayableDoc, Employee } from './types'
import { fmt, today } from './utils'

type Page = 'payments' | 'employees'
const curPeriod = () => today().slice(0, 7)
const outstanding = (d: PayableDoc) => d.status === 'paid' ? 0 : Math.max(0, (d.total || 0) - (d.paid_amount || 0))

export default function NotificationBell({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const { t } = useI18n()
  const { activeCompany } = useActiveCompany()
  const [open, setOpen] = useState(false)
  const [receivables, setReceivables] = useState<PayableDoc[]>([])
  const [payables, setPayables] = useState<PayableDoc[]>([])
  const [unpaidEmps, setUnpaidEmps] = useState<Employee[]>([])
  const [newMonth, setNewMonth] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const autoShown = useRef(false)

  const load = async () => {
    try {
      const [inRes, outRes, empRes, payRes] = await Promise.all([
        getPaymentDocuments('in'), getPaymentDocuments('out'), getEmployees(), getEmployeePayments(),
      ])
      setReceivables(inRes.data.filter(d => outstanding(d) > 0.01))
      setPayables(outRes.data.filter(d => outstanding(d) > 0.01))
      const paidIds = new Set(payRes.data.filter(p => p.period === curPeriod()).map(p => p.employee_id))
      setUnpaidEmps(empRes.data.filter(e => !paidIds.has(e.id)))
    } catch {}
  }

  useEffect(() => { load() }, [activeCompany?.id])

  // New-month detection (persisted across launches)
  useEffect(() => {
    const last = localStorage.getItem('lastSeenMonth')
    const cur = curPeriod()
    if (last && last !== cur) setNewMonth(true)
    localStorage.setItem('lastSeenMonth', cur)
  }, [])

  const totalRec = receivables.reduce((s, d) => s + outstanding(d), 0)
  const totalPay = payables.reduce((s, d) => s + outstanding(d), 0)
  const count = receivables.length + payables.length + unpaidEmps.length

  // Pop the panel open once per launch when there is something worth seeing
  useEffect(() => {
    if (!autoShown.current && (count > 0 || newMonth)) {
      autoShown.current = true
      const id = setTimeout(() => setOpen(true), 900)
      return () => clearTimeout(id)
    }
  }, [count, newMonth])

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const goto = (p: Page) => { setOpen(false); onNavigate?.(p) }

  const Section = ({ icon, color, title, badge, total, children, onClick }: {
    icon: React.ReactNode; color: string; title: string; badge: number; total?: number
    children: React.ReactNode; onClick: () => void
  }) => (
    <div className="rounded-xl border border-content3 bg-content2/40 overflow-hidden">
      <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-content2 transition-colors cursor-pointer text-left">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground">{title}</div>
          {total !== undefined && <div className="text-[11px] text-default-500">฿{fmt(total)}</div>}
        </div>
        <span className="text-[11px] font-bold text-foreground bg-content3 rounded-full px-2 py-0.5 flex-shrink-0">{badge}</span>
        <ChevronRight size={15} className="text-default-400 flex-shrink-0" />
      </button>
      <div className="px-3 pb-2.5 flex flex-col gap-1">{children}</div>
    </div>
  )

  const docRows = (docs: PayableDoc[]) => (<>
    {docs.slice(0, 4).map(d => (
      <div key={d.id} className="flex items-center justify-between text-[11px] gap-2">
        <span className="text-default-500 truncate">{d.number || `#${d.id}`} · {d.contact_name || d.contact_display || '—'}</span>
        <span className="text-warning font-semibold flex-shrink-0">฿{fmt(outstanding(d))}</span>
      </div>
    ))}
    {docs.length > 4 && <div className="text-[11px] text-default-400">+{docs.length - 4} {t('notif_items')}</div>}
  </>)

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen(o => !o)} title={t('notif_title')}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-500 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer">
        <Bell size={15} strokeWidth={1.8} className={count > 0 ? 'bell-ring' : ''} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center shadow-[0_2px_6px_rgba(248,113,113,.5)]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[999] w-[360px] max-h-[72vh] rounded-2xl bg-content1 border border-content3 shadow-[0_20px_60px_rgba(0,0,0,.6)] flex flex-col overflow-hidden modal-panel">
          {/* Header */}
          <div className="px-4 py-3 border-b border-content3 flex items-center gap-2 flex-shrink-0">
            <Bell size={15} className="text-primary" />
            <span className="text-[13px] font-semibold flex-1">{t('notif_title')}</span>
            {count > 0 && <span className="text-[11px] text-default-500">{count} {t('notif_items')}</span>}
          </div>

          <div className="p-3 flex flex-col gap-2.5 overflow-y-auto">
            {newMonth && (
              <div className="flex items-start gap-2.5 rounded-xl bg-primary/10 border border-primary/25 px-3 py-2.5">
                <CalendarClock size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-foreground leading-snug">{t('notif_new_month')}</div>
              </div>
            )}

            {count === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-default-500">
                <CheckCircle2 size={36} className="text-success opacity-80" strokeWidth={1.5} />
                <div className="text-[13px]">{t('notif_all_clear')}</div>
              </div>
            ) : (
              <>
                {receivables.length > 0 && (
                  <Section icon={<ArrowDownLeft size={15} className="text-success" />} color="bg-success/15"
                    title={t('notif_rec')} badge={receivables.length} total={totalRec} onClick={() => goto('payments')}>
                    {docRows(receivables)}
                  </Section>
                )}
                {payables.length > 0 && (
                  <Section icon={<ArrowUpRight size={15} className="text-warning" />} color="bg-warning/15"
                    title={t('notif_pay')} badge={payables.length} total={totalPay} onClick={() => goto('payments')}>
                    {docRows(payables)}
                  </Section>
                )}
                {unpaidEmps.length > 0 && (
                  <Section icon={<Wallet size={15} className="text-primary" />} color="bg-primary/15"
                    title={t('notif_salary')} badge={unpaidEmps.length} onClick={() => goto('employees')}>
                    {unpaidEmps.slice(0, 4).map(e => (
                      <div key={e.id} className="flex items-center justify-between text-[11px] gap-2">
                        <span className="text-default-500 truncate">{e.name}{e.department ? ` · ${e.department}` : ''}</span>
                        <span className="text-success font-semibold flex-shrink-0">฿{fmt(e.salary)}</span>
                      </div>
                    ))}
                    {unpaidEmps.length > 4 && <div className="text-[11px] text-default-400">+{unpaidEmps.length - 4} {t('notif_items')}</div>}
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
