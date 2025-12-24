import { useState, useEffect, useCallback } from 'react'
import { getShipments, getSchedulerStatus } from '../api'
import ShipmentCard from './ShipmentCard'
import AddShipment from './AddShipment'

function Dashboard() {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [countdown, setCountdown] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  const fetchShipments = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      const data = await getShipments()
      setShipments(data)
      setError(null)
    } catch (err) {
      setError('Failed to load shipments')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const status = await getSchedulerStatus()
      setCountdown(status.secondsUntilNextCheck)
      setLastChecked(status.lastCheckTime)
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err)
    }
  }, [])

  useEffect(() => {
    fetchShipments(true)
    fetchSchedulerStatus()

    // Refresh shipments every 15 seconds
    const shipmentInterval = setInterval(() => fetchShipments(false), 15000)

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          // Refresh when countdown reaches 0
          fetchShipments(false)
          fetchSchedulerStatus()
          return null
        }
        return prev - 1
      })
    }, 1000)

    // Sync with server every 30 seconds
    const syncInterval = setInterval(fetchSchedulerStatus, 30000)

    return () => {
      clearInterval(shipmentInterval)
      clearInterval(countdownInterval)
      clearInterval(syncInterval)
    }
  }, [fetchShipments, fetchSchedulerStatus])

  const formatCountdown = (seconds) => {
    if (seconds === null) return 'Checking...'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleShipmentAdded = (newShipment) => {
    setShipments(prev => [newShipment, ...prev])
    setShowAddForm(false)
  }

  const handleShipmentDeleted = (id) => {
    setShipments(prev => prev.filter(s => s.id !== id))
  }

  const filteredShipments = shipments.filter(s => {
    if (filter === 'active') return !s.is_delivered
    if (filter === 'delivered') return s.is_delivered
    return true
  })

  const activeCount = shipments.filter(s => !s.is_delivered).length
  const deliveredCount = shipments.filter(s => s.is_delivered).length

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Your Shipments</h1>
          <div className="shipment-stats">
            <span className="stat active">{activeCount} active</span>
            <span className="stat delivered">{deliveredCount} delivered</span>
            <span className="stat countdown" title="Time until next automatic check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', marginRight: '4px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Tracking
        </button>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({shipments.length})
        </button>
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({activeCount})
        </button>
        <button
          className={`filter-tab ${filter === 'delivered' ? 'active' : ''}`}
          onClick={() => setFilter('delivered')}
        >
          Delivered ({deliveredCount})
        </button>
      </div>

      {loading && shipments.length === 0 ? (
        <div className="loading">Loading shipments...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : filteredShipments.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <h3>No shipments found</h3>
          <p>Add a tracking URL to start monitoring your packages</p>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            Add Your First Shipment
          </button>
        </div>
      ) : (
        <div className="shipment-list">
          {filteredShipments.map(shipment => (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              onDeleted={handleShipmentDeleted}
              onRefresh={fetchShipments}
            />
          ))}
        </div>
      )}

      {showAddForm && (
        <AddShipment
          onClose={() => setShowAddForm(false)}
          onAdded={handleShipmentAdded}
        />
      )}
    </div>
  )
}

export default Dashboard
