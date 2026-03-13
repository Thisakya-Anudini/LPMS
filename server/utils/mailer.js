import nodemailer from 'nodemailer';

const buildTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0) || 587;
  const pass = process.env.SMTP_PASS;
  const user = process.env.SMTP_USER || process.env.MAIL_FROM;
  if (!host || !user || !pass) {
    return null;
  }

  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(port) === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

let cachedTransporter = null;

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
  }
  return cachedTransporter;
};

export const ensureMailerConfigured = () => {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_PASS and MAIL_FROM.');
  }
  return transporter;
};

export const sendLearningPathAssignmentEmail = async ({
  to,
  learnerName,
  learningPathTitle
}) => {
  const transporter = ensureMailerConfigured();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const safeName = learnerName || 'there';
  const subject = 'Learning Path Assigned';
  const text = [
    `Hi ${safeName},`,
    '',
    `You have been assigned to the learning path "${learningPathTitle}".`,
    'Please log in to LPMS to begin.',
    '',
    'Regards,',
    'LPMS'
  ].join('\n');

  return transporter.sendMail({
    from,
    to,
    subject,
    text
  });
};

export const sendLearningPathCompletionEmail = async ({
  to,
  learnerName,
  learningPathTitle
}) => {
  const transporter = ensureMailerConfigured();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const safeName = learnerName || 'there';
  const subject = 'Learning Path Completed';
  const text = [
    `Hi ${safeName},`,
    '',
    `Congratulations! You have successfully completed "${learningPathTitle}".`,
    'You can now download your completion certificate from the Certificates tab in LPMS.',
    '',
    'Regards,',
    'LPMS'
  ].join('\n');

  return transporter.sendMail({
    from,
    to,
    subject,
    text
  });
};
