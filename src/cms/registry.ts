/**
 * CMS field registry — use when swapping localStorage for Sanity / Payload / Directus.
 * Product shape matches `Product` + category slugs derived from `CategoryDef`.
 */
export const PRODUCT_FIELDS_DOC = [
  'id',
  'slug',
  'name',
  'categorySlug',
  'price',
  'compareAtPrice?',
  'sizes[]',
  'groupKey?',
  'variantLabel?',
  'colors[]?',
  'images[]',
  'hoverImage?',
  'description',
  'details[]',
  'rating',
  'reviewCount',
  'popularity',
  'tags[]',
  'trending?',
  'isNew?',
  'salePct?',
] as const

export const CMS_STORAGE_KEYS = {
  catalog: 'pv_cms_catalog_v3',
  orderLog: 'pv_cms_order_log_v3',
  /** sessionStorage gate for /admin */
  adminSession: 'pv_admin_session_v1',
} as const
