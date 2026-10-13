import {cp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('web/vendor',{recursive:true});
for(const dir of ['mathlive','mathjax','newcm']){await rm(`web/vendor/${dir}`,{recursive:true,force:true});await mkdir(`web/vendor/${dir}`,{recursive:true});}
for(const name of ['mathlive.min.js','fonts'])await cp(`node_modules/mathlive/${name}`,`web/vendor/mathlive/${name}`,{recursive:true});
for(const name of ['tex-svg.js','tex-svg-nofont.js','input','a11y','ui','sre'])await cp(`node_modules/mathjax/${name}`,`web/vendor/mathjax/${name}`,{recursive:true});
for(const name of ['svg.js','svg'])await cp(`node_modules/@mathjax/mathjax-newcm-font/${name}`,`web/vendor/newcm/${name}`,{recursive:true});
const mathFonts=['newcm','asana','bonum','dejavu','fira','modern','pagella','schola','stix2','termes','tex'];
await rm('web/vendor/fonts',{recursive:true,force:true});
for(const font of mathFonts){const dest=`web/vendor/fonts/mathjax-${font}-font`;await mkdir(dest,{recursive:true});for(const file of (font==='tex'?['svg.js']:['svg.js','svg']))await cp(`node_modules/@mathjax/mathjax-${font}-font/${file}`,`${dest}/${file}`,{recursive:true});}
await mkdir('web/vendor/fonts/mathjax-mhchem-font-extension',{recursive:true});
await cp('node_modules/@mathjax/mathjax-mhchem-font-extension/svg.js','web/vendor/fonts/mathjax-mhchem-font-extension/svg.js');
await build({entryPoints:['web/app.js'],bundle:true,format:'iife',target:['safari15','chrome100'],outfile:'web/vendor/app.bundle.js',minify:true,legalComments:'eof'});
const names=['@mathjax/mathjax-mhchem-font-extension',...mathFonts.filter(x=>x!=='newcm').map(x=>`@mathjax/mathjax-${x}-font`),'mathlive','mathjax','@mathjax/mathjax-newcm-font','tex2typst','jspdf','svg2pdf.js'];
let notices='Formula — Third-party notices\n\n';
for(const name of names){const p=JSON.parse(await readFile(`node_modules/${name}/package.json`));notices+=`${name} ${p.version} (${p.license})\n`;for(const file of ['LICENSE','LICENSE.txt','LICENSE.md']){try{notices+=await readFile(`node_modules/${name}/${file}`,'utf8');break;}catch{}}notices+='\n\n';}
await writeFile('THIRD-PARTY-NOTICES.txt',notices);
await writeFile('THIRD-PARTY-NOTICES.txt',(await readFile('THIRD-PARTY-NOTICES.txt','utf8'))+'\nOn-demand Word support: pypandoc_binary 1.17 (MIT), invoking Pandoc (GPL-2.0-or-later) as a standalone process. Source and license: https://github.com/jgm/pandoc/blob/main/COPYRIGHT\n');
console.log('Offline editor and exporters bundled.');
