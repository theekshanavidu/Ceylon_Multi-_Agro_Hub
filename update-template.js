import fs from 'fs';
const pdf = fs.readFileSync('./public/template.pdf');
const base64Str = pdf.toString('base64');
fs.writeFileSync('./src/assets/templatePdf.js', `export const templatePdf = "${base64Str}";\n`);
console.log('Template PDF updated successfully');
