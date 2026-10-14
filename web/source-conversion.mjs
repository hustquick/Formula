import {tex2typst as convert,typst2tex} from 'tex2typst';
export {typst2tex};
// Expand mathematical aliases before the existing parser. Never rewrite the user's source.
const aliases={'\\gt':'>','\\lt':'<','\\arcsin':'\\operatorname{arcsin}','\\arctan':'\\operatorname{arctan}','\\cfrac':'\\frac','\\limits':' ','\\nolimits':' '};
export function normalizeInfixGroups(source){
  function group(text){let output='';for(let i=0;i<text.length;){if(text[i]==='\\'){const token=text.slice(i).match(/^\\(?:[A-Za-z]+|.)/s)?.[0]||'\\';output+=token;i+=token.length;if(['\\text','\\mathrm','\\operatorname'].includes(token)&&text[i]==='{'){const end=closing(text,i);output+=text.slice(i,end+1);i=end+1;}continue;}if(text[i]==='{'){const end=closing(text,i),inside=text.slice(i+1,end),parts=[];let depth=0,split=null;for(let j=0;j<inside.length;j++){if(inside[j]==='\\'){const cmd=inside.slice(j).match(/^\\(?:[A-Za-z]+|.)/s)?.[0]||'\\';if(depth===0&&['\\over','\\choose'].includes(cmd)){split={at:j,length:cmd.length,command:cmd};break;}j+=cmd.length-1;continue;}if(inside[j]==='{')depth++;if(inside[j]==='}')depth--;}
    output+=split?'\\'+(split.command==='\\over'?'frac':'binom')+'{'+group(inside.slice(0,split.at).trim())+'}{'+group(inside.slice(split.at+split.length).trim())+'}':'{'+group(inside)+'}';i=end+1;continue;}output+=text[i++];}return output;}
  function closing(text,start){let depth=1;for(let i=start+1;i<text.length;i++){if(text[i]==='\\'){const token=text.slice(i).match(/^\\(?:[A-Za-z]+|.)/s)?.[0]||'\\';i+=token.length-1;continue;}if(text[i]==='{')depth++;if(text[i]==='}'&&!--depth)return i;}throw new Error('LaTeX 分组未闭合，保留原始源码');}
  return group(String(source));
}
export function tex2typst(source,options={}){return convert(normalizeInfixGroups(source),{...options,customTexMacros:{...aliases,...options.customTexMacros}});}
