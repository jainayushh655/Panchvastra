import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary:
    'bg-orange-500 text-zinc-950 hover:bg-orange-400 shadow-[0_0_24px_-4px_oklch(0.72_0.19_45_/0.5)] border border-orange-400/80',
  ghost:
    'bg-transparent border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900/80',
  ghostLight:
    'bg-transparent border border-zinc-300 text-zinc-900 hover:bg-zinc-100/80',
  outline:
    'bg-transparent border-2 border-zinc-700 text-zinc-900 hover:border-orange-500 dark:border-zinc-500 dark:text-white dark:hover:border-orange-400',
}

const sizes = {
  md: 'type-btn px-5 py-2.5 text-sm rounded-full',
  lg: 'type-btn px-7 py-3 text-base rounded-full',
  sm: 'type-btn px-3 py-1.5 text-xs rounded-full',
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
