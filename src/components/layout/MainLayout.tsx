import { Suspense, useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { RouteFallback } from '@/components/layout/RouteFallback'

export function MainLayout() {
  const { pathname, search } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      {/*
        The Suspense boundary sits INSIDE the layout, around the outlet only. Putting it
        above `MainLayout` would blank the navbar and footer every time a page chunk
        loaded — the chrome would flash out and back on each navigation. Here it stays
        painted and only the page area swaps.
      */}
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
