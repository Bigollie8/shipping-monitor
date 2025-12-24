import { useState, useEffect } from 'react'
import { getSettings, updateSettings, testEmail, testDiscord } from '../api'

function Settings() {
  const [settings, setSettings] = useState({
    poll_interval_minutes: '30',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    notification_email: '',
    discord_webhook_url: '',
    email_enabled: 'false',
    discord_enabled: 'false'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingDiscord, setTestingDiscord] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const data = await getSettings()
      setSettings(prev => ({ ...prev, ...data }))
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await updateSettings(settings)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    setMessage(null)

    try {
      await testEmail()
      setMessage({ type: 'success', text: 'Test email sent successfully!' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to send test email' })
    } finally {
      setTestingEmail(false)
    }
  }

  const handleTestDiscord = async () => {
    setTestingDiscord(true)
    setMessage(null)

    try {
      await testDiscord()
      setMessage({ type: 'success', text: 'Test Discord message sent successfully!' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to send test Discord message' })
    } finally {
      setTestingDiscord(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading settings...</div>
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        <section className="settings-section">
          <h2>Polling</h2>
          <div className="form-group">
            <label htmlFor="poll_interval_minutes">Check Interval (minutes)</label>
            <input
              type="number"
              id="poll_interval_minutes"
              name="poll_interval_minutes"
              value={settings.poll_interval_minutes}
              onChange={handleChange}
              min="5"
              max="1440"
            />
            <span className="form-hint">How often to check for updates (minimum 5 minutes)</span>
          </div>
        </section>

        <section className="settings-section">
          <h2>Email Notifications</h2>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="email_enabled"
                checked={settings.email_enabled === 'true'}
                onChange={handleChange}
              />
              <span className="checkbox-custom"></span>
              <span>Enable email notifications</span>
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="smtp_host">SMTP Host</label>
              <input
                type="text"
                id="smtp_host"
                name="smtp_host"
                value={settings.smtp_host}
                onChange={handleChange}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp_port">SMTP Port</label>
              <input
                type="number"
                id="smtp_port"
                name="smtp_port"
                value={settings.smtp_port}
                onChange={handleChange}
                placeholder="587"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="smtp_user">SMTP Username</label>
              <input
                type="text"
                id="smtp_user"
                name="smtp_user"
                value={settings.smtp_user}
                onChange={handleChange}
                placeholder="your-email@gmail.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp_pass">SMTP Password</label>
              <input
                type="password"
                id="smtp_pass"
                name="smtp_pass"
                value={settings.smtp_pass}
                onChange={handleChange}
                placeholder="App password"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notification_email">Notification Email</label>
            <input
              type="email"
              id="notification_email"
              name="notification_email"
              value={settings.notification_email}
              onChange={handleChange}
              placeholder="Where to send notifications"
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestEmail}
            disabled={testingEmail || settings.email_enabled !== 'true'}
          >
            {testingEmail ? 'Sending...' : 'Send Test Email'}
          </button>
        </section>

        <section className="settings-section">
          <h2>Discord Notifications</h2>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="discord_enabled"
                checked={settings.discord_enabled === 'true'}
                onChange={handleChange}
              />
              <span className="checkbox-custom"></span>
              <span>Enable Discord notifications</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="discord_webhook_url">Webhook URL</label>
            <input
              type="url"
              id="discord_webhook_url"
              name="discord_webhook_url"
              value={settings.discord_webhook_url}
              onChange={handleChange}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <span className="form-hint">
              Create a webhook in your Discord server settings under Integrations
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestDiscord}
            disabled={testingDiscord || settings.discord_enabled !== 'true'}
          >
            {testingDiscord ? 'Sending...' : 'Send Test Message'}
          </button>
        </section>

        <div className="settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Settings
