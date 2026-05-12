const nodemailer = require('nodemailer');

function readBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function getTransportConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return {
    host,
    port,
    secure: readBool(process.env.SMTP_SECURE),
    auth: { user, pass },
  };
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const config = getTransportConfig();
  if (!config) return null;
  transporter = nodemailer.createTransport(config);
  return transporter;
}

function getResetBaseUrl() {
  return process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:5173/reset-password';
}

function buildResetLink(rawToken) {
  const base = getResetBaseUrl();
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(rawToken)}`;
}

async function sendPasswordResetEmail({ to, displayName, rawToken }) {
  const client = getTransporter();
  const resetLink = buildResetLink(rawToken);

  if (!client) {
    console.warn('[mailer] SMTP is not configured. Reset link:', resetLink);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const safeName = displayName || 'Traveler';

  await client.sendMail({
    from,
    to,
    subject: 'Travel Planner 密碼重設',
    text: [
      `Hi ${safeName},`,
      '',
      '你收到這封信是因為有人請求重設你的密碼。',
      '請點擊以下連結以重設密碼（30 分鐘內有效）：',
      resetLink,
      '',
      '如果不是你本人操作，請忽略此信件。',
    ].join('\n'),
    html: [
      `<p>Hi ${safeName},</p>`,
      '<p>你收到這封信是因為有人請求重設你的密碼。</p>',
      '<p>請點擊以下連結以重設密碼（30 分鐘內有效）：</p>',
      `<p><a href="${resetLink}">${resetLink}</a></p>`,
      '<p>如果不是你本人操作，請忽略此信件。</p>',
    ].join(''),
  });
}

module.exports = { sendPasswordResetEmail, buildResetLink };