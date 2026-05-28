import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { KEYS, readJson, writeJson } from '@/lib/storage'

type ThemeMode = 'dark' | 'light'

type ThemeCtx = {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => readJson(KEYS.theme, 'dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeJson(KEYS.theme, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () =>
        setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme requires ThemeProvider')
  return v
}
