const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dbPath = path.resolve(__dirname, '../.data/test-backend.sqlite');
process.env.SQLITE_PATH = dbPath;

const { hashPassword, verifyPassword } = require('../src/security');
const { createServer } = require('../src/server');
const { getDatabase } = require('../src/store');

function removeDatabaseFiles() {
  [dbPath, `${dbPath}-shm`, `${dbPath}-wal`].forEach((filePath) => {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // SQLite can keep WAL files open until the connection closes.
    }
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

test('password hashes verify the original password only', () => {
  const pair = hashPassword('admin123');
  assert.equal(verifyPassword('admin123', pair.hash, pair.salt), true);
  assert.equal(verifyPassword('wrong-password', pair.hash, pair.salt), false);
});

test('auth protects admin snapshot and accepts seeded admin credentials', async () => {
  removeDatabaseFiles();
  const server = createServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const anonymousSnapshot = await fetch(`${baseUrl}/admin/snapshot`);
    assert.equal(anonymousSnapshot.status, 401);

    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', login: 'admin', password: 'wrong' }),
    });
    assert.equal(badLogin.status, 401);

    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', login: 'admin', password: 'admin123' }),
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get('set-cookie');
    assert.match(adminCookie, /sid=/);

    const adminSnapshot = await fetch(`${baseUrl}/admin/snapshot`, { headers: { cookie: adminCookie } });
    assert.equal(adminSnapshot.status, 200);
    const snapshotBody = await adminSnapshot.json();
    assert.equal(snapshotBody.data.services.length > 0, true);
    assert.equal(snapshotBody.data.staffAccounts.some((account) => account.password), false);

    const managerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'manager', login: 'manager', password: 'manager123' }),
    });
    const managerCookie = managerLogin.headers.get('set-cookie');
    const forbiddenSnapshot = await fetch(`${baseUrl}/admin/snapshot`, { headers: { cookie: managerCookie } });
    assert.equal(forbiddenSnapshot.status, 403);
  } finally {
    server.close();
    getDatabase().close();
    removeDatabaseFiles();
  }
});
