import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useState } from 'react'
import './CartPage.css'

export default function CartPage() {
  const { items, loading, removeFromCart, checkout, itemCount } = useCart()
  const showToast = useToast()
  const [checkingOut, setCheckingOut] = useState(false)
  const [result, setResult] = useState(null)

  const total = items.reduce((sum, i) => sum + (i.listing?.price || 0), 0)

  async function handleRemove(listingId) {
    try {
      await removeFromCart(listingId)
      showToast('Removed from cart', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      const data = await checkout()
      setResult(data)
      showToast(`Purchased ${data.transactions.length} item(s)!`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
    setCheckingOut(false)
  }

  if (loading) {
    return (
      <div className="cart-page">
        <div className="cart-container">
          <h1>Your Cart</h1>
          <p className="cart-loading">Loading cart...</p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="cart-page">
        <div className="cart-container">
          <div className="checkout-success">
            <h1>Purchase Complete</h1>
            <p>{result.transactions.length} item(s) purchased successfully.</p>
            {result.errors.length > 0 && (
              <p className="checkout-errors">
                {result.errors.length} item(s) were no longer available.
              </p>
            )}
            <Link to="/account" className="cart-btn-primary">View Purchases</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h1>Your Cart</h1>

        {itemCount === 0 ? (
          <div className="cart-empty">
            <p>Your cart is empty.</p>
            <Link to="/listings" className="cart-browse-link">Browse Listings</Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div key={item.listing_id} className="cart-item">
                  <img
                    src={item.listing?.image_url || 'https://placehold.co/80x100?text=Book'}
                    alt={item.listing?.textbook_title}
                    className="cart-item-img"
                  />
                  <div className="cart-item-info">
                    <p className="cart-item-course">
                      {item.listing?.course_department} {item.listing?.course_number}
                    </p>
                    <h3 className="cart-item-title">
                      <Link to={`/listing/${item.listing_id}`}>
                        {item.listing?.textbook_title}
                      </Link>
                    </h3>
                    <span className={`cart-badge badge-${item.listing?.condition === 'New' || item.listing?.condition === 'Like New' ? 'green' : item.listing?.condition === 'Good' ? 'yellow' : 'orange'}`}>
                      {item.listing?.condition}
                    </span>
                  </div>
                  <div className="cart-item-right">
                    <span className="cart-item-price">
                      ${Number(item.listing?.price || 0).toFixed(2)}
                    </span>
                    <button className="cart-remove-btn" onClick={() => handleRemove(item.listing_id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="cart-total">
                <span>Total ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <span className="cart-total-amount">${total.toFixed(2)}</span>
              </div>
              <button
                className="cart-btn-primary checkout-btn"
                onClick={handleCheckout}
                disabled={checkingOut}
              >
                {checkingOut ? 'Processing...' : 'Checkout'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
