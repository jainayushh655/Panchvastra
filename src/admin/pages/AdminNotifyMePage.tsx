import { useCallback, useEffect, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { deleteAdminNotifyMeRequest, getAdminNotifyMeRequests, readAdminNotifyApiError } from '@/api/notifyMe'
import type { AdminNotifyMeRequestDto, NotifyMePagination } from '@/types/api/NotifyMeDto'

/** The backend's own default page size for this endpoint. */
const PAGE_SIZE = 20

/** Formats the backend's timestamp for display only — the stored value is never modified. */
function formatRequestedAt(value: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Reads the backend's stock number without adding any stock logic of its own. */
function stockLabel(quantity: number): string {
  if (quantity <= 0) return 'Out of stock'
  return quantity === 1 ? '1 available' : `${quantity} available`
}

/**
 * Admin restock waitlist.
 *
 * Every column comes straight from GET /v1/notify_me/, which already joins the product,
 * variant and size — no product catalogue request is made from this page. Paging is
 * server-side using the endpoint's own `page` / `page_size`.
 */
export function AdminNotifyMePage() {
  const [requests, setRequests] = useState<AdminNotifyMeRequestDto[]>([])
  const [pagination, setPagination] = useState<NotifyMePagination | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<AdminNotifyMeRequestDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Synchronous guard — state updates are not immediate, so a double click could double-send. */
  const deletingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminNotifyMeRequests({ page, page_size: PAGE_SIZE })
      if (current !== requestId.current) return
      setRequests(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty waitlist.
      setRequests([])
      setPagination(undefined)
      setError(readAdminNotifyApiError(err, 'Something went wrong while loading notify requests.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async () => {
    if (!pendingDelete || deletingRef.current) return

    deletingRef.current = true
    setDeleting(true)
    setActionError(null)

    try {
      await deleteAdminNotifyMeRequest(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Notify request removed.')
      // Nothing is removed locally on the client's say-so — the list is re-read.
      await load()
    } catch (err) {
      setActionError(readAdminNotifyApiError(err, 'Could not remove this notify request.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  /*
   * An empty page is reported by `total_records`, never by `total_pages` — the backend
   * sends `total_pages: 1` even when there are no records at all.
   */
  const totalRecords = pagination?.total_records ?? requests.length
  const isEmpty = requests.length === 0 && totalRecords === 0
  const totalPages = Math.max(1, pagination?.total_pages ?? 1)

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Demand</p>
          <h2>Notify Me</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Notify Me' }]} />
      </div>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load notify requests" message={error} onRetry={load} />
      ) : isEmpty ? (
        <AdminEmptyState
          title="No notify requests"
          message="Nobody is currently waiting for a restock notification."
        />
      ) : (
        <>
          <AdminTable
            headers={['Product', 'Color', 'Size', 'Customer Email', 'Stock', 'Requested', 'Status', 'Action']}
            rows={requests}
            getRowKey={(row) => String(row.id)}
            renderRow={(row) => (
              <>
                <td className="admin-table__primary">{row.product_name}</td>
                <td>{row.color}</td>
                <td>{row.size}</td>
                <td>{row.email}</td>
                <td>{stockLabel(row.stock_quantity)}</td>
                <td className="admin-table__muted">{formatRequestedAt(row.created_at)}</td>
                <td>
                  <AdminBadge
                    label={row.is_notified ? 'Notified' : 'Waiting'}
                    tone={row.is_notified ? 'solid' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    disabled={deleting}
                    onClick={() => {
                      setActionError(null)
                      setPendingDelete(row)
                    }}
                  >
                    Remove
                  </button>
                </td>
              </>
            )}
          />

          <div className="admin-pagination">
            <span>
              Showing {requests.length} of {totalRecords}
            </span>
            <button
              type="button"
              disabled={pagination ? !pagination.has_previous : page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <span>
              Page {pagination?.current_page ?? page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={pagination ? !pagination.has_next : true}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Remove notify request?"
        message={
          pendingDelete
            ? `This removes ${pendingDelete.email}'s request to be notified when ${pendingDelete.product_name} (${pendingDelete.color}, size ${pendingDelete.size}) is back in stock. They will not receive a restock email.`
            : ''
        }
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
