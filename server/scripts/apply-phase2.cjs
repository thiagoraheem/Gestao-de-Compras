/**
 * Apply Phase 1 + Phase 2 changes to routes.ts:
 * 1. Phase 1: Update imports, remove inline functions, add utility/service imports
 * 2. Phase 2: Remove companies (282-506), users (508-926), suppliers (1157-1444) route blocks
 */
const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, '..', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf-8');
let lines = content.split(/\r?\n/);

console.log(`Original lines: ${lines.length}`);

// Phase 1: Fix imports - replace isAdminOrBuyer block to add isReceiver
const importBlockStart = lines.findIndex(l => l.includes('isAdminOrBuyer,'));
if (importBlockStart >= 0 && !lines[importBlockStart + 1].includes('isReceiver')) {
  lines.splice(importBlockStart + 1, 0, '  isReceiver,');
  console.log(`  Added isReceiver import after line ${importBlockStart + 1}`);
}

// Phase 1: Replace generateReceiptNumber function with import
const genFuncStart = lines.findIndex(l => l.includes('function generateReceiptNumber()'));
if (genFuncStart >= 0) {
  const genFuncEnd = lines.findIndex((l, i) => i > genFuncStart && l.trim() === '}');
  if (genFuncEnd >= 0) {
    lines.splice(genFuncStart, genFuncEnd - genFuncStart + 1,
      'import { generateReceiptNumber } from "./utils/generate-receipt-number";',
      'import { isInvalidDescription } from "./utils/validate-description";',
      'import { createPurchaseOrderFromQuotation } from "./services/purchase-order-factory";'
    );
    console.log(`  Replaced generateReceiptNumber function (lines ${genFuncStart}-${genFuncEnd}) with imports`);
  }
}

// Phase 1: Replace all inline invalidDescription functions with comment
let replacedCount = 0;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('const invalidDescription = (value: string | null) =>')) {
    // Find the closing };
    let end = i;
    for (let j = i; j < lines.length; j++) {
      if (lines[j].trim() === '};') { end = j; break; }
    }
    lines.splice(i, end - i + 1, '      // Using centralized isInvalidDescription from utils/validate-description.ts');
    replacedCount++;
  }
}
console.log(`  Replaced ${replacedCount} inline invalidDescription functions`);

// Phase 1: Replace invalidDescription( with isInvalidDescription(
let callReplacements = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('invalidDescription(') && !lines[i].includes('isInvalidDescription(') && !lines[i].includes('const invalid')) {
    lines[i] = lines[i].replace('invalidDescription(', 'isInvalidDescription(');
    callReplacements++;
  }
}
console.log(`  Replaced ${callReplacements} invalidDescription() calls`);

// Phase 1: Remove inline isReceiver function
const isReceiverStart = lines.findIndex(l => l.includes('async function isReceiver(req: Request'));
if (isReceiverStart >= 0) {
  // Find the comment above
  let start = isReceiverStart;
  if (lines[isReceiverStart - 1].includes('Add isReceiver')) start = isReceiverStart - 1;
  // Find end of function (closing brace at same indent level)
  let braceCount = 0;
  let end = isReceiverStart;
  for (let j = isReceiverStart; j < lines.length; j++) {
    if (lines[j].includes('{')) braceCount++;
    if (lines[j].includes('}')) braceCount--;
    if (braceCount === 0) { end = j; break; }
  }
  lines.splice(start, end - start + 1, '  // isReceiver middleware → Moved to ./routes/middleware.ts (Phase 1)');
  console.log(`  Removed inline isReceiver function (lines ${start}-${end})`);
}

// ============= PHASE 2: Remove route blocks =============
// Now find and remove companies, users, suppliers blocks
// We need to re-search after Phase 1 changes

// Find "Companies routes" comment
const companiesStart = lines.findIndex(l => l.trim() === '// Companies routes');
if (companiesStart >= 0) {
  // Find the next major section (Users routes)
  const companiesEnd = lines.findIndex((l, i) => i > companiesStart && l.trim() === '// Users routes');
  if (companiesEnd >= 0) {
    lines.splice(companiesStart, companiesEnd - companiesStart,
      '  // Companies routes → Moved to ./routes/companies.ts (Phase 2)',
      '');
    console.log(`  Removed companies routes (${companiesEnd - companiesStart} lines)`);
  }
}

// Find "Users routes" marker  
const usersStart = lines.findIndex(l => l.trim() === '// Users routes');
if (usersStart >= 0) {
  // Find next section after users
  const nextSectionIdx = lines.findIndex((l, i) => i > usersStart + 5 && l.trim() === '// Departments routes');
  if (nextSectionIdx >= 0) {
    lines.splice(usersStart, nextSectionIdx - usersStart,
      '  // Users routes → Moved to ./routes/users.ts (Phase 2)',
      '');
    console.log(`  Removed users routes (${nextSectionIdx - usersStart} lines)`);
  }
}

// Find "Suppliers routes" marker
const suppliersStart = lines.findIndex(l => l.trim() === '// Suppliers routes');
if (suppliersStart >= 0) {
  // Find next section (Payment Methods or Delivery Locations)
  const nextSection = lines.findIndex((l, i) => i > suppliersStart + 5 && (l.trim() === '// Payment Methods routes' || l.trim() === '// Delivery Locations routes'));
  if (nextSection >= 0) {
    lines.splice(suppliersStart, nextSection - suppliersStart,
      '  // Suppliers routes → Moved to ./routes/suppliers.ts (Phase 2)',
      '');
    console.log(`  Removed suppliers routes (${nextSection - suppliersStart} lines)`);
  }
}

// Write back
const output = lines.join('\n');
fs.writeFileSync(routesPath, output, 'utf-8');
console.log(`\nFinal lines: ${lines.length}`);
console.log('Done!');
