import { useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'

export function MainLayout() {
  const { pathname, search } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main key={`${pathname}${search}`} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
