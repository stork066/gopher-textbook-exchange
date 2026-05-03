import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import './MessagesPage.css'

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function MessagesPage() {
  const { authFetch, user } = useAuth()
  const showToast = useToast()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await authFetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [authFetch])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const fetchMessages = useCallback(async (convoId) => {
    try {
      const res = await authFetch(`/api/conversations/${convoId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setActiveConvo(data)
      }
    } catch { /* ignore */ }
  }, [authFetch])

  useEffect(() => {
    if (!activeId) return
    fetchMessages(activeId)
    const interval = setInterval(() => fetchMessages(activeId), 5000)
    return () => clearInterval(interval)
  }, [activeId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!newMessage.trim() || !activeId) return
    setSending(true)
    try {
      const res = await authFetch(`/api/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newMessage }),
      })
      if (res.ok) {
        setNewMessage('')
        await fetchMessages(activeId)
        await fetchConversations()
      }
    } catch {
      showToast('Failed to send message', 'error')
    }
    setSending(false)
  }

  async function handleAction(action) {
    try {
      const res = await authFetch(`/api/conversations/${activeId}/${action}`, {
        method: 'POST',
      })
      if (res.ok) {
        showToast(`Offer ${action}ed`, 'success')
        await fetchMessages(activeId)
        await fetchConversations()
      }
    } catch {
      showToast(`Failed to ${action} offer`, 'error')
    }
  }

  function selectConvo(id) {
    setActiveId(id)
    setMessages([])
  }

  if (loading) {
    return (
      <div className="messages-page">
        <div className="messages-loading">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div className="messages-page">
      <div className="messages-layout">
        {/* Conversation list */}
        <aside className={`convo-list${activeId ? ' hide-mobile' : ''}`}>
          <h2 className="convo-list-title">Messages</h2>
          {conversations.length === 0 && (
            <p className="convo-empty">No conversations yet</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.conversation_id}
              className={`convo-item${c.conversation_id === activeId ? ' active' : ''}${c.has_unread ? ' unread' : ''}`}
              onClick={() => selectConvo(c.conversation_id)}
            >
              <div className="convo-item-top">
                <span className="convo-name">
                  {c.role === 'buyer' ? c.seller_name : c.buyer_name}
                </span>
                <span className="convo-time">{formatTime(c.last_message_at)}</span>
              </div>
              <div className="convo-item-title">{c.listing_title}</div>
              {c.has_unread && <span className="convo-unread-dot" />}
            </button>
          ))}
        </aside>

        {/* Message thread */}
        <main className={`message-thread${!activeId ? ' hide-mobile' : ''}`}>
          {!activeId ? (
            <div className="no-convo-selected">
              <p>Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              <div className="thread-header">
                <button className="back-to-list" onClick={() => setActiveId(null)}>
                  ←
                </button>
                <div>
                  <div className="thread-title">{activeConvo?.listing_title}</div>
                  <div className="thread-subtitle">
                    with {activeConvo?.role === 'buyer' ? activeConvo?.seller_name : activeConvo?.buyer_name}
                    {activeConvo?.listing_price && ` — $${Number(activeConvo.listing_price).toFixed(2)}`}
                  </div>
                </div>
              </div>

              <div className="message-list">
                {messages.map((m) => (
                  <div
                    key={m.message_id}
                    className={`message-bubble ${m.sender_id === user.user_id ? 'mine' : 'theirs'}${m.type !== 'text' ? ` msg-${m.type}` : ''}`}
                  >
                    <div className="bubble-body">{m.body}</div>
                    <div className="bubble-time">{formatTime(m.created_at)}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Action bar for offers/buy-now (seller only).
                  Label tracks the latest unresolved request type. */}
              {(() => {
                if (activeConvo?.role !== 'seller') return null
                if (activeConvo?.status === 'accepted' || activeConvo?.status === 'declined') return null
                let pending = null
                for (let i = messages.length - 1; i >= 0; i--) {
                  const t = messages[i].type
                  if (t === 'accept' || t === 'decline') break
                  if (t === 'offer' || t === 'counter' || t === 'buy_now') { pending = t; break }
                }
                if (!pending) return null
                return (
                  <div className="offer-actions">
                    <button className="action-accept" onClick={() => handleAction('accept')}>
                      {pending === 'buy_now' ? 'Accept Buy Now' : 'Accept Offer'}
                    </button>
                    <button className="action-decline" onClick={() => handleAction('decline')}>Decline</button>
                  </div>
                )
              })()}

              <form className="message-composer" onSubmit={handleSend}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !newMessage.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
