const fs = require('fs');
const path = require('path');
function walk(d) {
    let r = [];
    fs.readdirSync(d, {withFileTypes: true}).forEach(f => {
        const p = path.join(d, f.name);
        if (f.isDirectory()) {
            r = r.concat(walk(p));
        } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
            r.push(p);
        }
    });
    return r;
}
const files = walk('src');
const tables = new Set();
files.forEach(f => {
    const t = fs.readFileSync(f, 'utf8');
    const regex = /supabase\.from\(['"`]([^'"`]+)['"`]\)/g;
    let m;
    while ((m = regex.exec(t)) !== null) {
        tables.add(m[1]);
    }
});
console.log(Array.from(tables).sort().join('\n'));
