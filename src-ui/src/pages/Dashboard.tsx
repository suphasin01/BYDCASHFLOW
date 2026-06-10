import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  Button, Card, CardBody, CardHeader, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { useI18n } from '../i18n'
import { getReportSummary, getReportMonthly, getDocuments, getReportTopContacts } from '../api'
import type { ReportSummary, MonthlyData, Document, TopContact } from '../types'
import { fmt, fmtShort, fmtDate } from '../utils'

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'companies' | 'settings'
interface Props { onNavigate: (p: Page) => void }

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
const STATUS_COLOR: Record<string, ChipColor> = {
  draft: 'default', sent: 'primary', approved: 'success', paid: 'success', cancelled: 'danger',
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
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
  }

  const statCards = [
    { color: 'text-success', icon: '💰', label: t('dash_revenue'), value: `฿${fmtShort(summary?.revenue || 0)}`, sub: t('dash_all_docs'), glow: 'bg-success/10' },
    { color: 'text-danger', icon: '📤', label: t('dash_expense'), value: `฿${fmtShort(summary?.expense || 0)}`, sub: t('dash_all_docs'), glow: 'bg-danger/10' },
    { color: (summary?.profit || 0) >= 0 ? 'text-success' : 'text-danger', icon: '📊', label: t('dash_profit'), value: `฿${fmtShort(Math.abs(summary?.profit || 0))}`, sub: (summary?.profit || 0) >= 0 ? t('dash_profit_label') : t('dash_loss_label'), glow: 'bg-[#60a5fa]/10' },
    { color: 'text-warning', icon: '⏳', label: t('dash_pending'), value: `฿${fmtShort(summary?.pending || 0)}`, sub: t('dash_overdue_label'), glow: 'bg-warning/10' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="bg-content1 border border-content3" shadow="none">
            <CardBody className="p-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 ${card.glow}`}>{card.icon}</div>
              <div className="text-[11px] font-medium text-default-500 uppercase tracking-wide mb-2.5">{card.label}</div>
              <div className={`text-[22px] font-bold tracking-tight ${card.color}`}>{card.value}</div>
              <div className="text-[11px] text-default-500 mt-1.5">{card.sub}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Chart + Top Contacts */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="bg-content1 border border-content3" shadow="none">
          <CardHeader className="text-[13px] font-semibold pb-0">📈 {t('dash_chart_title')}</CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-content3" shadow="none">
          <CardHeader className="text-[13px] font-semibold pb-0">🏆 {t('dash_top_contacts')}</CardHeader>
          <CardBody>
            {topContacts.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {topContacts.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-[26px] h-[26px] rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-default-500">{c.doc_count} {t('dash_doc_count')}</div>
                    </div>
                    <div className="text-[13px] font-semibold text-success">฿{fmtShort(c.total_amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 text-default-500">{t('no_data')}</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Documents */}
      <Card className="bg-content1 border border-content3" shadow="none">
        <CardHeader className="flex justify-between items-center">
          <div className="text-[13px] font-semibold">🕐 {t('dash_recent_docs')}</div>
          <Button size="sm" variant="flat" onPress={() => onNavigate('documents')}>{t('dash_view_all')}</Button>
        </CardHeader>
        <CardBody className="pt-0">
          <Table removeWrapper aria-label={t('dash_recent_docs')}
            classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
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
                <TableRow key={doc.id} className="cursor-pointer hover:bg-content2" onClick={() => onNavigate('documents')}>
                  <TableCell><span className="font-semibold text-primary">{doc.number || '—'}</span></TableCell>
                  <TableCell className="text-default-500">{DOC_TYPES[doc.type] || doc.type}</TableCell>
                  <TableCell>{doc.contact_name || '—'}</TableCell>
                  <TableCell className="text-default-500">{fmtDate(doc.date)}</TableCell>
                  <TableCell><span className="text-success font-semibold">฿{fmt(doc.total)}</span></TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={STATUS_COLOR[doc.status] || 'default'}>
                      {STATUS_LABELS[doc.status] || doc.status}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
}
