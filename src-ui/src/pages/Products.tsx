import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api'
import type { Product } from '../types'
import { fmt } from '../utils'

export default function Products() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  // Form
  const [fCode, setFCode] = useState('')
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState(0)
  const [fUnit, setFUnit] = useState('')
  const [fVat, setFVat] = useState<'excluded' | 'included' | 'none'>('excluded')
  const [fCategory, setFCategory] = useState('')
  const [fDescription, setFDescription] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getProducts(q ?? search); setProducts(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setFCode(''); setFName(''); setFPrice(0); setFUnit(''); setFVat('excluded'); setFCategory(''); setFDescription('')
    setModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setFCode(p.code || ''); setFName(p.name); setFPrice(p.price); setFUnit(p.unit || ''); setFVat(p.vat_type); setFCategory(p.category || ''); setFDescription(p.description || '')
    setModal(true)
  }

  const save = async () => {
    try {
      const payload = { code: fCode || null, name: fName, price: fPrice, unit: fUnit || null, vat_type: fVat, category: fCategory || null, description: fDescription || null }
      if (editing) { await updateProduct(editing.id, payload); toast(t('toast_product_edited')) }
      else { await createProduct(payload); toast(t('toast_product_added')) }
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_product'))) return
    try { await deleteProduct(id); toast(t('toast_product_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const vatBadge = (vt: string) => {
    if (vt === 'excluded') return { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', label: t('vat_excluded') }
    if (vt === 'included') return { bg: 'rgba(34,211,160,0.12)', color: '#22d3a0', label: t('vat_included') }
    return { bg: 'rgba(139,148,158,0.12)', color: '#8b949e', label: t('vat_none') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }}
          placeholder={t('search_product')} style={{ ...inputStyle, maxWidth: 280 }} />
        <button onClick={openCreate} style={btnPrimaryStyle}>{t('btn_add_product')}</button>
      </div>

      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[t('col_code'), t('col_product_name'), t('col_price'), t('col_unit'), t('col_vat'), t('col_category'), t('col_actions')].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 6 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8892a4' }}>{t('loading')}</td></tr>
              ) : products.length > 0 ? products.map(p => {
                const vb = vatBadge(p.vat_type)
                return (
                  <tr key={p.id}>
                    <td style={{ ...tdStyle, color: '#8892a4', fontSize: 12 }}>{p.code || '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{p.description}</div>}
                    </td>
                    <td style={tdStyle}><span style={{ color: '#22d3a0', fontWeight: 600 }}>฿{fmt(p.price)}</span></td>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{p.unit || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: vb.bg, color: vb.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: vb.color, display: 'inline-block' }} />
                        {vb.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#8892a4' }}>{p.category || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => openEdit(p)} style={{ ...btnGhostSmStyle, marginRight: 4 }}>{t('btn_edit')}</button>
                      <button onClick={() => doDelete(p.id)} style={btnDangerSmStyle}>{t('btn_delete')}</button>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: '#8892a4' }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>📦</div>
                  <p>{t('no_products')}</p>
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
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{editing ? t('modal_edit_product') : t('modal_new_product')}</h2>
              <button onClick={() => setModal(false)} style={btnGhostSmStyle}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_product_code')}</label>
                  <input value={fCode} onChange={e => setFCode(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_product_name')}</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_price')}</label>
                  <input type="number" value={fPrice === 0 ? '' : fPrice} onChange={e => setFPrice(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('col_unit')}</label>
                  <input value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder={t('lbl_unit_size_ph')} style={inputStyle} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('lbl_vat_type')}</label>
                  <select value={fVat} onChange={e => setFVat(e.target.value as 'excluded' | 'included' | 'none')} style={inputStyle}>
                    <option value="excluded">{t('vat_excluded')}</option>
                    <option value="included">{t('vat_included')}</option>
                    <option value="none">{t('vat_none')}</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('col_category')}</label>
                  <input value={fCategory} onChange={e => setFCategory(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('lbl_description')}</label>
                <textarea value={fDescription} onChange={e => setFDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }} />
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
