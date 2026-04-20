import fs from 'fs';
import path from 'path';

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        filelist = walkSync(filepath, filelist);
      }
    } else {
      if (filepath.endsWith('.ts') || filepath.endsWith('.tsx') || filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
};

function performRefactor(dir) {
  const files = walkSync(dir);
  let changedCount = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    content = content.replace(/@\/components\/ui/g, '@/shared/ui');
    content = content.replace(/@\/components\/theme-provider/g, '@/shared/ui/theme-provider');
    content = content.replace(/@\/components\/mode-toggle/g, '@/shared/ui/mode-toggle');
    content = content.replace(/@\/components\/manager-route/g, '@/app/guards/manager-route');
    content = content.replace(/@\/components\/admin-route/g, '@/app/guards/admin-route');
    content = content.replace(/@\/components\/admin-or-buyer-route/g, '@/app/guards/admin-or-buyer-route');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      changedCount++;
      console.log(`Updated: ${file}`);
    }
  });

  console.log(`Refactor complete. Updated ${changedCount} files.`);
}

const targetDir = path.resolve(process.cwd(), 'client/src');
performRefactor(targetDir);
