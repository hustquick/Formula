const {ipcRenderer}=require('electron');

const session=ipcRenderer.sendSync('formula-load-session')||{};
window.FormulaSavedState=session.state||{};
window.FormulaSavedLifecycle=session.identity||undefined;
window.webkit={messageHandlers:{mathforge:{postMessage(data){ipcRenderer.send('formula-native',data);}}}};
ipcRenderer.on('formula-native-reply',(_event,id,result)=>window.FormulaNativeReply?.(id,result));
ipcRenderer.on('formula-tools',(_event,tools)=>window.FormulaTools?.(tools));
ipcRenderer.on('formula-import',(_event,text,ext,name,token)=>window.FormulaImport?.(text,ext,name,token));
ipcRenderer.on('formula-result',(_event,message,error)=>window.FormulaNativeResult?.(message,!!error));
