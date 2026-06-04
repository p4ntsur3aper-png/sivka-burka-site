const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { loadFrontendSeed } = require('./seed');
const { hashPassword, hashToken, verifyPassword } = require('./security');

const DATA_DIR = path.resolve(__dirname, '../.data');
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'sivka_burka.sqlite');
const SESSION_TTL_DAYS = 7;

const ENTITY_TABLES = {
  services: 'services',
  horses: 'horses',
  trainers: 'trainers',
  bookingRules: 'booking_rules',
  bookings: 'bookings',
  reviews: 'reviews',
  galleryItems: 'gallery_items',
  mediaFolders: 'media_folders',
  mediaAssets: 'media_assets',
  contentBlocks: 'content_blocks',
  contentRevisions: 'content_revisions',
};

const SETTINGS_KEYS = ['siteContent', 'contacts', 'rulesInfo'];

let database;
let cachedDb;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
}

function getDatabase() {
  if (!database) {
    ensureDataDir();
    database = new DatabaseSync(SQLITE_PATH);
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA journal_mode = WAL');
    migrate();
    seedIfNeeded();
  }
  return database;
}

function migrate() {
  const db = database;
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS horses (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_rules (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_folders (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_blocks (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_revisions (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_role TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      booking_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient
      ON notifications (recipient_role, recipient_id, is_read, created_at);

    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'trainer')),
      login TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      trainer_id TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      notification_settings TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users (role);
    CREATE INDEX IF NOT EXISTS idx_staff_users_trainer ON staff_users (trainer_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
  `);
  setMeta('schema_version', '1');
}

function nowIso() {
  return new Date().toISOString();
}

function getMeta(key) {
  const row = database.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row?.value;
}

function setMeta(key, value) {
  database.prepare(`
    INSERT INTO app_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function writeSetting(key, value) {
  database.prepare(`
    INSERT INTO app_settings (key, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), nowIso());
}

function readSetting(key, fallback) {
  const row = database.prepare('SELECT payload FROM app_settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.payload) : clone(fallback);
}

function replaceEntityCollection(table, items) {
  const db = database;
  const timestamp = nowIso();
  db.exec('BEGIN');
  try {
    db.prepare(`DELETE FROM ${table}`).run();
    const insert = db.prepare(`
      INSERT INTO ${table} (id, payload, sort_order, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    items.forEach((item, index) => {
      insert.run(item.id, JSON.stringify(item), index, timestamp);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function readEntityCollection(table) {
  return database
    .prepare(`SELECT payload FROM ${table} ORDER BY sort_order ASC, id ASC`)
    .all()
    .map((row) => JSON.parse(row.payload));
}

function replaceNotifications(items = []) {
  const db = database;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM notifications').run();
    const insert = db.prepare(`
      INSERT INTO notifications (
        id, recipient_role, recipient_id, type, channel, title, message, booking_id, is_read, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    items.forEach((item) => {
      insert.run(
        item.id,
        item.recipientRole,
        item.recipientId,
        item.type,
        item.channel,
        item.title,
        item.message,
        item.bookingId || null,
        item.isRead ? 1 : 0,
        item.createdAt,
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function readNotifications() {
  return database
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC')
    .all()
    .map((row) => ({
      id: row.id,
      recipientRole: row.recipient_role,
      recipientId: row.recipient_id,
      type: row.type,
      channel: row.channel,
      title: row.title,
      message: row.message,
      bookingId: row.booking_id || undefined,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
    }));
}

function defaultNotificationSettings(contacts = {}) {
  return {
    inApp: true,
    browser: false,
    emailEnabled: false,
    telegramEnabled: false,
    whatsappEnabled: false,
    email: contacts.email || '',
    telegram: contacts.telegram || '',
    whatsapp: contacts.whatsapp || '',
  };
}

function disableNotificationChannels(settings) {
  return {
    ...settings,
    inApp: false,
    browser: false,
    emailEnabled: false,
    telegramEnabled: false,
    whatsappEnabled: false,
  };
}

function normalizeNotificationSettings(role, settings) {
  const normalized = {
    ...defaultNotificationSettings(),
    ...(settings || {}),
  };
  return role === 'trainer' ? disableNotificationChannels(normalized) : normalized;
}

function defaultStaffAccounts(trainers) {
  return [
    {
      id: 'admin-local',
      role: 'admin',
      displayName: 'Администратор',
      login: 'admin',
      password: 'admin123',
      notificationSettings: defaultNotificationSettings(),
    },
    {
      id: 'manager-local',
      role: 'manager',
      displayName: 'Управляющий',
      login: 'manager',
      password: 'manager123',
      notificationSettings: defaultNotificationSettings(),
    },
    ...trainers.map((trainer) => ({
      id: `trainer-account-${trainer.id}`,
      role: 'trainer',
      displayName: trainer.fullName,
      login: trainer.id,
      password: 'trainer123',
      trainerId: trainer.id,
      notificationSettings: disableNotificationChannels(defaultNotificationSettings({
        email: trainer.email || '',
        whatsapp: trainer.phone || '',
      })),
    })),
  ];
}

function rowToStaffAccount(row) {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    login: row.login,
    password: '',
    trainerId: row.trainer_id || undefined,
    notificationSettings: normalizeNotificationSettings(row.role, JSON.parse(row.notification_settings || '{}')),
  };
}

function rowToUser(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    role: row.role,
    login: row.login,
    displayName: row.display_name,
    name: row.display_name,
    trainerId: row.trainer_id || undefined,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    notificationSettings: normalizeNotificationSettings(row.role, JSON.parse(row.notification_settings || '{}')),
  };
}

function listStaffAccounts() {
  return database
    .prepare(`
      SELECT * FROM staff_users
      ORDER BY
        CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
        display_name COLLATE NOCASE
    `)
    .all()
    .map(rowToStaffAccount);
}

function writeStaffAccounts(accounts, trainers) {
  const existingRows = database.prepare('SELECT * FROM staff_users').all();
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const defaults = defaultStaffAccounts(trainers);
  const incomingById = new Map((accounts || []).map((account) => [account.id, account]));
  const normalizedAccounts = defaults.map((defaultAccount) => {
    const incoming = incomingById.get(defaultAccount.id) || {};
    return {
      ...defaultAccount,
      ...incoming,
      role: defaultAccount.role,
      trainerId: defaultAccount.trainerId,
      displayName: defaultAccount.role === 'trainer' ? defaultAccount.displayName : (incoming.displayName || defaultAccount.displayName),
      login: defaultAccount.role === 'trainer' ? defaultAccount.login : (incoming.login || defaultAccount.login),
      notificationSettings: normalizeNotificationSettings(defaultAccount.role, {
        ...defaultAccount.notificationSettings,
        ...(incoming.notificationSettings || {}),
      }),
    };
  });

  const db = database;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM staff_users').run();
    const insert = db.prepare(`
      INSERT INTO staff_users (
        id, role, login, display_name, trainer_id, password_hash, password_salt,
        notification_settings, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const timestamp = nowIso();
    normalizedAccounts.forEach((account) => {
      const existing = existingById.get(account.id);
      const passwordValue = String(account.password || '').trim();
      const passwordPair = passwordValue
        ? hashPassword(passwordValue)
        : existing
          ? { hash: existing.password_hash, salt: existing.password_salt }
          : hashPassword(account.role === 'admin' ? 'admin123' : account.role === 'manager' ? 'manager123' : 'trainer123');

      insert.run(
        account.id,
        account.role,
        account.login.trim().toLowerCase(),
        account.displayName,
        account.trainerId || null,
        passwordPair.hash,
        passwordPair.salt,
        JSON.stringify(account.notificationSettings),
        existing?.created_at || timestamp,
        timestamp,
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function clearDomainData({ includeSessions = false } = {}) {
  const db = database;
  db.exec('BEGIN');
  try {
    Object.values(ENTITY_TABLES).forEach((table) => db.prepare(`DELETE FROM ${table}`).run());
    db.prepare('DELETE FROM app_settings').run();
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM staff_users').run();
    if (includeSessions) db.prepare('DELETE FROM sessions').run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedDatabase({ includeSessions = false } = {}) {
  const seed = loadFrontendSeed();
  clearDomainData({ includeSessions });

  SETTINGS_KEYS.forEach((key) => writeSetting(key, seed[key]));
  Object.entries(ENTITY_TABLES).forEach(([key, table]) => replaceEntityCollection(table, seed[key] || []));
  replaceNotifications(seed.notifications || []);
  writeStaffAccounts(defaultStaffAccounts(seed.trainers || []), seed.trainers || []);
  setMeta('created_at', nowIso());
  setMeta('db_initialized', 'true');
}

function seedIfNeeded() {
  const isInitialized = getMeta('db_initialized') === 'true';
  if (!isInitialized) seedDatabase({ includeSessions: true });
}

function loadDb() {
  getDatabase();
  const seed = loadFrontendSeed();
  const db = {
    version: Number(getMeta('schema_version') || 1),
    createdAt: getMeta('created_at') || nowIso(),
    notifications: readNotifications(),
    staffAccounts: listStaffAccounts(),
  };

  SETTINGS_KEYS.forEach((key) => {
    db[key] = readSetting(key, seed[key]);
  });
  Object.entries(ENTITY_TABLES).forEach(([key, table]) => {
    db[key] = readEntityCollection(table);
  });
  return db;
}

function getDb() {
  if (!cachedDb) cachedDb = loadDb();
  return cachedDb;
}

function saveDb() {
  const db = getDb();
  SETTINGS_KEYS.forEach((key) => writeSetting(key, db[key]));
  Object.entries(ENTITY_TABLES).forEach(([key, table]) => replaceEntityCollection(table, db[key] || []));
  replaceNotifications(db.notifications || []);
  writeStaffAccounts(db.staffAccounts || listStaffAccounts(), db.trainers || []);
  setMeta('updated_at', nowIso());
  cachedDb = loadDb();
}

function resetDb() {
  seedDatabase();
  cachedDb = loadDb();
  return cachedDb;
}

function findStaffUserForLogin({ role, login, trainerId }) {
  getDatabase();
  cleanupExpiredSessions();
  if (role === 'trainer') {
    const trainerLogin = String(trainerId || login || '').trim();
    return rowToUser(
      database
        .prepare('SELECT * FROM staff_users WHERE role = ? AND (lower(login) = lower(?) OR lower(trainer_id) = lower(?))')
        .get('trainer', trainerLogin, trainerLogin),
    );
  }
  return rowToUser(
    database
      .prepare('SELECT * FROM staff_users WHERE role = ? AND lower(login) = lower(?)')
      .get(role, String(login || '').trim()),
  );
}

function createSession(userId) {
  getDatabase();
  const token = `${crypto.randomUUID()}.${crypto.randomBytes(24).toString('hex')}`;
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  database
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, createdAt, expiresAt);
  return { token, expiresAt };
}

function cleanupExpiredSessions() {
  getDatabase();
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}

function getSessionUser(token) {
  if (!token) return undefined;
  getDatabase();
  cleanupExpiredSessions();
  const row = database
    .prepare(`
      SELECT staff_users.*
      FROM sessions
      JOIN staff_users ON staff_users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
    .get(hashToken(token), nowIso());
  return rowToUser(row);
}

function deleteSession(token) {
  if (!token) return;
  getDatabase();
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

function verifyStaffPassword(user, password) {
  return verifyPassword(password, user?.passwordHash, user?.passwordSalt);
}

module.exports = {
  clone,
  createSession,
  deleteSession,
  findStaffUserForLogin,
  getDatabase,
  getDb,
  getSessionUser,
  listStaffAccounts,
  resetDb,
  saveDb,
  verifyStaffPassword,
};
