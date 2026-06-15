import { useEffect, useMemo, useState } from 'react'
import { Avatar, Card, CardBody, Chip, Spinner } from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeePayments, createEmployeePayment, deleteEmployeePayment,
} from '../api'
import type { Employee, EmployeePayment } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import { Users, Wallet, History, CheckCircle2 } from 'lucide-react'
import { today } from '../utils'

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const curPeriod = () => today().slice(0, 7) // YYYY-MM

type Method = 'cash' | 'transfer' | 'cheque' | 'credit_card'

const ZERO: Partial<Employee> = {
  employee_no: '', name: '', nickname: '', department: '', position: '',
  start_date: '', salary: 0, phone: '', email: '',
  id_card: '', bank_name: '', bank_account: '', notes: '',
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

  // History modal
  const [histEmp, setHistEmp] = useState<Employee | null>(null)

  const METHODS: Record<string, string> = {
    cash: t('method_cash'), transfer: t('method_transfer'), cheque: t('method_cheque'), credit_card: t('method_credit_card'),
  }

  const set = (k: keyof Employee, v: string | number) => setForm(f => ({ ...f, [k]: v }))

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
  const openPay = (e: Employee) => {
    setPayEmp(e)
    setPPeriod(curPeriod()); setPAmount(e.salary || 0); setPDate(today()); setPMethod('transfer'); setPNotes('')
  }

  const savePay = async () => {
    if (!payEmp) return
    try {
      await createEmployeePayment({ employee_id: payEmp.id, period: pPeriod, amount: pAmount, pay_date: pDate, method: pMethod, notes: pNotes || null })
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
      <div className="flex justify-between items-center">
        <TextField
          className="max-w-[280px]"
          placeholder={t('emp_search')}
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value) }}
        />
        <Btn variant="primary" onClick={openCreate}>{t('emp_btn_add')}</Btn>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
          {employees.map(emp => {
            const paid = isPaidThisMonth(emp.id)
            return (
              <Card key={emp.id} className="card-panel card-lift hover:border-primary/30 transition-colors">
                <CardBody className="p-4">
                  <div className="flex gap-3 items-start">
                    <Avatar
                      name={emp.name.slice(0, 2)}
                      radius="md"
                      className="w-10 h-10 flex-shrink-0 text-sm font-bold bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate">{emp.name}</span>
                        {emp.nickname && <span className="text-[11px] text-default-400">({emp.nickname})</span>}
                        <div className="ml-auto">
                          {paid ? (
                            <Chip size="sm" variant="flat" color="success" startContent={<CheckCircle2 size={12} />}>
                              {t('emp_pay_status_paid')} · {t('emp_pay_this_month')}
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat" color="warning">{t('emp_pay_status_unpaid')} · {t('emp_pay_this_month')}</Chip>
                          )}
                        </div>
                      </div>
                      {emp.employee_no && (
                        <div className="text-[11px] text-default-500 mt-0.5">#{emp.employee_no}</div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                        {emp.position && <span className="text-[11px] text-default-500">{emp.position}</span>}
                        {emp.department && <span className="text-[11px] text-primary/70">{emp.department}</span>}
                      </div>
                      {(emp.phone || emp.email) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {emp.phone && <span className="text-[11px] text-default-400">{emp.phone}</span>}
                          {emp.email && <span className="text-[11px] text-default-400 truncate">{emp.email}</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-content3">
                        <span className="text-[12px] font-semibold text-success">{fmt(emp.salary)} ฿/เดือน</span>
                        <div className="flex gap-1.5">
                          <Btn size="sm" variant="primary" onClick={() => openPay(emp)} startContent={<Wallet size={13} strokeWidth={2} />}>{t('emp_btn_pay_salary')}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setHistEmp(emp)} startContent={<History size={13} strokeWidth={2} />}>{t('emp_btn_pay_history')}</Btn>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(emp)}>{t('btn_edit')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => doDelete(emp.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
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
