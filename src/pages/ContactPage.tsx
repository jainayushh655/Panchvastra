import type { FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function ContactPage() {
  useDocumentTitle('Contact')
  const [sent, setSent] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  const input =
    'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white'

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="type-page-title">
        Contact
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Collabs, bulk / campus programs, or press — we read everything.</p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-4">
          <input required placeholder="Name" className={input} />
          <input required type="email" placeholder="Email" className={input} />
          <textarea required rows={4} placeholder="Message" className={input} />
          <Button type="submit" size="lg">
            Send
          </Button>
          {sent ? (
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Thanks — this is a UI mock; wire to your CRM / email API.
            </p>
          ) : null}
        </form>
        <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-bold text-zinc-900 dark:text-white">Email</span>
            <br />
            crew@panchvastra.in
          </p>
          <p>
            <span className="font-bold text-zinc-900 dark:text-white">Social</span>
            <br />
            <a href="https://instagram.com" className="text-black underline underline-offset-2 dark:text-white">
              Instagram
            </a>
            {' · '}
            <a href="https://x.com" className="text-black underline underline-offset-2 dark:text-white">
              X
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
