import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastVariant = 'success' | 'warning'

type ToastRecord = {
  id: number
  message: string
  description?: string
  variant: ToastVariant
}

type ToastOptions = {
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. */
  duration?: number
}

type ToastCtx = {
  showToast: (message: string, options?: ToastOptions) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { bubble: string; badge: string; icon: string }> = {
  success: { bubble: 'bg-black', badge: 'bg-white text-black', icon: '✓' },
  warning: { bubble: 'bg-amber-600', badge: 'bg-white text-amber-700', icon: '!' },
}

/**
 * A minimal, dependency-free toast stack (no library in the project). One shared instance
 * so Add to Cart, stock-limit warnings, etc. all render through the same fixed-position
 * stack instead of every page rolling its own popup markup.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++nextId.current
      const variant = options.variant ?? 'success'
      setToasts((current) => [...current, { id, message, description: options.description, variant }])
      window.setTimeout(() => dismiss(id), options.duration ?? 3000)
    },
    [dismiss],
  )

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}

      <div
        className="pointer-events-none fixed top-20 right-4 z-[9999] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 sm:right-6"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant]
          return (
            <div
              key={toast.id}
              role="status"
              className={`pv-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl px-5 py-4 text-white shadow-2xl ${style.bubble}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans text-sm font-bold ${style.badge}`}
                aria-hidden
              >
                {style.icon}
              </div>
              <div className="min-w-0">
                <p className="font-sans text-sm font-semibold">{toast.message}</p>
                {toast.description ? <p className="font-sans text-xs text-white/80">{toast.description}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useToast requires ToastProvider')
  return value
}
