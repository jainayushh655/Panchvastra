import type { AdminActivityItem, AdminCategory, AdminCoupon, AdminProduct } from '@/admin/types/admin'

export const adminDashboardStats = [
  { title: 'Total Products', value: '128', accent: 'accent-purple' },
  { title: 'Total Categories', value: '24', accent: 'accent-coral' },
  { title: 'Total Coupons', value: '18', accent: 'accent-teal' },
  { title: 'Total Orders', value: '342', accent: 'accent-gold' },
  { title: 'Revenue', value: '₹3.4L', accent: 'accent-blue' },
]

export const adminProducts: AdminProduct[] = [
  { id: 'P-1001', name: 'Velvet Sari', category: 'Ethnic', price: 1890, stock: 24, status: 'Active' },
  { id: 'P-1002', name: 'Pearl Drop Set', category: 'Jewellery', price: 1290, stock: 8, status: 'Active' },
  { id: 'P-1003', name: 'Silk Kurta', category: 'Apparel', price: 2450, stock: 14, status: 'Draft' },
  { id: 'P-1004', name: 'Bridal Dupatta', category: 'Textiles', price: 3200, stock: 5, status: 'Out of Stock' },
]

export const adminCategories: AdminCategory[] = [
  { id: 'C-1', name: 'Ethnic', slug: 'ethnic', products: 42, status: 'Active' },
  { id: 'C-2', name: 'Jewellery', slug: 'jewellery', products: 31, status: 'Active' },
  { id: 'C-3', name: 'Apparel', slug: 'apparel', products: 19, status: 'Hidden' },
  { id: 'C-4', name: 'Textiles', slug: 'textiles', products: 12, status: 'Active' },
]

export const adminCoupons: AdminCoupon[] = [
  { id: 'CP-1', code: 'WELCOME10', discount: '10%', expiry: '2026-08-15', status: 'Active' },
  { id: 'CP-2', code: 'SUMMER20', discount: '20%', expiry: '2026-07-30', status: 'Scheduled' },
  { id: 'CP-3', code: 'FESTIVE15', discount: '15%', expiry: '2026-06-10', status: 'Expired' },
]

export const adminRecentActivity: AdminActivityItem[] = [
  { id: 'A-1', title: 'New product added', detail: 'Velvet Sari added to the catalog', time: '12 mins ago' },
  { id: 'A-2', title: 'Coupon updated', detail: 'WELCOME10 discount adjusted', time: '1 hr ago' },
  { id: 'A-3', title: 'Category archived', detail: 'Apparel visibility changed', time: '4 hrs ago' },
]
