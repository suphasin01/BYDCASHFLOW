import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { Avatar, Progress } from '@heroui/react'
import { I18nContext, useI18nState, type Lang } from './i18n'
import ErrorBoundary from './ErrorBoundary'
import Btn from './ui/Btn'
import Modal from './ui/Modal'
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
import WithholdingTaxPage from './pages/WithholdingTax'

// ─── Toast ───────────────────────────────────────────────────────────────────
export type ToastItem = { id: number; msg: string; type: 'ok' | 'err' }
type ToastCtxType = { toast: (msg: string, type?: 'ok' | 'err') => void }
export const ToastContext = createContext<ToastCtxType>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

// ─── Active Company ──────────────────────────────────────────────────────────
type CompanyCtxType = { activeCompany: Company | null; reload: () => void }
export const CompanyContext = createContext<CompanyCtxType>({ activeCompany: null, reload: () => {} })
export const useActiveCompany = () => useContext(CompanyContext)

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'reports' | 'withholding_tax' | 'companies' | 'settings'

const NAV_ITEMS: { page: Page; icon: string; key: string }[] = [
  { page: 'dashboard', icon: '🏠', key: 'nav_dashboard' },
  { page: 'documents', icon: '📄', key: 'nav_documents' },
  { page: 'payments', icon: '💳', key: 'nav_payments' },
  { page: 'contacts', icon: '👥', key: 'nav_contacts' },
  { page: 'products', icon: '📦', key: 'nav_products' },
  { page: 'reports', icon: '📈', key: 'nav_reports' },
  { page: 'withholding_tax', icon: '🧾', key: 'nav_withholding_tax' },
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
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [updateBanner, setUpdateBanner] = useState<{ type: 'downloading' | 'ready' | 'mac-available'; version: string; releaseUrl?: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', darkMode)
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
    const api = (window as unknown as { electronAPI?: { onUpdateStatus: (cb: (d: { type: 'downloading' | 'ready' | 'error' | 'mac-available'; version?: string; message?: string; releaseUrl?: string }) => void) => void; onUpdateNotAvailable: (cb: () => void) => void; onUpdateProgress: (cb: (d: { percent: number }) => void) => void } }).electronAPI
    api?.onUpdateStatus(data => {
      setCheckingUpdate(false)
      if (data.type === 'error') {
        setInstalling(false)
        toast(t('toast_update_failed') + (data.message ? ': ' + data.message : ''), 'err')
        return
      }
      if (data.type === 'mac-available') {
        setUpdateBanner({ type: 'mac-available', version: data.version || '', releaseUrl: data.releaseUrl })
        return
      }
      setUpdateBanner({ type: data.type, version: data.version || '' })
      if (data.type === 'ready') setDownloadProgress(null)
    })
    api?.onUpdateNotAvailable(() => { setCheckingUpdate(false); toast(t('toast_up_to_date')) })
    api?.onUpdateProgress(data => setDownloadProgress(data.percent))
  }, [t, toast])

  const checkForUpdates = () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    const api = (window as unknown as { electronAPI?: { checkForUpdates: () => void } }).electronAPI
    api?.checkForUpdates()
    setTimeout(() => setCheckingUpdate(false), 15000)
  }

  const installUpdate = () => {
    if (installing) return
    setInstalling(true)
    const api = (window as unknown as { electronAPI?: { installUpdate: () => void } }).electronAPI
    api?.installUpdate()
    // If the app hasn't quit/relaunched within a few seconds, the install
    // silently failed (e.g. unsigned build) — let the user retry.
    setTimeout(() => setInstalling(false), 8000)
  }

  const quitApp = () => {
    const api = (window as unknown as { electronAPI?: { quitApp: () => void } }).electronAPI
    api?.quitApp()
  }

  const openReleasesPage = () => {
    const api = (window as unknown as { electronAPI?: { openReleasesPage: () => void } }).electronAPI
    api?.openReleasesPage()
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
      setSwitcherOpen(true)
    } catch {}
  }

  const handleSwitchCompany = async (id: number) => {
    try {
      await apiActivateCompany(id)
      await reloadCompany()
      setSwitcherOpen(false)
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
      case 'documents': return <Documents onNavigate={navigate} />
      case 'payments': return <Payments />
      case 'contacts': return <Contacts />
      case 'products': return <Products />
      case 'reports': return <Reports />
      case 'withholding_tax': return <WithholdingTaxPage />
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
    withholding_tax: null,
    companies: null,
    settings: null,
  }

  const navSections = [
    { label: t('nav_sec_main'), items: ['dashboard', 'payments'] },
    { label: t('nav_sec_docs'), items: ['documents', 'withholding_tax'] },
    { label: t('nav_sec_data'), items: ['contacts', 'products'] },
    { label: t('nav_sec_analyze'), items: ['reports'] },
    { label: '', items: ['companies', 'settings'] },
  ]

  return (
    <I18nContext.Provider value={i18n}>
      <ToastContext.Provider value={{ toast }}>
        <CompanyContext.Provider value={{ activeCompany, reload: reloadCompany }}>
          <div className="flex h-screen overflow-hidden text-foreground text-sm">
            {/* Sidebar */}
            <aside className="w-60 flex-shrink-0 flex flex-col border-r border-content3" style={{ background: 'var(--bg-sidebar)' }}>
              {/* Logo */}
              <div className="px-5 pt-5 pb-4 flex items-center gap-2.5 border-b border-content3 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                <img src="/app-icon.png" alt="FruitBiz" className="w-9 h-9 rounded-[10px] flex-shrink-0 object-cover shadow-[0_4px_12px_rgba(124,109,243,.6)] relative z-10" />
                <div>
                  <div className="text-[15px] font-bold tracking-tight">FruitBiz</div>
                  <div className="text-[10px] text-default-500 mt-px">{t('app_subtitle')}</div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-2.5 py-3 overflow-y-auto flex flex-col gap-0.5">
                {navSections.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <div className="text-[10px] font-semibold text-default-400 tracking-wider uppercase px-3 pt-3 pb-1 mt-1">
                        {section.label}
                      </div>
                    )}
                    {section.items.map(p => {
                      const item = NAV_ITEMS.find(n => n.page === p)!
                      const active = page === p
                      return (
                        <button key={p} onClick={() => setPage(p as Page)}
                          className={`w-full flex items-center gap-3 py-2.5 px-3 text-[13px] font-medium transition-all duration-150 ${active ? 'nav-item-active' : 'nav-item-inactive text-default-500 rounded-lg'}`}>
                          <span className={`text-[17px] flex-shrink-0 leading-none transition-transform duration-150 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                          <span>{t(item.key)}</span>
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(124,109,243,.8)]" />}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>

              {/* Company Switcher */}
              <button onClick={openCompanySwitcher}
                className="px-3.5 py-3 border-t border-content3 cursor-pointer transition-colors hover:bg-content2 text-left">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={activeCompany?.logo_url || undefined}
                    name={(activeCompany?.name || 'บ').slice(0, 2)}
                    radius="md"
                    className="w-8 h-8 flex-shrink-0 text-xs font-bold bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{activeCompany?.name || t('loading')}</div>
                    <div className="text-[10px] text-default-500 mt-px">{t('company_click')}</div>
                  </div>
                  <span className="text-[10px] text-default-400">▼</span>
                </div>
              </button>

              {/* Exit Button */}
              <div className="px-3.5 py-2 border-t border-content3">
                <Btn onClick={quitApp} variant="danger" size="sm"
                  className="w-full justify-start"
                  startContent={<span className="text-sm">🚪</span>}>
                  {t('btn_exit_app')}
                </Btn>
              </div>

              {/* Status */}
              <div className="px-3.5 py-3 border-t border-content3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-content2 rounded-full px-2.5 py-1.5 text-[11px] text-default-500 flex-1">
                  <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 inline-block ${apiOnline ? 'bg-success shadow-[0_0_8px_rgba(34,211,160,0.6)]' : 'bg-danger shadow-[0_0_8px_rgba(248,113,113,0.5)]'}`} />
                  <span>{apiOnline ? t('status_connected') : t('status_disconnected')}</span>
                </div>
                {appVersion && <span className="text-[10px] text-default-400 flex-shrink-0 tracking-wide">v{appVersion}</span>}
              </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Topbar */}
              <div className="h-[60px] px-7 flex items-center justify-between border-b border-content3 flex-shrink-0 bg-content1/90 backdrop-blur-md">
                <h1 className="text-[15px] font-semibold">{t(NAV_ITEMS.find(n => n.page === page)?.key || 'nav_dashboard')}</h1>
                <div className="flex items-center gap-2.5">
                  {/* Check for Updates */}
                  <button disabled={checkingUpdate}
                    onClick={checkForUpdates} title={t('btn_check_update')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-600 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none">
                    <span className={`text-sm inline-block ${checkingUpdate ? 'animate-spin' : ''}`}>🔄</span>
                  </button>
                  {/* Dark/Light toggle */}
                  <button
                    onClick={() => setDarkMode(d => !d)}
                    title={darkMode ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-600 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer">
                    <span className="text-base">{darkMode ? '☀️' : '🌙'}</span>
                  </button>
                  {/* Lang switcher */}
                  <div className="flex items-center gap-0.5 bg-content2 border border-content3 rounded-lg p-0.5">
                    {(['th', 'en', 'zh'] as Lang[]).map((l, i) => {
                      const flags = ['🇹🇭', '🇬🇧', '🇨🇳']
                      return (
                        <button key={l} onClick={() => switchLang(l)}
                          className={`px-1.5 py-1 rounded text-[15px] leading-none transition-all ${lang === l ? 'bg-primary/30 opacity-100' : 'opacity-60 hover:opacity-90'}`}>
                          {flags[i]}
                        </button>
                      )
                    })}
                  </div>
                  {topbarActions[page]}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-7 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,109,243,.08),transparent)]">
                <ErrorBoundary key={page}>
                  <div className="page-content">
                    {pageComponent()}
                  </div>
                </ErrorBoundary>
              </div>
            </div>

            {/* Company Switcher Modal */}
            <Modal open={switcherOpen} onClose={() => setSwitcherOpen(false)} size="lg"
              title={t('company_switcher_title')}
              footer={
                <Btn variant="ghost" className="w-full justify-center" onClick={() => { setSwitcherOpen(false); setPage('companies') }}>
                  {t('company_manage')}
                </Btn>
              }>
              <div className="flex flex-col gap-2">
                {allCompanies.map(c => {
                  const isActive = activeCompany?.id === c.id
                  return (
                    <button key={c.id} onClick={() => handleSwitchCompany(c.id)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all border ${isActive ? 'border-primary/50 bg-primary/10' : 'border-content3 hover:bg-content2'}`}>
                      <Avatar name={(c.name || '').slice(0, 2)} radius="md"
                        className="w-9 h-9 flex-shrink-0 text-sm font-bold bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">{c.name}</div>
                        <div className="text-[11px] text-default-500 mt-0.5 truncate">{c.tax_id ? t('company_tax_prefix') + c.tax_id : c.email || t('no_extra_info')}</div>
                      </div>
                      {isActive && <span className="text-xs text-primary font-semibold">{t('company_active_sw')}</span>}
                    </button>
                  )
                })}
                {allCompanies.length === 0 && <p className="text-center text-default-500 py-5">{t('no_companies_sw')}</p>}
              </div>
            </Modal>

            {/* Update Banner */}
            {updateBanner && (
              <div className={`fixed bottom-6 left-[260px] z-[998] rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl min-w-[300px] border ${
                updateBanner.type === 'ready' ? 'bg-success/10 border-success/40' :
                updateBanner.type === 'mac-available' ? 'bg-warning/10 border-warning/40' :
                'bg-[#60a5fa]/10 border-[#60a5fa]/40'
              }`}>
                <span className="text-lg">
                  {updateBanner.type === 'ready' ? '✅' : updateBanner.type === 'mac-available' ? '🆕' : '⬇️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-semibold flex items-center justify-between ${
                    updateBanner.type === 'ready' ? 'text-success' :
                    updateBanner.type === 'mac-available' ? 'text-warning' :
                    'text-[#60a5fa]'
                  }`}>
                    <span>
                      {updateBanner.type === 'ready' ? `v${updateBanner.version} พร้อมแล้ว` :
                       updateBanner.type === 'mac-available' ? `v${updateBanner.version} พร้อมให้ดาวน์โหลด` :
                       `กำลังดาวน์โหลด v${updateBanner.version}...`}
                    </span>
                    {updateBanner.type === 'downloading' && downloadProgress !== null && (
                      <span className="text-xs font-bold text-[#60a5fa] ml-2">{downloadProgress}%</span>
                    )}
                  </div>
                  {updateBanner.type === 'downloading' && downloadProgress !== null ? (
                    <Progress aria-label="download" size="sm" color="primary" value={downloadProgress} className="mt-1.5" />
                  ) : (
                    <div className="text-[11px] text-default-500 mt-0.5">
                      {updateBanner.type === 'ready' ? 'ดาวน์โหลดเสร็จแล้ว พร้อมติดตั้ง' :
                       updateBanner.type === 'mac-available' ? 'กด "ดาวน์โหลด" เพื่อเปิดหน้า Releases' :
                       'ดาวน์โหลดอัพเดทในพื้นหลัง'}
                    </div>
                  )}
                </div>
                {updateBanner.type === 'ready' && (
                  <Btn size="sm" variant="success" onClick={installUpdate} isLoading={installing} className="whitespace-nowrap">
                    {installing ? 'กำลังติดตั้ง...' : 'ติดตั้งเดี๋ยวนี้'}
                  </Btn>
                )}
                {updateBanner.type === 'mac-available' && (
                  <Btn size="sm" variant="primary" onClick={openReleasesPage} className="whitespace-nowrap">
                    ดาวน์โหลด
                  </Btn>
                )}
                <button onClick={() => setUpdateBanner(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-default-500 hover:text-foreground hover:bg-content3 transition-colors cursor-pointer flex-shrink-0">✕</button>
              </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
              {toasts.map(item => (
                <div key={item.id}
                  className={`toast-item bg-content2/90 backdrop-blur-sm rounded-xl px-4 py-3 text-[13px] flex items-center gap-2 max-w-80 shadow-[0_8px_32px_rgba(0,0,0,.5)] border ${item.type === 'ok' ? 'border-success/40 text-success shadow-success/10' : 'border-danger/40 text-danger shadow-danger/10'}`}>
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
