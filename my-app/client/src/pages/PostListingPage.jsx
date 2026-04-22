import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import './PostListingPage.css'

const CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable']

const REQUIRED = ['course_department', 'course_number', 'textbook_title', 'condition', 'price']

const FIELD_LABELS = {
  course_department: 'Course Department',
  course_number: 'Course Number',
  textbook_title: 'Textbook Title',
  condition: 'Condition',
  price: 'Price',
}

function validate(form) {
  const errors = {}
  for (const field of REQUIRED) {
    if (!form[field] || String(form[field]).trim() === '') {
      errors[field] = `${FIELD_LABELS[field]} is required.`
    }
  }
  if (form.price && (isNaN(Number(form.price)) || Number(form.price) <= 0)) {
    errors.price = 'Price must be a positive number.'
  }
  return errors
}

export default function PostListingPage() {
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const showToast = useToast()
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({
    course_department: '',
    course_number: '',
    textbook_title: '',
    author: '',
    edition: '',
    condition: '',
    price: '',
    description: '',
    image_url: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {})
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setApiError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price),
      }
      if (!payload.image_url) delete payload.image_url
      const res = await authFetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.status === 201) {
        showToast('Listing posted successfully!', 'success')
        navigate(`/listing/${data.listing_id}`)
      } else {
        const msg = data.errors
          ? data.errors.map((e) => e.msg).join(', ')
          : data.error || 'Something went wrong.'
        setApiError(msg)
      }
    } catch {
      setApiError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="post-page">
      <div className="post-container">
        <h1 className="post-heading">Post a Listing</h1>
        <p className="post-subhead">
          Posting as <strong>{user?.display_name}</strong> ({user?.email})
        </p>

        {apiError && <div className="api-error">{apiError}</div>}

        <form className="post-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section-title">Course Info</div>
          <div className="form-row-2">
            <div className="form-field">
              <label>
                Department <span className="req">*</span>
              </label>
              <select name="course_department" value={form.course_department} onChange={handleChange}>
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.department_code} value={d.department_code}>
                    {d.department_code} — {d.department_name}
                  </option>
                ))}
              </select>
              {fieldErrors.course_department && (
                <span className="field-error">{fieldErrors.course_department}</span>
              )}
            </div>
            <div className="form-field">
              <label>
                Course Number <span className="req">*</span>
              </label>
              <input
                type="text"
                name="course_number"
                value={form.course_number}
                onChange={handleChange}
                placeholder="e.g. 1133"
              />
              {fieldErrors.course_number && (
                <span className="field-error">{fieldErrors.course_number}</span>
              )}
            </div>
          </div>

          <div className="form-section-title">Book Details</div>
          <div className="form-field">
            <label>
              Textbook Title <span className="req">*</span>
            </label>
            <input
              type="text"
              name="textbook_title"
              value={form.textbook_title}
              onChange={handleChange}
              placeholder="Full textbook title"
            />
            {fieldErrors.textbook_title && (
              <span className="field-error">{fieldErrors.textbook_title}</span>
            )}
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Author</label>
              <input
                type="text"
                name="author"
                value={form.author}
                onChange={handleChange}
                placeholder="Author name(s)"
              />
            </div>
            <div className="form-field">
              <label>Edition</label>
              <input
                type="text"
                name="edition"
                value={form.edition}
                onChange={handleChange}
                placeholder="e.g. 3rd"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>
                Condition <span className="req">*</span>
              </label>
              <select name="condition" value={form.condition} onChange={handleChange}>
                <option value="">Select condition...</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldErrors.condition && (
                <span className="field-error">{fieldErrors.condition}</span>
              )}
            </div>
            <div className="form-field">
              <label>
                Price <span className="req">*</span>
              </label>
              <div className="price-input-wrap">
                <span className="price-prefix">$</span>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="price-input"
                />
              </div>
              {fieldErrors.price && (
                <span className="field-error">{fieldErrors.price}</span>
              )}
            </div>
          </div>

          <div className="form-section-title">Additional Info</div>
          <div className="form-field">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the condition, any highlighting, missing pages, etc."
            />
          </div>

          <div className="form-field">
            <label>Image URL <span className="optional">(optional)</span></label>
            <input
              type="url"
              name="image_url"
              value={form.image_url}
              onChange={handleChange}
              placeholder="https://... (a placeholder will be used if blank)"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting && <span className="btn-spinner" />}
              {submitting ? 'Posting...' : 'Post Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
