const fs = require('fs');
let content = fs.readFileSync('js/ui/ui-search-history.js', 'utf8');
const old = "document.querySelector('.relative.mb-3 > .h-12')";
const newS = "document.querySelector('[data-searchbar]')";
content = content.split(old).join(newS);
fs.writeFileSync('js/ui/ui-search-history.js', content, 'utf8');
console.log('Done:', content.includes('[data-searchbar]'));
