import { createApp } from '../app.js';

const users = [
  ['admin@lpms.com', 'Admin@123'],
  ['ladmin@lpms.com', 'Admin@123'],
  ['employee@lpms.com', 'Employee@123'],
  ['011349', '011349'],
  ['011338', '011338']
];

const app = createApp();

const server = app.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  try {
    for (const [identifier, password] of users) {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: identifier, password })
      });

      const body = await response.json();
      console.log(`${identifier} -> ${response.status} (${body?.user?.role || 'NO_ROLE'})`);
    }
  } catch (error) {
    console.error('Smoke login failed:', error);
    process.exitCode = 1;
  } finally {
    server.close(() => process.exit(process.exitCode || 0));
  }
});

setTimeout(() => {
  console.error('Smoke login timeout.');
  server.close(() => process.exit(1));
}, 15000);
