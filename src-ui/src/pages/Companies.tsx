import { useEffect, useState, useRef } from 'react'
import {
  Avatar, Card, CardBody, Chip, Spinner,
} from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import { getCompanies, getActiveCompany, createCompany, updateCompany, deleteCompany, activateCompany } from '../api'
import type { Company } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

export default function Companies() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { reload: reloadActive } = useActiveCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [active, setActive] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form
  const [fName, setFName] = useState('')
  const [fTax, setFTax] = useState('')
  const [fBranch, setFBranch] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fWebsite, setFWebsite] = useState('')
  const [fAddress, setFAddress] = useState('')
  const [fNote, setFNote] = useState('')
  const [fLogo, setFLogo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: cs }, ac] = await Promise.all([getCompanies(), getActiveCompany()])
      setCompanies(cs)
      setActive(ac)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setFName(''); setFTax(''); setFBranch(''); setFPhone(''); setFEmail(''); setFWebsite(''); setFAddress(''); setFNote(''); setFLogo('')
    setModal(true)
  }

  const openEdit = (c: Company) => {
    setEditing(c)
    setFName(c.name); setFTax(c.tax_id || ''); setFBranch(c.branch || ''); setFPhone(c.phone || ''); setFEmail(c.email || ''); setFWebsite(c.website || ''); setFAddress(c.address || ''); setFNote(c.note || ''); setFLogo(c.logo_url || '')
    setModal(true)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast(t('toast_logo_too_large'), 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setFLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onTaxChange = (v: string) => setFTax(v.replace(/\D/g, '').slice(0, 13))

  const save = async () => {
    const cleanTax = fTax.replace(/\D/g, '')
    if (cleanTax && cleanTax.length !== 13) { toast(t('err_tax_id_invalid'), 'err'); return }
    try {
      const payload = { name: fName, tax_id: cleanTax || null, branch: fBranch || null, phone: fPhone || null, email: fEmail || null, website: fWebsite || null, address: fAddress || null, note: fNote || null, logo_url: fLogo || null }
      if (editing) { await updateCompany(editing.id, payload); toast(t('toast_company_edited')) }
      else { await createCompany(payload); toast(t('toast_company_added')) }
      setModal(false); load(); reloadActive()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doActivate = async (id: number) => {
    try {
      await activateCompany(id)
      await load()
      reloadActive()
      const c = companies.find(c => c.id === id)
      toast(t('toast_company_changed') + (c?.name || ''))
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_company'))) return
    try { await deleteCompany(id); await load(); reloadActive(); toast(t('toast_company_deleted')) }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Btn variant="primary" onClick={openCreate}>{t('btn_add_company')}</Btn>
      </div>

      <div className="flex flex-col gap-3.5">
        {companies.map(c => {
          const isActive = active?.id === c.id
          return (
            <Card key={c.id} shadow="none"
              className={isActive ? 'bg-primary/5 border border-primary/40' : 'bg-content1 border border-content3'}>
              <CardBody className="flex flex-row items-center gap-4 p-[18px_20px]">
                <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  {c.logo_url
                    ? <img src={c.logo_url} className="w-9 h-9 object-cover" style={{ width: 36, height: 36 }} alt="" />
                    : <span className="text-white font-bold text-[10px]">{(c.name || '').slice(0, 2)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-semibold">{c.name}</span>
                    {isActive && <Chip size="sm" variant="flat" color="secondary">{t('company_active_badge')}</Chip>}
                  </div>
                  <div className="flex gap-4 flex-wrap text-[12px] text-default-500">
                    {c.tax_id && <span>{t('company_tax_prefix')}{c.tax_id}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                    {c.address && <span>📍 {c.address.slice(0, 40)}{c.address.length > 40 ? '...' : ''}</span>}
                    {!c.tax_id && !c.phone && !c.email && <span className="text-default-400">{t('no_extra_info')}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!isActive && <Btn size="sm" variant="success" onClick={() => doActivate(c.id)}>{t('btn_use')}</Btn>}
                  <Btn size="sm" variant="ghost" onClick={() => openEdit(c)}>{t('btn_edit')}</Btn>
                  {companies.length > 1 && <Btn size="sm" variant="danger" onClick={() => doDelete(c.id)}>{t('btn_delete')}</Btn>}
                </div>
              </CardBody>
            </Card>
          )
        })}
        {companies.length === 0 && (
          <div className="py-16 text-center text-default-500">
            <div className="text-4xl mb-3.5 opacity-40">🏢</div>
            <p>{t('no_companies')}</p>
            <p className="mt-1 text-[12px]" dangerouslySetInnerHTML={{ __html: t('no_companies_hint') }} />
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} size="xl"
        title={editing ? t('modal_edit_company') : t('modal_new_company')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal(false)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
                {/* Logo */}
                <div>
                  <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_logo')}</label>
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-content3 overflow-hidden flex-shrink-0 bg-content2">
                      {fLogo
                        ? <img src={fLogo} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', display: 'block' }} />
                        : <div className="w-full h-full flex items-center justify-center"><span className="text-2xl text-default-400">🏢</span></div>}
                    </div>
                    <div className="flex-1">
                      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleLogoChange} />
                      <div className="flex gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>{t('btn_select_logo')}</Btn>
                        {fLogo && <Btn size="sm" variant="danger" onClick={() => setFLogo('')}>{t('btn_remove_logo')}</Btn>}
                      </div>
                      <div className="text-[11px] text-default-500 mt-1.5">{t('logo_hint')}</div>
                    </div>
                  </div>
                </div>

                <TextField label={t('lbl_company_name')}
                  placeholder={t('lbl_company_name_ph')} value={fName} onChange={e => setFName(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <TextField label={t('lbl_tax_number')} inputMode="numeric"
                      placeholder="0000000000000" value={fTax} onChange={e => onTaxChange(e.target.value)} />
                    {fTax.length > 0 && fTax.length < 13 && <div className="text-[11px] text-warning mt-1">{fTax.length}/13 หลัก</div>}
                    {fTax.length === 13 && <div className="text-[11px] text-success mt-1">✓ ครบ 13 หลัก</div>}
                  </div>
                  <TextField label={t('lbl_company_branch')}
                    placeholder={t('lbl_branch_ph')} value={fBranch} onChange={e => setFBranch(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField label={t('lbl_company_phone')}
                    value={fPhone} onChange={e => setFPhone(e.target.value)} />
                  <TextField type="email" label={t('lbl_company_email')}
                    value={fEmail} onChange={e => setFEmail(e.target.value)} />
                </div>
                <TextField label={t('lbl_company_website')}
                  placeholder="https://" value={fWebsite} onChange={e => setFWebsite(e.target.value)} />
                <TextAreaField label={t('lbl_company_address')}
                  value={fAddress} onChange={e => setFAddress(e.target.value)} />
                <TextAreaField label={t('lbl_company_note')}
                  value={fNote} onChange={e => setFNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
