import api from './axios'
import type { AddressCreateDto, AddressDto, AddressUpdateDto } from '@/types/api/AddressDto'

/**
 * Address Management API.
 *
 * VERIFIED LIVE against /v1/address_management/:
 *   - GET / POST / PUT / DELETE all exist (OPTIONS advertises them).
 *   - All four require authentication; unauthenticated calls return
 *     401 {"success": false, "message": "Authorization token missing.", "data": {}}
 *     and a malformed bearer returns
 *     401 {"success": false, "message": "Invalid authentication token.", "error": "...", "data": {}}
 *
 * NOT VERIFIED: the authenticated 2xx payloads. Logging in requires an OTP emailed to a
 * real account, so no authenticated session could be established from this environment.
 * The `data` shapes below follow this backend's confirmed convention — every endpoint
 * wraps payloads in `{ success, message, data }`, and list endpoints put the array
 * directly in `data` (verified on /v1/categories_management/). `readList` additionally
 * tolerates a nested array so an unexpected wrapper degrades to an empty list rather
 * than crashing the page.
 *
 * Auth headers, base URL and interceptors all come from the shared `api` client — no new
 * HTTP layer and no separate token.
 */

type AddressEnvelope<T> = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: T
}

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readAddressApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message
  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }
  return fallback
}

/** Turns any thrown request error into a user-safe message (never a raw stack/trace). */
export function readAddressApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: AddressEnvelope<unknown> } }).response

  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 404) return 'That address could not be found. It may already have been removed.'
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readAddressApiMessage(response.data?.message, fallback)
}

function readList(data: unknown): AddressDto[] {
  if (Array.isArray(data)) return data as AddressDto[]
  if (data && typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as AddressDto[]
    }
  }
  return []
}

function readOne(data: unknown): AddressDto | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (typeof record.id === 'number' || typeof record.id === 'string') return data as AddressDto
  const nested = readList(data)
  return nested.length ? nested[0] : null
}

/** GET /v1/address_management/ — all addresses for the authenticated user. */
export async function getAddresses(): Promise<AddressDto[]> {
  const response = await api.get<AddressEnvelope<unknown>>('/v1/address_management/')
  return readList(response.data?.data)
}

/** GET /v1/address_management/?id=<id> — a single address. */
export async function getAddressById(id: number | string): Promise<AddressDto | null> {
  const response = await api.get<AddressEnvelope<unknown>>('/v1/address_management/', { params: { id } })
  return readOne(response.data?.data)
}

/**
 * POST /v1/address_management/ — creates an address. Per the API contract the backend
 * decides the resulting default state, so callers must re-fetch rather than assume.
 * Returns the created record when the response includes it, otherwise null.
 */
export async function createAddress(payload: AddressCreateDto): Promise<AddressDto | null> {
  const response = await api.post<AddressEnvelope<unknown>>('/v1/address_management/', payload)
  return readOne(response.data?.data)
}

/**
 * PUT /v1/address_management/ — updates an address. Sending `is_default: true` makes it
 * the default and the backend unsets the previous one; the frontend never touches the
 * other records.
 */
export async function updateAddress(payload: AddressUpdateDto): Promise<AddressDto | null> {
  const response = await api.put<AddressEnvelope<unknown>>('/v1/address_management/', payload)
  return readOne(response.data?.data)
}

/**
 * DELETE /v1/address_management/?id=<id>. If the removed address was the default, the
 * backend promotes another one — callers re-fetch instead of recomputing that locally.
 */
export async function deleteAddress(id: number | string): Promise<void> {
  await api.delete<AddressEnvelope<unknown>>('/v1/address_management/', { params: { id } })
}
