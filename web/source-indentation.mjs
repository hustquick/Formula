// Whitespace-only editing. Generated-source formatting never runs on hand-written text.
export function installSourceIndentation(source,getLanguage){
  let composing=false;
  source.addEventListener('compositionstart',()=>{composing=true;});
  source.addEventListener('compositionend',()=>{composing=false;});
  const transact=execute=>window.FormulaCommands?window.FormulaCommands.execute('sourceAccept',{execute}):execute();
  source.addEventListener('keydown',event=>{
    if(composing||event.defaultPrevented||event.isComposing||event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.key!=='Enter'&&event.key!=='Tab')return;
    const value=source.value,start=source.selectionStart,end=source.selectionEnd;
    const lineStart=start===0?0:value.lastIndexOf('\n',start-1)+1;
    if(event.key==='Enter'){
      if(event.shiftKey)return;
      event.preventDefault();
      const prefix=value.slice(lineStart,start),indent=prefix.match(/^\s*/)[0];
      const opens=getLanguage()==='latex'?/\\begin\{[^{}]+\}(?:\{[^{}]*\})?\s*$|(?<!\\)[{[(]\s*$/:/[{[(]\s*$/;
      const extra=opens.test(prefix)?'  ':'';
      transact(()=>{source.focus();document.execCommand('insertText',false,'\n'+indent+extra);source.dispatchEvent(new Event('input',{bubbles:true}));});
      return;
    }
    event.preventDefault();
    transact(()=>{
      source.focus();
      if(start===end&&!event.shiftKey){document.execCommand('insertText',false,'  ');source.dispatchEvent(new Event('input',{bubbles:true}));return;}
      // A selection ending at a line boundary does not include the next line.
      const last=value.indexOf('\n',end>start&&value[end-1]==='\n'?end-1:end);
      const stop=last<0?value.length:last;
      const text=value.slice(lineStart,stop),lines=text.split('\n');
      const next=lines.map(line=>event.shiftKey?line.replace(/^(?: {1,2}|\t)/,''):'  '+line).join('\n');
      source.setSelectionRange(lineStart,stop);document.execCommand('insertText',false,next);
      source.setSelectionRange(lineStart,lineStart+next.length);source.dispatchEvent(new Event('input',{bubbles:true}));
    });
  });
}
