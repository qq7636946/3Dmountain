// Update the independent release entry without touching any other page.
const fs=require('node:fs'),path=require('node:path');
const target=path.resolve(__dirname,'../../1-6.html');
fs.copyFileSync(path.join(__dirname,'page.html'),target);
console.log('Updated '+target);
