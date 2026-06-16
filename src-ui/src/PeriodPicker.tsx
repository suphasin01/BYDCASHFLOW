import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { usePeriod } from './App'
import { useI18n } from './i18n'
import { today } from './utils'

/** Topbar month selector. Controls the global viewing period (YYYY-MM). */
export default function PeriodPicker() {
  const { period, setPeriod } = usePeriod()
  const { t, tArr } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const cur = today().slice(0, 7)
  const isCurrent = period === cur
  const months = tArr('months')
  const [y, m] = period.split('-')
  const label = `${months[Number(m) - 1] || m} ${y}`

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen(o => !o)} title={t('period_pick')}
        className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg bg-content2 border border-content3 text-default-600 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer text-[12px] font-medium">
        <CalendarDays size={15} strokeWidth={1.8} className={isCurrent ? '' : 'text-primary'} />
        <span className="hidden sm:inline whitespace-nowrap">{label}</span>
        {!isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[999] w-[230px] rounded-2xl bg-content1 border border-content3 shadow-[0_20px_60px_rgba(0,0,0,.6)] p-3 flex flex-col gap-2 modal-panel">
          <div className="text-[11px] text-default-500 uppercase tracking-wide font-medium">{t('period_pick')}</div>
          <input type="month" value={period}
            onChange={e => { if (e.target.value) setPeriod(e.target.value) }}
            className="w-full bg-content2 border border-content3 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary [color-scheme:dark]" />
          <button onClick={() => { setPeriod(cur); setOpen(false) }}
            className={`w-full text-[12px] py-1.5 rounded-lg border transition-colors cursor-pointer ${isCurrent ? 'border-primary/40 bg-primary/10 text-primary' : 'border-content3 hover:border-primary hover:text-primary text-default-500'}`}>
            {t('period_this_month')}
          </button>
        </div>
      )}
    </div>
  )
}
