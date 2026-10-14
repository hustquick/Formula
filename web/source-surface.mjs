// A noninteractive paint layer: the native textarea remains the only editor and selection owner.
export function installSourceSurface(source,getLanguage){
  const frame=document.createElement('div'),code=document.createElement('pre');frame.className='source-syntax';frame.setAttribute('aria-hidden','true');frame.append(code);source.before(frame);source.classList.add('syntax-source');
  function refresh(){
    const style=getComputedStyle(source);Object.assign(frame.style,{left:source.offsetLeft+'px',top:source.offsetTop+'px',width:source.clientWidth+'px',height:source.clientHeight+'px',borderWidth:style.borderWidth});
    for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','padding','tabSize','textAlign'])code.style[key]=style[key];
    code.style.width=source.clientWidth+'px';code.style.transform=`translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;code.replaceChildren();
    const value=source.value,at=source.selectionStart;let bracket=at;if(!'{}[]()'.includes(value[bracket]||' '))bracket=at-1;let mate=-1;
    const opens='{[(',closes='}])',char=value[bracket],forward=opens.includes(char),pair=forward?closes[opens.indexOf(char)]:opens[closes.indexOf(char)];
    if(source.selectionStart===source.selectionEnd&&pair){let depth=0;for(let i=bracket;i>=0&&i<value.length;i+=forward?1:-1){if(value[i]===char)depth++;else if(value[i]===pair&&!--depth){mate=i;break;}}}
    const pattern=getLanguage()==='latex'?/\\[A-Za-z]+\*?|%[^\n]*|[{}[\]()]|\d+(?:\.\d+)?/g:/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\b(?:frac|sqrt|root|mat|vec|cases|set|show|let|import|include)\b|[{}[\]()]|\d+(?:\.\d+)?/g;let previous=0;
    for(const m of value.matchAll(pattern)){code.append(document.createTextNode(value.slice(previous,m.index)));const span=document.createElement('span');span.textContent=m[0];span.className=/^(%|\/\/)/.test(m[0])?'syntax-comment':/^\d/.test(m[0])?'syntax-number':/^[{}[\]()]/.test(m[0])?'syntax-bracket':'syntax-command';if(mate>=0&&(m.index===mate||m.index===bracket))span.classList.add('syntax-match');code.append(span);previous=m.index+m[0].length;}
    code.append(document.createTextNode(value.slice(previous)+'\n'));
  }
  for(const event of ['input','keyup','click','select','scroll','focus'])source.addEventListener(event,refresh);
  new ResizeObserver(refresh).observe(source);new MutationObserver(refresh).observe(source,{attributes:true,attributeFilter:['style','class']});window.addEventListener('resize',refresh);refresh();return{refresh};
}
