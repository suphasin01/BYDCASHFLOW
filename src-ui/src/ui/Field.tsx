import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

const BASE = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none transition-all duration-150 hover:border-default-300 focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-default-400 [color-scheme:dark]'

/** Label + control wrapper. Label sits ABOVE the control (never overlaps). */
export function Field({ label, children, className = '' }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1">{label}</label>}
      {children}
    </div>
  )
}

/** Native text/number/date input. Pass a `label` to get the wrapper, or omit for a bare input. */
export function TextField({ label, className = '', wrapClassName, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; wrapClassName?: string }) {
  const input = <input {...rest} className={`${BASE} ${className}`} />
  return label !== undefined ? <Field label={label} className={wrapClassName}>{input}</Field> : input
}

/** Native textarea. */
export function TextAreaField({ label, className = '', wrapClassName, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; wrapClassName?: string }) {
  const area = <textarea {...rest} className={`${BASE} resize-y min-h-[64px] leading-relaxed ${className}`} />
  return label !== undefined ? <Field label={label} className={wrapClassName}>{area}</Field> : area
}
