export type FilterOption = { value: string; label: string }

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  active,
  disabled = false,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  active: boolean
  disabled?: boolean
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`w-full min-w-[9.5rem] cursor-pointer appearance-none border bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold uppercase tracking-wide text-black outline-none transition-colors [color-scheme:light] disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? 'border-black' : 'border-zinc-300 hover:border-black'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-black">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 ${active ? 'text-black' : 'text-zinc-500'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
