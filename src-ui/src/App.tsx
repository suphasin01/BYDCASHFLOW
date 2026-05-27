import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { I18nContext, useI18nState, type Lang } from './i18n'
import type { Company } from './types'
import { getHealth, getActiveCompany, activateCompany as apiActivateCompany, getCompanies } from './api'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import Contacts from './pages/Contacts'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Companies from './pages/Companies'
import Settings from './pages/Settings'

// ─── Toast ───────────────────────────────────────────────────────────────────
export type ToastItem = { id: number; msg: string; type: 'ok' | 'err' }
type ToastCtxType = { toast: (msg: string, type?: 'ok' | 'err') => void }
export const ToastContext = createContext<ToastCtxType>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

// ─── Active Company ──────────────────────────────────────────────────────────
type CompanyCtxType = { activeCompany: Company | null; reload: () => void }
export const CompanyContext = createContext<CompanyCtxType>({ activeCompany: null, reload: () => {} })
export const useActiveCompany = () => useContext(CompanyContext)

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'companies' | 'settings'

const NAV_ITEMS: { page: Page; icon: string; key: string }[] = [
  { page: 'dashboard', icon: '🏠', key: 'nav_dashboard' },
  { page: 'documents', icon: '📄', key: 'nav_documents' },
  { page: 'payments', icon: '💳', key: 'nav_payments' },
  { page: 'contacts', icon: '👥', key: 'nav_contacts' },
  { page: 'products', icon: '📦', key: 'nav_products' },
  { page: 'reports', icon: '📈', key: 'nav_reports' },
  { page: 'companies', icon: '🏢', key: 'nav_companies' },
  { page: 'settings', icon: '⚙️', key: 'nav_settings' },
]

export default function App() {
  const i18n = useI18nState()
  const { lang, t, switchLang } = i18n

  const [page, setPage] = useState<Page>('dashboard')
  const [apiOnline, setApiOnline] = useState(false)
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false)
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [updateBanner, setUpdateBanner] = useState<{ type: 'downloading' | 'ready'; version: string } | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { getVersion: () => Promise<string> } }).electronAPI
    api?.getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])

  const toast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { onUpdateStatus: (cb: (d: { type: 'downloading' | 'ready'; version: string }) => void) => void; onUpdateNotAvailable: (cb: () => void) => void } }).electronAPI
    api?.onUpdateStatus(data => { setUpdateBanner(data); setCheckingUpdate(false) })
    api?.onUpdateNotAvailable(() => { setCheckingUpdate(false); toast(t('toast_up_to_date')) })
  }, [t, toast])

  const checkForUpdates = () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    const api = (window as unknown as { electronAPI?: { checkForUpdates: () => void } }).electronAPI
    api?.checkForUpdates()
    setTimeout(() => setCheckingUpdate(false), 15000)
  }

  const installUpdate = () => {
    const api = (window as unknown as { electronAPI?: { installUpdate: () => void } }).electronAPI
    api?.installUpdate()
  }

  const quitApp = () => {
    const api = (window as unknown as { electronAPI?: { quitApp: () => void } }).electronAPI
    api?.quitApp()
  }

  const reloadCompany = useCallback(async () => {
    try { setActiveCompany(await getActiveCompany()) } catch {}
  }, [])

  const checkStatus = useCallback(async () => {
    try { await getHealth(); setApiOnline(true) } catch { setApiOnline(false) }
  }, [])

  useEffect(() => {
    checkStatus()
    reloadCompany()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [checkStatus, reloadCompany])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
    document.body.className = lang === 'zh' ? 'lang-zh' : ''
  }, [lang])

  const openCompanySwitcher = async () => {
    try {
      const { data } = await getCompanies()
      setAllCompanies(data)
      setShowCompanySwitcher(true)
    } catch {}
  }

  const handleSwitchCompany = async (id: number) => {
    try {
      await apiActivateCompany(id)
      await reloadCompany()
      setShowCompanySwitcher(false)
      const c = allCompanies.find(c => c.id === id)
      toast(t('toast_company_changed') + (c?.name || ''))
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'err')
    }
  }

  const navigate = (p: Page) => setPage(p)

  const pageComponent = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />
      case 'documents': return <Documents />
      case 'payments': return <Payments />
      case 'contacts': return <Contacts />
      case 'products': return <Products />
      case 'reports': return <Reports />
      case 'companies': return <Companies />
      case 'settings': return <Settings />
    }
  }

  const topbarActions: Record<Page, React.ReactNode> = {
    dashboard: null,
    documents: null,
    payments: null,
    contacts: null,
    products: null,
    reports: null,
    companies: null,
    settings: null,
  }

  const avatarEl = activeCompany?.logo_url
    ? <img src={activeCompany.logo_url} className="w-full h-full object-contain rounded-lg" />
    : <span className="text-xs font-bold text-white">{(activeCompany?.name || 'บ').slice(0, 2)}</span>

  const navSections = [
    { label: t('nav_sec_main'), items: ['dashboard', 'documents', 'payments'] },
    { label: t('nav_sec_data'), items: ['contacts', 'products'] },
    { label: t('nav_sec_analyze'), items: ['reports'] },
    { label: '', items: ['companies', 'settings'] },
  ]

  return (
    <I18nContext.Provider value={i18n}>
      <ToastContext.Provider value={{ toast }}>
        <CompanyContext.Provider value={{ activeCompany, reload: reloadCompany }}>
          <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 14 }}>
            {/* Sidebar */}
            <aside style={{ width: 240, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Logo */}
              <div style={{ padding: '20px 20px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#7c6df3,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💼</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>FruitBiz</div>
                  <div style={{ fontSize: 10, color: '#8892a4', marginTop: 1 }}>{t('app_subtitle')}</div>
                </div>
              </div>

              {/* Navigation */}
              <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {navSections.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7685', letterSpacing: '.8px', textTransform: 'uppercase', padding: '12px 12px 4px', marginTop: 4 }}>
                        {section.label}
                      </div>
                    )}
                    {section.items.map(p => {
                      const item = NAV_ITEMS.find(n => n.page === p)!
                      const active = page === p
                      return (
                        <a key={p} onClick={() => setPage(p as Page)}
                          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, color: active ? '#a78bfa' : '#8892a4', textDecoration: 'none', cursor: 'pointer', transition: 'all .18s', fontSize: 13, fontWeight: 500, background: active ? 'rgba(124,109,243,0.15)' : 'transparent' }}>
                          <span style={{ fontSize: 17, opacity: active ? 1 : 0.8, flexShrink: 0 }}>{item.icon}</span>
                          <span>{t(item.key)}</span>
                        </a>
                      )
                    })}
                  </div>
                ))}
              </nav>

              {/* Company Switcher */}
              <div onClick={openCompanySwitcher} style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: activeCompany?.logo_url ? '#fff' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, padding: activeCompany?.logo_url ? 2 : 0, overflow: 'hidden' }}>
                    {avatarEl}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeCompany?.name || t('loading')}</div>
                    <div style={{ fontSize: 10, color: '#8892a4', marginTop: 1 }}>{t('company_click')}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7685' }}>▼</div>
                </div>
              </div>

              {/* Exit Button */}
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                <button onClick={quitApp}
                  style={{ width: '100%', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 8, cursor: 'pointer', padding: '8px 12px', color: '#f87171', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .15s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.15)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.07)')}>
                  <span style={{ fontSize: 14 }}>🚪</span>
                  <span>{t('btn_exit_app')}</span>
                </button>
              </div>

              {/* Status */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2235', borderRadius: 99, padding: '5px 10px', fontSize: 11, color: '#8892a4', flex: 1 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: apiOnline ? '#22d3a0' : '#f87171', flexShrink: 0, boxShadow: apiOnline ? '0 0 8px rgba(34,211,160,0.6)' : '0 0 8px rgba(248,113,113,0.5)', display: 'inline-block' }} />
                  <span>{apiOnline ? t('status_connected') : t('status_disconnected')}</span>
                </div>
                {appVersion && <span style={{ fontSize: 10, color: '#4a5568', flexShrink: 0, letterSpacing: '0.3px' }}>v{appVersion}</span>}
              </div>
            </aside>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Topbar */}
              <div style={{ height: 60, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', flexShrink: 0 }}>
                <h1 style={{ fontSize: 15, fontWeight: 600 }}>{t(NAV_ITEMS.find(n => n.page === page)?.key || 'nav_dashboard')}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Check for Updates */}
                  <button onClick={checkForUpdates} disabled={checkingUpdate}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, cursor: checkingUpdate ? 'default' : 'pointer', padding: '6px 10px', fontSize: 13, lineHeight: 1, color: 'var(--text-secondary)', fontFamily: 'inherit', opacity: checkingUpdate ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
                    title={t('btn_check_update')}>
                    <span style={{ fontSize: 14, display: 'inline-block', animation: checkingUpdate ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
                  </button>
                  <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                  {/* Dark/Light toggle */}
                  <button onClick={() => setDarkMode(d => !d)}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', fontSize: 16, lineHeight: 1, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                    title={darkMode ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}>
                    {darkMode ? '☀️' : '🌙'}
                  </button>
                  {/* Lang switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
                    {(['th', 'en', 'zh'] as Lang[]).map((l, i) => {
                      const flags = ['🇹🇭', '🇬🇧', '🇨🇳']
                      return (
                        <button key={l} onClick={() => switchLang(l)}
                          style={{ background: lang === l ? 'rgba(124,109,243,0.3)' : 'none', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: 5, fontSize: 15, lineHeight: 1, opacity: lang === l ? 1 : 0.6, transition: 'all .15s' }}>
                          {flags[i]}
                        </button>
                      )
                    })}
                  </div>
                  {topbarActions[page]}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 28, background: 'radial-gradient(ellipse 80% 50% at 50% -20%,rgba(124,109,243,.06),transparent)' }}>
                {pageComponent()}
              </div>
            </div>

            {/* Company Switcher Modal */}
            {showCompanySwitcher && (
              <div onClick={() => setShowCompanySwitcher(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 460, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t('company_switcher_title')}</h2>
                    <button onClick={() => setShowCompanySwitcher(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', padding: '5px 11px', color: '#8892a4', fontSize: 13 }}>✕</button>
                  </div>
                  <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {allCompanies.map(c => {
                        const isActive = activeCompany?.id === c.id
                        return (
                          <div key={c.id} onClick={() => handleSwitchCompany(c.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${isActive ? 'rgba(124,109,243,0.5)' : 'rgba(255,255,255,0.07)'}`, background: isActive ? 'rgba(124,109,243,0.1)' : 'transparent', transition: 'all .15s' }}
                            onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                            onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(c.name || '').slice(0, 2)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{c.tax_id ? t('company_tax_prefix') + c.tax_id : c.email || t('no_extra_info')}</div>
                            </div>
                            {isActive && <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{t('company_active_sw')}</span>}
                          </div>
                        )
                      })}
                      {allCompanies.length === 0 && <p style={{ textAlign: 'center', color: '#8892a4', padding: 20 }}>{t('no_companies_sw')}</p>}
                    </div>
                    <button onClick={() => { setShowCompanySwitcher(false); setPage('companies') }}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', padding: '9px 16px', color: '#8892a4', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
                      {t('company_manage')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Update Banner */}
            {updateBanner && (
              <div style={{ position: 'fixed', bottom: 24, left: 260, zIndex: 998, background: updateBanner.type === 'ready' ? 'rgba(34,211,160,0.12)' : 'rgba(96,165,250,0.12)', border: `1px solid ${updateBanner.type === 'ready' ? 'rgba(34,211,160,0.4)' : 'rgba(96,165,250,0.4)'}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <span style={{ fontSize: 18 }}>{updateBanner.type === 'ready' ? '✅' : '⬇️'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: updateBanner.type === 'ready' ? '#22d3a0' : '#60a5fa' }}>
                    {updateBanner.type === 'ready' ? `v${updateBanner.version} พร้อมแล้ว` : `กำลังดาวน์โหลด v${updateBanner.version}...`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {updateBanner.type === 'ready' ? 'ดาวน์โหลดเสร็จแล้ว พร้อมติดตั้ง' : 'ดาวน์โหลดอัพเดทในพื้นหลัง'}
                  </div>
                </div>
                {updateBanner.type === 'ready' && (
                  <button onClick={installUpdate}
                    style={{ background: 'rgba(34,211,160,0.2)', border: '1px solid rgba(34,211,160,0.5)', borderRadius: 7, cursor: 'pointer', padding: '5px 12px', color: '#22d3a0', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    ติดตั้งเดี๋ยวนี้
                  </button>
                )}
                <button onClick={() => setUpdateBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px', fontFamily: 'inherit', marginLeft: 4 }}>✕</button>
              </div>
            )}

            {/* Toasts */}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
              {toasts.map(item => (
                <div key={item.id} style={{ background: '#1a2235', border: `1px solid ${item.type === 'ok' ? 'rgba(34,211,160,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', color: item.type === 'ok' ? '#22d3a0' : '#f87171' }}>
                  <span>{item.type === 'ok' ? '✓' : '✕'}</span>
                  {item.msg}
                </div>
              ))}
            </div>
          </div>
        </CompanyContext.Provider>
      </ToastContext.Provider>
    </I18nContext.Provider>
  )
}
