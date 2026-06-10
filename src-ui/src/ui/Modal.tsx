import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl' | '3xl' | '4xl'
}

const WIDTHS = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl' }

export default function Modal({ open, onClose, title, children, footer, size = 'xl' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
      onClick={onClose}>
      <div className={`w-full ${WIDTHS[size]} max-h-[88vh] flex flex-col bg-content1 border border-content4 rounded-2xl shadow-2xl overflow-hidden`}
        onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-content3 flex-shrink-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-content2 border border-content3 text-default-500 hover:text-foreground hover:bg-content3 transition-colors cursor-pointer">✕</button>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-content3 flex justify-end gap-2 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
