const nodemailer = require('nodemailer');
const db = require('../../db');

function getEmailConfig() {
  const settings = db.getAllSettings();

  return {
    host: settings.smtp_host || process.env.SMTP_HOST,
    port: parseInt(settings.smtp_port || process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: settings.smtp_user || process.env.SMTP_USER,
      pass: settings.smtp_pass || process.env.SMTP_PASS
    }
  };
}

function getNotificationEmail() {
  const settings = db.getAllSettings();
  return settings.notification_email || process.env.NOTIFICATION_EMAIL;
}

function isEnabled() {
  const settings = db.getAllSettings();
  return settings.email_enabled === 'true';
}

async function createTransporter() {
  const config = getEmailConfig();

  if (!config.host || !config.auth.user || !config.auth.pass) {
    throw new Error('Email not configured. Please set SMTP settings.');
  }

  return nodemailer.createTransport(config);
}

async function sendEmail({ subject, shipment, status }) {
  if (!isEnabled()) {
    console.log('Email notifications disabled');
    return;
  }

  const transporter = await createTransporter();
  const to = getNotificationEmail();

  if (!to) {
    throw new Error('No notification email configured');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #22c55e;">Package Delivered!</h2>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">${shipment.friendly_name || 'Your Package'}</h3>
        <p style="margin: 5px 0;"><strong>Carrier:</strong> ${(shipment.carrier || 'Unknown').toUpperCase()}</p>
        <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${shipment.tracking_number || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Status:</strong> ${status}</p>
      </div>
      <p>
        <a href="${shipment.tracking_url}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Tracking Details
        </a>
      </p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        Sent by Shipping Monitor
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: getEmailConfig().auth.user,
    to,
    subject,
    html
  });
}

async function sendTestEmail() {
  if (!isEnabled()) {
    throw new Error('Email notifications are disabled. Enable them in settings first.');
  }

  const transporter = await createTransporter();
  const to = getNotificationEmail();

  if (!to) {
    throw new Error('No notification email configured');
  }

  await transporter.sendMail({
    from: getEmailConfig().auth.user,
    to,
    subject: 'Shipping Monitor - Test Email',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Test Email</h2>
        <p>Your email notifications are configured correctly!</p>
        <p style="color: #6b7280; font-size: 12px;">Sent by Shipping Monitor</p>
      </div>
    `
  });
}

module.exports = {
  sendEmail,
  sendTestEmail,
  isEnabled,
  getEmailConfig
};
