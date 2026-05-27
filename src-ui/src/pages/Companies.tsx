import { useEffect, useState, useRef } from 'react'
import { useI18n } from '../i18n'
import { useToast, useActiveCompany } from '../App'
import { getCompanies, getActiveCompany, createCompany, updateCompany, deleteCompany, activateCompany } from '../api'
import type { Company } from '../types'

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

  const save = async () => {
    try {
      const payload = { name: fName, tax_id: fTax || null, branch: fBranch || null, phone: fPhone || null, email: fEmail || null, website: fWebsite || null, address: fAddress || null, note: fNote || null, logo_url: fLogo || null }
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

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('btn_add_company')}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {companies.map(c => {
          const isActive = active?.id === c.id
          return (
            <div key={c.id} style={{ background: isActive ? 'rgba(124,109,243,0.05)' : '#111827', border: `1px solid ${isActive ? 'rgba(124,109,243,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                {c.logo_url
                  ? <img src={c.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>{(c.name || '').slice(0, 2)}</div>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                  {isActive && <span style={{ background: 'rgba(124,109,243,0.2)', color: '#a78bfa', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, letterSpacing: '.3px' }}>{t('company_active_badge')}</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {c.tax_id && <span style={{ fontSize: 12, color: '#8892a4' }}>{t('company_tax_prefix')}{c.tax_id}</span>}
                  {c.phone && <span style={{ fontSize: 12, color: '#8892a4' }}>📞 {c.phone}</span>}
                  {c.email && <span style={{ fontSize: 12, color: '#8892a4' }}>✉️ {c.email}</span>}
                  {c.address && <span style={{ fontSize: 12, color: '#8892a4' }}>📍 {c.address.slice(0, 40)}{c.address.length > 40 ? '...' : ''}</span>}
                  {!c.tax_id && !c.phone && !c.email && <span style={{ fontSize: 12, color: '#6b7685' }}>{t('no_extra_info')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!isActive && <button onClick={() => doActivate(c.id)} style={btnSuccessSmStyle}>{t('btn_use')}</button>}
                <button onClick={() => openEdit(c)} style={btnGhostSmStyle}>{t('btn_edit')}</button>
                {companies.length > 1 && <button onClick={() => doDelete(c.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>}
              </div>
            </div>
          )
        })}
        {companies.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
            <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>🏢</div>
            <p>{t('no_companies')}</p>
            <p style={{ marginTop: 4, fontSize: 12 }} dangerouslySetInnerHTML={{ __html: t('no_companies_hint') }} />
          </div>
        )}
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{editing ? t('modal_edit_company') : t('modal_new_company')}</h2>
              <button onClick={() => setModal(false)} style={btnGhostSmStyle}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Logo */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_logo')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 12, border: '2px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.03)' }}>
                    {fLogo ? <img src={fLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24, color: '#6b7685' }}>🏢</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={btnGhostSmStyle}>{t('btn_select_logo')}</button>
                    {fLogo && <button type="button" onClick={() => setFLogo('')} style={{ ...btnDangerSmStyle, marginLeft: 8 }}>{t('btn_remove_logo')}</button>}
                    <div style={{ fontSize: 11, color: '#8892a4', marginTop: 6 }}>{t('logo_hint')}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_company_name')}</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder={t('lbl_company_name_ph')} style={inputStyle} />
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_tax_number')}</label>
                  <input value={fTax} onChange={e => setFTax(e.target.value)} placeholder="0000000000000" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_company_branch')}</label>
                  <input value={fBranch} onChange={e => setFBranch(e.target.value)} placeholder={t('lbl_branch_ph')} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_company_phone')}</label>
                  <input value={fPhone} onChange={e => setFPhone(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_company_email')}</label>
                  <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_company_website')}</label>
                <input value={fWebsite} onChange={e => setFWebsite(e.target.value)} placeholder="https://" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_company_address')}</label>
                <textarea value={fAddress} onChange={e => setFAddress(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_company_note')}</label>
                <textarea value={fNote} onChange={e => setFNote(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(false)} style={btnGhostStyle}>{t('btn_cancel')}</button>
              <button onClick={save} style={btnPrimaryStyle}>{t('btn_save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#f0f4ff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }
const formRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#8892a4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostSmStyle: React.CSSProperties = { ...btnGhostStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnDangerSmStyle: React.CSSProperties = { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
const btnSuccessSmStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#22d3a0,#059669)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
