import { useEffect, useRef, useState } from 'react'
import {
  Card, CardBody, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { FileText, Plus, Eye, Paperclip } from 'lucide-react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getPaySlips, createPaySlip, updatePaySlip, deletePaySlip, getEmployees, getActiveCompany as getActiveCompanyApi, createEmployeePayment } from '../api'
import type { PaySlip, Employee } from '../types'
import { fmt, fmtDate, today } from '../utils'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

const ZERO_FORM = {
  employee_name: '', contact_id: '', department: '', period: '', pay_date: today(),
  salary: 0, cost_of_living: 0, position_allow: 0, meal_allow: 0, overtime: 0,
  shift_allow: 0, travel_allow: 0, subsidy: 0, welfare: 0, bonus: 0,
  tax_withheld: 0, social_security: 0, late_deduct: 0, absent_deduct: 0,
  loan_deduct: 0, advance_deduct: 0, other_deduct: 0,
  cum_income: 0, cum_tax: 0, cum_social_sec: 0, cum_provident: 0,
  notes: '',
}
type FormState = typeof ZERO_FORM

export default function PaySlipPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [slips, setSlips] = useState<PaySlip[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const [editId, setEditId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState<FormState>({ ...ZERO_FORM })
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [billPreview, setBillPreview] = useState<string | null>(null)
  const [attachingId, setAttachingId] = useState<number | null>(null)
  const billInputRef = useRef<HTMLInputElement>(null)

  const setF = (field: keyof FormState, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const totalIncome = ['salary','cost_of_living','position_allow','meal_allow','overtime','shift_allow','travel_allow','subsidy','welfare','bonus'].reduce((s, k) => s + (Number((form as Record<string,unknown>)[k]) || 0), 0)
  const totalDeductions = ['tax_withheld','social_security','late_deduct','absent_deduct','loan_deduct','advance_deduct','other_deduct'].reduce((s, k) => s + (Number((form as Record<string,unknown>)[k]) || 0), 0)
  const netIncome = totalIncome - totalDeductions

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getPaySlips(q); setSlips(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = async () => {
    try { const { data } = await getEmployees(); setEmployees(data) } catch {}
    setForm({ ...ZERO_FORM })
    setEditId(null)
    setModal('create')
  }

  const openEdit = async (slip: PaySlip) => {
    try { const { data } = await getEmployees(); setEmployees(data) } catch {}
    setForm({
      employee_name: slip.employee_name,
      contact_id: slip.contact_id ? String(slip.contact_id) : '',
      department: slip.department || '',
      period: slip.period || '',
      pay_date: slip.pay_date?.slice(0, 10) || today(),
      salary: slip.salary,
      cost_of_living: slip.cost_of_living,
      position_allow: slip.position_allow,
      meal_allow: slip.meal_allow,
      overtime: slip.overtime,
      shift_allow: slip.shift_allow,
      travel_allow: slip.travel_allow,
      subsidy: slip.subsidy,
      welfare: slip.welfare,
      bonus: slip.bonus,
      tax_withheld: slip.tax_withheld,
      social_security: slip.social_security,
      late_deduct: slip.late_deduct,
      absent_deduct: slip.absent_deduct,
      loan_deduct: slip.loan_deduct,
      advance_deduct: slip.advance_deduct,
      other_deduct: slip.other_deduct,
      cum_income: slip.cum_income,
      cum_tax: slip.cum_tax,
      cum_social_sec: slip.cum_social_sec,
      cum_provident: slip.cum_provident,
      notes: slip.notes || '',
    })
    setEditId(slip.id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.employee_name.trim()) { toast(t('ps_select_employee'), 'err'); return }
    const payload = {
      employee_name: form.employee_name,
      contact_id: form.contact_id ? Number(form.contact_id) : null,
      department: form.department || null,
      period: form.period || null,
      pay_date: form.pay_date,
      salary: Number(form.salary),
      cost_of_living: Number(form.cost_of_living),
      position_allow: Number(form.position_allow),
      meal_allow: Number(form.meal_allow),
      overtime: Number(form.overtime),
      shift_allow: Number(form.shift_allow),
      travel_allow: Number(form.travel_allow),
      subsidy: Number(form.subsidy),
      welfare: Number(form.welfare),
      bonus: Number(form.bonus),
      total_income: totalIncome,
      tax_withheld: Number(form.tax_withheld),
      social_security: Number(form.social_security),
      late_deduct: Number(form.late_deduct),
      absent_deduct: Number(form.absent_deduct),
      loan_deduct: Number(form.loan_deduct),
      advance_deduct: Number(form.advance_deduct),
      other_deduct: Number(form.other_deduct),
      total_deductions: totalDeductions,
      net_income: netIncome,
      cum_income: Number(form.cum_income),
      cum_tax: Number(form.cum_tax),
      cum_social_sec: Number(form.cum_social_sec),
      cum_provident: Number(form.cum_provident),
      notes: form.notes || null,
    }
    try {
      if (modal === 'edit' && editId) {
        await updatePaySlip(editId, payload)
      } else {
        await createPaySlip(payload)
        // Sync: create employee_payment so Employees page shows "paid" status
        if (form.employee_name && form.period) {
          try {
            const { data: emps } = await getEmployees()
            const emp = emps.find((e: Employee) => e.name === form.employee_name)
            if (emp) {
              await createEmployeePayment({
                employee_id: emp.id, period: form.period,
                amount: totalIncome, pay_date: form.pay_date,
                method: 'transfer', notes: null,
              })
            }
          } catch {} // don't block if linking fails
        }
      }
      toast(t('toast_ps_saved'))
      setModal('none')
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_ps'))) return
    try { await deletePaySlip(id); toast(t('toast_ps_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const handleBillAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || attachingId === null) return
    if (file.size > 5 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 5MB', 'err'); return }
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        await updatePaySlip(attachingId, { receipt_image: ev.target?.result as string })
        toast('แนบบิลแล้ว')
        load()
      } catch {}
      setAttachingId(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const openPreview = async (slip: PaySlip) => {
    try {
      const company = await getActiveCompanyApi().catch(() => null)
      setPreviewHtml(buildPaySlipHtml(slip, company))
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const printPDF = async (slip: PaySlip) => {
    try {
      const company = await getActiveCompanyApi().catch(() => null)
      const html = buildPaySlipHtml(slip, company)
      const api = (window as unknown as { electronAPI?: { exportPDF: (h: string, f: string) => Promise<{ success: boolean }> } }).electronAPI
      if (api?.exportPDF) {
        await api.exportPDF(html, `payslip_${slip.employee_name}_${slip.period || slip.pay_date}.pdf`)
      } else {
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
      }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const numField = (label: string, field: keyof FormState, idx?: number) => (
    <div className="flex items-center gap-2 py-1 border-b border-content3/50">
      <span className="text-[11px] text-default-400 w-4 flex-shrink-0">{idx}</span>
      <span className="text-[12px] text-default-600 flex-1">{label}</span>
      <input
        type="number" min={0} step="0.01"
        value={(form as Record<string,unknown>)[field] === 0 ? '' : String((form as Record<string,unknown>)[field])}
        onChange={e => setF(field, e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-28 bg-content2 border border-content3 rounded-lg px-2 py-1 text-sm text-right text-foreground outline-none focus:border-primary transition-colors"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <TextField className="flex-1 min-w-0" placeholder="🔍  ค้นหาพนักงาน / แผนก / งวด..."
          value={search} onChange={e => { setSearch(e.target.value); load(e.target.value || undefined) }} />
        <Btn variant="primary" size="sm" onClick={openCreate}
          className="flex-shrink-0 whitespace-nowrap"
          startContent={<Plus size={15} strokeWidth={2.5} />}>{t('ps_btn_create')}</Btn>
      </div>

      <Card className="bg-content1 border border-content3 rounded-xl" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('ps_title')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('ps_lbl_employee')}</TableColumn>
                <TableColumn>{t('ps_lbl_dept')}</TableColumn>
                <TableColumn>{t('ps_lbl_period')}</TableColumn>
                <TableColumn>{t('ps_lbl_pay_date')}</TableColumn>
                <TableColumn>{t('ps_total_income')}</TableColumn>
                <TableColumn>{t('ps_total_deduct')}</TableColumn>
                <TableColumn>{t('ps_net_income')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500 flex flex-col items-center">
                  <FileText size={40} className="mb-3.5 opacity-30" strokeWidth={1.2} />
                  <p>{t('no_pay_slips')}</p>
                </div>
              }>
                {slips.map(s => (
                  <TableRow key={s.id} className="hover:bg-content2/60 transition-colors">
                    <TableCell className="font-semibold">{s.employee_name}</TableCell>
                    <TableCell className="text-default-500">{s.department || '—'}</TableCell>
                    <TableCell className="text-default-500">{s.period || '—'}</TableCell>
                    <TableCell className="text-default-500">{fmtDate(s.pay_date)}</TableCell>
                    <TableCell><span className="text-primary font-semibold">฿{fmt(s.total_income)}</span></TableCell>
                    <TableCell><span className="text-danger">฿{fmt(s.total_deductions)}</span></TableCell>
                    <TableCell><span className="text-success font-bold">฿{fmt(s.net_income)}</span></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {s.receipt_image ? (
                          <Btn size="sm" variant="ghost" onClick={() => setBillPreview(s.receipt_image!)}
                            className="text-success border border-success/30 font-semibold" title="ดูหลักฐานการจ่าย">
                            📄 บิล
                          </Btn>
                        ) : (
                          <Btn size="sm" variant="ghost" onClick={() => { setAttachingId(s.id); billInputRef.current?.click() }}
                            className="text-default-400 border border-dashed border-content3" title="แนบรูปหลักฐาน">
                            <Paperclip size={13} className="mr-1" />บิล
                          </Btn>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => openPreview(s)} title={t('btn_preview')}><Eye size={14} /></Btn>
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>{t('btn_edit')}</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => printPDF(s)}>PDF</Btn>
                        <Btn size="sm" variant="danger" onClick={() => doDelete(s.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Hidden file input for attaching bill */}
      <input type="file" ref={billInputRef} accept="image/*" className="hidden" onChange={handleBillAttach} />

      {/* Bill/receipt image full-screen preview */}
      {billPreview && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setBillPreview(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 text-xl transition-colors cursor-pointer"
            onClick={() => setBillPreview(null)}>✕</button>
          <img src={billPreview} alt="หลักฐานการจ่าย"
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Preview modal */}
      <Modal open={!!previewHtml} onClose={() => setPreviewHtml(null)} size="xl"
        title={t('ps_preview_title')}
        footer={<Btn variant="ghost" onClick={() => setPreviewHtml(null)}>{t('btn_close')}</Btn>}>
        {previewHtml && (
          <iframe srcDoc={previewHtml} className="w-full rounded-lg border border-content3" style={{ height: '68vh' }} />
        )}
      </Modal>

      <Modal open={modal !== 'none'} onClose={() => setModal('none')} size="xl"
        title={modal === 'edit' ? t('ps_modal_edit') : t('ps_modal_create')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal('none')}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('ps_lbl_employee')}</label>
              <select value={form.employee_name} onChange={e => {
                const name = e.target.value
                setF('employee_name', name)
                if (name) {
                  const emp = employees.find(em => em.name === name)
                  if (emp) {
                    if (emp.department) setF('department', emp.department)
                    if (emp.salary) setF('salary', emp.salary)
                  }
                }
              }} className={SELECT_CLASS}>
                <option value="">— เลือกพนักงาน —</option>
                {employees.map(em => (
                  <option key={em.id} value={em.name}>
                    {em.name}{em.department ? ` (${em.department})` : ''}{em.employee_no ? ` #${em.employee_no}` : ''}
                  </option>
                ))}
              </select>
              <input
                className="mt-1.5 w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
                placeholder="หรือพิมพ์ชื่อโดยตรง..."
                value={form.employee_name}
                onChange={e => setF('employee_name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <TextField label={t('ps_lbl_dept')} value={form.department} onChange={e => setF('department', e.target.value)} placeholder="แผนก..." />
              <div className="grid grid-cols-2 gap-2">
                <TextField label={t('ps_lbl_period')} value={form.period} onChange={e => setF('period', e.target.value)} placeholder="เช่น เมษายน 2568" />
                <TextField type="date" label={t('ps_lbl_pay_date')} value={form.pay_date} onChange={e => setF('pay_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Income + Deductions side by side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Income */}
            <div className="bg-content2/50 rounded-xl p-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">{t('ps_income_title')}</div>
              {numField(t('ps_salary'), 'salary', 1)}
              {numField(t('ps_cost_living'), 'cost_of_living', 2)}
              {numField(t('ps_pos_allow'), 'position_allow', 3)}
              {numField(t('ps_meal_allow'), 'meal_allow', 4)}
              {numField(t('ps_overtime'), 'overtime', 5)}
              {numField(t('ps_shift_allow'), 'shift_allow', 6)}
              {numField(t('ps_travel_allow'), 'travel_allow', 7)}
              {numField(t('ps_subsidy'), 'subsidy', 8)}
              {numField(t('ps_welfare'), 'welfare', 9)}
              {numField(t('ps_bonus'), 'bonus', 10)}
              <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-primary/30">
                <span className="text-[12px] font-bold text-primary">{t('ps_total_income')}</span>
                <span className="text-[15px] font-bold text-primary">฿{fmt(totalIncome)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-content2/50 rounded-xl p-3">
              <div className="text-[11px] font-bold text-danger uppercase tracking-wider mb-2">{t('ps_deduct_title')}</div>
              {numField(t('ps_tax_withheld'), 'tax_withheld', 11)}
              {numField(t('ps_social_sec'), 'social_security', 12)}
              {numField(t('ps_late_deduct'), 'late_deduct', 13)}
              {numField(t('ps_absent_deduct'), 'absent_deduct', 14)}
              {numField(t('ps_loan_deduct'), 'loan_deduct', 15)}
              {numField(t('ps_advance_deduct'), 'advance_deduct', 16)}
              {numField(t('ps_other_deduct'), 'other_deduct', 17)}
              <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-danger/30">
                <span className="text-[12px] font-bold text-danger">{t('ps_total_deduct')}</span>
                <span className="text-[15px] font-bold text-danger">-฿{fmt(totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className="bg-success/10 border border-success/30 rounded-xl px-5 py-3 flex justify-between items-center">
            <span className="text-[14px] font-bold text-success">{t('ps_net_income')}</span>
            <span className="text-[22px] font-bold text-success">฿{fmt(netIncome)}</span>
          </div>

          {/* Cumulative */}
          <div className="bg-content2/50 rounded-xl p-3">
            <div className="text-[11px] font-bold text-default-500 uppercase tracking-wider mb-2">{t('ps_cum_title')}</div>
            <div className="grid grid-cols-2 gap-3">
              <TextField type="number" label={t('ps_cum_income')}
                value={form.cum_income === 0 ? '' : String(form.cum_income)} onChange={e => setF('cum_income', e.target.value === '' ? 0 : Number(e.target.value))} />
              <TextField type="number" label={t('ps_cum_tax')}
                value={form.cum_tax === 0 ? '' : String(form.cum_tax)} onChange={e => setF('cum_tax', e.target.value === '' ? 0 : Number(e.target.value))} />
              <TextField type="number" label={t('ps_cum_social')}
                value={form.cum_social_sec === 0 ? '' : String(form.cum_social_sec)} onChange={e => setF('cum_social_sec', e.target.value === '' ? 0 : Number(e.target.value))} />
              <TextField type="number" label={t('ps_cum_provident')}
                value={form.cum_provident === 0 ? '' : String(form.cum_provident)} onChange={e => setF('cum_provident', e.target.value === '' ? 0 : Number(e.target.value))} />
            </div>
          </div>

          <TextAreaField label={t('lbl_notes')} value={form.notes} onChange={e => setF('notes', e.target.value)} />
        </div>
      </Modal>

    </div>
  )
}

export function buildPaySlipHtml(slip: PaySlip, company: { name?: string | null; address?: string | null; phone?: string | null; tax_id?: string | null } | null): string {
  const fmtN = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n || 0)
  const row = (label: string, val: number, idx: number, _side: 'income' | 'deduct') => {
    return `<tr>
      <td style="padding:4px 6px;font-size:12px;color:#6b7280;width:18px">${idx}</td>
      <td style="padding:4px 6px;font-size:12px;color:#1a1a2e;border-bottom:1px solid #f1f5f9">${label}</td>
      <td style="padding:4px 8px;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:${val > 0 ? '600' : '400'};color:${val > 0 ? '#111827' : '#9ca3af'}">${val > 0 ? fmtN(val) : '-'}</td>
    </tr>`
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Sarabun',sans-serif;background:#fff;color:#111827}@page{size:A4;margin:12mm}@media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}.page{max-width:780px;margin:0 auto;padding:24px}.print-btn{position:fixed;top:16px;right:16px;background:#6366f1;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}</style>
</head><body>
<button class="no-print print-btn" onclick="window.print()">พิมพ์</button>
<div class="page">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #6366f1">
    <div>
      <div style="font-size:18px;font-weight:700;color:#6366f1">ใบเสร็จรับเงินเดือน (PAY SLIP)</div>
      <div style="font-size:13px;color:#374151;margin-top:3px">${company?.name || 'FruitBiz'}</div>
      ${company?.address ? `<div style="font-size:11px;color:#6b7280">${company.address}</div>` : ''}
      ${company?.phone ? `<div style="font-size:11px;color:#6b7280">โทร. ${company.phone}</div>` : ''}
    </div>
    <div style="text-align:right;background:#f8f9ff;border:1px solid #e0e7ff;border-radius:10px;padding:12px 16px">
      <div style="font-size:11px;color:#6b7280">ประจำงวด</div>
      <div style="font-size:16px;font-weight:700;color:#111827">${slip.period || '-'}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">วันที่จ่าย</div>
      <div style="font-size:13px;font-weight:600;color:#6366f1">${slip.pay_date?.slice(0, 10) || '-'}</div>
    </div>
  </div>

  <!-- Employee info -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;background:#f9fafb;border-radius:10px;padding:14px">
    <div>
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">ชื่อสกุลพนักงาน</div>
      <div style="font-size:15px;font-weight:700;color:#111827">${slip.employee_name}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">แผนก</div>
      <div style="font-size:14px;font-weight:600;color:#374151">${slip.department || '-'}</div>
    </div>
  </div>

  <!-- Income / Deductions -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <!-- Income -->
    <div>
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #6366f1">รายได้ (Income)</div>
      <table style="width:100%;border-collapse:collapse">
        ${row('เงินเดือนค่าจ้าง', slip.salary, 1, 'income')}
        ${row('ค่าครองชีพ', slip.cost_of_living, 2, 'income')}
        ${row('ค่าตำแหน่ง', slip.position_allow, 3, 'income')}
        ${row('ค่าอาหาร', slip.meal_allow, 4, 'income')}
        ${row('ค่าล่วงเวลา', slip.overtime, 5, 'income')}
        ${row('ค่ากะ', slip.shift_allow, 6, 'income')}
        ${row('ค่าเดินทาง', slip.travel_allow, 7, 'income')}
        ${row('เงินอุดหนุน', slip.subsidy, 8, 'income')}
        ${row('เงินสวัสดิการ', slip.welfare, 9, 'income')}
        ${row('เงินโบนัส', slip.bonus, 10, 'income')}
        <tr style="background:#eef2ff">
          <td colspan="2" style="padding:7px 6px;font-size:12px;font-weight:700;color:#4f46e5">รวมเงินได้</td>
          <td style="padding:7px 8px;font-size:13px;font-weight:700;color:#4f46e5;text-align:right">${fmtN(slip.total_income)}</td>
        </tr>
      </table>
    </div>
    <!-- Deductions -->
    <div>
      <div style="font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #ef4444">รายการหัก (Deduction)</div>
      <table style="width:100%;border-collapse:collapse">
        ${row('ภาษีหัก ณ ที่จ่าย', slip.tax_withheld, 11, 'deduct')}
        ${row('ประกันสังคม', slip.social_security, 12, 'deduct')}
        ${row('หักมาทำงานสาย', slip.late_deduct, 13, 'deduct')}
        ${row('หักขาดงาน', slip.absent_deduct, 14, 'deduct')}
        ${row('หักเงินกู้', slip.loan_deduct, 15, 'deduct')}
        ${row('หักเบิกล่วงหน้า', slip.advance_deduct, 16, 'deduct')}
        ${row('อื่นๆ', slip.other_deduct, 17, 'deduct')}
        <tr style="background:#fff1f1">
          <td colspan="2" style="padding:7px 6px;font-size:12px;font-weight:700;color:#dc2626">รวมเงินหัก</td>
          <td style="padding:7px 8px;font-size:13px;font-weight:700;color:#dc2626;text-align:right">${fmtN(slip.total_deductions)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Net Income -->
  <div style="background:linear-gradient(135deg,#065f46,#10b981);border-radius:10px;padding:14px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:15px;font-weight:700;color:#fff">เงินได้สุทธิ (Net Income)</span>
    <span style="font-size:22px;font-weight:700;color:#fff">฿${fmtN(slip.net_income)}</span>
  </div>

  <!-- Cumulative -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px">
    ${[
      ['เงินได้สะสม', slip.cum_income],
      ['ภาษีสะสม', slip.cum_tax],
      ['ประกันสังคมสะสม', slip.cum_social_sec],
      ['กองทุนสำรองเลี้ยงชีพสะสม', slip.cum_provident],
    ].map(([lbl, val]) => `<div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">${lbl}</div>
      <div style="font-size:13px;font-weight:600;color:#374151">฿${fmtN(val as number)}</div>
    </div>`).join('')}
  </div>

  <!-- Signature -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:24px">
    <div style="text-align:center">
      <div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px">
        <div style="font-size:12px;color:#6b7280">ลงชื่อผู้รับเงิน / Recipient Signature</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${slip.employee_name}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px">วันที่ / Date ................................</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="border-top:1px solid #d1d5db;padding-top:8px;margin-top:48px">
        <div style="font-size:12px;color:#6b7280">ผู้จ่ายเงิน / Authorized Signature</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${company?.name || ''}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px">วันที่ / Date ................................</div>
      </div>
    </div>
  </div>
  ${slip.notes ? `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px"><div style="font-size:10px;font-weight:600;color:#92400e;margin-bottom:3px">หมายเหตุ</div><div style="font-size:12px;color:#78350f">${slip.notes}</div></div>` : ''}
</div></body></html>`
}
