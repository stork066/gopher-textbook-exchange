import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import ImageUploader from '../components/ImageUploader'
import './ListingDetailPage.css'

const PLACEHOLDER = 'https://placehold.co/400x600?text=Textbook'

function imagesFor(listing) {
  if (!listing) return []
  if (Array.isArray(listing.image_urls) && listing.image_urls.length > 0) {
    return listing.image_urls
  }
  return listing.image_url ? [listing.image_url] : []
}

function ConditionBadge({ condition }) {
  const cls =
    condition === 'New' || condition === 'Like New'
      ? 'badge badge-green'
      : condition === 'Good'
      ? 'badge badge-yellow'
      : 'badge badge-orange'
  return <span className={cls}>{condition}</span>
}

function StatusBadge({ status }) {
  const cls =
    status === 'Available'
      ? 'badge badge-green'
      : status === 'Pending'
      ? 'badge badge-yellow'
      : 'badge badge-gray'
  return <span className={cls}>{status}</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const { addToCart } = useCart()
  const showToast = useToast()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)

  // Gallery + image-edit state
  const [selectedImgIdx, setSelectedImgIdx] = useState(0)
  const [editingImages, setEditingImages] = useState(false)
  const [draftImages, setDraftImages] = useState([])
  const [savingImages, setSavingImages] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    fetch(`/api/listings/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => { if (data) { setListing(data); setLoading(false); setSelectedImgIdx(0) } })
      .catch(() => {
        showToast('Failed to load listing. Please try again.', 'error')
        setNotFound(true)
        setLoading(false)
      })
  }, [id, showToast])

  const images = useMemo(() => imagesFor(listing), [listing])
  const mainImage = images[selectedImgIdx] || images[0] || PLACEHOLDER

  const isOwner = user && listing && listing.seller_id === user.user_id
  const isAvailable = listing && listing.status === 'Available'

  async function handleBuyNow() {
    if (!user) { navigate('/login'); return }
    setBuyingNow(true)
    try {
      const res = await authFetch(`/api/listings/${id}/buy-now`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        showToast('Purchase successful!', 'success')
        setListing((prev) => ({ ...prev, status: 'Sold' }))
      } else {
        showToast(data.error || 'Purchase failed', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setBuyingNow(false)
  }

  async function handleAddToCart() {
    if (!user) { navigate('/login'); return }
    setAddingToCart(true)
    try {
      await addToCart(id)
      showToast('Added to cart!', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
    setAddingToCart(false)
  }

  async function handleMakeOffer(e) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (!offerAmount || Number(offerAmount) <= 0) {
      showToast('Enter a valid offer amount', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await authFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: id,
          message: offerMessage || `I'd like to offer $${Number(offerAmount).toFixed(2)} for this textbook.`,
          offer_amount: Number(offerAmount),
        }),
      })
      if (res.ok) {
        showToast('Offer sent! Check your messages.', 'success')
        setOfferAmount('')
        setOfferMessage('')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to send offer', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setSubmitting(false)
  }

  function startEditImages() {
    setDraftImages([...images])
    setEditingImages(true)
  }

  function cancelEditImages() {
    setDraftImages([])
    setEditingImages(false)
  }

  async function saveEditImages() {
    if (draftImages.length === 0) {
      showToast('At least one photo is required.', 'error')
      return
    }
    setSavingImages(true)
    try {
      const res = await authFetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_urls: draftImages,
          image_url: draftImages[0],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setListing(data)
      setSelectedImgIdx(0)
      setEditingImages(false)
      setDraftImages([])
      showToast('Photos updated.', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save photos', 'error')
    }
    setSavingImages(false)
  }

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-skeleton">
          <div className="sk-img" />
          <div className="sk-content">
            <div className="sk-line xs" />
            <div className="sk-line xl" />
            <div className="sk-line lg" />
            <div className="sk-line md" />
            <div className="sk-line sm" />
            <div className="sk-line md" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="detail-page">
        <div className="not-found">
          <div className="not-found-icon">🔍</div>
          <h2>Listing not found</h2>
          <p>This listing may have been removed or the link is incorrect.</p>
          <Link to="/listings" className="back-link">← Back to Listings</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <div className="detail-container">
        <Link to="/listings" className="back-link">← Back to Listings</Link>

        <div className="detail-layout">
          <div className="detail-img-col">
            {editingImages ? (
              <div className="image-edit-panel">
                <ImageUploader value={draftImages} onChange={setDraftImages} disabled={savingImages} />
                <div className="image-edit-actions">
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={saveEditImages}
                    disabled={savingImages || draftImages.length === 0}
                  >
                    {savingImages && <span className="btn-spinner" />}
                    {savingImages ? 'Saving...' : 'Save Photos'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={cancelEditImages}
                    disabled={savingImages}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={mainImage}
                  alt={listing.textbook_title}
                  className="detail-img"
                  onError={(e) => { e.target.src = PLACEHOLDER }}
                />
                {images.length > 1 && (
                  <div className="gallery-thumbs" role="listbox" aria-label="Listing photos">
                    {images.map((url, idx) => (
                      <button
                        key={url + idx}
                        type="button"
                        role="option"
                        aria-selected={idx === selectedImgIdx}
                        className={`gallery-thumb${idx === selectedImgIdx ? ' gallery-thumb-active' : ''}`}
                        onClick={() => setSelectedImgIdx(idx)}
                      >
                        <img
                          src={url}
                          alt={`${listing.textbook_title} photo ${idx + 1}`}
                          onError={(e) => { e.target.src = PLACEHOLDER }}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className="btn-manage-images"
                    onClick={startEditImages}
                  >
                    Manage Photos
                  </button>
                )}
              </>
            )}
          </div>

          <div className="detail-info-col">
            <p className="detail-course">
              {listing.course_department} {listing.course_number}
            </p>
            <h1 className="detail-title">{listing.textbook_title}</h1>

            {listing.author && (
              <p className="detail-meta">
                <span className="meta-label">Author</span> {listing.author}
              </p>
            )}
            {listing.edition && (
              <p className="detail-meta">
                <span className="meta-label">Edition</span> {listing.edition}
              </p>
            )}

            <div className="detail-badges">
              <ConditionBadge condition={listing.condition} />
              <StatusBadge status={listing.status} />
            </div>

            <p className="detail-price">${Number(listing.price).toFixed(2)}</p>

            {listing.description && (
              <p className="detail-description">{listing.description}</p>
            )}

            {isAvailable && !isOwner && (
              <div className="detail-actions">
                <button className="btn-buy-now" onClick={handleBuyNow} disabled={buyingNow}>
                  {buyingNow ? 'Processing...' : 'Buy Now'}
                </button>
                <button className="btn-add-cart" onClick={handleAddToCart} disabled={addingToCart}>
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
              </div>
            )}

            {isOwner && (
              <p className="owner-notice">This is your listing.</p>
            )}

            <div className="seller-box">
              <p className="seller-label">Seller</p>
              <p className="seller-name">{listing.seller_name}</p>
              <p className="seller-contact">{listing.seller_contact}</p>
            </div>

            <p className="detail-date">
              Posted on {formatDate(listing.created_at)}
            </p>
          </div>
        </div>

        {isAvailable && !isOwner && (
          <div className="offer-section">
            <h2 className="offer-heading">Make an Offer</h2>
            <form className="offer-form" onSubmit={handleMakeOffer}>
              <div className="form-row">
                <div className="form-field">
                  <label>Offer Amount ($) <span className="req">*</span></label>
                  <input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder={`e.g. ${Math.round(listing.price * 0.85)}`}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Message (optional)</label>
                  <input
                    type="text"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder="I can meet on campus..."
                  />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting && <span className="btn-spinner" />}
                {submitting ? 'Sending...' : 'Send Offer'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
