function run(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_url TEXT NOT NULL,
      carrier TEXT,
      tracking_number TEXT,
      friendly_name TEXT,
      current_status TEXT DEFAULT 'Pending',
      is_delivered INTEGER DEFAULT 0,
      last_checked_at TEXT,
      last_status_change_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      notify_email INTEGER DEFAULT 0,
      notify_discord INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      status TEXT,
      location TEXT,
      details TEXT,
      timestamp TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shipment_id) REFERENCES shipments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_shipments_delivered ON shipments(is_delivered)');
  db.run('CREATE INDEX IF NOT EXISTS idx_history_shipment ON status_history(shipment_id)');
}

module.exports = { run };
