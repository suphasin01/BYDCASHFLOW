import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  startContent?: ReactNode
  isLoading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-br from-[#7c6df3] to-[#a855f7] text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-px',
  ghost: 'bg-content2 text-default-600 border border-content3 hover:bg-content3 hover:text-foreground',
  danger: 'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25',
  success: 'bg-success/15 text-success border border-success/30 hover:bg-success/25',
}
const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-[13px] px-4 py-2 rounded-lg gap-2',
}

export default function Btn({ variant = 'primary', size = 'md', startContent, isLoading, className = '', children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {isLoading ? <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : startContent}
      {children}
    </button>
  )
}
