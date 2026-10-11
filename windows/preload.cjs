const {ipcRenderer}=require('electron');

window.FormulaSavedState=ipcRenderer.sendSync('formula-load-state')||{};
window.webkit={messageHandlers:{mathforge:{postMessage(data){ipcRenderer.send('formula-native',data);}}}};
ipcRenderer.on('formula-native-reply',(_event,id,result)=>window.FormulaNativeReply?.(id,result));
ipcRenderer.on('formula-tools',(_event,tools)=>window.FormulaTools?.(tools));
ipcRenderer.on('formula-import',(_event,text,ext)=>window.FormulaImport?.(text,ext));
ipcRenderer.on('formula-result',(_event,message,error)=>window.FormulaNativeResult?.(message,!!error));
