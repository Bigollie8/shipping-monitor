import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { getShipment, updateShipment, checkShipment, deleteShipment } from '../api'

function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const fetchShipment = async () => {
    try {
      setLoading(true)
      const data = await getShipment(id)
      setShipment(data)
      setEditName(data.friendly_name || '')
      setError(null)
    } catch (err) {
      setError('Failed to load shipment')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShipment()
  }, [id])

  const handleCheck = async () => {
    setChecking(true)
    try {
      await checkShipment(id)
      await fetchShipment()
    } catch (err) {
      console.error('Check failed:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this shipment?')) return
    try {
      await deleteShipment(id)
      navigate('/')
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleSaveName = async () => {
    try {
      await updateShipment(id, { friendly_name: editName })
      setShipment(prev => ({ ...prev, friendly_name: editName }))
      setEditing(false)
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  const handleNotificationToggle = async (type) => {
    const field = type === 'email' ? 'notify_email' : 'notify_discord'
    const newValue = !shipment[field]
    try {
      await updateShipment(id, { [field]: newValue })
      setShipment(prev => ({ ...prev, [field]: newValue }))
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
    } catch {
      return dateStr
    }
  }

  const getStatusColor = (status, isDelivered) => {
    if (isDelivered) return 'status-delivered'
    const s = status?.toLowerCase() || ''
    if (s.includes('transit') || s.includes('shipped')) return 'status-transit'
    if (s.includes('out for delivery')) return 'status-out'
    if (s.includes('exception') || s.includes('error')) return 'status-exception'
    return 'status-pending'
  }

  if (loading) {
    return <div className="loading">Loading shipment...</div>
  }

  if (error || !shipment) {
    return (
      <div className="error-page">
        <h2>Shipment not found</h2>
        <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="shipment-detail">
      <div className="detail-header">
        <Link to="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="detail-card">
        <div className="detail-card-header">
          <div className="detail-title">
            {editing ? (
              <div className="edit-name">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={handleSaveName}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <h1 onClick={() => setEditing(true)} title="Click to edit">
                {shipment.friendly_name || `Package ${shipment.id}`}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="edit-icon">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </h1>
            )}
            <div className={`status-badge large ${getStatusColor(shipment.current_status, shipment.is_delivered)}`}>
              {shipment.is_delivered === 1 && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              {shipment.current_status || 'Pending'}
            </div>
          </div>
          <div className="detail-actions">
            <button className="btn btn-secondary" onClick={handleCheck} disabled={checking}>
              {checking ? 'Checking...' : 'Check Now'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>

        <div className="detail-info">
          <div className="info-row">
            <span className="info-label">Carrier</span>
            <span className="info-value">{(shipment.carrier || 'Unknown').toUpperCase()}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tracking Number</span>
            <span className="info-value">{shipment.tracking_number || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tracking URL</span>
            <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="info-value link">
              View on carrier site
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
          <div className="info-row">
            <span className="info-label">Last Checked</span>
            <span className="info-value">{formatDate(shipment.last_checked_at)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Added</span>
            <span className="info-value">{formatDate(shipment.created_at)}</span>
          </div>
        </div>

        <div className="notification-settings">
          <h3>Delivery Notifications</h3>
          <div className="notification-toggles">
            <button
              className={`toggle-btn ${shipment.notify_email ? 'active' : ''}`}
              onClick={() => handleNotificationToggle('email')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Email
            </button>
            <button
              className={`toggle-btn ${shipment.notify_discord ? 'active' : ''}`}
              onClick={() => handleNotificationToggle('discord')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
              </svg>
              Discord
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-section">
        <h2>Tracking History</h2>
        {shipment.history && shipment.history.length > 0 ? (
          <div className="timeline">
            {shipment.history.map((event, index) => (
              <div key={event.id || index} className={`timeline-item ${index === 0 ? 'latest' : ''}`}>
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <div className="timeline-status">{event.status}</div>
                  {event.location && <div className="timeline-location">{event.location}</div>}
                  {event.details && event.details !== event.status && (
                    <div className="timeline-details">{event.details}</div>
                  )}
                  <div className="timeline-date">{formatDate(event.timestamp || event.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-history">
            <p>No tracking history available yet.</p>
            <button className="btn btn-secondary" onClick={handleCheck} disabled={checking}>
              Check Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShipmentDetail
