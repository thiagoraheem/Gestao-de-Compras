import fs from 'fs';
import path from 'path';

const source = path.join(process.cwd(), 'server', 'templates');
const destination = path.join(process.cwd(), 'dist', 'templates');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log(`Copying templates from ${source} to ${destination}...`);
  if (!fs.existsSync(source)) {
    console.error(`Source directory ${source} does not exist!`);
    process.exit(1);
  }
  
  copyRecursiveSync(source, destination);
  console.log('Templates copied successfully!');
} catch (err) {
  console.error('Error copying templates:', err);
  process.exit(1);
}
