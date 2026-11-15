/**
 * Every Django endpoint this application talks to, in one place.
 *
 * Transcribed from the Vite application's `src/api/*` modules — nothing here is inferred
 * and nothing is new. The paths are exactly the strings those services send today, so a
 * migrated service can switch to a constant without changing a single request.
 *
 * WHY CONSTANTS. The Vite app repeats each path literal across up to six call sites in a
 * service (list / create / update / delete / lookup). During the migration those services
 * get moved file by file, and a typo in a re-typed path would produce a 404 that looks
 * like a backend problem. Referencing one constant removes that whole class of mistake.
 *
 * The trailing slash on every path is REQUIRED — this is a Django backend with
 * `APPEND_SLASH` behaviour, and the Vite app sends it everywhere.
 */

export const ENDPOINTS = {
  /* ------------------------------------------------------------------ auth */

  /** POST — registers a customer. */
  registerUser: '/v1/register_user/',
  /** POST `{ email }` — sends the login OTP. Returns the generic message either way. */
  loginUser: '/v1/login_user/',
  /** POST `{ email, otp }` — verifies the OTP and issues the customer JWT. */
  verifyEmail: '/v1/verify_email/',
  /** POST `{ credential }` — Google ID token exchange. 200 = existing account, 201 = new. */
  googleLogin: '/v1/google_login/',
  /**
   * POST `{ email, password }`.
   *
   * PRESENT BUT UNUSED. The Vite app stopped calling this: an admin signs in through the
   * same `loginUser` -> `verifyEmail` OTP flow, and admin access is an AUTHORIZATION check
   * on the backend-issued role (`role_id === 1`). Kept in this inventory so the contract is
   * recorded, but no migrated code should call it without an explicit decision.
   */
  loginAdmin: '/v1/login_admin/',

  /* ------------------------------------------------------------- catalogue */

  /**
   * GET (public + admin), POST / PUT / DELETE (admin).
   *
   * Storefront query params: `category_id`, `sub_category_id`, `size`, `search`, `sort_by`,
   * `page`, `page_size`. Admin additionally: `id`, `tag`, `min_price`, `max_price`.
   * Detail read is `?id=<id>` on this same path — there is no `/products/<id>/` route.
   *
   * Writes accept JSON, or multipart when images are involved — see `http/multipart.ts`.
   */
  products: '/v1/products_management/',
  /** GET (public), POST / PUT / DELETE (admin). Writes are **multipart only**. */
  categories: '/v1/categories_management/',
  /** GET (public), POST / PUT / DELETE (admin). Writes are **JSON**, unlike categories. */
  subCategories: '/v1/sub_categories_management/',

  /* ------------------------------------------------------------------ cart */

  /**
   * GET / POST / PUT / DELETE — the signed-in customer's server-side cart.
   * POST `{ variant_size_id, quantity }`; PUT `{ cart_item_id, quantity }`; DELETE `?id=`.
   */
  cart: '/v1/cart_management/',

  /* -------------------------------------------------------- customer account */

  /** GET / POST / PUT / DELETE. The backend owns default-address promotion rules. */
  addresses: '/v1/address_management/',
  /** GET, and PUT as **multipart** (the avatar upload travels with the profile fields). */
  userProfile: '/v1/user_profile/',

  /* --------------------------------------------------------------- payment */

  /**
   * POST `{ address_id, coupon_code? }` — creates the application order and its Razorpay
   * order. The returned `amount` is already in paise and must never be recomputed.
   */
  checkoutPayment: '/v1/checkout_payment/',
  /**
   * POST `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`.
   * This response is the ONLY thing that makes a payment successful.
   */
  verifyPayment: '/v1/verify_payment_api/',
  /** POST `{ address_id, coupon_code? }` — Cash on Delivery. Never touches Razorpay. */
  codOrder: '/v1/cod_order/',

  /* ---------------------------------------------------------------- orders */

  /**
   * GET (customer: own orders · admin: all orders, with `search_parameter`),
   * PUT (admin: status, `tracking_id`, `courier_name`, `expected_delivery_date`, `note`).
   */
  orders: '/v1/orders/',
  /**
   * POST / DELETE — admin-only internal notes.
   *
   * ⚠️ Verified 2026-10-03 against the live host: returns **404** there. The feature
   * surfaces the API's own error until the deployment catches up. Do NOT "fix" this
   * during migration — it is a backend deployment gap, not a frontend defect.
   */
  orderNotes: '/v1/orders/notes/',
  /** PUT — admin edit of an order's shipping address. ⚠️ Also 404 on the live host. */
  orderAddress: '/v1/orders/address/',
  /** GET `?id=` — returns a **PDF binary**; needs `responseType: 'blob'`. ⚠️ Also 404. */
  orderInvoice: '/v1/orders/invoice/',

  /* --------------------------------------------------------------- coupons */

  /** GET / POST / PUT / DELETE (admin). Also read by checkout for code lookup. */
  coupons: '/v1/coupon_management/',

  /* ------------------------------------------------------------- notify me */

  /** POST is **public** (`{ variant_size_id, email }`); GET / DELETE are admin. */
  notifyMe: '/v1/notify_me/',

  /* ------------------------------------------------------------- help desk */

  /** POST — public contact form. Returns field-level validation errors. */
  supportQuery: '/v1/support_query/',
  /** GET / PUT (admin) — note the PLURAL path; it is a different route from the POST. */
  supportQueries: '/v1/support_queries/',

  /* ---------------------------------------------------------- custom piece */

  /**
   * GET is **public and must be sent WITHOUT an Authorization header** — the endpoint
   * changes its response for a privileged token, so the storefront read uses a bare
   * client (see `http/client.ts` → `publicApi`). Admin GET adds `include_inactive=true`.
   * Writes are admin-only and **multipart**.
   */
  customOptions: '/v1/custom_options/',
  /** POST (customer, **multipart** with a reference file); GET / PUT (admin). */
  customRequests: '/v1/custom_requests/',

  /* -------------------------------------------------------- auth carousel */

  /** GET (public, drives the home hero and the auth screens); writes admin **multipart**. */
  authCarousel: '/v1/auth_carousel/',
} as const

export type EndpointPath = (typeof ENDPOINTS)[keyof typeof ENDPOINTS]

/**
 * Endpoints whose 401 belongs to the CALLER and must never end the session.
 *
 * Ported verbatim from the Vite app's `src/api/axios.ts`. Two groups, two reasons:
 *
 * Sign-in endpoints: a wrong password, a wrong OTP and a rejected Google credential all
 * arrive as 401. Treating those as an expired session would clear the (non-existent)
 * session and bounce the visitor back to the login screen they are already on — a
 * redirect loop that hides the message explaining what went wrong.
 *
 * Payment and order endpoints: non-idempotent POSTs where money or an order may already
 * have moved. Signing someone out mid-checkout would drop them at the worst possible
 * moment and would set up a replay-after-login hazard. Each screen already shows a
 * deliberate message for a 401 on these.
 */
export const CALLER_HANDLED_401: readonly string[] = [
  // Sign-in
  ENDPOINTS.loginUser,
  ENDPOINTS.registerUser,
  ENDPOINTS.verifyEmail,
  ENDPOINTS.googleLogin,
  ENDPOINTS.loginAdmin,
  // Payment / order placement
  ENDPOINTS.checkoutPayment,
  ENDPOINTS.verifyPayment,
  ENDPOINTS.codOrder,
] as const
