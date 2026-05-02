const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'new features.txt'), 'utf8');
const lines = content.split(/\r?\n/);

let currentFile = null;
let currentLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect file path header (looks like a path and doesn't look like code)
  if (line.match(/^[\w\:\/\\]+[\w\-\.]+\.(js|jsx|css|sql|json)$/) && !line.includes('{') && !line.includes('require')) {
    if (currentFile && currentLines.length > 0) {
      console.log(`Extracted: ${currentFile} (${currentLines.length} lines)`);
      // normalize path
      let cleanPath = currentFile.replace('D:\\odoo-hack-finals\\', '');
      cleanPath = cleanPath.replace('empay-backend\\', 'empay-backend/').replace('empay-frontend\\', 'empay-frontend/');
      cleanPath = cleanPath.replace(/\\/g, '/');
      const targetPath = path.join(__dirname, cleanPath);
      console.log(`Writing to ${targetPath}`);
      // write file
      fs.writeFileSync(targetPath, currentLines.join('\n'));
    }
    currentFile = line.trim();
    currentLines = [];
  } else {
    if (currentFile) {
      currentLines.push(line);
    }
  }
}

if (currentFile && currentLines.length > 0) {
  console.log(`Extracted: ${currentFile} (${currentLines.length} lines)`);
  let cleanPath = currentFile.replace('D:\\odoo-hack-finals\\', '');
  cleanPath = cleanPath.replace('empay-backend\\', 'empay-backend/').replace('empay-frontend\\', 'empay-frontend/');
  cleanPath = cleanPath.replace(/\\/g, '/');
  const targetPath = path.join(__dirname, cleanPath);
  console.log(`Writing to ${targetPath}`);
  fs.writeFileSync(targetPath, currentLines.join('\n'));
}

console.log('Done!');
