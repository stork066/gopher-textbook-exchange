import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import './TextbookDetailPage.css'

function ConditionBadge({ condition }) {
  const cls = condition === 'New' || condition === 'Like New' ? 'badge-green'
    : condition === 'Good' ? 'badge-yellow' : 'badge-orange'
  return <span className={`tb-badge ${cls}`}>{condition}</span>
}

export default function TextbookDetailPage() {
  const { id } = useParams()
  const [textbook, setTextbook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/textbooks/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => { if (data) { setTextbook(data); setLoading(false) } })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="tb-detail-page">
        <div className="tb-detail-skeleton">
          <div className="tb-sk-img-lg" />
          <div className="tb-sk-content">
            <div className="sk-line" style={{ width: '60%', height: 24 }} />
            <div className="sk-line" style={{ width: '40%', height: 14 }} />
            <div className="sk-line" style={{ width: '30%', height: 14 }} />
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="tb-detail-page">
        <div className="tb-not-found">
          <h2>Textbook not found</h2>
          <Link to="/textbooks" className="back-link">← Back to Textbooks</Link>
        </div>
      </div>
    )
  }

  const listings = textbook.listings || []

  return (
    <div className="tb-detail-page">
      <Link to="/textbooks" className="back-link">← Back to Textbooks</Link>

      <div className="tb-detail-layout">
        <div className="tb-detail-img-col">
          <img
            src={textbook.canonical_image_url || 'https://placehold.co/300x420?text=Textbook'}
            alt={textbook.title}
            className="tb-detail-img"
            onError={(e) => { e.target.src = 'https://placehold.co/300x420?text=Textbook' }}
          />
        </div>

        <div className="tb-detail-info">
          <h1 className="tb-detail-title">{textbook.title}</h1>
          <p className="tb-detail-author">{textbook.author}</p>
          {textbook.edition && <p className="tb-detail-edition">{textbook.edition} Edition</p>}
          <p className="tb-detail-isbn">ISBN: {textbook.isbn}</p>
        </div>
      </div>

      <section className="tb-listings-section">
        <h2>Available Listings ({listings.length})</h2>

        {listings.length === 0 ? (
          <p className="tb-no-listings">No listings available for this textbook right now.</p>
        ) : (
          <div className="tb-listings-list">
            {listings.map((l) => (
              <Link key={l.listing_id} to={`/listing/${l.listing_id}`} className="tb-listing-item">
                <div className="tb-listing-info">
                  <span className="tb-listing-course">{l.course_department} {l.course_number}</span>
                  <ConditionBadge condition={l.condition} />
                  <span className="tb-listing-seller">by {l.seller_name}</span>
                </div>
                <span className="tb-listing-price">${Number(l.price).toFixed(2)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
