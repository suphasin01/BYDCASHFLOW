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
  primary: 'btn-3d-primary',
  ghost:   'btn-3d-ghost text-default-600 hover:text-foreground',
  danger:  'btn-3d-danger',
  success: 'btn-3d-success',
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
      className={`inline-flex items-center justify-center font-semibold disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {isLoading ? <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : startContent}
      {children}
    </button>
  )
}
