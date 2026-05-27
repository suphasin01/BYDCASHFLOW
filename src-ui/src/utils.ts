export const fmt = (n: number | undefined | null) =>
  new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

export const fmtShort = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : fmt(n)

export const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10) : '—'

export const today = () => new Date().toISOString().slice(0, 10)

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(139,148,158,0.12)', color: '#8b949e' },
  sent: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
  approved: { bg: 'rgba(34,211,160,0.12)', color: '#22d3a0' },
  paid: { bg: 'rgba(34,211,160,0.18)', color: '#6ee7b7' },
  cancelled: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
}
