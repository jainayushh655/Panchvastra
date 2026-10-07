import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import {
  getAdminSupportQueries,
  isSupportQueryMissing,
  readSupportApiError,
  updateSupportQueryStatus,
} from '@/api/supportQuery'
import { formatOrderDateTime } from '@/lib/format'
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, supportStatusLabel } from '@/types/api/SupportQueryDto'
import type {
  SupportCategory,
  SupportQueryDto,
  SupportQueryPaginationDto,
  SupportStatus,
} from '@/types/api/SupportQueryDto'

const PAGE_SIZE = 10
/** Characters of the message shown in the table before it is cut to a preview. */
const PREVIEW_CHARS = 110

/** Reads a pagination number that may arrive as a string, as DRF often serialises them. */
function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** One or two lines of the message, as plain text. */
function preview(message: string | null | undefined): string {
  const text = (message ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return '—'
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text
}

const STATUS_TONE: Record<string, 'solid' | 'outline' | 'subtle'> = {
  OPEN: 'solid',
  IN_PROGRESS: 'outline',
  RESOLVED: 'subtle',
}

/**
 * Admin Help Desk inbox.
 *
 * Search, category, status and paging are all SERVER-side through the endpoint's own
 * parameters, so an admin is never looking at a locally-filtered slice. Row order is the
 * backend's — it already returns unresolved queries first, then newest — and nothing here
 * re-sorts it.
 *
 * Every request carries the admin credential explicitly (see `getAdminSupportQueries`),
 * which throws before the request when there is no admin session, so a shopper's token can
 * never reach these routes.
 *
 * Customer-submitted text is rendered as plain React children throughout. There is no
 * `dangerouslySetInnerHTML` anywhere in this file, so a message containing markup is shown
 * as the characters the sender typed.
 */
export function AdminHelpDeskPage() {
  const [rows, setRows] = useState<SupportQueryDto[]>([])
  const [pagination, setPagination] = useState<SupportQueryPaginationDto | null>(null)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<SupportCategory | ''>('')
  const [status, setStatus] = useState<SupportStatus | ''>('')
  const [page, setPage] = useState(1)

  const [active, setActive] = useState<SupportQueryDto | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const savingRef = useRef(false)

  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminSupportQueries({
        page,
        page_size: PAGE_SIZE,
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(search ? { search_parameter: search } : {}),
      })
      if (current !== requestId.current) return
      // An empty array is a normal empty state, never an error.
      setRows(result.queries)
      setPagination(result.pagination)
      setEmptyMessage(result.message)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty inbox.
      setRows([])
      setPagination(null)
      setError(readSupportApiError(err, 'Something went wrong while loading the Help Desk.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [category, page, search, status])

  useEffect(() => {
    void load()
  }, [load])

  // Debounce typing so each keystroke does not fire its own request. A new search resets to
  // page 1, otherwise page 3 of the previous result set would be requested for a new query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  /** Every filter change restarts at page 1 for the same reason. */
  const changeCategory = (value: SupportCategory | '') => {
    setCategory(value)
    setPage(1)
  }
  const changeStatus = (value: SupportStatus | '') => {
    setStatus(value)
    setPage(1)
  }

  const handleStatusChange = async (row: SupportQueryDto, next: SupportStatus) => {
    if (savingRef.current || next === row.status) return
    savingRef.current = true
    setSavingId(row.id)
    setNotice(null)
    setError(null)

    try {
      const updated = await updateSupportQueryStatus({ id: row.id, status: next })
      if (updated) {
        /*
         * The response IS the new state: the complete updated query replaces the row in
         * place. No refetch, and nothing was shown as changed before the server confirmed
         * it. Replacing in place also preserves the backend's ordering — re-reading the
         * list could reorder rows under the admin mid-task.
         */
        setRows((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
        setActive((current) => (current && current.id === updated.id ? updated : current))
        setNotice('Status updated.')
      } else {
        // Confirmed, but no object came back — re-read rather than guess at the new state.
        setNotice('Status updated.')
        await load()
      }
    } catch (err) {
      if (isSupportQueryMissing(err)) {
        // Gone server-side: drop it from view and say so, rather than leaving a row that
        // cannot be acted on.
        setRows((current) => current.filter((entry) => entry.id !== row.id))
        setActive((current) => (current && current.id === row.id ? null : current))
        setNotice('That query no longer exists and has been removed from the list.')
      } else {
        setError(readSupportApiError(err, 'Could not update this query.'))
      }
    } finally {
      savingRef.current = false
      setSavingId(null)
    }
  }

  const totalRecords = num(pagination?.total_records)
  const totalPages = num(pagination?.total_pages)
  const currentPage = num(pagination?.page) ?? page

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Support</p>
          <h2>Help Desk</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Help Desk' }]} />
      </div>

      <section className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-helpdesk-search">
          Search queries
        </label>
        <input
          id="admin-helpdesk-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sender name or email"
        />

        <label className="sr-only" htmlFor="admin-helpdesk-category">
          Category
        </label>
        <select
          id="admin-helpdesk-category"
          value={category}
          onChange={(event) => changeCategory(event.target.value as SupportCategory | '')}
        >
          <option value="">All Categories</option>
          {SUPPORT_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="admin-helpdesk-status">
          Status
        </label>
        <select
          id="admin-helpdesk-status"
          value={status}
          onChange={(event) => changeStatus(event.target.value as SupportStatus | '')}
        >
          <option value="">All Statuses</option>
          {SUPPORT_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load the Help Desk" message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No queries found"
          // The envelope's own wording ("Data not found.") is written for end users.
          message={
            emptyMessage ||
            (search || category || status ? 'No queries match these filters.' : 'No one has written in yet.')
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Sender', 'Category', 'Message', 'Status', 'Received', 'Actions']}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            renderRow={(row) => (
              <>
                <td>
                  {/*
                    Linked only when the backend reports a `user_id` — a logged-out visitor
                    can submit this form, and there is no customer to open for them. The
                    destination is the admin order list filtered to that email, which is a
                    real existing screen rather than a route invented for this page.
                  */}
                  {row.user_id != null && row.email ? (
                    <Link
                      to={`/admin/orders?search=${encodeURIComponent(row.email)}`}
                      className="admin-link-button admin-link-button--name"
                    >
                      {row.name || '—'}
                    </Link>
                  ) : (
                    <div className="admin-table__primary">{row.name || '—'}</div>
                  )}
                  {row.email ? <div className="admin-table__muted">{row.email}</div> : null}
                </td>

                <td>
                  {/* The backend's own `category_label`; nothing is derived from the enum. */}
                  {row.category_label ? <AdminBadge label={row.category_label} tone="outline" /> : <span className="admin-muted">—</span>}
                </td>

                <td>
                  <div className="admin-helpdesk__preview">{preview(row.message)}</div>
                </td>

                <td>
                  {row.status ? (
                    <AdminBadge label={supportStatusLabel(row.status)} tone={STATUS_TONE[row.status] ?? 'subtle'} />
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>

                <td className="admin-table__muted">{formatOrderDateTime(row.created_at) ?? '—'}</td>

                <td className="admin-table__actions">
                  <button type="button" className="admin-link-button" onClick={() => setActive(row)}>
                    View
                  </button>
                </td>
              </>
            )}
          />

          {/* Paging follows the envelope's own block; `has_next`/`has_previous` are read
              strictly, so a response without them yields disabled controls rather than an
              invented page count. */}
          <div className="admin-pagination">
            <span>{totalRecords !== null ? `Showing ${rows.length} of ${totalRecords}` : `Showing ${rows.length}`}</span>
            <button
              type="button"
              disabled={pagination?.has_previous !== true}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <span>
              Page {currentPage}
              {totalPages ? ` of ${totalPages}` : ''}
            </span>
            <button type="button" disabled={pagination?.has_next !== true} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {active ? (
        <QueryDetail
          query={active}
          saving={savingId === active.id}
          onClose={() => setActive(null)}
          onStatusChange={(next) => void handleStatusChange(active, next)}
        />
      ) : null}
    </div>
  )
}

/**
 * The full query.
 *
 * Opened from the row data the list already holds — the complete query is in that payload,
 * so there is no second request just to show it.
 */
function QueryDetail({
  query,
  saving,
  onClose,
  onStatusChange,
}: {
  query: SupportQueryDto
  saving: boolean
  onClose: () => void
  onStatusChange: (status: SupportStatus) => void
}) {
  return (
    <div className="admin-modal__backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Query from ${query.name ?? 'customer'}`}
        className="admin-modal admin-modal--wide"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{query.name || 'Customer query'}</h3>

        <dl className="admin-money">
          <div className="admin-kv">
            <dt>Email</dt>
            <dd>{query.email || '—'}</dd>
          </div>
          <div className="admin-kv">
            <dt>Category</dt>
            <dd>{query.category_label || query.category || '—'}</dd>
          </div>
          <div className="admin-kv">
            <dt>Received</dt>
            <dd>{formatOrderDateTime(query.created_at) ?? '—'}</dd>
          </div>
          <div className="admin-kv">
            <dt>Status</dt>
            <dd>{query.status ? supportStatusLabel(query.status) : '—'}</dd>
          </div>
        </dl>

        {/*
          The message, verbatim. Rendered as a text child — never as HTML — so markup a
          sender typed appears as characters. `pre-wrap` keeps their line breaks without
          turning the text into markup.
        */}
        <p className="admin-helpdesk__message">{query.message || '—'}</p>

        <div className="admin-form">
          <div className="admin-form__field">
            <label htmlFor="helpdesk-status">Status</label>
            <select
              id="helpdesk-status"
              value={query.status ?? ''}
              disabled={saving}
              onChange={(event) => onStatusChange(event.target.value as SupportStatus)}
            >
              {/* A status the backend holds but this contract does not list stays selectable,
                  so opening the dialog can never silently rewrite it. */}
              {query.status && !SUPPORT_STATUSES.some((entry) => entry.value === query.status) ? (
                <option value={query.status}>{query.status}</option>
              ) : null}
              {SUPPORT_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-modal__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
