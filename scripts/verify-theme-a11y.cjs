const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/components/supplier-comparison.tsx');

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

const checks = [
  {
    name: "Red text dark mode contrast",
    regex: /text-red-600.*dark:text-red-400/,
    error: "Missing dark:text-red-400 for text-red-600"
  },
  {
    name: "Orange text dark mode contrast",
    regex: /text-orange-600.*dark:text-orange-400/,
    error: "Missing dark:text-orange-400 for text-orange-600"
  },
  {
    name: "Green text dark mode contrast",
    regex: /text-green-700.*dark:text-green-400/,
    error: "Missing dark:text-green-400 for text-green-700"
  },
  {
    name: "Blue text dark mode contrast",
    regex: /text-blue-600.*dark:text-blue-400/,
    error: "Missing dark:text-blue-400 for text-blue-600"
  },
  {
    name: "Unavailable items card background",
    regex: /bg-orange-50.*dark:bg-orange-950\/20/,
    error: "Missing dark background for unavailable items card"
  },
  {
    name: "Smooth transitions",
    regex: /transition-colors/,
    error: "Missing transition-colors class"
  }
];

let hasError = false;

console.log("Verifying accessibility and theme compatibility...");

checks.forEach(check => {
  if (content.match(check.regex)) {
    console.log(`[PASS] ${check.name}`);
  } else {
    console.error(`[FAIL] ${check.name}: ${check.error}`);
    hasError = true;
  }
});

if (hasError) {
  console.error("\nSome accessibility checks failed.");
  process.exit(1);
} else {
  console.log("\nAll accessibility checks passed!");
  process.exit(0);
}
