import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './TextbooksPage.css'

export default function TextbooksPage() {
  const [textbooks, setTextbooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/textbooks')
      .then((r) => r.json())
      .then((data) => { setTextbooks(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = search.trim().length < 2
    ? textbooks
    : textbooks.filter((t) => {
        const q = search.toLowerCase()
        return (t.title || '').toLowerCase().includes(q) ||
               (t.author || '').toLowerCase().includes(q) ||
               (t.isbn || '').includes(search)
      })

  return (
    <div className="textbooks-page">
      <div className="textbooks-header">
        <h1>Textbook Catalog</h1>
        <p className="textbooks-sub">Browse available textbooks or search by title, author, or ISBN</p>
        <input
          type="text"
          className="textbooks-search"
          placeholder="Search textbooks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="textbooks-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tb-skeleton">
              <div className="tb-sk-img" />
              <div className="tb-sk-line wide" />
              <div className="tb-sk-line narrow" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="textbooks-empty">
          <p>No textbooks found.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="textbooks-grid">
          {filtered.map((tb) => (
            <Link key={tb.textbook_id} to={`/textbook/${tb.textbook_id}`} className="tb-card">
              <img
                src={tb.canonical_image_url || 'https://placehold.co/200x280?text=Textbook'}
                alt={tb.title}
                className="tb-card-img"
                onError={(e) => { e.target.src = 'https://placehold.co/200x280?text=Textbook' }}
              />
              <div className="tb-card-body">
                <h3 className="tb-card-title">{tb.title}</h3>
                <p className="tb-card-author">{tb.author}</p>
                {tb.edition && <p className="tb-card-edition">{tb.edition} Edition</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
