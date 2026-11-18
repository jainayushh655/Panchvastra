import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminTable } from '@/admin/components/AdminTable'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { getCategories } from '@/api/category'
import {
  SIZE_CHART_MAX_COLUMNS,
  SIZE_CHART_MAX_ROWS,
  SIZE_CHART_UNITS,
  createSizeChart,
  deleteSizeChart,
  getSizeCharts,
  readSizeChartApiError,
  updateSizeChart,
  validateSizeChart,
  type SizeChartDto,
} from '@/api/sizeCharts'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { SizeChartUnit } from '@/types/api/ProductDetailDto'

/**
 * Size charts — one per category.
 *
 * This is the admin side of the table the product page now shows in its Size Guide. It
 * replaces the old arrangement entirely: three PNG files in `public/images/` and a
 * hardcoded category→artwork map in `src/lib/sizeChart.ts`, which needed a code change and
 * a deploy to cover a new category.
 *
 * The editor is a real grid rather than a textarea of CSV, because the backend rejects a
 * ragged table outright — every row must have exactly one value per header — and a grid
 * makes that impossible to get wrong by construction rather than by validation.
 */

const DEFAULT_HEADERS = ['Size', 'Chest', 'Length']
const DEFAULT_ROWS = [
  ['S', '', ''],
  ['M', '', ''],
  ['L', '', ''],
]

type ChartForm = {
  id: number | null
  categoryId: string
  unit: SizeChartUnit
  headers: string[]
  rows: string[][]
  notes: string
  isActive: boolean
}

function emptyForm(): ChartForm {
  return {
    id: null,
    categoryId: '',
    unit: 'IN',
    headers: [...DEFAULT_HEADERS],
    rows: DEFAULT_ROWS.map((row) => [...row]),
    notes: '',
    isActive: true,
  }
}

function formFromChart(chart: SizeChartDto): ChartForm {
  return {
    id: chart.id,
    categoryId: String(chart.category_id),
    unit: chart.unit,
    headers: [...(chart.headers ?? [])],
    rows: (chart.rows ?? []).map((row) => [...row]),
    notes: chart.notes ?? '',
    isActive: chart.is_active !== false,
  }
}

export function AdminSizeChartsPage() {
  const [charts, setCharts] = useState<SizeChartDto[]>([])
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [form, setForm] = useState<ChartForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<SizeChartDto | null>(null)

  /** Synchronous guard — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      // Categories come along because the picker needs them and the list needs to know
      // which categories still have no chart.
      const [chartList, categoryList] = await Promise.all([getSizeCharts(true), getCategories()])
      if (current !== requestId.current) return
      setCharts(chartList)
      setCategories(categoryList)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty list.
      setCharts([])
      setError(readSizeChartApiError(err, 'Something went wrong while loading size charts.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Categories that have no chart yet — the only ones a NEW chart may target. */
  const usedCategoryIds = new Set(charts.map((chart) => chart.category_id))
  const availableCategories = categories.filter(
    (category) => !usedCategoryIds.has(category.id) || String(category.id) === form?.categoryId,
  )

  const updateForm = (patch: Partial<ChartForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  const setCell = (rowIndex: number, cellIndex: number, value: string) => {
    setForm((current) => {
      if (!current) return current
      const rows = current.rows.map((row, index) =>
        index === rowIndex ? row.map((cell, position) => (position === cellIndex ? value : cell)) : row,
      )
      return { ...current, rows }
    })
  }

  const setHeader = (index: number, value: string) => {
    setForm((current) => {
      if (!current) return current
      return { ...current, headers: current.headers.map((header, i) => (i === index ? value : header)) }
    })
  }

  /** Columns and rows are added to the header AND every row together, so the grid stays rectangular. */
  const addColumn = () => {
    setForm((current) => {
      if (!current || current.headers.length >= SIZE_CHART_MAX_COLUMNS) return current
      return {
        ...current,
        headers: [...current.headers, ''],
        rows: current.rows.map((row) => [...row, '']),
      }
    })
  }

  const removeColumn = (index: number) => {
    setForm((current) => {
      if (!current || current.headers.length <= 1) return current
      return {
        ...current,
        headers: current.headers.filter((_, i) => i !== index),
        rows: current.rows.map((row) => row.filter((_, i) => i !== index)),
      }
    })
  }

  const addRow = () => {
    setForm((current) => {
      if (!current || current.rows.length >= SIZE_CHART_MAX_ROWS) return current
      return { ...current, rows: [...current.rows, current.headers.map(() => '')] }
    })
  }

  const removeRow = (index: number) => {
    setForm((current) => {
      if (!current || current.rows.length <= 1) return current
      return { ...current, rows: current.rows.filter((_, i) => i !== index) }
    })
  }

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const categoryId = Number(form.categoryId)
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      setFormError('Choose a category.')
      return
    }

    // Mirrors the backend's own rules so the admin is told which row is wrong, rather
    // than getting a generic 400.
    const invalid = validateSizeChart(form.headers, form.rows)
    if (invalid) {
      setFormError(invalid)
      return
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    const payload = {
      category_id: categoryId,
      unit: form.unit,
      headers: form.headers.map((header) => header.trim()),
      rows: form.rows.map((row) => row.map((cell) => cell.trim())),
      notes: form.notes.trim(),
      is_active: form.isActive,
    }

    try {
      if (form.id === null) await createSizeChart(payload)
      else await updateSizeChart({ id: form.id, ...payload })

      setForm(null)
      setNotice(form.id === null ? 'Size chart created.' : 'Size chart updated.')
      // Nothing is changed locally on the client's say-so — the list is re-read.
      await load()
    } catch (err) {
      setFormError(readSizeChartApiError(err, 'Could not save this size chart.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return

    const target = pendingDelete
    setPendingDelete(null)
    setActionError(null)

    try {
      await deleteSizeChart(target.id)
      setNotice('Size chart deleted.')
      await load()
    } catch (err) {
      setActionError(readSizeChartApiError(err, 'Could not delete this size chart.'))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Size Charts</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Size Charts' }]} />
      </div>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="admin-toolbar">
        <p className="admin-muted">
          One chart per category. It appears on every product in that category as the
          &ldquo;Size Guide&rdquo; link.
        </p>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setFormError(null)
            setForm(emptyForm())
          }}
          disabled={loading || categories.length === usedCategoryIds.size}
        >
          Add Size Chart
        </button>
      </div>

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load size charts" message={error} onRetry={load} />
      ) : charts.length === 0 ? (
        <AdminEmptyState
          title="No size charts yet"
          message="Add one per category so shoppers can check measurements before choosing a size."
        />
      ) : (
        <AdminTable
          headers={['Category', 'Unit', 'Columns', 'Rows', 'Status', 'Actions']}
          rows={charts}
          getRowKey={(row) => String(row.id)}
          renderRow={(row) => (
            <>
              <td className="admin-table__primary">{row.category_name}</td>
              <td>{row.unit === 'CM' ? 'Centimetres' : 'Inches'}</td>
              <td>{row.headers?.length ?? 0}</td>
              <td>{row.rows?.length ?? 0}</td>
              <td>
                <AdminBadge label={row.is_active ? 'Active' : 'Inactive'} tone={row.is_active ? 'solid' : 'outline'} />
              </td>
              <td className="admin-table__actions">
                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => {
                    setFormError(null)
                    setForm(formFromChart(row))
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-link-button admin-link-button--danger"
                  onClick={() => setPendingDelete(row)}
                >
                  Delete
                </button>
              </td>
            </>
          )}
        />
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={() => !saving && setForm(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form.id === null ? 'Add size chart' : 'Edit size chart'}
            className="admin-modal admin-modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Size Chart' : 'Edit Size Chart'}</h3>

            <div className="admin-form">
              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="size-chart-category">Category</label>
                  <select
                    id="size-chart-category"
                    value={form.categoryId}
                    // A saved chart cannot be moved to another category — that would be a
                    // delete and a create, and the backend's one-per-category rule makes
                    // the intermediate state impossible.
                    disabled={form.id !== null}
                    onChange={(e) => updateForm({ categoryId: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form__field">
                  <label htmlFor="size-chart-unit">Unit</label>
                  <select
                    id="size-chart-unit"
                    value={form.unit}
                    onChange={(e) => updateForm({ unit: e.target.value as SizeChartUnit })}
                  >
                    {SIZE_CHART_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form__field">
                <label>Measurements</label>
                <div className="admin-table-card" style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {form.headers.map((header, index) => (
                          <th key={index} scope="col">
                            <input
                              aria-label={`Column ${index + 1} heading`}
                              value={header}
                              placeholder="Heading"
                              onChange={(e) => setHeader(index, e.target.value)}
                            />
                            {form.headers.length > 1 ? (
                              <button
                                type="button"
                                className="admin-link-button admin-link-button--danger"
                                onClick={() => removeColumn(index)}
                                aria-label={`Remove column ${index + 1}`}
                              >
                                Remove
                              </button>
                            ) : null}
                          </th>
                        ))}
                        <th scope="col" aria-label="Row actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>
                              <input
                                aria-label={`Row ${rowIndex + 1}, ${form.headers[cellIndex] || `column ${cellIndex + 1}`}`}
                                value={cell}
                                onChange={(e) => setCell(rowIndex, cellIndex, e.target.value)}
                              />
                            </td>
                          ))}
                          <td className="admin-table__actions">
                            {form.rows.length > 1 ? (
                              <button
                                type="button"
                                className="admin-link-button admin-link-button--danger"
                                onClick={() => removeRow(rowIndex)}
                                aria-label={`Remove row ${rowIndex + 1}`}
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-toolbar">
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={addColumn}
                    disabled={form.headers.length >= SIZE_CHART_MAX_COLUMNS}
                  >
                    Add column
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={addRow}
                    disabled={form.rows.length >= SIZE_CHART_MAX_ROWS}
                  >
                    Add row
                  </button>
                </div>

                <p className="admin-muted">
                  Up to {SIZE_CHART_MAX_COLUMNS} columns and {SIZE_CHART_MAX_ROWS} rows. Every row needs a
                  value in every column.
                </p>
              </div>

              <div className="admin-form__field">
                <label htmlFor="size-chart-notes">Notes</label>
                <textarea
                  id="size-chart-notes"
                  rows={2}
                  value={form.notes}
                  placeholder="Oversized fit. Size down for a regular fit."
                  onChange={(e) => updateForm({ notes: e.target.value })}
                />
              </div>

              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateForm({ isActive: e.target.checked })}
                />
                Active
              </label>

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : form.id === null ? 'Create Size Chart' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete size chart"
        message={`Delete the size chart for ${pendingDelete?.category_name ?? 'this category'}? Products in it will no longer show a Size Guide.`}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
