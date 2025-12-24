# Shipping Monitor

A self-hosted application to monitor shipping URLs and track package delivery status. Get notified via email or Discord when your packages are delivered.

## Features

- **Multi-carrier support**: UPS, FedEx, USPS, DHL, Amazon, and generic tracking URLs
- **Autonomous monitoring**: Background polling with configurable intervals
- **Smart rate limiting**: Exponential backoff to avoid carrier blocking
- **Delivery notifications**: Email and Discord webhook support
- **Clean dashboard**: View all shipments at a glance
- **Detailed tracking**: Click any shipment to see full tracking history
- **Docker support**: Easy deployment with Docker Compose

## Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm run install-all
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Start the application**:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

### Docker Deployment

1. **Build and run**:
   ```bash
   docker-compose up -d
   ```

2. Open `http://localhost:3001` in your browser.

## Configuration

Edit `.env` or configure via the Settings page in the UI:

### Polling

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_POLL_INTERVAL_MINUTES` | 30 | How often to check shipments |
| `MIN_POLL_INTERVAL_MINUTES` | 15 | Minimum allowed interval |

### Email Notifications (Optional)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server (e.g., smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username/email |
| `SMTP_PASS` | SMTP password or app password |
| `NOTIFICATION_EMAIL` | Email to receive notifications |

**Gmail Setup**: Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### Discord Notifications (Optional)

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL |

**Creating a webhook**: Server Settings > Integrations > Webhooks > New Webhook

## Usage

### Adding a Shipment

1. Click "Add Tracking" on the dashboard
2. Paste the full tracking URL from your carrier
3. Optionally add a friendly name (e.g., "New Laptop")
4. Choose notification preferences

### Supported URL Formats

- UPS: `https://www.ups.com/track?tracknum=1Z999AA10123456784`
- FedEx: `https://www.fedex.com/apps/fedextrack/?tracknumbers=794644790138`
- USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223337878532`
- DHL: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=1234567890`
- Amazon: `https://www.amazon.com/progress-tracker/package/...`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shipments` | List all shipments |
| POST | `/api/shipments` | Add new shipment |
| GET | `/api/shipments/:id` | Get shipment details + history |
| PUT | `/api/shipments/:id` | Update shipment |
| DELETE | `/api/shipments/:id` | Delete shipment |
| POST | `/api/track/check/:id` | Force check shipment |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |

## Architecture

```
shipping-monitor/
├── server/               # Express.js backend
│   ├── db/              # SQLite database
│   ├── routes/          # API endpoints
│   └── services/        # Tracking, notifications, scheduler
├── client/              # React frontend
│   └── src/
│       ├── components/  # React components
│       ├── api/         # API client
│       └── styles/      # CSS styles
├── docker-compose.yml   # Docker deployment
└── Dockerfile           # Container build
```

## Troubleshooting

### Carrier not tracking correctly

Some carriers use JavaScript-heavy pages. The application will attempt to use Puppeteer for these cases. If running locally, ensure Puppeteer is installed correctly.

### Rate limiting issues

If you see errors about rate limiting:
1. Increase the polling interval in Settings
2. The system will automatically back off on failures

### Docker Puppeteer issues

The Docker image includes Chromium. If you encounter issues:
```bash
docker-compose logs shipping-monitor
```

## License

MIT
