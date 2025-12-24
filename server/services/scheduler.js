const cron = require('node-cron');
const db = require('../db');
const tracker = require('./tracker');
const { sendCheckLog } = require('./notifications/discord');

let scheduledJob = null;
let lastCheckTime = null;

function getPollingInterval() {
  const setting = db.getSetting('poll_interval_minutes');
  const envDefault = process.env.DEFAULT_POLL_INTERVAL_MINUTES || '30';
  const minutes = parseInt(setting || envDefault, 10);
  return Math.max(5, minutes);
}

function start() {
  if (scheduledJob) {
    console.log('Scheduler already running');
    return;
  }

  const intervalMinutes = getPollingInterval();
  console.log(`Starting scheduler with ${intervalMinutes} minute interval`);

  scheduledJob = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled tracking check`);
    lastCheckTime = new Date();
    try {
      const results = await tracker.checkAllActiveShipments();
      const delivered = results.filter(r => r.isDelivered).length;
      const errors = results.filter(r => r.error).length;
      console.log(`Check complete: ${results.length} shipments, ${delivered} delivered, ${errors} errors`);

      // Send Discord webhook log
      await sendCheckLog(results);
    } catch (error) {
      console.error('Scheduled check failed:', error.message);
    }
  });

  setTimeout(async () => {
    console.log('Running initial tracking check on startup');
    lastCheckTime = new Date();
    try {
      const results = await tracker.checkAllActiveShipments();
      await sendCheckLog(results);
    } catch (error) {
      console.error('Initial check failed:', error.message);
    }
  }, 5000);
}

function stop() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('Scheduler stopped');
  }
}

function restart() {
  stop();
  start();
}

function getStatus() {
  const intervalMinutes = getPollingInterval();
  let nextCheckTime = null;
  let secondsUntilNextCheck = null;

  if (lastCheckTime && scheduledJob) {
    const nextCheck = new Date(lastCheckTime.getTime() + intervalMinutes * 60 * 1000);
    nextCheckTime = nextCheck.toISOString();
    secondsUntilNextCheck = Math.max(0, Math.floor((nextCheck - new Date()) / 1000));
  }

  return {
    running: scheduledJob !== null,
    intervalMinutes,
    lastCheckTime: lastCheckTime ? lastCheckTime.toISOString() : null,
    nextCheckTime,
    secondsUntilNextCheck
  };
}

module.exports = {
  start,
  stop,
  restart,
  getStatus
};
