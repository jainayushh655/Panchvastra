import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import {
  customRequestFields as F,
  getAdminCustomRequest,
  getAdminCustomRequests,
  isCustomRequestMissing,
  readCustomRequestApiError,
  updateCustomRequest,
} from '@/api/customRequests'
import { CUSTOM_REQUEST_STATUSES } from '@/types/api/CustomPieceDto'
import type {
  CustomRequestDto,
  CustomRequestPaginationDto,
  CustomRequestStatus,
} from '@/types/api/CustomPieceDto'

/**
 * Admin — Custom Piece requests (the enquiries customers send from /custom-piece).
 *
 * Reads `GET /v1/custom_requests/` with the ADMIN token, which the endpoint documents as
 * returning every customer's requests (a customer token returns only their own). Search,
 * status filter and paging use the documented query parameters; the status values come
 * from the published `UpdateCustomRequestStatusEnum`.
 *
 * The response BODY is undocumented — see `CustomRequestDto`. Every display value is read
 * through the `customRequestFields` accessors, so an unexpected key shows an empty cell
 * rather than breaking the screen.
 */

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350

/** Reads a pagination number that may arrive as a string, as DRF often serialises them. */
function num(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

/**
 * ISO 8601 in the VIEWER's local timezone, e.g. "8 Oct 2026, 9:14 AM".
 *
 * Deliberately not the store-timezone formatter the Orders screens use: those render in
 * Asia/Kolkata because an order's timestamps are the shop's own. An enquiry is read by
 * whoever is at the desk, so it uses their clock.
 */
function formatLocal(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`
}

/** WhatsApp deep link from the request's own country code and number. */
function whatsAppUrl(countryCode: string | null, phone: string | null): string | null {
  const digits = `${countryCode ?? ''}${phone ?? ''}`.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export function AdminCustomRequestsPage() {
  const [rows, setRows] = useState<CustomRequestDto[]>([])
  const [pagination, setPagination] = useState<CustomRequestPaginationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [detail, setDetail] = useState<CustomRequestDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draftStatus, setDraftStatus] = useState<string>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAdminCustomRequests({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search_parameter: search } : {}),
        ...(status ? { status } : {}),
      })
      setRows(result.rows)
      setPagination(result.pagination)
    } catch (err) {
      setError(readCustomRequestApiError(err, 'Unable to load custom requests.'))
      setRows([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    void load()
  }, [load])

  /** Typing settles before a request goes out, and every filter change restarts at page 1. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  const openDetail = async (row: CustomRequestDto) => {
    setDetail(row)
    setDraftStatus(F.statusValue(row) ?? '')
    setNote('')
    setActionError(null)
    setDetailLoading(true)
    try {
      // The list row may not carry history; `?id=` is documented to return it.
      const full = await getAdminCustomRequest(row.id)
      if (full) {
        setDetail(full)
        setDraftStatus(F.statusValue(full) ?? '')
      }
    } catch (err) {
      if (isCustomRequestMissing(err)) {
        setRows((current) => current.filter((r) => r.id !== row.id))
        setDetail(null)
        setActionError('That request no longer exists.')
      } else {
        // The row we already have still renders; only the history is missing.
        setActionError(readCustomRequestApiError(err, 'Could not load the full request.'))
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetail(null)
    setNote('')
    setActionError(null)
  }

  /**
   * Any status may move to any other, including reopening something already delivered or
   * cancelled — the endpoint documents no transition rules, so none are invented here.
   */
  const handleUpdate = async () => {
    if (!detail || saving) return

    const statusChanged = draftStatus && draftStatus !== (F.statusValue(detail) ?? '')
    const hasNote = note.trim().length > 0
    if (!statusChanged && !hasNote) {
      setActionError('Change the status or write a note first.')
      return
    }

    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateCustomRequest({
        id: detail.id,
        ...(statusChanged ? { status: draftStatus as CustomRequestStatus } : {}),
        ...(hasNote ? { note: note.trim() } : {}),
      })

      if (updated) {
        // Replaced from the API's own response, never from what was sent.
        setDetail(updated)
        setDraftStatus(F.statusValue(updated) ?? '')
        setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)))
        setNote('')
        setNotice('Request updated.')
      } else {
        // A 2xx that carried no object: re-read rather than assume what changed.
        setNote('')
        await load()
        const full = await getAdminCustomRequest(detail.id)
        if (full) setDetail(full)
        setNotice('Request updated.')
      }
    } catch (err) {
      if (isCustomRequestMissing(err)) {
        setRows((current) => current.filter((r) => r.id !== detail.id))
        setDetail(null)
        setActionError('That request no longer exists.')
      } else {
        setActionError(readCustomRequestApiError(err, 'Could not update this request.'))
      }
      // The note stays in the box so nothing typed is lost.
    } finally {
      setSaving(false)
    }
  }

  const totalRecords = num(pagination?.total_records)
  const totalPages = num(pagination?.total_pages)
  const currentPage = num(pagination?.current_page) ?? page
  const hasNext = pagination?.has_next ?? (totalPages !== null ? currentPage < totalPages : rows.length === PAGE_SIZE)
  const hasPrevious = pagination?.has_previous ?? currentPage > 1

  const detailHistory = useMemo(() => (detail ? F.history(detail) : []), [detail])

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Custom Piece</p>
          <h2>Custom Requests</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Custom Requests' }]} />
      </div>

      <section className="admin-toolbar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: 1 }}>
          <label htmlFor="cr-search" className="sr-only">
            Search custom requests
          </label>
          <input
            id="cr-search"
            type="search"
            placeholder="Search name, phone, email or reference"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 240, flex: 1 }}
          />
          <label htmlFor="cr-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="cr-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {CUSTOM_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <span className="admin-muted">{totalRecords !== null ? `${totalRecords} total` : ''}</span>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError && !detail ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load custom requests" message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No custom requests"
          message={
            search || status
              ? 'No request matches these filters.'
              : 'Requests customers send from the Custom Piece page will appear here.'
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Reference', 'Customer', 'Piece', 'Design', 'Status', 'Received', '']}
            rows={rows}
            getRowKey={(r) => String(r.id)}
            renderRow={(row) => {
              const wa = whatsAppUrl(F.countryCode(row), F.phone(row))
              const design = F.designUrl(row)
              return (
                <>
                  <td className="admin-table__primary">{F.reference(row)}</td>
                  <td>
                    <span className="admin-table__primary">{F.customerName(row) ?? '—'}</span>
                    <br />
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer noopener" className="admin-link-button">
                        {`${F.countryCode(row) ?? ''} ${F.phone(row) ?? ''}`.trim()}
                      </a>
                    ) : (
                      <span className="admin-table__muted">—</span>
                    )}
                    {F.email(row) ? (
                      <>
                        <br />
                        <span className="admin-table__muted">{F.email(row)}</span>
                      </>
                    ) : null}
                  </td>
                  <td className="admin-table__muted">
                    {[F.garment(row), F.colour(row), F.size(row), F.printType(row)].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>
                    {design ? (
                      <a href={design} target="_blank" rel="noreferrer noopener" className="admin-link-button">
                        View file
                      </a>
                    ) : (
                      <span className="admin-helpdesk__preview">{F.description(row) ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    <AdminBadge label={F.statusLabel(row) ?? '—'} tone="outline" />
                  </td>
                  <td className="admin-table__muted">{formatLocal(F.createdAt(row))}</td>
                  <td className="admin-table__actions">
                    <button type="button" className="admin-link-button" onClick={() => void openDetail(row)}>
                      View
                    </button>
                  </td>
                </>
              )
            }}
          />

          <section className="admin-toolbar">
            <span className="admin-muted">
              Page {currentPage}
              {totalPages !== null ? ` of ${totalPages}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={!hasPrevious}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}

      {detail ? (
        <div className="admin-modal__backdrop" onClick={closeDetail}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Custom request ${F.reference(detail)}`}
            className="admin-modal admin-modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Request {F.reference(detail)}</h3>

            <div className="admin-kv">
              <span>Customer</span>
              <span>{F.customerName(detail) ?? '—'}</span>
            </div>
            <div className="admin-kv">
              <span>Phone</span>
              <span>
                {whatsAppUrl(F.countryCode(detail), F.phone(detail)) ? (
                  <a
                    href={whatsAppUrl(F.countryCode(detail), F.phone(detail)) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="admin-link-button"
                  >
                    {`${F.countryCode(detail) ?? ''} ${F.phone(detail) ?? ''}`.trim()} · WhatsApp
                  </a>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="admin-kv">
              <span>Email</span>
              <span>{F.email(detail) ?? '—'}</span>
            </div>
            <div className="admin-kv">
              <span>Piece</span>
              <span>
                {[F.garment(detail), F.colour(detail), F.size(detail), F.printType(detail)]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
            </div>
            <div className="admin-kv">
              <span>Received</span>
              <span>{formatLocal(F.createdAt(detail))}</span>
            </div>
            {F.designUrl(detail) ? (
              <div className="admin-kv">
                <span>Design file</span>
                <span>
                  <a
                    href={F.designUrl(detail) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="admin-link-button"
                  >
                    Open
                  </a>
                </span>
              </div>
            ) : null}

            {F.description(detail) ? (
              <>
                <p className="admin-page__eyebrow" style={{ marginTop: 16 }}>
                  Design description
                </p>
                {/* Plain text child, never HTML. `pre-wrap` keeps the customer's line breaks. */}
                <p className="admin-helpdesk__message">{F.description(detail)}</p>
              </>
            ) : null}

            <p className="admin-page__eyebrow" style={{ marginTop: 16 }}>
              History
            </p>
            {detailLoading ? (
              <p className="admin-muted">Loading history…</p>
            ) : detailHistory.length === 0 ? (
              <p className="admin-muted">No history yet.</p>
            ) : (
              <ul className="admin-history">
                {detailHistory.map((entry, index) => {
                  const entryStatus = F.historyStatus(entry)
                  const entryNote = F.historyNote(entry)
                  // A note-only entry is a note, not a status change — shown as such.
                  const isNoteOnly = !entryStatus && !!entryNote
                  return (
                    <li key={entry.id ?? index}>
                      <strong>{isNoteOnly ? 'Note' : (entryStatus ?? 'Updated')}</strong>
                      {entryNote ? <p className="admin-helpdesk__message">{entryNote}</p> : null}
                      <span className="admin-table__muted">
                        {[F.historyActor(entry), formatLocal(F.historyAt(entry))].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="admin-form" style={{ marginTop: 16 }}>
              <div className="admin-form__field">
                <label htmlFor="cr-detail-status">Status</label>
                <select
                  id="cr-detail-status"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  disabled={saving}
                >
                  <option value="">—</option>
                  {CUSTOM_REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                  Any status can move to any other, including reopening a closed request.
                </span>
              </div>

              <div className="admin-form__field">
                <label htmlFor="cr-detail-note">Admin note</label>
                <textarea
                  id="cr-detail-note"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  disabled={saving}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal note — not shown to the customer."
                />
              </div>

              {actionError ? (
                <p className="admin-form__error" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeDetail} disabled={saving}>
                Close
              </button>
              <button type="button" className="admin-btn" onClick={() => void handleUpdate()} disabled={saving}>
                {saving ? 'Saving…' : 'Save update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
