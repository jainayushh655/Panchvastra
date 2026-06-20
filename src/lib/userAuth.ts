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

export function getAuthEventName() {
  return AUTH_EVENT
}

export function getAllUsers(): UserAccount[] {
  return readJson<UserAccount[]>(KEYS.users, [])
}

export function getCurrentUser(): UserSession | null {
  return readJson<UserSession | null>(KEYS.currentUser, null)
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

  const session: UserSession = { id: account.id, name: account.name, email: account.email }
  writeJson(KEYS.currentUser, session)
  emitAuthChange()
  return { ok: true, user: session }
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

  const session: UserSession = { id: found.id, name: found.name, email: found.email }
  writeJson(KEYS.currentUser, session)
  emitAuthChange()
  return { ok: true, user: session }
}

export function logoutUser() {
  localStorage.removeItem(KEYS.currentUser)
  emitAuthChange()
}
