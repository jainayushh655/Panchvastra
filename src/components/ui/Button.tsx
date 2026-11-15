import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-chocolate text-cream hover:bg-espresso border border-chocolate',
  ghost:
    'bg-transparent border border-sand text-espresso hover:bg-soft-beige dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900/80',
  ghostLight:
    'bg-transparent border border-sand text-espresso hover:bg-soft-beige',
  outline:
    'bg-transparent border-2 border-chocolate text-espresso hover:border-espresso dark:border-zinc-500 dark:text-white dark:hover:border-white',
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
