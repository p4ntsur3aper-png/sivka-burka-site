const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MOCK_DATA_PATH = path.resolve(__dirname, '../../src/data/mockData.ts');

const EXPORT_NAMES = [
  'siteContent',
  'services',
  'horses',
  'trainers',
  'bookingRules',
  'bookings',
  'reviews',
  'galleryItems',
  'contacts',
  'rulesInfo',
  'mediaFolders',
  'mediaAssets',
  'contentBlocks',
  'contentRevisions',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function transformMockData(source) {
  return source
    .replace(/import type\s*\{[\s\S]*?\}\s*from\s*'..\/types';\s*/m, '')
    .replace(/export const (\w+)\s*:\s*[^=]+=/g, 'const $1 =')
    .replace(/export const (\w+)\s*=/g, 'const $1 =');
}

function loadFrontendSeed() {
  const source = fs.readFileSync(MOCK_DATA_PATH, 'utf8');
  const transformed = transformMockData(source);
  const exportCode = `\nmodule.exports = { ${EXPORT_NAMES.join(', ')} };\n`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.runInNewContext(transformed + exportCode, sandbox, {
    filename: MOCK_DATA_PATH,
    timeout: 1000,
  });

  const seed = clone(sandbox.module.exports);
  return {
    ...seed,
    notifications: [],
    sessions: [],
  };
}

module.exports = {
  loadFrontendSeed,
};
