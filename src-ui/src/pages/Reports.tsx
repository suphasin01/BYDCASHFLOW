import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  Card, CardBody, CardHeader, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
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

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>

  const statCards = [
    { color: 'text-success', icon: '💰', label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, glow: 'bg-success/10' },
    { color: 'text-danger', icon: '📤', label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, glow: 'bg-danger/10' },
    { color: (summary?.profit || 0) >= 0 ? 'text-success' : 'text-danger', icon: '📊', label: t('dash_profit'), value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, glow: 'bg-[#60a5fa]/10' },
    { color: 'text-warning', icon: '⏳', label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, glow: 'bg-warning/10' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="bg-content1 border border-content3" shadow="none">
            <CardBody className="p-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 ${card.glow}`}>{card.icon}</div>
              <div className="text-[11px] font-medium text-default-500 uppercase tracking-wide mb-2.5">{card.label}</div>
              <div className={`text-[22px] font-bold tracking-tight ${card.color}`}>{card.value}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="bg-content1 border border-content3" shadow="none">
        <CardHeader className="text-[13px] font-semibold pb-0">📈 {t('report_monthly_title')} ({new Date().getFullYear()})</CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      {/* Top Contacts */}
      <Card className="bg-content1 border border-content3" shadow="none">
        <CardHeader className="text-[13px] font-semibold pb-0">🏆 {t('dash_top_contacts')}</CardHeader>
        <CardBody className="pt-0">
          <Table removeWrapper aria-label={t('dash_top_contacts')}
            classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
            <TableHeader>
              <TableColumn>#</TableColumn>
              <TableColumn>{t('col_name')}</TableColumn>
              <TableColumn>{t('lbl_type')}</TableColumn>
              <TableColumn>{t('col_count')}</TableColumn>
              <TableColumn align="end">{t('col_total')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent={<div className="py-10 text-default-500">{t('no_data')}</div>}>
              {topContacts.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="text-default-500">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={c.type === 'customer' ? 'secondary' : 'warning'}>
                      {c.type === 'customer' ? t('contact_customer') : t('contact_vendor')}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-default-500">{c.doc_count} {t('records_suffix')}</TableCell>
                  <TableCell><div className="text-right text-success font-semibold">฿{fmt(c.total_amount)}</div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
}
