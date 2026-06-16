import type { ReactNode } from 'react'

/** Compact square icon-only button (32px) used in card action rows. */
export default function IconBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: ReactNode
}) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-150 cursor-pointer active:scale-90 ${
        danger
          ? 'border-content3 text-default-400 hover:text-danger hover:border-danger/40 hover:bg-danger/10'
          : 'border-content3 text-default-500 hover:text-primary hover:border-primary/40 hover:bg-primary/10'
      }`}>
      {children}
    </button>
  )
}
