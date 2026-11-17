import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import type { SizeChartUnit } from '@/types/api/ProductDetailDto'

export { MissingAdminSessionError }

/**
 * Size charts — `/v1/size_charts/`.
 *
 * One chart per CATEGORY, maintained by an admin. The product detail response embeds the
 * resolved chart for the product's category, so the storefront never calls this service:
 * it exists for the admin screen only.
 *
 * This replaces the hardcoded category→PNG mapping in `src/lib/sizeChart.ts`, which could
 * only ever serve the three artwork files committed to `public/images/` and needed a code
 * change to cover a new category.
 */

const PATH = '/v1/size_charts/'

/** Backend limits, mirrored so the grid editor can stop the admin before a 400. */
export const SIZE_CHART_MAX_COLUMNS = 12
export const SIZE_CHART_MAX_ROWS = 30

export const SIZE_CHART_UNITS: { value: SizeChartUnit; label: string }[] = [
  { value: 'IN', label: 'Inches' },
  { value: 'CM', label: 'Centimetres' },
]

/** How the unit reads under the table on the storefront. */
export function sizeChartUnitLabel(unit: SizeChartUnit): string {
  return unit === 'CM' ? 'Measurements in centimetres' : 'Measurements in inches'
}

export interface SizeChartDto {
  id: number
  category_id: number
  /** Resolved server-side, so the list does not need a second call to name the category. */
  category_name: string
  unit: SizeChartUnit
  headers: string[]
  rows: string[][]
  notes: string | null
  is_active: boolean
}

export interface SizeChartWritePayload {
  category_id: number
  unit: SizeChartUnit
  headers: string[]
  rows: string[][]
  notes?: string | null
  is_active?: boolean
}

type Envelope<T> = { success?: boolean; message?: unknown; data?: T }

/** Flattens the two `message` shapes this backend uses into one displayable line. */
export function readSizeChartApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) parts.push(field === 'detail' ? text : `${field}: ${text}`)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/** Turns a thrown request error into a message that is safe to show an admin. */
export function readSizeChartApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  const message = readSizeChartApiMessage(response.data?.message, '')
  if (message) return message

  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage size charts.'
  if (status === 404) return 'That size chart could not be found.'
  // The one-chart-per-category rule.
  if (status === 409) return 'This category already has a size chart. Edit the existing one instead.'

  return fallback
}

/**
 * Client-side validation mirroring the backend's rules, so the admin gets the problem
 * pointed at the offending row instead of a generic 400.
 *
 * Returns an error string, or null when the chart is valid.
 */
export function validateSizeChart(headers: string[], rows: string[][]): string | null {
  const usableHeaders = headers.filter((header) => header.trim())
  if (usableHeaders.length === 0) return 'Add at least one column.'
  if (headers.length > SIZE_CHART_MAX_COLUMNS) return `A chart can have at most ${SIZE_CHART_MAX_COLUMNS} columns.`
  if (usableHeaders.length !== headers.length) return 'Every column needs a heading.'
  if (rows.length === 0) return 'Add at least one row.'
  if (rows.length > SIZE_CHART_MAX_ROWS) return `A chart can have at most ${SIZE_CHART_MAX_ROWS} rows.`

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    // The backend rejects a ragged table outright; naming the row is far more useful.
    if (row.length !== headers.length) {
      return `Row ${index + 1} has ${row.length} value${row.length === 1 ? '' : 's'} but the chart has ${headers.length} columns.`
    }
    if (row.every((cell) => !cell.trim())) return `Row ${index + 1} is empty.`
  }

  return null
}

/** `GET /v1/size_charts/?include_inactive=true` — every chart, for the admin list. */
export async function getSizeCharts(includeInactive = true): Promise<SizeChartDto[]> {
  const response = await api.get<Envelope<SizeChartDto[]>>(PATH, {
    ...adminAuthConfig(),
    params: includeInactive ? { include_inactive: true } : undefined,
  })
  return Array.isArray(response.data?.data) ? response.data.data : []
}

/** `POST /v1/size_charts/` — 409 when the category already has one. */
export async function createSizeChart(payload: SizeChartWritePayload): Promise<void> {
  await api.post<Envelope<SizeChartDto>>(PATH, payload, adminAuthConfig())
}

/** `PUT /v1/size_charts/` — `id` plus only the fields that changed. */
export async function updateSizeChart(payload: Partial<SizeChartWritePayload> & { id: number }): Promise<void> {
  await api.put<Envelope<SizeChartDto>>(PATH, payload, adminAuthConfig())
}

/** `DELETE /v1/size_charts/?id=…`. */
export async function deleteSizeChart(id: number): Promise<void> {
  await api.delete<Envelope<unknown>>(PATH, { ...adminAuthConfig(), params: { id } })
}
