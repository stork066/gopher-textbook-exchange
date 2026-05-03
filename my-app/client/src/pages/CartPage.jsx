import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useState } from 'react'
import './CartPage.css'

function StatusPill({ status }) {
  if (status === 'pending') {
    return (
      <Link to="/messages" className="cart-status-pill cart-status-pending">
        Pending — awaiting seller
      </Link>
    )
  }
  if (status === 'purchased') {
    return <span className="cart-status-pill cart-status-purchased">Purchased</span>
  }
  if (status === 'unavailable') {
    return <span className="cart-status-pill cart-status-unavailable">No longer available</span>
  }
  return null
}

export default function CartPage() {
  const { items, loading, removeFromCart, sendBuyNowRequests, itemCount } = useCart()
  const showToast = useToast()
  const [sending, setSending] = useState(false)

  const inCartItems = items.filter((i) => i.status === 'in_cart')
  const inCartTotal = inCartItems.reduce((sum, i) => sum + (i.listing?.price || 0), 0)

  async function handleRemove(listingId) {
    try {
      await removeFromCart(listingId)
      showToast('Removed from cart', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleSendRequests() {
    setSending(true)
    try {
      const data = await sendBuyNowRequests()
      const sentCount = data.sent?.length || 0
      const skippedCount = data.skipped?.length || 0
      if (sentCount > 0 && skippedCount === 0) {
        showToast(
          `Sent ${sentCount} Buy Now request${sentCount === 1 ? '' : 's'} — check Messages.`,
          'success'
        )
      } else if (sentCount > 0 && skippedCount > 0) {
        showToast(
          `Sent ${sentCount} of ${sentCount + skippedCount} — ${skippedCount} skipped (already pending or unavailable).`,
          'success'
        )
      } else {
        showToast('No requests sent — items already pending or unavailable.', 'error')
      }
    } catch (err) {
      showToast(err.message, 'error')
    }
    setSending(false)
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
                    <StatusPill status={item.status} />
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
                <span>
                  {inCartItems.length === itemCount
                    ? `Total (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`
                    : `Ready to send (${inCartItems.length} of ${itemCount})`}
                </span>
                <span className="cart-total-amount">${inCartTotal.toFixed(2)}</span>
              </div>
              <button
                className="cart-btn-primary checkout-btn"
                onClick={handleSendRequests}
                disabled={sending || inCartItems.length === 0}
              >
                {sending ? 'Sending...' : 'Send Buy Now Requests'}
              </button>
              <p className="cart-helper-text">
                Each item sends a Buy Now request to its seller. Nothing is purchased
                until the seller accepts.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
