const crypto = require('crypto');

const KEY_LENGTH = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, expectedHash, salt) {
  if (!expectedHash || !salt) return false;
  const { hash } = hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
  hashPassword,
  hashToken,
  verifyPassword,
};
