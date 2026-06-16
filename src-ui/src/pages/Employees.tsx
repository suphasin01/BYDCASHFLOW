import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardBody, Spinner } from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeePayments, createEmployeePayment, deleteEmployeePayment,
  createPaySlip, createEvidence,
} from '../api'
import type { Employee, EmployeePayment } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import IconBtn from '../ui/IconBtn'
import { Users, Wallet, History, CheckCircle2, Camera, Pencil, Trash2 } from 'lucide-react'
import { today } from '../utils'

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const curPeriod = () => today().slice(0, 7) // YYYY-MM

type Method = 'cash' | 'transfer' | 'cheque' | 'credit_card'

const ZERO: Partial<Employee> = {
  employee_no: '', name: '', nickname: '', department: '', position: '',
  start_date: '', salary: 0, phone: '', email: '',
  id_card: '', bank_name: '', bank_account: '', photo_url: '', notes: '',
}

export default function Employees() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeCompany } = useActiveCompany()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payments, setPayments] = useState<EmployeePayment[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<Partial<Employee>>(ZERO)

  // Salary payment modal
  const [payEmp, setPayEmp] = useState<Employee | null>(null)
  const [pPeriod, setPPeriod] = useState(curPeriod())
  const [pAmount, setPAmount] = useState(0)
  const [pDate, setPDate] = useState(today())
  const [pMethod, setPMethod] = useState<Method>('transfer')
  const [pNotes, setPNotes] = useState('')
  const [pImage, setPImage] = useState<string | null>(null)
  const payImageRef = useRef<HTMLInputElement>(null)

  // History modal
  const [histEmp, setHistEmp] = useState<Employee | null>(null)

  const METHODS: Record<string, string> = {
    cash: t('method_cash'), transfer: t('method_transfer'), cheque: t('method_cheque'), credit_card: t('method_credit_card'),
  }

  const set = (k: keyof Employee, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast(t('toast_logo_too_large'), 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => set('photo_url', ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const [{ data: emps }, { data: pays }] = await Promise.all([
        getEmployees(q ?? search), getEmployeePayments(),
      ])
      setEmployees(emps); setPayments(pays)
    } catch {}
    setLoading(false)
  }

  // Reload on mount and whenever active company switches
  useEffect(() => { load() }, [activeCompany?.id])

  // Map: employee_id → its payments (most recent first, already sorted by API)
  const paymentsByEmp = useMemo(() => {
    const m = new Map<number, EmployeePayment[]>()
    for (const p of payments) {
      if (!m.has(p.employee_id)) m.set(p.employee_id, [])
      m.get(p.employee_id)!.push(p)
    }
    return m
  }, [payments])

  const isPaidThisMonth = (empId: number) =>
    (paymentsByEmp.get(empId) || []).some(p => p.period === curPeriod())

  const openCreate = () => { setEditing(null); setForm(ZERO); setModal(true) }
  const openEdit = (e: Employee) => { setEditing(e); setForm({ ...e }); setModal(true) }

  const save = async () => {
    if (!form.name?.trim()) { toast('กรุณากรอกชื่อพนักงาน', 'err'); return }
    if (form.id_card && form.id_card.length !== 13) { toast(t('emp_id_card_invalid'), 'err'); return }
    try {
      if (editing) { await updateEmployee(editing.id, form); toast(t('toast_emp_edited')) }
      else { await createEmployee(form); toast(t('toast_emp_added')) }
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_emp'))) return
    try { await deleteEmployee(id); toast(t('toast_emp_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  // ── Salary payment ───────────────────────────────────────────────────────────
  const payImageHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 5MB', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setPImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const openPay = (e: Employee) => {
    setPayEmp(e)
    setPPeriod(curPeriod()); setPAmount(e.salary || 0); setPDate(today()); setPMethod('transfer'); setPNotes(''); setPImage(null)
  }

  const savePay = async () => {
    if (!payEmp) return
    try {
      await createEmployeePayment({ employee_id: payEmp.id, period: pPeriod, amount: pAmount, pay_date: pDate, method: pMethod, notes: pNotes || null, receipt_image: pImage || null })
      // Auto-create a pay slip record so it appears in the Pay Slips page
      try {
        await createPaySlip({
          employee_name: payEmp.name,
          contact_id: null,
          department: payEmp.department || null,
          period: pPeriod,
          pay_date: pDate,
          salary: pAmount,
          cost_of_living: 0, position_allow: 0, meal_allow: 0, overtime: 0,
          shift_allow: 0, travel_allow: 0, subsidy: 0, welfare: 0, bonus: 0,
          total_income: pAmount,
          tax_withheld: 0, social_security: 0, late_deduct: 0, absent_deduct: 0,
          loan_deduct: 0, advance_deduct: 0, other_deduct: 0,
          total_deductions: 0, net_income: pAmount,
          cum_income: 0, cum_tax: 0, cum_social_sec: 0, cum_provident: 0,
          notes: pNotes || null,
          receipt_image: pImage || null,
        })
      } catch {} // don't block if pay slip creation fails
      // Auto-create Evidence record if image was attached
      if (pImage) {
        try {
          await createEvidence({
            title: `จ่ายเงินเดือน - ${payEmp.name}${pPeriod ? ` (${pPeriod})` : ''}`,
            category: 'bank_slip',
            amount: pAmount,
            doc_date: pDate,
            contact_name: payEmp.name,
            image_url: pImage,
            notes: pNotes || null,
          })
        } catch {}
      }
      toast(t('toast_emp_paid'))
      setPayEmp(null); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const deletePay = async (id: number) => {
    if (!confirm(t('confirm_delete_emp_pay'))) return
    try { await deleteEmployeePayment(id); toast(t('toast_emp_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const histList = histEmp ? (paymentsByEmp.get(histEmp.id) || []) : []

  // Limit ID card input to 13 digits, numbers only
  const onIdCard = (v: string) => set('id_card', v.replace(/\D/g, '').slice(0, 13))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <TextField
          className="w-full sm:max-w-[280px]"
          placeholder={t('emp_search')}
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value) }}
        />
        <Btn variant="primary" onClick={openCreate} className="w-full sm:w-auto"
          startContent={<Users size={15} strokeWidth={2} />}>{t('emp_btn_add')}</Btn>
      </div>

      {/* Count summary */}
      {!loading && employees.length > 0 && (
        <div className="flex items-center gap-2 text-[12px] text-default-400 -mt-1">
          <Users size={13} strokeWidth={2} className="text-primary/70" />
          <span>{employees.length} {t('emp_title')}</span>
          <span className="text-content3">·</span>
          <CheckCircle2 size={13} strokeWidth={2} className="text-success/80" />
          <span>{employees.filter(e => isPaidThisMonth(e.id)).length} {t('emp_pay_status_paid')}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : employees.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center py-12 gap-3 text-default-400">
            <Users size={40} strokeWidth={1.2} />
            <p>{t('emp_no_data')}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 stagger">
          {employees.map(emp => {
            const paid = isPaidThisMonth(emp.id)
            return (
              <div key={emp.id}
                className="group card-lift sheen relative rounded-2xl border border-content3 bg-content1 overflow-hidden hover:border-primary/40">
                {/* Status accent bar */}
                <div className={`absolute inset-x-0 top-0 h-[3px] ${paid
                  ? 'bg-gradient-to-r from-success/40 via-success to-success/40'
                  : 'bg-gradient-to-r from-warning/30 via-warning to-warning/40'}`} />

                <div className="p-3.5 flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.name}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-content3 group-hover:ring-primary/40 transition-all duration-300" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-[15px] font-bold text-white bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] ring-2 ring-white/10 group-hover:scale-105 transition-transform duration-300">
                        {emp.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-semibold truncate">{emp.name}</span>
                        {emp.nickname && <span className="text-[10.5px] text-default-400 flex-shrink-0">({emp.nickname})</span>}
                      </div>
                      <div className="text-[10.5px] text-default-500 truncate mt-0.5 flex items-center gap-1.5">
                        {emp.employee_no && <span className="text-primary/70 font-semibold">#{emp.employee_no}</span>}
                        {(emp.position || emp.department) && (
                          <span className="truncate">{[emp.position, emp.department].filter(Boolean).join(' · ')}</span>
                        )}
                      </div>
                    </div>
                    {/* Status pill */}
                    {paid ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-success bg-success/10 border border-success/25 rounded-full pl-1.5 pr-2 py-0.5">
                        <CheckCircle2 size={11} strokeWidth={2.5} />{t('emp_pay_status_paid')}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-warning bg-warning/10 border border-warning/25 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />{t('emp_pay_status_unpaid')}
                      </span>
                    )}
                  </div>

                  {/* Footer: salary + actions */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-content3/60">
                    <div className="leading-none">
                      <span className="text-[15px] font-bold text-success">฿{fmt(emp.salary)}</span>
                      <span className="text-[10px] text-default-500"> /เดือน</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {paid ? (
                        <div title={t('emp_pay_this_month')}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-success/10 text-success border border-success/25">
                          <CheckCircle2 size={15} strokeWidth={2} />
                        </div>
                      ) : (
                        <button onClick={() => openPay(emp)} title={t('emp_btn_pay_salary')} aria-label={t('emp_btn_pay_salary')}
                          className="w-8 h-8 flex items-center justify-center rounded-lg btn-3d-primary hover-grow">
                          <Wallet size={15} strokeWidth={2} />
                        </button>
                      )}
                      <IconBtn onClick={() => setHistEmp(emp)} title={t('emp_btn_pay_history')}><History size={14} strokeWidth={2} /></IconBtn>
                      <IconBtn onClick={() => openEdit(emp)} title={t('btn_edit')}><Pencil size={14} strokeWidth={2} /></IconBtn>
                      <IconBtn danger onClick={() => doDelete(emp.id)} title={t('btn_delete')}><Trash2 size={14} strokeWidth={2} /></IconBtn>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Employee form modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `แก้ไขพนักงาน — ${editing.name}` : t('emp_btn_add')}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Btn variant="ghost" onClick={() => setModal(false)}>{t('btn_cancel')}</Btn>
            <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover border border-content3" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-content2 border border-dashed border-content3 flex items-center justify-center text-default-400">
                <Camera size={24} strokeWidth={1.6} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-default-500 uppercase tracking-wide">{t('emp_photo')}</span>
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhoto} />
              <div className="flex items-center gap-2">
                <Btn size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}
                  startContent={<Camera size={13} strokeWidth={2} />}>{t('emp_photo_upload')}</Btn>
                {form.photo_url && (
                  <button onClick={() => set('photo_url', '')} className="text-[11px] text-danger hover:underline cursor-pointer">{t('emp_photo_remove')}</button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t('emp_no')} value={form.employee_no || ''} onChange={e => set('employee_no', e.target.value)} placeholder="EMP001" />
            <div className="col-span-2">
              <TextField label={t('emp_name')} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="ชื่อ นามสกุล" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t('emp_nickname')} value={form.nickname || ''} onChange={e => set('nickname', e.target.value)} />
            <TextField label={t('emp_dept')} value={form.department || ''} onChange={e => set('department', e.target.value)} />
            <TextField label={t('emp_position')} value={form.position || ''} onChange={e => set('position', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_start_date')} type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            <TextField label={t('emp_salary')} type="number" value={String(form.salary ?? 0)} onChange={e => set('salary', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_phone')} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            <TextField label={t('emp_email')} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
          </div>
          {/* บัตรประชาชน — 13 หลักเท่านั้น */}
          <div>
            <TextField label={t('emp_id_card')} value={form.id_card || ''} onChange={e => onIdCard(e.target.value)}
              inputMode="numeric" placeholder="X XXXX XXXXX XX X" />
            {form.id_card && form.id_card.length > 0 && form.id_card.length < 13 && (
              <div className="text-[11px] text-warning mt-1">{form.id_card.length}/13</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_bank_name')} value={form.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="กสิกรไทย, SCB, ..." />
            <TextField label={t('emp_bank_account')} value={form.bank_account || ''} onChange={e => set('bank_account', e.target.value)} />
          </div>
          <TextAreaField label={t('emp_notes')} value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>
      </Modal>

      {/* Salary payment modal */}
      <Modal open={!!payEmp} onClose={() => setPayEmp(null)} size="md"
        title={`${t('emp_pay_title')} — ${payEmp?.name || ''}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setPayEmp(null)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={savePay}>{t('btn_save')}</Btn>
        </>}>
        {payEmp && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t('emp_pay_period')} type="month" value={pPeriod} onChange={e => setPPeriod(e.target.value)} />
              <TextField label={t('emp_pay_amount')} type="number" value={pAmount === 0 ? '' : String(pAmount)} onChange={e => setPAmount(e.target.value === '' ? 0 : Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t('emp_pay_date')} type="date" value={pDate} onChange={e => setPDate(e.target.value)} />
              <div>
                <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('emp_pay_method')}</label>
                <select value={pMethod} onChange={e => setPMethod(e.target.value as Method)}
                  className="w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]">
                  <option value="transfer">{t('method_transfer')}</option>
                  <option value="cash">{t('method_cash')}</option>
                  <option value="cheque">{t('method_cheque')}</option>
                  <option value="credit_card">{t('method_credit_card')}</option>
                </select>
              </div>
            </div>
            <TextAreaField label={t('emp_notes')} value={pNotes} onChange={e => setPNotes(e.target.value)} rows={2} />
            {/* Receipt image */}
            <div>
              <div className="text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('emp_pay_receipt')}</div>
              <input type="file" ref={payImageRef} accept="image/*" className="hidden" onChange={payImageHandler} />
              {pImage ? (
                <div className="relative rounded-xl overflow-hidden border border-content3 bg-content2">
                  <img src={pImage} alt="receipt" className="w-full max-h-48 object-contain" />
                  <button onClick={() => setPImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-danger/80 text-white text-[13px] cursor-pointer hover:bg-danger transition-colors">✕</button>
                </div>
              ) : (
                <button onClick={() => payImageRef.current?.click()}
                  className="w-full border-2 border-dashed border-content3 rounded-xl py-5 flex flex-col items-center gap-2 text-default-400 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                  <Camera size={20} strokeWidth={1.6} />
                  <span className="text-[12px]">{t('emp_pay_receipt_add')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Salary history modal */}
      <Modal open={!!histEmp} onClose={() => setHistEmp(null)} size="lg"
        title={`${t('emp_pay_history_title')} — ${histEmp?.name || ''}`}
        footer={<Btn variant="ghost" onClick={() => setHistEmp(null)}>{t('btn_close')}</Btn>}>
        {histList.length === 0 ? (
          <div className="py-8 text-center text-default-500">{t('emp_pay_no_history')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {histList.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-content2 rounded-lg px-3.5 py-2.5">
                <div>
                  <div className="text-[13px] font-semibold text-success">฿{fmt(p.amount)}</div>
                  <div className="text-[11px] text-default-500 mt-0.5">
                    {p.period ? `${p.period} · ` : ''}{p.pay_date} · {METHODS[p.method] || p.method}
                  </div>
                  {p.notes && <div className="text-[11px] text-default-400 mt-0.5">{p.notes}</div>}
                  {p.receipt_image && (
                    <img src={p.receipt_image} alt="receipt" className="mt-2 max-h-32 rounded-lg border border-content3 object-contain" />
                  )}
                </div>
                <Btn size="sm" variant="danger" onClick={() => deletePay(p.id)}>{t('btn_delete')}</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
