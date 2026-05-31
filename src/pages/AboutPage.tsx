import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle('About Us')

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7355]">
          Our Story
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          More Than a Brand. A Beginning.
        </h1>

        <div className="mt-10 space-y-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            Panchvastra was not born in a studio — it began as a conversation.
          </p>

          <p>
            In 2025, in the heart of Indore, four friends — all software
            engineers by profession — found themselves questioning the pace and
            purpose of the world they were building for. While technology shaped
            their careers, their roots told a different story — one of
            craftsmanship, culture, and clothing that carried meaning.
          </p>

          <p>
            What started as late-night discussions soon turned into a shared
            vision: to build something of their own. Not just a brand, but a
            statement.
          </p>

          <p>
            Panchvastra was created to bring back that lost connection —
            between the fabric and the wearer, between tradition and today.
          </p>
        </div>

        <div className="my-14 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            We don't chase trends.
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-[#8a7355] sm:text-3xl">
            We build identity.
          </p>
        </div>

        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Every piece we create carries the spirit of where we started —
          four minds, one vision, and the courage to begin.
        </p>

        <div className="mt-12">
          <Link to="/shop">
            <Button size="lg">
              Explore Collection
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}