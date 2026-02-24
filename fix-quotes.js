const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && filePath.indexOf('node_modules') < 0 && filePath.indexOf('.angular') < 0) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');
let found = false;
files.forEach(f => {
  const data = fs.readFileSync(f, 'utf8');
  const leftCount = (data.match(/\u2018/g) || []).length;
  const rightCount = (data.match(/\u2019/g) || []).length;
  if (leftCount > 0 || rightCount > 0) {
    console.log(f + ': left=' + leftCount + ' right=' + rightCount);
    found = true;
    const fixed = data.replace(/[\u2018\u2019]/g, "'");
    fs.writeFileSync(f, fixed);
    console.log('  -> Fixed');
  }
});
if (!found) console.log('No other files with smart quotes.');
