import {cp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('web/vendor',{recursive:true});
for(const dir of ['mathlive','mathjax','newcm']){await rm(`web/vendor/${dir}`,{recursive:true,force:true});await mkdir(`web/vendor/${dir}`,{recursive:true});}
for(const name of ['mathlive.min.js','fonts'])await cp(`node_modules/mathlive/${name}`,`web/vendor/mathlive/${name}`,{recursive:true});
for(const name of ['tex-svg.js','input','a11y','ui','sre'])await cp(`node_modules/mathjax/${name}`,`web/vendor/mathjax/${name}`,{recursive:true});
for(const name of ['svg.js','svg'])await cp(`node_modules/@mathjax/mathjax-newcm-font/${name}`,`web/vendor/newcm/${name}`,{recursive:true});
await build({entryPoints:['web/app.js'],bundle:true,format:'iife',target:['safari15','chrome100'],outfile:'web/vendor/app.bundle.js',minify:true,legalComments:'eof'});
const names=['mathlive','mathjax','@mathjax/mathjax-newcm-font','tex2typst','jspdf','svg2pdf.js'];
let notices='Formula — Third-party notices\n\n';
for(const name of names){const p=JSON.parse(await readFile(`node_modules/${name}/package.json`));notices+=`${name} ${p.version} (${p.license})\n`;for(const file of ['LICENSE','LICENSE.txt','LICENSE.md']){try{notices+=await readFile(`node_modules/${name}/${file}`,'utf8');break;}catch{}}notices+='\n\n';}
await writeFile('THIRD-PARTY-NOTICES.txt',notices);
console.log('Offline editor and exporters bundled.');
