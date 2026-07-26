import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import Btn from '../ui/Btn'
import { TextField, TextAreaField } from '../ui/Field'
import { useToast, useActiveCompany } from '../App'
import { getSettings, updateSettings } from '../api'
import type { Settings } from '../types'

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glow-hover bg-content1 border border-content3 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold mb-4">{children}</div>
}

export default function Settings() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { reload } = useActiveCompany()
  const [loading, setLoading] = useState(true)

  const [fName, setFName] = useState('')
  const [fTax, setFTax] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fWebsite, setFWebsite] = useState('')
  const [fAddress, setFAddress] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const biz = await getSettings()
        setFName(biz?.name || '')
        setFTax(biz?.tax_id || '')
        setFPhone(biz?.phone || '')
        setFEmail(biz?.email || '')
        setFWebsite(biz?.website || '')
        setFAddress(biz?.address || '')
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    try {
      await updateSettings({ name: fName, tax_id: fTax || null, phone: fPhone || null, email: fEmail || null, website: fWebsite || null, address: fAddress || null })
      toast(t('toast_biz_saved'))
      reload()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-default-500">{t('loading')}</div>

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Business Info */}
      <SectionCard>
        <SectionTitle>{t('settings_biz_info')}</SectionTitle>
        <div className="flex flex-col gap-4">
          <TextField label={t('lbl_biz_name')} value={fName} onChange={e => setFName(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label={t('col_tax_id')} value={fTax} onChange={e => setFTax(e.target.value)} />
            <TextField label={t('col_phone')} value={fPhone} onChange={e => setFPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField type="email" label={t('col_email')} value={fEmail} onChange={e => setFEmail(e.target.value)} />
            <TextField label={t('lbl_website')} value={fWebsite} onChange={e => setFWebsite(e.target.value)} />
          </div>
          <TextAreaField label={t('lbl_address')} value={fAddress} onChange={e => setFAddress(e.target.value)} />
          <div>
            <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
