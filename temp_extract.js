const fs = require('fs');
const path = require('path');
const uiPath = path.join(__dirname, 'ui');
const files = fs.readdirSync(uiPath).filter(f => f.endsWith('.html'));
const re = /google\.script\.run\s*(?:\.|\n\s*\.)*?\.(\w+)\s*\(/gs;
files.forEach(f => {
  const s = fs.readFileSync(path.join(uiPath, f), 'utf8');
  const names = new Set();
  let m;
  while ((m = re.exec(s)) !== null) {
    names.add(m[1]);
  }
  console.log(f + ':', [...names].sort());
});
