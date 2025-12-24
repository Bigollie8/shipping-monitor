import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { deleteShipment, checkShipment } from '../api'

function ShipmentCard({ shipment, onDeleted, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const getStatusColor = (status, isDelivered) => {
    if (isDelivered) return 'status-delivered'
    const s = status?.toLowerCase() || ''
    if (s.includes('transit') || s.includes('shipped')) return 'status-transit'
    if (s.includes('out for delivery')) return 'status-out'
    if (s.includes('exception') || s.includes('error')) return 'status-exception'
    return 'status-pending'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never'
    try {
      const date = new Date(dateStr)
      return format(date, 'MMM d, yyyy h:mm a')
    } catch {
      return dateStr
    }
  }

  const formatRelative = (dateStr) => {
    if (!dateStr) return ''
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ''
    }
  }

  const handleCheck = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setChecking(true)
    try {
      await checkShipment(shipment.id)
      onRefresh()
    } catch (err) {
      console.error('Check failed:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleDelete = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this shipment?')) return
    setDeleting(true)
    try {
      await deleteShipment(shipment.id)
      onDeleted(shipment.id)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  const carrierDisplay = shipment.carrier
    ? shipment.carrier.toUpperCase()
    : 'Unknown Carrier'

  return (
    <Link to={`/shipment/${shipment.id}`} className="shipment-card">
      <div className="shipment-card-header">
        <div className="shipment-info">
          <h3 className="shipment-name">
            {shipment.friendly_name || `Package ${shipment.id}`}
          </h3>
          <div className="shipment-carrier">
            {carrierDisplay}
            {shipment.tracking_number && (
              <span className="tracking-number">{shipment.tracking_number}</span>
            )}
          </div>
        </div>
        <div className={`status-badge ${getStatusColor(shipment.current_status, shipment.is_delivered)}`}>
          {shipment.is_delivered === 1 && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
          {shipment.current_status || 'Pending'}
        </div>
      </div>

      <div className="shipment-card-footer">
        <div className="last-update">
          <span className="label">Last checked:</span>
          <span className="value">{formatDate(shipment.last_checked_at)}</span>
          <span className="relative">{formatRelative(shipment.last_checked_at)}</span>
        </div>

        <div className="shipment-actions">
          {shipment.notify_email && (
            <span className="notification-badge" title="Email notifications enabled">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </span>
          )}
          {shipment.notify_discord && (
            <span className="notification-badge" title="Discord notifications enabled">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
              </svg>
            </span>
          )}
          <button
            className="btn-icon"
            onClick={handleCheck}
            disabled={checking}
            title="Check now"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={checking ? 'spin' : ''}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </Link>
  )
}

export default ShipmentCard
