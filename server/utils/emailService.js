import net from 'net';
import tls from 'tls';

const DEFAULT_ALLOWED_EMPLOYEE_NUMBERS = ['020998', '008668'];
const DEFAULT_BLOCKED_EMAIL_DOMAINS = ['erp.local'];

const normalizeEmployeeNumber = (value) => String(value || '').trim();

const getAllowedEmployeeNumbers = () => {
  const configured = String(process.env.EMAIL_TEST_EMPLOYEE_NUMBERS || '').trim();
  const source = configured ? configured.split(',') : DEFAULT_ALLOWED_EMPLOYEE_NUMBERS;
  return new Set(source.map(normalizeEmployeeNumber).filter(Boolean));
};

const isEmailEnabled = () => String(process.env.EMAIL_ENABLED || 'true').toLowerCase() !== 'false';

const getBlockedEmailDomains = () => {
  const configured = String(process.env.EMAIL_BLOCKED_DOMAINS || '').trim();
  const source = configured ? configured.split(',') : DEFAULT_BLOCKED_EMAIL_DOMAINS;
  return new Set(source.map((domain) => String(domain || '').trim().toLowerCase()).filter(Boolean));
};

const getEmailDomain = (email) => String(email || '').trim().toLowerCase().split('@').pop() || '';

const canSendToEmailAddress = (email) => {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return false;
  }
  return !getBlockedEmailDomains().has(getEmailDomain(normalizedEmail));
};

export const canSendEmailToEmployee = (employeeNumber) =>
  isEmailEnabled() && getAllowedEmployeeNumbers().has(normalizeEmployeeNumber(employeeNumber));

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || 'mail.slt.com.lk',
  port: Number(process.env.SMTP_PORT || 25),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  startTls: String(process.env.SMTP_STARTTLS || 'false').toLowerCase() === 'true',
  rejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true',
  username: process.env.SMTP_USERNAME || 'lpms',
  password: process.env.SMTP_PASSWORD || '',
  from: process.env.SMTP_FROM || 'lpms@slt.com.lk',
  fromName: process.env.SMTP_FROM_NAME || 'LPMS'
});

const encodeAddress = ({ name, email }) => {
  const safeEmail = String(email || '').trim();
  const safeName = String(name || '').replace(/"/g, "'");
  return safeName ? `"${safeName}" <${safeEmail}>` : safeEmail;
};

const stripHtml = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const createBoundary = () => `lpms_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const createMessage = ({ to, subject, html, text }) => {
  const config = getSmtpConfig();
  const boundary = createBoundary();
  const plainText = text || stripHtml(html);

  return [
    `From: ${encodeAddress({ name: config.fromName, email: config.from })}`,
    `To: ${encodeAddress({ email: to })}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    ''
  ].join('\r\n');
};

const getSmtpTimeoutMs = () => Number(process.env.SMTP_TIMEOUT_MS || 15000);

const createSmtpSession = (config) => new Promise((resolve, reject) => {
  const socket = config.secure
    ? tls.connect({
      host: config.host,
      port: config.port,
      servername: config.host,
      rejectUnauthorized: config.rejectUnauthorized
    })
    : net.connect({ host: config.host, port: config.port });

  let settled = false;
  const settle = (callback, value) => {
    if (settled) {
      return;
    }
    settled = true;
    socket.off('connect', onConnect);
    socket.off('secureConnect', onSecureConnect);
    socket.off('timeout', onTimeout);
    socket.off('error', onError);
    callback(value);
  };
  const onConnect = () => {
    if (!config.secure) {
      settle(resolve, socket);
    }
  };
  const onSecureConnect = () => settle(resolve, socket);
  const onTimeout = () => {
    socket.destroy();
    settle(reject, new Error('SMTP connection timed out.'));
  };
  const onError = (error) => settle(reject, error);

  socket.setEncoding('utf8');
  socket.setTimeout(getSmtpTimeoutMs());
  socket.once('connect', onConnect);
  socket.once('secureConnect', onSecureConnect);
  socket.once('timeout', onTimeout);
  socket.once('error', onError);
});

const readResponse = (socket) => new Promise((resolve, reject) => {
  let buffer = '';
  let settled = false;
  const cleanup = () => {
    socket.off('data', onData);
    socket.off('error', onError);
    socket.off('timeout', onTimeout);
    socket.off('close', onClose);
  };
  const settle = (callback, value) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    callback(value);
  };
  const onData = (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    if (/^\d{3}\s/.test(lastLine)) {
      const code = Number(lastLine.slice(0, 3));
      settle(resolve, { code, message: buffer });
    }
  };
  const onError = (error) => settle(reject, error);
  const onTimeout = () => {
    socket.destroy();
    settle(reject, new Error('SMTP response timed out.'));
  };
  const onClose = () => settle(reject, new Error('SMTP connection closed before server response.'));

  socket.on('data', onData);
  socket.once('error', onError);
  socket.once('timeout', onTimeout);
  socket.once('close', onClose);
});

const writeCommand = async (socket, command, expectedCodes = []) => {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  if (expectedCodes.length > 0 && !expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.message}`);
  }
  return response;
};

const introduceSmtpClient = async (socket) => {
  const heloDomain = process.env.SMTP_HELO_DOMAIN || 'lpms.slt.com.lk';
  try {
    return await writeCommand(socket, `EHLO ${heloDomain}`, [250]);
  } catch (error) {
    if (error.message === 'SMTP connection closed before server response.') {
      throw error;
    }
    console.warn('LPMS SMTP EHLO failed; retrying with HELO.', {
      message: error.message
    });
    return writeCommand(socket, `HELO ${heloDomain}`, [250]);
  }
};

const readInitialGreeting = async (socket) => {
  try {
    return await readResponse(socket);
  } catch (error) {
    if (error.message === 'SMTP response timed out.') {
      console.warn('LPMS SMTP greeting timed out; continuing with EHLO.', {
        message: error.message
      });
      return null;
    }
    throw error;
  }
};

const authenticateIfConfigured = async (socket, config) => {
  const password = String(config.password || '').trim();
  if (!config.username || !password || password.toUpperCase() === 'N/A') {
    return;
  }

  await writeCommand(socket, 'AUTH LOGIN', [334]);
  await writeCommand(socket, Buffer.from(config.username).toString('base64'), [334]);
  await writeCommand(socket, Buffer.from(password).toString('base64'), [235]);
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const config = getSmtpConfig();
  if (!to) {
    return { skipped: true, reason: 'Recipient email is empty.' };
  }
  if (!canSendToEmailAddress(to)) {
    return { skipped: true, reason: 'Recipient email is not deliverable.' };
  }

  let socket;
  try {
    socket = await createSmtpSession(config);
    await readInitialGreeting(socket);
    await introduceSmtpClient(socket);

    if (!config.secure && config.startTls) {
      await writeCommand(socket, 'STARTTLS', [220]);
      socket = tls.connect({
        socket,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized
      });
      await introduceSmtpClient(socket);
    }

    await authenticateIfConfigured(socket, config);
    await writeCommand(socket, `MAIL FROM:<${config.from}>`, [250]);
    await writeCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await writeCommand(socket, 'DATA', [354]);

    const message = createMessage({ to, subject, html, text }).replace(/^\./gm, '..');
    socket.write(`${message}\r\n.\r\n`);
    await readResponse(socket);
    await writeCommand(socket, 'QUIT', [221]);

    return { sent: true };
  } finally {
    socket?.end();
  }
};

const detailList = (items) =>
  Object.entries(items)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([label, value]) => `<li><strong>${label}:</strong> ${String(value)}</li>`)
    .join('');

const wrapEmail = ({ title, learnerName, intro, details }) => `
  <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.55;">
    <p>Dear ${learnerName || 'Learner'},</p>
    <p>${intro}</p>
    <ul>
      ${detailList(details)}
    </ul>
    <p>Please log in to LPMS for further information and progress updates.</p>
    <p>
      Regards,<br />
      Learning Portal Management System
    </p>
    <p style="font-size: 12px; color: #64748b;">${title}</p>
  </div>
`;

const safelySendNotificationEmail = async ({ employeeNumber, to, subject, html, text }) => {
  if (!canSendEmailToEmployee(employeeNumber)) {
    console.info('LPMS email skipped:', {
      employeeNumber,
      to,
      subject,
      reason: 'Employee is outside email test allowlist.'
    });
    return { skipped: true, reason: 'Employee is outside email test allowlist.' };
  }

  try {
    console.info('LPMS email sending:', {
      employeeNumber,
      to,
      subject,
      smtp: {
        host: getSmtpConfig().host,
        port: getSmtpConfig().port,
        secure: getSmtpConfig().secure,
        startTls: getSmtpConfig().startTls
      }
    });
    const result = await sendEmail({ to, subject, html, text });
    if (result.skipped) {
      console.info('LPMS email skipped:', {
        employeeNumber,
        to,
        subject,
        reason: result.reason
      });
    }
    if (result.sent) {
      console.info('LPMS email sent:', {
        employeeNumber,
        to,
        subject
      });
    }
    return result;
  } catch (error) {
    console.error('LPMS email send failed:', {
      employeeNumber,
      to,
      subject,
      message: error.message
    });
    return { failed: true, error: error.message };
  }
};

export const sendLearningPathAssignedEmail = async ({ employeeNumber, to, learnerName, learningPathTitle }) =>
  safelySendNotificationEmail({
    employeeNumber,
    to,
    subject: `LPMS Learning Path Assignment: ${learningPathTitle}`,
    html: wrapEmail({
      title: 'Learning Path Assignment Notification',
      learnerName,
      intro: 'You have been assigned to a learning path in LPMS.',
      details: {
        'Learning Path': learningPathTitle,
        'Employee Number': employeeNumber
      }
    })
  });

export const sendClassAssignedEmail = async ({
  employeeNumber,
  to,
  learnerName,
  learningPathTitle,
  courseCode,
  classTitle,
  classCode
}) =>
  safelySendNotificationEmail({
    employeeNumber,
    to,
    subject: `LPMS Class Assignment: ${classTitle || classCode || courseCode}`,
    html: wrapEmail({
      title: 'Class Assignment Notification',
      learnerName,
      intro: 'You have been assigned to a class for a course in LPMS.',
      details: {
        'Learning Path': learningPathTitle,
        'Course Code': courseCode,
        'Class': classTitle,
        'Class Code': classCode,
        'Employee Number': employeeNumber
      }
    })
  });

export const sendCourseCompletedEmail = async ({
  employeeNumber,
  to,
  learnerName,
  learningPathTitle,
  courseTitle,
  courseCode
}) =>
  safelySendNotificationEmail({
    employeeNumber,
    to,
    subject: `LPMS Course Completion: ${courseTitle || courseCode}`,
    html: wrapEmail({
      title: 'Course Completion Notification',
      learnerName,
      intro: 'Your course completion has been recorded in LPMS.',
      details: {
        'Learning Path': learningPathTitle,
        'Course': courseTitle,
        'Course Code': courseCode,
        'Employee Number': employeeNumber
      }
    })
  });
