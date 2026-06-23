const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const start = html.indexOf('DATA STORE - en memoria');
const endTag = '</' + 'script>';
const end = html.lastIndexOf(endTag);
const code = html.slice(start, end);
console.log('len', code.length);
try { new Function(code); console.log('OK sintaxis'); }
catch (e) { console.log('ERROR', e.message); process.exit(2); }
