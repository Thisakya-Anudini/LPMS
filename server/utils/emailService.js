import net from 'net';
import tls from 'tls';

const DEFAULT_ALLOWED_EMPLOYEE_NUMBERS = ['020998', '008668'];
const TEMP_TEST_COPY_EMAIL = 'sudam17fernando@gmail.com';

const normalizeEmployeeNumber = (value) => String(value || '').trim();

const getAllowedEmployeeNumbers = () => {
  const configured = String(process.env.EMAIL_TEST_EMPLOYEE_NUMBERS || '').trim();
  const source = configured ? configured.split(',') : DEFAULT_ALLOWED_EMPLOYEE_NUMBERS;
  return new Set(source.map(normalizeEmployeeNumber).filter(Boolean));
};

const isEmailEnabled = () => String(process.env.EMAIL_ENABLED || 'true').toLowerCase() !== 'false';

export const canSendEmailToEmployee = (employeeNumber) =>
  isEmailEnabled() && getAllowedEmployeeNumbers().has(normalizeEmployeeNumber(employeeNumber));

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || 'mail.slt.com.lk',
  port: Number(process.env.SMTP_PORT || 25),
  secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
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

const createSmtpSession = (config) => new Promise((resolve, reject) => {
  const socket = config.secure
    ? tls.connect({
      host: config.host,
      port: config.port,
      servername: config.host,
      rejectUnauthorized: config.rejectUnauthorized
    })
    : net.connect({ host: config.host, port: config.port });

  socket.setEncoding('utf8');
  socket.setTimeout(Number(process.env.SMTP_TIMEOUT_MS || 15000));
  socket.once('connect', () => resolve(socket));
  socket.once('secureConnect', () => resolve(socket));
  socket.once('timeout', () => {
    socket.destroy();
    reject(new Error('SMTP connection timed out.'));
  });
  socket.once('error', reject);
});

const readResponse = (socket) => new Promise((resolve, reject) => {
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    if (/^\d{3}\s/.test(lastLine)) {
      socket.off('data', onData);
      const code = Number(lastLine.slice(0, 3));
      resolve({ code, message: buffer });
    }
  };
  const onError = (error) => {
    socket.off('data', onData);
    reject(error);
  };

  socket.on('data', onData);
  socket.once('error', onError);
});

const writeCommand = async (socket, command, expectedCodes = []) => {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  if (expectedCodes.length > 0 && !expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.message}`);
  }
  return response;
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

  let socket;
  try {
    socket = await createSmtpSession(config);
    await readResponse(socket);
    await writeCommand(socket, `EHLO ${process.env.SMTP_HELO_DOMAIN || 'lpms.local'}`, [250]);

    if (!config.secure && config.startTls) {
      await writeCommand(socket, 'STARTTLS', [220]);
      socket = tls.connect({
        socket,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized
      });
      await writeCommand(socket, `EHLO ${process.env.SMTP_HELO_DOMAIN || 'lpms.local'}`, [250]);
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
    return { skipped: true, reason: 'Employee is outside email test allowlist.' };
  }

  const results = [];
  try {
    results.push({ to, ...(await sendEmail({ to, subject, html, text })) });
  } catch (error) {
    console.error('LPMS email send failed:', {
      employeeNumber,
      to,
      subject,
      message: error.message
    });
    results.push({ to, failed: true, error: error.message });
  }

  if (TEMP_TEST_COPY_EMAIL && TEMP_TEST_COPY_EMAIL !== to) {
    try {
      results.push({
        to: TEMP_TEST_COPY_EMAIL,
        ...(await sendEmail({ to: TEMP_TEST_COPY_EMAIL, subject, html, text }))
      });
    } catch (error) {
      console.error('LPMS test copy email send failed:', {
        employeeNumber,
        to: TEMP_TEST_COPY_EMAIL,
        subject,
        message: error.message
      });
      results.push({ to: TEMP_TEST_COPY_EMAIL, failed: true, error: error.message });
    }
  }

  return { results };
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
