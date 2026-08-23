import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AddressProvider } from './context/AddressProvider'
import { AuthProvider } from './context/AuthProvider'
import { CartProvider } from './context/CartProvider'
import { WishlistProvider } from './context/WishlistProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <AddressProvider>
              <App />
            </AddressProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
