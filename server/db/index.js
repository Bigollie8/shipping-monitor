const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const migrations = require('./migrations');

const dbPath = path.join(__dirname, '..', '..', 'shipping.db');
let db = null;

async function initializeDb() {
  const SQL = await initSqlJs();

  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch (e) {
    db = new SQL.Database();
  }

  migrations.run(db);
  saveDb();
  console.log('Database initialized successfully');
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  return db;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getShipments() {
  return getAll(`
    SELECT * FROM shipments
    ORDER BY
      CASE WHEN is_delivered = 1 THEN 1 ELSE 0 END,
      last_status_change_at DESC
  `);
}

function getShipmentById(id) {
  return getOne('SELECT * FROM shipments WHERE id = ?', [id]);
}

function getShipmentHistory(shipmentId) {
  return getAll(`
    SELECT * FROM status_history
    WHERE shipment_id = ?
    ORDER BY timestamp DESC, created_at DESC
  `, [shipmentId]);
}

function createShipment(data) {
  runQuery(`
    INSERT INTO shipments (tracking_url, carrier, tracking_number, friendly_name, current_status, notify_email, notify_discord)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.tracking_url,
    data.carrier || null,
    data.tracking_number || null,
    data.friendly_name || null,
    data.current_status || 'Pending',
    data.notify_email ? 1 : 0,
    data.notify_discord ? 1 : 0
  ]);

  const result = getOne('SELECT last_insert_rowid() as id');
  return result.id;
}

function updateShipment(id, data) {
  const fields = [];
  const values = [];

  if (data.friendly_name !== undefined) {
    fields.push('friendly_name = ?');
    values.push(data.friendly_name);
  }
  if (data.current_status !== undefined) {
    fields.push('current_status = ?');
    values.push(data.current_status);
  }
  if (data.is_delivered !== undefined) {
    fields.push('is_delivered = ?');
    values.push(data.is_delivered ? 1 : 0);
  }
  if (data.last_checked_at !== undefined) {
    fields.push('last_checked_at = ?');
    values.push(data.last_checked_at);
  }
  if (data.last_status_change_at !== undefined) {
    fields.push('last_status_change_at = ?');
    values.push(data.last_status_change_at);
  }
  if (data.notify_email !== undefined) {
    fields.push('notify_email = ?');
    values.push(data.notify_email ? 1 : 0);
  }
  if (data.notify_discord !== undefined) {
    fields.push('notify_discord = ?');
    values.push(data.notify_discord ? 1 : 0);
  }
  if (data.carrier !== undefined) {
    fields.push('carrier = ?');
    values.push(data.carrier);
  }
  if (data.tracking_number !== undefined) {
    fields.push('tracking_number = ?');
    values.push(data.tracking_number);
  }

  if (fields.length === 0) return false;

  values.push(id);
  runQuery(`UPDATE shipments SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

function deleteShipment(id) {
  runQuery('DELETE FROM status_history WHERE shipment_id = ?', [id]);
  const before = getOne('SELECT COUNT(*) as count FROM shipments WHERE id = ?', [id]);
  runQuery('DELETE FROM shipments WHERE id = ?', [id]);
  return before && before.count > 0;
}

function addStatusHistory(data) {
  runQuery(`
    INSERT INTO status_history (shipment_id, status, location, details, timestamp, raw_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    data.shipment_id,
    data.status,
    data.location || null,
    data.details || null,
    data.timestamp || new Date().toISOString(),
    data.raw_data ? JSON.stringify(data.raw_data) : null
  ]);
}

function getSetting(key) {
  const row = getOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  const existing = getSetting(key);
  if (existing !== null) {
    runQuery('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
  } else {
    runQuery('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

function getAllSettings() {
  const rows = getAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

function getActiveShipments() {
  return getAll('SELECT * FROM shipments WHERE is_delivered = 0');
}

module.exports = {
  initializeDb,
  getDb,
  saveDb,
  getShipments,
  getShipmentById,
  getShipmentHistory,
  createShipment,
  updateShipment,
  deleteShipment,
  addStatusHistory,
  getSetting,
  setSetting,
  getAllSettings,
  getActiveShipments
};
