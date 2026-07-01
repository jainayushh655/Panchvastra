import api from './axios'
import type { Category } from '@/types/category'

interface CategoryResponse {
  success: boolean
  message: string
  data: Category[]
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<CategoryResponse>(
    '/categories_management/'
  )

  return response.data.data
}