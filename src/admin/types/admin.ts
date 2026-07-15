export type AdminProduct = {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: 'Active' | 'Draft' | 'Out of Stock'
}

export type AdminCategory = {
  id: string
  name: string
  slug: string
  products: number
  status: 'Active' | 'Hidden'
}

export type AdminCoupon = {
  id: string
  code: string
  discount: string
  expiry: string
  status: 'Active' | 'Expired' | 'Scheduled'
}

export type AdminActivityItem = {
  id: string
  title: string
  detail: string
  time: string
}
