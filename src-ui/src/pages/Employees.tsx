import { useEffect, useState } from 'react'
import { Avatar, Card, CardBody, Spinner } from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../api'
import type { Employee } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import { Users } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const ZERO: Partial<Employee> = {
  employee_no: '', name: '', nickname: '', department: '', position: '',
  start_date: '', salary: 0, phone: '', email: '',
  id_card: '', bank_name: '', bank_account: '', notes: '',
}

export default function Employees() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<Partial<Employee>>(ZERO)

  const set = (k: keyof Employee, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getEmployees(q ?? search); setEmployees(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(ZERO)
    setModal(true)
  }

  const openEdit = (e: Employee) => {
    setEditing(e)
    setForm({ ...e })
    setModal(true)
  }

  const save = async () => {
    if (!form.name?.trim()) { toast('กรุณากรอกชื่อพนักงาน', 'err'); return }
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {employees.map(emp => (
            <Card key={emp.id} className="card-panel hover:border-primary/30 transition-colors">
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
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(emp)}>{t('btn_edit')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => doDelete(emp.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

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
          {/* Row 1: รหัส + ชื่อ */}
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t('emp_no')} value={form.employee_no || ''} onChange={e => set('employee_no', e.target.value)} placeholder="EMP001" />
            <div className="col-span-2">
              <TextField label={t('emp_name')} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="ชื่อ นามสกุล" />
            </div>
          </div>
          {/* Row 2: ชื่อเล่น + แผนก + ตำแหน่ง */}
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t('emp_nickname')} value={form.nickname || ''} onChange={e => set('nickname', e.target.value)} />
            <TextField label={t('emp_dept')} value={form.department || ''} onChange={e => set('department', e.target.value)} />
            <TextField label={t('emp_position')} value={form.position || ''} onChange={e => set('position', e.target.value)} />
          </div>
          {/* Row 3: วันเริ่มงาน + เงินเดือน */}
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_start_date')} type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            <TextField label={t('emp_salary')} type="number" value={String(form.salary ?? 0)} onChange={e => set('salary', parseFloat(e.target.value) || 0)} />
          </div>
          {/* Row 4: โทรศัพท์ + อีเมล */}
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_phone')} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            <TextField label={t('emp_email')} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
          </div>
          {/* Row 5: บัตรประชาชน */}
          <TextField label={t('emp_id_card')} value={form.id_card || ''} onChange={e => set('id_card', e.target.value)} placeholder="X XXXX XXXXX XX X" />
          {/* Row 6: ธนาคาร + เลขบัญชี */}
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('emp_bank_name')} value={form.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="กสิกรไทย, SCB, ..." />
            <TextField label={t('emp_bank_account')} value={form.bank_account || ''} onChange={e => set('bank_account', e.target.value)} />
          </div>
          {/* หมายเหตุ */}
          <TextAreaField label={t('emp_notes')} value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>
      </Modal>
    </div>
  )
}
