function formatRows(latex){
    const input=String(latex||'');
    // Preserve comments/verbatim and single-line formulas; only recognized multiline environments.
    if(/%|\\verb|\\begin\{(?:verbatim|lstlisting)\}/.test(input))return input;
    const environments=new Set(['aligned','align','align*','gathered','gather','gather*','cases','matrix','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix','smallmatrix','array']);
    let out='',depth=0,braces=0;
    const newline=()=>{out=out.replace(/[ \t]+$/,'');if(!out.endsWith('\n'))out+='\n';out+='  '.repeat(depth);};
    for(let i=0;i<input.length;){
      const env=input.slice(i).match(/^\\(begin|end)\{([^}]+)\}/);
      if(env&&environments.has(env[2])){
        if(env[1]==='end'){depth=Math.max(0,depth-1);newline();out+=env[0];}
        else{out+=env[0];i+=env[0].length;
          // Array column specification belongs on the begin line.
          if(env[2]==='array'){const columns=input.slice(i).match(/^\s*\{[^{}]*\}/);if(columns){out+=columns[0];i+=columns[0].length;}}
          depth++;newline();continue;
        }
        i+=env[0].length;continue;
      }
      if(input[i]==='\\'){
        if(input[i+1]==='\\'&&depth&&braces===0){out+='\\\\';i+=2;
          const spacing=input.slice(i).match(/^\s*(?:\*)?(?:\[[^\]]*\])?/);if(spacing){out+=spacing[0].trim();i+=spacing[0].length;}
          newline();continue;
        }
        const command=input.slice(i).match(/^\\(?:[A-Za-z]+|.)/);if(command){out+=command[0];i+=command[0].length;continue;}
      }
      const ch=input[i++];if(ch==='{')braces++;if(ch==='}')braces=Math.max(0,braces-1);
      if(depth&&/\s/.test(ch)&&out.endsWith('\n'+'  '.repeat(depth)))continue;
      out+=ch;
    }
    return out;
  }

// Format only known mathematical arguments. Text and arbitrary macro syntax are opaque.
export function formatLatexSource(value){
  const input=String(value||'');
  if(/%|\\verb|\\begin\{(?:verbatim|lstlisting)\}/.test(input))return input;
  function groupEnd(s,start){let depth=0;for(let i=start;i<s.length;i++){if(s[i]==='\\'){i++;continue;}if(s[i]==='{')depth++;if(s[i]==='}'&&!--depth)return i;}return -1;}
  function format(s,level=0){
    let out='';
    for(let i=0;i<s.length;){
      const command=s.slice(i).match(/^\\(?:[A-Za-z]+|.)/);
      if(!command){out+=s[i++];continue;}
      const name=command[0],count=/^\\(?:frac|dfrac|tfrac)$/.test(name)?2:name==='\\sqrt'?1:0;
      let cursor=i+name.length,optional='';
      if(name==='\\sqrt'&&s[cursor]==='['){const end=s.indexOf(']',cursor);if(end<0)return s;optional=s.slice(cursor,end+1);cursor=end+1;}
      if(count){
        const args=[];
        for(let n=0;n<count;n++){while(/\s/.test(s[cursor]||'')&&cursor<s.length)cursor++;if(s[cursor]!=='{')break;const end=groupEnd(s,cursor);if(end<0)return s;args.push(s.slice(cursor+1,end));cursor=end+1;}
        if(args.length===count){
          const complex=args.some(a=>/[+=]|\\(?:frac|dfrac|tfrac|sqrt)\b/.test(a)||a.trim().length>32);
          out+=name+optional+args.map(a=>complex?'{\n'+'  '.repeat(level+1)+format(a.trim(),level+1)+'\n'+'  '.repeat(level)+'}':'{'+format(a,level)+'}').join('');i=cursor;continue;
        }
      }
      // Do not descend into text, units, chemistry or custom macro arguments.
      out+=name;i+=name.length;
      if(!count&&s[i]==='{'){const end=groupEnd(s,i);if(end>=0){out+=s.slice(i,end+1);i=end+1;}}
    }
    return out;
  }
  return formatRows(format(input));
}

export function formatTypstSource(value){
  const input=String(value||'');
  if(/#|\/\/|\/\*/.test(input))return input;
  function format(s,level=0){
    let out='';
    for(let i=0;i<s.length;){
      if(s[i]==='"'){let j=i+1;for(;j<s.length;j++){if(s[j]==='\\')j++;else if(s[j]==='"'){j++;break;}}out+=s.slice(i,j);i=j;continue;}
      const call=s.slice(i).match(/^(frac|sqrt|root|mat|vec|cases)\(/);
      if(!call){out+=s[i++];continue;}
      const begin=i+call[0].length;let depth=1,j=begin,quoted=false;
      for(;j<s.length;j++){if(s[j]==='\\'){j++;continue;}if(s[j]==='"')quoted=!quoted;if(quoted)continue;if(s[j]==='(')depth++;if(s[j]===')'&&!--depth)break;}
      if(depth)return s;
      const body=s.slice(begin,j);const complex=/^(mat|cases)$/.test(call[1])||body.length>36||/(?:frac|sqrt|root)\(/.test(body)||/[+=]/.test(body);
      let content=format(body.trim(),level+1);
      if(complex){let d=0,q=false,split='';for(let k=0;k<content.length;k++){const c=content[k];if(c==='\\'){split+=c+(content[++k]||'');continue;}if(c==='"')q=!q;if(!q){if(c==='(')d++;if(c===')')d--;}split+=c;if(!q&&!d&&(c===','||c===';')){split+='\n'+'  '.repeat(level+1);while(/\s/.test(content[k+1]||'')&&k+1<content.length)k++;}}content=split;
        out+=call[1]+'(\n'+'  '.repeat(level+1)+content+'\n'+'  '.repeat(level)+')';
      }else out+=call[1]+'('+body+')';
      i=j+1;
    }
    return out;
  }
  return format(input);
}
