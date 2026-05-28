import { AnimatePresence, motion } from 'framer-motion'
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
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex-1"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  )
}
