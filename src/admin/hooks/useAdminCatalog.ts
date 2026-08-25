import { useCallback, useEffect, useState } from 'react'
import { getProducts } from '@/api/product'
import { getCategories } from '@/api/category'
import type { ProductDto } from '@/types/api/ProductDto'
import type { CategoryDto } from '@/types/api/CategoryDto'

type AsyncState<T> = {
  data: T
  loading: boolean
  error: string | null
  reload: () => void
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status) return `The server responded with an error (${status}).`
  }
  if (error instanceof Error && error.message) return fallback
  return fallback
}

/**
 * Reads the REAL product catalog through the existing storefront API client
 * (`getProducts()` → GET /v1/products_management/). No new endpoint, no changed contract —
 * the admin list simply stops rendering hardcoded placeholder rows.
 */
export function useAdminProducts(): AsyncState<ProductDto[]> {
  const [data, setData] = useState<ProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getProducts()
      .then((rows) => {
        if (cancelled) return
        setData(Array.isArray(rows) ? rows : [])
      })
      .catch((err) => {
        if (cancelled) return
        setData([])
        setError(errorMessage(err, 'Something went wrong while loading products.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload }
}

/** Reads real categories via the existing `getCategories()` (GET /v1/categories_management/). */
export function useAdminCategories(): AsyncState<CategoryDto[]> {
  const [data, setData] = useState<CategoryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getCategories()
      .then((rows) => {
        if (cancelled) return
        setData(Array.isArray(rows) ? rows : [])
      })
      .catch((err) => {
        if (cancelled) return
        setData([])
        setError(errorMessage(err, 'Something went wrong while loading categories.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload }
}
