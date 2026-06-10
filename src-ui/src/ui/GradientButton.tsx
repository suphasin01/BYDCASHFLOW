import { Button, type ButtonProps } from '@heroui/react'

/** Primary action button with the brand purple gradient + soft glow. */
export default function GradientButton(props: ButtonProps) {
  return (
    <Button
      {...props}
      className={`bg-gradient-to-br from-[#7c6df3] to-[#a855f7] text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-px active:translate-y-0 transition-all ${props.className || ''}`}
    />
  )
}
