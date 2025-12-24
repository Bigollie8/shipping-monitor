require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

async function startServer() {
  await db.initializeDb();

  const shipmentsRouter = require('./routes/shipments');
  const settingsRouter = require('./routes/settings');
  const scheduler = require('./services/scheduler');

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.use('/api/shipments', shipmentsRouter);
  app.use('/api/settings', settingsRouter);

  app.post('/api/track/check/:id', async (req, res) => {
    try {
      const tracker = require('./services/tracker');
      const result = await tracker.checkShipment(parseInt(req.params.id));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Shipping Monitor server running on port ${PORT}`);
    scheduler.start();
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
