import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import Btn from '../ui/Btn'
import { TextField, TextAreaField } from '../ui/Field'
import { useToast, useActiveCompany } from '../App'
import { getSettings, updateSettings } from '../api'
import type { Settings } from '../types'

type ElectronAPI = {
  exportData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  importData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
}
const eAPI = () => (window as unknown as { electronAPI?: ElectronAPI }).electronAPI

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-content1 border border-content3 rounded-xl p-5 ${className}`}>
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
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

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

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await eAPI()?.exportData()
      if (res?.success) toast(t('toast_export_done'))
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
    setExporting(false)
  }

  const handleImport = async () => {
    if (!window.confirm(t('confirm_import'))) return
    setImporting(true)
    try {
      const res = await eAPI()?.importData()
      if (res?.success) toast(t('toast_import_done'))
      else if (!res?.canceled) toast(t('toast_import_err'), 'err')
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
    setImporting(false)
  }

  const save = async () => {
    try {
      await updateSettings({ name: fName, tax_id: fTax || null, phone: fPhone || null, email: fEmail || null, website: fWebsite || null, address: fAddress || null })
      toast(t('toast_biz_saved'))
      reload()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-default-500">{t('loading')}</div>

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>
      {/* Business Info */}
      <SectionCard>
        <SectionTitle>{t('settings_biz_info')}</SectionTitle>
        <div className="flex flex-col gap-4">
          <TextField label={t('lbl_biz_name')} value={fName} onChange={e => setFName(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label={t('col_tax_id')} value={fTax} onChange={e => setFTax(e.target.value)} />
            <TextField label={t('col_phone')} value={fPhone} onChange={e => setFPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField type="email" label={t('col_email')} value={fEmail} onChange={e => setFEmail(e.target.value)} />
            <TextField label={t('lbl_website')} value={fWebsite} onChange={e => setFWebsite(e.target.value)} />
          </div>
          <TextAreaField label={t('lbl_address')} value={fAddress} onChange={e => setFAddress(e.target.value)} />
          <div>
            <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
          </div>
        </div>
      </SectionCard>

      {/* Right column */}
      <div className="flex flex-col gap-4">
        {/* API Info */}
        <SectionCard>
          <SectionTitle>{t('settings_api_title')}</SectionTitle>
          <div className="flex flex-col gap-2 text-[13px] text-default-500">
            <div className="flex items-center gap-2">
              <span>Endpoint:</span>
              <code className="text-primary bg-primary/10 px-2 py-0.5 rounded-md text-[12px]">http://localhost:3737</code>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span>MCP:</span>
              <code className="text-success bg-success/10 px-2 py-0.5 rounded-md text-[12px]">node dist/mcp.js</code>
            </div>
          </div>
        </SectionCard>

        {/* Claude tips */}
        <SectionCard>
          <SectionTitle>{t('settings_claude_title')}</SectionTitle>
          <div className="text-[12px] text-default-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('claude_tips') }} />
        </SectionCard>

        {/* Data Backup */}
        <SectionCard>
          <SectionTitle>{t('settings_data_title')}</SectionTitle>
          <p className="text-[11px] text-default-400 mb-4 leading-relaxed">
            ส่งออก / นำเข้าข้อมูลทั้งหมด เพื่อย้ายข้อมูลระหว่างเครื่อง
          </p>
          <div className="flex flex-col gap-3">
            {/* Import drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (!importing) handleImport() }}
              onKeyDown={e => e.key === 'Enter' && !importing && handleImport()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); if (!importing) handleImport() }}
              className={`border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-content4 hover:border-primary hover:bg-primary/5'}`}
            >
              <svg className="w-7 h-7 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-[13px] font-semibold text-primary">
                {importing ? '...' : t('btn_import_data')}
              </span>
              <span className="text-[11px] text-default-400">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
            </div>
            {/* Export action */}
            <Btn variant="success" className="w-full justify-center" onClick={handleExport} disabled={exporting} isLoading={exporting}
              startContent={!exporting ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              ) : undefined}>
              {t('btn_export_data')}
            </Btn>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
