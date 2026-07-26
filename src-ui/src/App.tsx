import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { Avatar } from '@heroui/react'
import {
  LayoutDashboard, FileText, CreditCard, Users, Package,
  TrendingUp, Receipt, Building2, Settings as SettingsIcon, LogOut,
  Sun, Moon, ImageIcon, Menu, type LucideIcon,
} from 'lucide-react'
import { I18nContext, useI18nState, type Lang } from './i18n'
import ErrorBoundary from './ErrorBoundary'
import NotificationBell from './NotificationBell'
import Btn from './ui/Btn'
import Modal from './ui/Modal'
import type { Company } from './types'
import { getActiveCompany, activateCompany as apiActivateCompany, getCompanies } from './api'
import { today } from './utils'
import PeriodPicker from './PeriodPicker'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import Contacts from './pages/Contacts'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Companies from './pages/Companies'
import Settings from './pages/Settings'
import WithholdingTaxPage from './pages/WithholdingTax'
import PaySlipPage from './pages/PaySlip'
import EmployeesPage from './pages/Employees'
import EvidencePage from './pages/Evidence'

// ─── Toast ───────────────────────────────────────────────────────────────────
export type ToastItem = { id: number; msg: string; type: 'ok' | 'err' }
type ToastCtxType = { toast: (msg: string, type?: 'ok' | 'err') => void }
export const ToastContext = createContext<ToastCtxType>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

// ─── Active Company ──────────────────────────────────────────────────────────
type CompanyCtxType = { activeCompany: Company | null; reload: () => void }
export const CompanyContext = createContext<CompanyCtxType>({ activeCompany: null, reload: () => {} })
export const useActiveCompany = () => useContext(CompanyContext)

// ─── Viewing Period (month filter) ───────────────────────────────────────────
// Global selected month (YYYY-MM). Defaults to the current month on every launch
// so each new month starts fresh; users can pick a past month to review old data.
type PeriodCtxType = { period: string; setPeriod: (p: string) => void }
export const PeriodContext = createContext<PeriodCtxType>({ period: today().slice(0, 7), setPeriod: () => {} })
export const usePeriod = () => useContext(PeriodContext)

type Page = 'dashboard' | 'documents' | 'payments' | 'contacts' | 'products' | 'employees' | 'evidence' | 'reports' | 'withholding_tax' | 'pay_slips' | 'companies' | 'settings'

// Pages whose data is scoped to the selected month — the period picker shows only on these.
const MONTH_SCOPED: Page[] = ['dashboard', 'documents', 'evidence', 'pay_slips', 'withholding_tax']

const NAV_ITEMS: { page: Page; Icon: LucideIcon; key: string }[] = [
  { page: 'dashboard', Icon: LayoutDashboard, key: 'nav_dashboard' },
  { page: 'documents', Icon: FileText, key: 'nav_documents' },
  { page: 'payments', Icon: CreditCard, key: 'nav_payments' },
  { page: 'contacts', Icon: Users, key: 'nav_contacts' },
  { page: 'products', Icon: Package, key: 'nav_products' },
  { page: 'employees', Icon: Users, key: 'nav_employees' },
  { page: 'evidence', Icon: ImageIcon, key: 'nav_evidence' },
  { page: 'reports', Icon: TrendingUp, key: 'nav_reports' },
  { page: 'withholding_tax', Icon: Receipt, key: 'nav_withholding_tax' },
  { page: 'pay_slips', Icon: FileText, key: 'nav_pay_slips' },
  { page: 'companies', Icon: Building2, key: 'nav_companies' },
  { page: 'settings', Icon: SettingsIcon, key: 'nav_settings' },
]

export default function App() {
  const i18n = useI18nState()
  const { lang, t, switchLang } = i18n

  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState(() => today().slice(0, 7))
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(t)
  }, [])

  const toast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const quitApp = () => {
    const api = (window as unknown as { electronAPI?: { quitApp: () => void } }).electronAPI
    api?.quitApp()
  }

  const reloadCompany = useCallback(async () => {
    try { setActiveCompany(await getActiveCompany()) } catch {}
  }, [])

  useEffect(() => {
    reloadCompany()
  }, [reloadCompany])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
    document.body.className = lang === 'zh' ? 'lang-zh' : lang === 'th' ? 'lang-th' : ''
  }, [lang])

  const openCompanySwitcher = async () => {
    setSidebarOpen(false)
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
      case 'employees': return <EmployeesPage />
      case 'evidence': return <EvidencePage />
      case 'withholding_tax': return <WithholdingTaxPage />
      case 'pay_slips': return <PaySlipPage />
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
    employees: null,
    evidence: null,
    withholding_tax: null,
    pay_slips: null,
    companies: null,
    settings: null,
  }

  const navSections = [
    { label: t('nav_sec_main'), items: ['dashboard', 'payments'] },
    { label: t('nav_sec_docs'), items: ['documents', 'withholding_tax', 'pay_slips'] },
    { label: t('nav_sec_data'), items: ['contacts', 'products', 'employees', 'evidence'] },
    { label: t('nav_sec_analyze'), items: ['reports'] },
    { label: '', items: ['companies', 'settings'] },
  ]

  return (
    <I18nContext.Provider value={i18n}>
      <ToastContext.Provider value={{ toast }}>
        <CompanyContext.Provider value={{ activeCompany, reload: reloadCompany }}>
        <PeriodContext.Provider value={{ period, setPeriod }}>
          {/* Splash screen */}
          {showSplash && (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center splash-out"
              style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #1a1040 0%, #0a0f1e 100%)' }}>
              <img src="/app-icon.png" alt="BYD CASHFLOW" className="splash-icon w-28 h-28 rounded-[28px] shadow-[0_0_80px_rgba(124,109,243,.7),0_24px_48px_rgba(0,0,0,.6)]" />
              <div className="splash-text text-[26px] font-bold tracking-tight mt-6" style={{ color: '#f0f4ff' }}>BYD CASHFLOW</div>
              <div className="splash-sub text-[13px] mt-1" style={{ color: '#6b7685' }}>Business Management</div>
              <div className="mt-8 flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60"
                    style={{ animation: `splashPulse .9s ease ${i * .2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div className="flex h-screen overflow-hidden text-foreground text-sm">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
              <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden animate-[fadeIn_.2s_ease]"
                onClick={() => setSidebarOpen(false)} />
            )}
            {/* Sidebar */}
            <aside className={`w-60 flex-shrink-0 flex flex-col border-r border-content3 z-50
              fixed inset-y-0 left-0 md:static md:translate-x-0 transition-transform duration-300 ease-out
              ${sidebarOpen ? 'translate-x-0 shadow-[0_0_60px_rgba(0,0,0,.6)]' : '-translate-x-full'}`}
              style={{ background: 'var(--bg-sidebar)' }}>
              {/* Logo — drag region for Mac traffic lights */}
              <div className="drag px-5 pt-5 pb-4 flex items-center gap-2.5 border-b border-content3 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                <img src="/app-icon.png" alt="BYD CASHFLOW" className="no-drag w-9 h-9 rounded-[10px] flex-shrink-0 object-cover shadow-[0_4px_12px_rgba(124,109,243,.6)] relative z-10" />
                <div className="no-drag">
                  <div className="text-[15px] font-bold tracking-tight">BYD CASHFLOW</div>
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
                      const { Icon } = item
                      return (
                        <button key={p} onClick={() => { setPage(p as Page); setSidebarOpen(false) }}
                          className={`group/nav w-full flex items-center gap-3 py-2.5 px-3 text-[13px] font-medium transition-all duration-150 ${active ? 'nav-item-active' : 'nav-item-inactive text-default-500 rounded-lg'}`}>
                          <Icon size={16} className={`flex-shrink-0 transition-transform duration-200 ${active ? 'scale-110 text-primary' : 'group-hover/nav:scale-110 group-hover/nav:-rotate-6'}`} strokeWidth={active ? 2.5 : 1.8} />
                          <span className="transition-transform duration-150 group-hover/nav:translate-x-0.5">{t(item.key)}</span>
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(124,109,243,.8)] animate-pulse" />}
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
              <div className="px-2.5 py-2 border-t border-content3">
                <button onClick={quitApp}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-default-400 hover:text-danger hover:bg-danger/8 transition-all duration-150 cursor-pointer group">
                  <LogOut size={14} className="flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.8} />
                  {t('btn_exit_app')}
                </button>
              </div>

            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Topbar */}
              <div className="drag h-[60px] px-3 md:px-7 flex items-center justify-between gap-2 border-b border-content3 flex-shrink-0 bg-content1/90 backdrop-blur-md relative z-20">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Hamburger (mobile only) */}
                  <button onClick={() => setSidebarOpen(true)} aria-label="menu"
                    className="no-drag md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-500 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer flex-shrink-0">
                    <Menu size={17} strokeWidth={1.8} />
                  </button>
                  <h1 className="text-[15px] font-semibold truncate">{t(NAV_ITEMS.find(n => n.page === page)?.key || 'nav_dashboard')}</h1>
                </div>
                <div className="no-drag flex items-center gap-1.5 md:gap-2.5 flex-shrink-0">
                  {/* Month picker (month-scoped pages only) */}
                  {MONTH_SCOPED.includes(page) && <PeriodPicker />}
                  {/* Notifications */}
                  <NotificationBell onNavigate={navigate} />
                  {/* Dark/Light toggle */}
                  <button
                    onClick={() => setDarkMode(d => !d)}
                    title={darkMode ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-500 hover:bg-content3 hover:text-foreground transition-colors cursor-pointer">
                    {darkMode ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
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
              <div className="flex-1 overflow-y-auto p-4 md:p-7 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,109,243,.08),transparent)] relative">
                <div className="dot-grid-bg absolute inset-0 pointer-events-none opacity-[0.35]" />
                <ErrorBoundary key={page + ':' + (activeCompany?.id ?? '')}>
                  <div className="page-content relative z-10">
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
        </PeriodContext.Provider>
        </CompanyContext.Provider>
      </ToastContext.Provider>
    </I18nContext.Provider>
  )
}
