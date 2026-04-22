import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, NavLink, Link } from 'react-router-dom'
import './App.css'
import Toast from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastContext } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider, useCart } from './context/CartContext'
import HomePage from './pages/HomePage'
import ListingsPage from './pages/ListingsPage'
import ListingDetailPage from './pages/ListingDetailPage'
import PostListingPage from './pages/PostListingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MessagesPage from './pages/MessagesPage'
import CartPage from './pages/CartPage'
import AccountPage from './pages/AccountPage'

function AppContent() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const { user } = useAuth()
  const { itemCount } = useCart()
  const [unreadCount, setUnreadCount] = useState(0)

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  // Poll unread messages count
  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    const token = localStorage.getItem('token')
    function fetchUnread() {
      fetch('/api/conversations/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : { count: 0 })
        .then((d) => setUnreadCount(d.count))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [user])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <ToastContext.Provider value={showToast}>
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand" onClick={closeMenu}>
          GopherBooks
        </NavLink>

        <ul className={`navbar-links${menuOpen ? ' open' : ''}`}>
          <li><NavLink to="/" end onClick={closeMenu}>Home</NavLink></li>
          <li><NavLink to="/listings" onClick={closeMenu}>Browse Listings</NavLink></li>

          {user ? (
            <>
              <li><NavLink to="/post" onClick={closeMenu}>Sell</NavLink></li>
              <li>
                <NavLink to="/messages" onClick={closeMenu} className="nav-badge-link">
                  Messages
                  {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/cart" onClick={closeMenu} className="nav-badge-link">
                  Cart
                  {itemCount > 0 && <span className="nav-badge">{itemCount}</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/account" onClick={closeMenu} className="nav-account">
                  {user.display_name.split(' ')[0]}
                </NavLink>
              </li>
            </>
          ) : (
            <>
              <li><NavLink to="/login" onClick={closeMenu}>Log In</NavLink></li>
              <li>
                <Link to="/signup" onClick={closeMenu} className="nav-signup-btn">
                  Sign Up
                </Link>
              </li>
            </>
          )}
        </ul>

        <button
          className={`hamburger${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
<Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/post" element={
            <ProtectedRoute><PostListingPage /></ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute><MessagesPage /></ProtectedRoute>
          } />
          <Route path="/cart" element={
            <ProtectedRoute><CartPage /></ProtectedRoute>
          } />
          <Route path="/account" element={
            <ProtectedRoute><AccountPage /></ProtectedRoute>
          } />
        </Routes>
      </div>

      <Toast toasts={toasts} />
    </ToastContext.Provider>
  )
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  )
}

export default App
