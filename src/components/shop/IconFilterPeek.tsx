/**
 * See-no-evil style filter toggle: hands over eyes = filters hidden,
 * eyes open with hands aside = filters visible.
 */
export function IconFilterPeek({ open, className }: { open: boolean; className?: string }) {
  if (open) {
    return (
      <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="26" r="13" fill="#F2C094" stroke="#1c1917" strokeWidth="1.25" />
        <path
          d="M11 20c2.5-6 7-9 13-9s10.5 3 13 9c-1.5 2-4 3.5-13 3.5S12.5 22 11 20z"
          fill="#1c1917"
        />
        <ellipse cx="18.5" cy="25" rx="3.2" ry="3.8" fill="#fff" stroke="#1c1917" strokeWidth="1" />
        <ellipse cx="29.5" cy="25" rx="3.2" ry="3.8" fill="#fff" stroke="#1c1917" strokeWidth="1" />
        <circle cx="18.5" cy="25.5" r="1.6" fill="#1c1917" />
        <circle cx="29.5" cy="25.5" r="1.6" fill="#1c1917" />
        <path d="M23 29.5v2" stroke="#1c1917" strokeWidth="1.1" strokeLinecap="round" />
        <path
          d="M19.5 33.5c1.2 1.2 2.4 1.8 4.5 1.8s3.3-.6 4.5-1.8"
          stroke="#1c1917"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <rect
          x="7"
          y="18"
          width="5"
          height="14"
          rx="2.5"
          fill="#F2C094"
          stroke="#1c1917"
          strokeWidth="1.1"
        />
        <rect
          x="36"
          y="18"
          width="5"
          height="14"
          rx="2.5"
          fill="#F2C094"
          stroke="#1c1917"
          strokeWidth="1.1"
        />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="26" r="13" fill="#F2C094" stroke="#1c1917" strokeWidth="1.25" />
      <path
        d="M11 20c2.5-6 7-9 13-9s10.5 3 13 9c-1.5 2-4 3.5-13 3.5S12.5 22 11 20z"
        fill="#1c1917"
      />
      <rect
        x="13"
        y="22"
        width="9"
        height="6"
        rx="2"
        fill="#F2C094"
        stroke="#1c1917"
        strokeWidth="1.1"
      />
      <rect
        x="26"
        y="22"
        width="9"
        height="6"
        rx="2"
        fill="#F2C094"
        stroke="#1c1917"
        strokeWidth="1.1"
      />
      <path d="M23 29.5v2" stroke="#1c1917" strokeWidth="1.1" strokeLinecap="round" />
      <path
        d="M19.5 33.5c1.2 1.2 2.4 1.8 4.5 1.8s3.3-.6 4.5-1.8"
        stroke="#1c1917"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
