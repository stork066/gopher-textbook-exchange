import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import './AccountPage.css'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'listings', label: 'My Listings' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'sales', label: 'Sales' },
  { id: 'profile', label: 'Profile' },
]

function StatusBadge({ status }) {
  const cls = status === 'Available' ? 'badge-green' : status === 'Pending' ? 'badge-yellow' : 'badge-gray'
  return <span className={`acct-badge ${cls}`}>{status}</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AccountPage() {
  const { user, authFetch, logout } = useAuth()
  const showToast = useToast()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [listings, setListings] = useState([])
  const [purchases, setPurchases] = useState([])
  const [sales, setSales] = useState([])
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      if (tab === 'overview') {
        const res = await authFetch('/api/account/stats')
        if (res.ok) setStats(await res.json())
      } else if (tab === 'listings') {
        const res = await authFetch('/api/account/listings')
        if (res.ok) setListings(await res.json())
      } else if (tab === 'purchases') {
        const res = await authFetch('/api/account/purchases')
        if (res.ok) setPurchases(await res.json())
      } else if (tab === 'sales') {
        const res = await authFetch('/api/account/sales')
        if (res.ok) setSales(await res.json())
      }
    } catch { /* ignore */ }
  }, [tab, authFetch])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleProfileSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authFetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      })
      if (res.ok) {
        showToast('Profile updated', 'success')
      } else {
        showToast('Failed to update profile', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setSaving(false)
  }

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-header">
          <h1>Account</h1>
          <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>

        <div className="account-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'overview' && stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.active_listings}</span>
                <span className="stat-label">Active Listings</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.sold_listings}</span>
                <span className="stat-label">Sold</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.purchases}</span>
                <span className="stat-label">Purchases</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">${stats.total_earned.toFixed(2)}</span>
                <span className="stat-label">Total Earned</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">${stats.total_spent.toFixed(2)}</span>
                <span className="stat-label">Total Spent</span>
              </div>
            </div>
          )}

          {tab === 'listings' && (
            <div className="acct-list">
              {listings.length === 0 && <p className="acct-empty">You haven't posted any listings yet.</p>}
              {listings.map((l) => (
                <div key={l.listing_id} className="acct-item">
                  <div className="acct-item-info">
                    <Link to={`/listing/${l.listing_id}`} className="acct-item-title">{l.textbook_title}</Link>
                    <p className="acct-item-meta">{l.course_department} {l.course_number} — ${Number(l.price).toFixed(2)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}

          {tab === 'purchases' && (
            <div className="acct-list">
              {purchases.length === 0 && <p className="acct-empty">No purchases yet.</p>}
              {purchases.map((t) => (
                <div key={t.transaction_id} className="acct-item">
                  <div className="acct-item-info">
                    <span className="acct-item-title">{t.listing_title}</span>
                    <p className="acct-item-meta">${Number(t.amount).toFixed(2)} — {formatDate(t.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'sales' && (
            <div className="acct-list">
              {sales.length === 0 && <p className="acct-empty">No sales yet.</p>}
              {sales.map((t) => (
                <div key={t.transaction_id} className="acct-item">
                  <div className="acct-item-info">
                    <span className="acct-item-title">{t.listing_title}</span>
                    <p className="acct-item-meta">${Number(t.amount).toFixed(2)} — {formatDate(t.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'profile' && (
            <form className="profile-form" onSubmit={handleProfileSave}>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={user?.email || ''} disabled />
              </div>
              <div className="form-field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
