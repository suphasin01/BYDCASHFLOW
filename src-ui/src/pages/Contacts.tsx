import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getContacts, createContact, updateContact, deleteContact } from '../api'
import type { Contact } from '../types'

export default function Contacts() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  // Form
  const [fType, setFType] = useState<'customer' | 'vendor'>('customer')
  const [fName, setFName] = useState('')
  const [fTax, setFTax] = useState('')
  const [fBranch, setFBranch] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fAddress, setFAddress] = useState('')
  const [fNote, setFNote] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getContacts(q || search); setContacts(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setFType('customer'); setFName(''); setFTax(''); setFBranch(''); setFEmail(''); setFPhone(''); setFAddress(''); setFNote('')
    setModal(true)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setFType(c.type); setFName(c.name); setFTax(c.tax_id || ''); setFBranch(c.branch || ''); setFEmail(c.email || ''); setFPhone(c.phone || ''); setFAddress(c.address || ''); setFNote(c.note || '')
    setModal(true)
  }

  const save = async () => {
    try {
      const payload = { type: fType, name: fName, tax_id: fTax || null, branch: fBranch || null, email: fEmail || null, phone: fPhone || null, address: fAddress || null, note: fNote || null }
      if (editing) { await updateContact(editing.id, payload); toast(t('toast_contact_edited')) }
      else { await createContact(payload); toast(t('toast_contact_added')) }
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_contact'))) return
    try { await deleteContact(id); toast(t('toast_contact_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const BADGE: Record<string, { bg: string; color: string }> = {
    customer: { bg: 'rgba(124,109,243,0.12)', color: '#a78bfa' },
    vendor: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }}
          placeholder={t('search_contact')} style={{ ...inputStyle, maxWidth: 280 }} />
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('btn_add_contact')}</button>
      </div>

      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('col_name'), t('lbl_type'), t('col_tax_id'), t('col_email'), t('col_phone'), t('col_actions')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 5 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</td></tr>
              ) : contacts.length > 0 ? contacts.map(c => (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,109,243,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: BADGE[c.type]?.bg, color: BADGE[c.type]?.color }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: BADGE[c.type]?.color, display: 'inline-block' }} />
                      {c.type === 'customer' ? t('contact_customer') : t('contact_vendor')}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{c.tax_id || '—'}</td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{c.email || '—'}</td>
                  <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{c.phone || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => openEdit(c)} style={{ ...btnGhostSmStyle, marginRight: 4 }}>{t('btn_edit')}</button>
                    <button onClick={() => doDelete(c.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>👥</div>
                  <p>{t('no_contacts')}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{editing ? t('modal_edit_contact') : t('modal_new_contact')}</h2>
              <button onClick={() => setModal(false)} style={btnGhostSmStyle}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_type')}</label>
                  <select value={fType} onChange={e => setFType(e.target.value as 'customer' | 'vendor')} style={inputStyle}>
                    <option value="customer">{t('contact_customer')}</option>
                    <option value="vendor">{t('contact_vendor')}</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_name')}</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder={t('lbl_name_ph')} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('col_tax_id')}</label>
                  <input value={fTax} onChange={e => setFTax(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_branch')}</label>
                  <input value={fBranch} onChange={e => setFBranch(e.target.value)} placeholder={t('lbl_branch_ph')} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_email')}</label>
                  <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_phone')}</label>
                  <input value={fPhone} onChange={e => setFPhone(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_address')}</label>
                <textarea value={fAddress} onChange={e => setFAddress(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_note')}</label>
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
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const btnPrimaryStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c6df3,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: '#8892a4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }
const btnGhostSmStyle: React.CSSProperties = { ...btnGhostStyle, padding: '5px 11px', fontSize: 12, borderRadius: 6 }
const btnDangerSmStyle: React.CSSProperties = { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }
