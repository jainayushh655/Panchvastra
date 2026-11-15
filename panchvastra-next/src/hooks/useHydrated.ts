'use client'

import { useEffect, useState } from 'react'

/**
 * False during the server render and the first client render; true from the second.
 *
 * WHY THIS EXISTS. Several pieces of this application derive what they render from
 * `localStorage`: the signed-in user in the navbar, the wishlist count badge, the cart
 * badge, the admin session. The server has no storage, so it always renders the
 * signed-out version. If the first CLIENT render reads storage and renders the signed-in
 * version instead, the two trees disagree and React throws the server HTML away.
 *
 * The failure mode is quiet, which is what makes it dangerous: no crash, just a hydration
 * warning in the console and a first paint that flickers from signed-out to signed-in —
 * or, worse, silently stays wrong if the mismatch happens inside a conditional subtree.
 *
 * HOW TO USE IT. Render the same thing the server rendered until this returns true:
 *
 *     const hydrated = useHydrated()
 *     // Server and first client render agree on "0"; the real count appears after.
 *     return <span>{hydrated ? wishlistCount : 0}</span>
 *
 * WHEN NOT TO USE IT. This is for presentation that depends on client-only state. It is
 * not a way to delay a data fetch, and it is not authentication: a route guard must still
 * check the session, because hiding UI is not access control.
 *
 * The effect runs once and the state never goes back to false, so this costs exactly one
 * extra render per mounting component and nothing thereafter.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
