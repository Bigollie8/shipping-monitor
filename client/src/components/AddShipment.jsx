import { useState } from 'react'
import { createShipment } from '../api'

function AddShipment({ onClose, onAdded }) {
  const [formData, setFormData] = useState({
    tracking_url: '',
    friendly_name: '',
    notify_email: false,
    notify_discord: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.tracking_url.trim()) {
      setError('Please enter a tracking URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const shipment = await createShipment(formData)
      onAdded(shipment)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add shipment')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Tracking</h2>
          <button className="btn-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tracking_url">Tracking URL *</label>
            <input
              type="url"
              id="tracking_url"
              name="tracking_url"
              value={formData.tracking_url}
              onChange={handleChange}
              placeholder="https://www.ups.com/track?tracknum=1Z999AA10123456784"
              required
            />
            <span className="form-hint">
              Paste the full tracking URL from any carrier (UPS, FedEx, USPS, DHL, Amazon)
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="friendly_name">Package Name (optional)</label>
            <input
              type="text"
              id="friendly_name"
              name="friendly_name"
              value={formData.friendly_name}
              onChange={handleChange}
              placeholder="e.g., iPhone Case, New Laptop"
            />
          </div>

          <div className="form-group">
            <label>Notify me when delivered:</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="notify_email"
                  checked={formData.notify_email}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                <span>Email</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="notify_discord"
                  checked={formData.notify_discord}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                <span>Discord</span>
              </label>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddShipment
