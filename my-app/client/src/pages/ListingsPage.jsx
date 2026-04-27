import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import DepartmentSearch from '../components/DepartmentSearch'
import './ListingsPage.css'

const CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable']
const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

function ConditionBadge({ condition }) {
  const cls =
    condition === 'New' || condition === 'Like New'
      ? 'badge badge-green'
      : condition === 'Good'
      ? 'badge badge-yellow'
      : 'badge badge-orange'
  return <span className={cls}>{condition}</span>
}

export default function ListingsPage() {
  const showToast = useToast()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [department, setDepartment] = useState('')
  const [courseNumberInput, setCourseNumberInput] = useState('') // immediate (displayed)
  const [courseNumber, setCourseNumber] = useState('')           // debounced (fetched)
  const [conditions, setConditions] = useState([])
  const [sort, setSort] = useState('newest')

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Debounce course number input → fetch param
  useEffect(() => {
    const timer = setTimeout(() => setCourseNumber(courseNumberInput), 300)
    return () => clearTimeout(timer)
  }, [courseNumberInput])

  // Reset pagination when any filter or sort changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [department, courseNumber, conditions, sort])

  const fetchListings = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    if (courseNumber) params.set('course_number', courseNumber)
    params.set('sort', sort)
    fetch(`/api/listings?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => { setListings(data); setLoading(false) })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
        showToast('Failed to load listings. Please try again.', 'error')
      })
  }, [department, courseNumber, sort, showToast])

  useEffect(() => { fetchListings() }, [fetchListings])

  const filteredListings =
    conditions.length === 0
      ? listings
      : listings.filter((l) => conditions.includes(l.condition))

  const visibleListings = filteredListings.slice(0, visibleCount)
  const hasMore = visibleCount < filteredListings.length

  function toggleCondition(c) {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  function clearFilters() {
    setDepartment('')
    setCourseNumberInput('')
    setCourseNumber('')
    setConditions([])
    setSort('newest')
  }

  const hasFilters = department || courseNumberInput || conditions.length > 0

  return (
    <div className="listings-page">
      <aside className="filters-panel">
        <div className="filters-header">
          <h2>Filters</h2>
          {hasFilters && (
            <button className="clear-btn" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>

        <div className="filter-group">
          <label className="filter-label">Department</label>
          <DepartmentSearch
            value={department}
            onChange={setDepartment}
            placeholder="All Departments"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Course Number</label>
          <input
            type="text"
            placeholder="e.g. 1133"
            value={courseNumberInput}
            onChange={(e) => setCourseNumberInput(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Condition</label>
          <div className="checkbox-list">
            {CONDITIONS.map((c) => (
              <label key={c} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={conditions.includes(c)}
                  onChange={() => toggleCondition(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Sort By</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="filter-select"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </aside>

      <main className="listings-main">
        <div className="listings-header">
          <h1>Browse Listings</h1>
        </div>

        {loading && (
          <div className="skeleton-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-img" />
                <div className="skeleton-body">
                  <div className="skeleton-line narrow" />
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line mid" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="fetch-error">
            <p>Failed to load listings.</p>
            <button className="retry-btn" onClick={fetchListings}>Retry</button>
          </div>
        )}

        {!loading && !error && filteredListings.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p>No listings match your filters.</p>
            <button className="clear-btn-lg" onClick={clearFilters}>Clear Filters</button>
          </div>
        )}

        {!loading && !error && filteredListings.length > 0 && (
          <>
            <p className="showing-count">
              Showing {visibleListings.length} of {filteredListings.length}{' '}
              {filteredListings.length === 1 ? 'listing' : 'listings'}
            </p>

            <div className="card-grid">
              {visibleListings.map((listing) => (
                <Link
                  key={listing.listing_id}
                  to={`/listing/${listing.listing_id}`}
                  className="listing-card"
                >
                  <div className="card-img-wrap">
                    <img
                      src={listing.image_url || 'https://placehold.co/400x600?text=Textbook'}
                      alt={listing.textbook_title}
                      className="card-img"
                      onError={(e) => { e.target.src = 'https://placehold.co/400x600?text=Textbook' }}
                    />
                  </div>
                  <div className="card-body">
                    <p className="card-course">
                      {listing.course_department} {listing.course_number}
                    </p>
                    <h3 className="card-title">{listing.textbook_title}</h3>
                    {listing.description && (
                      <p className="card-description">{listing.description}</p>
                    )}
                    <div className="card-footer">
                      <span className="card-price">
                        ${Number(listing.price).toFixed(2)}
                      </span>
                      <ConditionBadge condition={listing.condition} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="load-more-wrap">
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                >
                  Load More
                  <span className="load-more-count">
                    ({filteredListings.length - visibleCount} more)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
