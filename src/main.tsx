import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ApiNotices } from './components/system/ApiNotices'
import { AddressProvider } from './context/AddressProvider'
import { AuthProvider } from './context/AuthProvider'
import { CartProvider } from './context/CartProvider'
import { ToastProvider } from './context/ToastProvider'
import { WishlistProvider } from './context/WishlistProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        {/* Subscribes the API layer's signals (rate limiting) to the toast stack. Renders
            nothing, and sits inside ToastProvider because that is what it consumes. */}
        <ApiNotices />
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <AddressProvider>
                <App />
              </AddressProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
