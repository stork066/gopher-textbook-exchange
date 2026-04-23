import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import './ImageUploader.css'

const MAX_FILES = 8
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ImageUploader({ value = [], onChange, disabled = false }) {
  const { authFetch } = useAuth()
  const showToast = useToast()
  const [uploading, setUploading] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState(null)
  const fileInputRef = useRef(null)

  const remainingSlots = MAX_FILES - value.length
  const canAdd = remainingSlots > 0 && !disabled && !uploading

  function openFilePicker() {
    if (canAdd) fileInputRef.current?.click()
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).slice(0, remainingSlots)
    if (files.length === 0) return

    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        showToast(`${f.name}: only JPG, PNG, or WEBP allowed`, 'error')
        return
      }
      if (f.size > MAX_SIZE) {
        showToast(`${f.name}: too large (max 10 MB)`, 'error')
        return
      }
    }

    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('images', f))
      const res = await authFetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange([...value, ...data.urls])
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error')
    }
    setUploading(false)
  }

  function handleRemove(idx) {
    const url = value[idx]
    onChange(value.filter((_, i) => i !== idx))
    authFetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {})
  }

  function handleZoneDragOver(e) {
    if (!canAdd) return
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setDropActive(true)
    }
  }
  function handleZoneDragLeave() {
    setDropActive(false)
  }
  function handleZoneDrop(e) {
    setDropActive(false)
    if (!canAdd) return
    if (e.dataTransfer.files?.length) {
      e.preventDefault()
      handleFiles(e.dataTransfer.files)
    }
  }

  function handleThumbDragStart(idx, e) {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-gopher-thumb', String(idx))
  }
  function handleThumbDragOver(idx, e) {
    if (draggedIdx === null || draggedIdx === idx) return
    e.preventDefault()
    const next = [...value]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(idx, 0, moved)
    onChange(next)
    setDraggedIdx(idx)
  }
  function handleThumbDragEnd() {
    setDraggedIdx(null)
  }

  return (
    <div className="image-uploader">
      {value.length > 0 && (
        <div className="thumb-grid">
          {value.map((url, idx) => (
            <div
              key={url}
              className={`thumb${draggedIdx === idx ? ' thumb-dragging' : ''}`}
              draggable={!disabled}
              onDragStart={(e) => handleThumbDragStart(idx, e)}
              onDragOver={(e) => handleThumbDragOver(idx, e)}
              onDragEnd={handleThumbDragEnd}
            >
              <img src={url} alt={`Upload ${idx + 1}`} draggable={false} />
              {idx === 0 && <span className="cover-badge">Cover</span>}
              {!disabled && (
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() => handleRemove(idx)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div
          className={`drop-zone${dropActive ? ' drop-zone-active' : ''}${uploading ? ' drop-zone-uploading' : ''}`}
          onClick={openFilePicker}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker() } }}
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          role="button"
          tabIndex={0}
          aria-disabled={uploading}
        >
          {uploading ? (
            <div className="drop-zone-inner">
              <span className="drop-spinner" />
              <p className="drop-primary">Uploading…</p>
            </div>
          ) : (
            <div className="drop-zone-inner">
              <div className="drop-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="M21 17l-5-5-4 4-3-3-6 6" />
                </svg>
              </div>
              <p className="drop-primary">
                Drag &amp; drop photos, or <span className="drop-link">click to choose</span>
              </p>
              <p className="drop-secondary">
                JPG, PNG, or WEBP · up to 10 MB each · {remainingSlots} more allowed
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {value.length > 1 && (
        <p className="reorder-hint">
          Drag thumbnails to reorder — the first photo is your cover.
        </p>
      )}
    </div>
  )
}
