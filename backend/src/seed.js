const seedData = require('./seed-data');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadBackendSeed() {
  return {
    ...clone(seedData),
    notifications: [],
    sessions: [],
  };
}

module.exports = {
  loadBackendSeed,
};
