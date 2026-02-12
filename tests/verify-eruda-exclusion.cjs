
const fs = require('fs');
const path = require('path');

const mainTsxPath = path.join(__dirname, '../client/src/main.tsx');
const content = fs.readFileSync(mainTsxPath, 'utf8');

console.log('Verifying Eruda exclusion in production...');

// Check for static import
if (content.match(/^import\s+eruda\s+from\s+['"]eruda['"]/m)) {
  console.error('FAIL: Found static import of eruda. It should be dynamically imported.');
  process.exit(1);
}

// Check for dynamic import inside DEV check
// We look for: if (import.meta.env.DEV) { ... import('eruda') ... }
// This regex is a bit simplified but checks the structure
const hasDevCheck = content.includes('if (import.meta.env.DEV)');
const hasDynamicImport = content.includes("import('eruda')");

if (!hasDevCheck) {
  console.error('FAIL: Missing import.meta.env.DEV check.');
  process.exit(1);
}

if (!hasDynamicImport) {
  console.error('FAIL: Missing dynamic import of eruda.');
  process.exit(1);
}

// Check if dynamic import is roughly inside the dev check
// This is a naive check (checking index order)
const devCheckIndex = content.indexOf('if (import.meta.env.DEV)');
const dynamicImportIndex = content.indexOf("import('eruda')");

if (dynamicImportIndex < devCheckIndex) {
  console.error('FAIL: Dynamic import appears before the DEV check (or outside of it).');
  process.exit(1);
}

console.log('PASS: Eruda is correctly configured to load only in development.');
