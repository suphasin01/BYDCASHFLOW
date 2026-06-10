import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import { getSettings, updateSettings } from '../api'
import type { Settings } from '../types'

type ElectronAPI = {
  exportData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  importData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
}
const eAPI = () => (window as unknown as { electronAPI?: ElectronAPI }).electronAPI

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

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
      {/* Business Info */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{t('settings_biz_info')}</div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('lbl_biz_name')}</label>
          <input value={fName} onChange={e => setFName(e.target.value)} style={inputStyle} />
        </div>
        <div style={formRowStyle}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('col_tax_id')}</label>
            <input value={fTax} onChange={e => setFTax(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('col_phone')}</label>
            <input value={fPhone} onChange={e => setFPhone(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={formRowStyle}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('col_email')}</label>
            <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('lbl_website')}</label>
            <input value={fWebsite} onChange={e => setFWebsite(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('lbl_address')}</label>
          <textarea value={fAddress} onChange={e => setFAddress(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
        </div>
        <button onClick={save} style={btnPrimaryStyle}>{t('btn_save')}</button>
      </div>

      {/* Sidebar info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t('settings_api_title')}</div>
          <div style={{ fontSize: 13, color: '#8892a4', lineHeight: 1.8 }}>
            <div>Endpoint: <code style={{ color: '#7c6df3', background: 'rgba(124,109,243,0.1)', padding: '2px 6px', borderRadius: 4 }}>http://localhost:3737</code></div>
            <div style={{ marginTop: 8 }}>MCP: <code style={{ color: '#22d3a0', background: 'rgba(34,211,160,0.1)', padding: '2px 6px', borderRadius: 4 }}>node dist/mcp.js</code></div>
          </div>
        </div>
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t('settings_claude_title')}</div>
          <div style={{ fontSize: 12, color: '#8892a4', lineHeight: 1.9 }} dangerouslySetInnerHTML={{ __html: t('claude_tips') }} />
        </div>

        {/* Data Backup */}
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('settings_data_title')}</div>
          <div style={{ fontSize: 11, color: '#6b7685', marginBottom: 14, lineHeight: 1.6 }}>
            ส่งออก / นำเข้าข้อมูลทั้งหมด เพื่อย้ายข้อมูลระหว่างเครื่อง
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Import drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (!importing) handleImport() }}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); if (!importing) handleImport() }}
              className={`border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-content4 hover:border-primary hover:bg-primary/5'}`}
            >
              <span style={{ fontSize: 26 }}>📥</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>
                {importing ? '...' : t('btn_import_data')}
              </span>
              <span style={{ fontSize: 11, color: '#6b7685' }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
            </div>
            {/* Export action */}
            <Button color="success" variant="flat" onClick={handleExport} isDisabled={exporting} isLoading={exporting}
              startContent={!exporting ? <span style={{ fontSize: 15 }}>📤</span> : undefined}>
              {t('btn_export_data')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#f0f4ff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }
const formRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
