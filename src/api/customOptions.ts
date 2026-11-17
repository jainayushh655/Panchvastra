import axios from 'axios'
import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import type {
  CreateCustomOptionPayload,
  CustomOptionsDto,
  UpdateCustomOptionPayload,
} from '@/types/api/CustomPieceDto'

/**
 * Custom Piece options — `/v1/custom_options/`.
 *
 * GET is public and is deliberately sent with NO Authorization header. The shared `api`
 * instance attaches the shopper's bearer token to everything, and this endpoint changes its
 * response for a privileged token, so the customer-facing read uses its own bare client.
 * That keeps the storefront's view identical whether or not anyone is signed in, and means
 * a token can never widen what a shopper sees.
 *
 * Writes are admin-only and pass the admin token explicitly through `adminAuthConfig`,
 * exactly as Categories, Products and the Auth Carousel already do — the customer token can
 * never reach them.
 */

export { MissingAdminSessionError }

const PATH = '/v1/custom_options/'

/** Bare client for the public read: same base URL and timeout, no auth interceptor. */
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
})

type Envelope<T> = { success?: boolean; message?: unknown; data?: T }

const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const OFFLINE = 'Unable to connect to the server. Check your connection and try again.'

function responseOf(error: unknown) {
  return (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
}

/**
 * Flattens this backend's two `message` shapes — a plain string, or an object of
 * field -> messages — into one line. Never returns a raw stack, SQL or exception text.
 */
export function readCustomOptionMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message

  if (message && typeof message === 'object' && !Array.isArray(message)) {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) parts.push(field === 'detail' || field === 'non_field_errors' ? text : `${field}: ${text}`)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/** Per-field errors from a 400, keyed by the field the admin form shows them against. */
export function readCustomOptionFieldErrors(error: unknown): Record<string, string> {
  const response = responseOf(error)
  if (response?.status !== 400) return {}

  const message = response.data?.message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return {}

  const out: Record<string, string> = {}
  for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
    const first = Array.isArray(value)
      ? value.find((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : typeof value === 'string' && value.trim()
        ? value
        : undefined
    if (first) out[field] = first
  }
  return out
}

export function readCustomOptionApiError(error: unknown, fallback = GENERIC_FAILURE): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = responseOf(error)
  if (!response) return OFFLINE

  const status = response.status
  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage Custom Piece options.'
  if (status === 404) return 'That option no longer exists. Refresh and try again.'
  if (status === 429) return "You're making changes too quickly. Please wait a minute and try again."
  if (status && status >= 500) return GENERIC_FAILURE

  return readCustomOptionMessage(response.data?.message, fallback)
}

/** An empty, well-formed set — so a failed or partial response can never crash a render. */
const EMPTY: CustomOptionsDto = { garments: [], colours: [], sizes: [], print_types: [] }

function toOptions(data: unknown): CustomOptionsDto {
  if (!data || typeof data !== 'object') return EMPTY
  const d = data as Partial<Record<keyof CustomOptionsDto, unknown>>
  const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
  return {
    garments: list(d.garments),
    colours: list(d.colours),
    sizes: list(d.sizes),
    print_types: list(d.print_types),
  }
}

/** Public read for the storefront. No Authorization header is sent. */
export async function getCustomOptions(): Promise<CustomOptionsDto> {
  const response = await publicApi.get<Envelope<CustomOptionsDto>>(PATH)
  return toOptions(response.data?.data)
}

/** Admin read — includes inactive options and an `is_active` flag on each. */
export async function getCustomOptionsForAdmin(): Promise<CustomOptionsDto> {
  const response = await api.get<Envelope<CustomOptionsDto>>(PATH, {
    ...adminAuthConfig(),
    params: { include_inactive: true },
  })
  return toOptions(response.data?.data)
}

/**
 * Builds the multipart body.
 *
 * `colour_ids` is appended ONCE PER ID, which is what the endpoint documents ("repeat the
 * field per id in multipart") — a JSON array in a single field is not accepted. An empty
 * array is still meaningful on update, where it clears the garment's colour list, so the
 * key is omitted only when the caller passed nothing at all.
 *
 * `Content-Type` is never set by hand: the browser has to generate the multipart boundary,
 * and the shared client's JSON default is cleared so it cannot override it.
 */
function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue

    if (key === 'colour_ids') {
      for (const id of value as number[]) form.append('colour_ids', String(id))
      continue
    }

    if (value === null) {
      form.append(key, '')
      continue
    }

    if (value instanceof File) {
      form.append(key, value)
      continue
    }

    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
      continue
    }

    form.append(key, String(value))
  }

  return form
}

/** Explicitly unset so the browser supplies the multipart boundary. */
const MULTIPART = { 'Content-Type': undefined } as const

export async function createCustomOption(payload: CreateCustomOptionPayload): Promise<void> {
  const auth = adminAuthConfig()
  await api.post(PATH, toFormData(payload as unknown as Record<string, unknown>), {
    headers: { ...auth.headers, ...MULTIPART },
  })
}

export async function updateCustomOption(payload: UpdateCustomOptionPayload): Promise<void> {
  const auth = adminAuthConfig()
  await api.put(PATH, toFormData(payload as unknown as Record<string, unknown>), {
    headers: { ...auth.headers, ...MULTIPART },
  })
}

/** Soft delete — existing requests keep the option's name. */
export async function deleteCustomOption(id: number): Promise<void> {
  await api.delete(PATH, { ...adminAuthConfig(), params: { id } })
}
