import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle('About Us')

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-600 dark:text-orange-400">
          About us
        </p>
        <h1 className="type-page-title mt-3 sm:text-4xl">
          Panch + vastra · five threads of attitude
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          “PANCH” nods to the idea of multiplicity — moods, playlists, rotations. “VASTRA” is what you armor up in daily.
          PANCHVASTRA is modular by design so we can lean into TikTok-fit drops tomorrow while shipping solid staples today:
          regular tees, oversized fits, shorts — scalable categories with one design system &amp; one cart.
        </p>
        <h2 className="type-section-title mt-12">
          Vision
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-zinc-600 marker:text-orange-500 dark:text-zinc-400">
          <li>Climate-aware fabrics tuned for Indian heat &amp; humidity.</li>
          <li>Honest pricing — no fake strikethrough theatre.</li>
          <li>Community drops instead of endless SKUs.</li>
        </ul>
        <Link to="/shop" className="mt-10 inline-block">
          <Button size="lg">Shop the line</Button>
        </Link>
      </motion.div>
    </div>
  )
}
