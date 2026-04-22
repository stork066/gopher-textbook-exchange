import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user, authFetch } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); return }
    setLoading(true)
    try {
      const res = await authFetch('/api/cart')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [user, authFetch])

  useEffect(() => { fetchCart() }, [fetchCart])

  const addToCart = useCallback(async (listingId) => {
    const res = await authFetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add to cart')
    await fetchCart()
    return data
  }, [authFetch, fetchCart])

  const removeFromCart = useCallback(async (listingId) => {
    const res = await authFetch(`/api/cart/items/${listingId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to remove from cart')
    await fetchCart()
    return data
  }, [authFetch, fetchCart])

  const checkout = useCallback(async () => {
    const res = await authFetch('/api/cart/checkout', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Checkout failed')
    await fetchCart()
    return data
  }, [authFetch, fetchCart])

  const itemCount = items.length

  return (
    <CartContext.Provider value={{ items, loading, itemCount, addToCart, removeFromCart, checkout, fetchCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
