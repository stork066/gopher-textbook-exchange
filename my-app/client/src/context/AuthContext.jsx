import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(!!token)

  // Validate token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => { setUser(data.user); setLoading(false) })
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
        setLoading(false)
      })
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const signup = useCallback(async (email, password, display_name) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name }),
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.errors
        ? data.errors.map((e) => e.msg).join(', ')
        : data.error || 'Signup failed'
      throw new Error(msg)
    }
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  const authFetch = useCallback((url, options = {}) => {
    const t = localStorage.getItem('token')
    const headers = { ...options.headers }
    if (t) headers.Authorization = `Bearer ${t}`
    return fetch(url, { ...options, headers })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
