import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-black text-white hover:bg-zinc-800 border border-black',
  ghost:
    'bg-transparent border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900/80',
  ghostLight:
    'bg-transparent border border-zinc-300 text-zinc-900 hover:bg-zinc-100/80',
  outline:
    'bg-transparent border-2 border-zinc-700 text-zinc-900 hover:border-black dark:border-zinc-500 dark:text-white dark:hover:border-white',
}

const sizes = {
  md: 'type-btn px-5 py-2.5 text-sm rounded-md uppercase tracking-wide',
  lg: 'type-btn px-7 py-3 text-base rounded-md uppercase tracking-wide',
  sm: 'type-btn px-3 py-1.5 text-xs rounded-md uppercase tracking-wide',
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
