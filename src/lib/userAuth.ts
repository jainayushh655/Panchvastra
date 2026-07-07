import { http } from '@/lib/api'
import { KEYS, readJson, writeJson } from '@/lib/storage'

export type UserAccount = {
  id: string
  name: string
  email: string
  password: string
  createdAt: string
}

export type UserSession = {
  id: string
  name: string
  email: string
}

const AUTH_EVENT = 'pv_auth_changed'

function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function persistSession(account: UserAccount) {
  const session: UserSession = { id: account.id, name: account.name, email: account.email }
  writeJson(KEYS.currentUser, session)
  emitAuthChange()
  return { ok: true as const, user: session }
}

function ensureAccountForEmail(email: string): UserAccount {
  const normalizedEmail = normalizeEmail(email)
  const users = getAllUsers()
  const existing = users.find((u) => normalizeEmail(u.email) === normalizedEmail)
  if (existing) return existing

  const account: UserAccount = {
    id: `usr_${Math.random().toString(36).slice(2, 10)}`,
    name: normalizedEmail.split('@')[0] || normalizedEmail,
    email: normalizedEmail,
    password: '',
    createdAt: new Date().toISOString(),
  }

  writeJson(KEYS.users, [account, ...users])
  return account
}

export function getAuthEventName() {
  return AUTH_EVENT
}

export function getAllUsers(): UserAccount[] {
  return readJson<UserAccount[]>(KEYS.users, [])
}

export function getCurrentUser(): UserSession | null {
  return readJson<UserSession | null>(KEYS.currentUser, null)
}

export function isAuthenticated(): boolean {
  return Boolean(getCurrentUser())
}

export function signupUser(input: { name: string; email: string; password: string }):
  | { ok: true; user: UserSession }
  | { ok: false; error: string } {
  const email = normalizeEmail(input.email)
  const users = getAllUsers()
  if (users.some((u) => normalizeEmail(u.email) === email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }

  const account: UserAccount = {
    id: `usr_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name.trim(),
    email,
    password: input.password,
    createdAt: new Date().toISOString(),
  }

  writeJson(KEYS.users, [account, ...users])
  return persistSession(account)
}

export function loginUser(input: { email: string; password: string }):
  | { ok: true; user: UserSession }
  | { ok: false; error: string } {
  const email = normalizeEmail(input.email)
  const users = getAllUsers()
  const found = users.find((u) => normalizeEmail(u.email) === email)
  if (!found || found.password !== input.password) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  return persistSession(found)
}

export async function sendOtpForEmail(input: { email: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email)
  if (!email) {
    return { ok: false, error: 'Email is required.' }
  }

  try {
    const { data } = await http.post<{ ok: boolean; error?: string }>('/api/auth/otp/send', { email })
    if (!data?.ok) {
      return { ok: false, error: data?.error ?? 'Unable to send OTP right now.' }
    }
    return { ok: true }
  } catch (error) {
    const message =
      typeof error === 'object' && error && 'response' in error
        ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Unable to send OTP right now.')
        : 'Unable to send OTP right now.'

    return { ok: false, error: message }
  }
}

export async function verifyOtpAndLogin(input: { email: string; otp: string }): Promise<{ ok: true; user: UserSession } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email)
  if (!email) {
    return { ok: false, error: 'Email is required.' }
  }

  try {
    const { data } = await http.post<{ ok: boolean; error?: string }>('/api/auth/otp/verify', { email, otp: input.otp.trim() })
    if (!data?.ok) {
      return { ok: false, error: data?.error ?? 'Unable to verify OTP.' }
    }

    return persistSession(ensureAccountForEmail(email))
  } catch (error) {
    const message =
      typeof error === 'object' && error && 'response' in error
        ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Unable to verify OTP.')
        : 'Unable to verify OTP.'

    return { ok: false, error: message }
  }
}

export function logoutUser() {
  localStorage.removeItem(KEYS.currentUser)
  emitAuthChange()
}
