// All coordinates use the source-card's local coordinate system.
export function computeCompletionPopupPlacement({caret,viewport,preferredWidth,preferredHeight,gap=3}){
  const width=Math.max(0,Math.min(preferredWidth,viewport.right-viewport.left));
  const below=Math.max(0,viewport.bottom-caret.bottom-gap),above=Math.max(0,caret.top-gap-viewport.top);
  const side=below>=preferredHeight?'below':above>=preferredHeight?'above':below>=above?'below':'above';
  const height=Math.min(preferredHeight,side==='below'?below:above);
  return{side,left:Math.max(viewport.left,Math.min(caret.left,viewport.right-width)),top:side==='below'?caret.bottom+gap:caret.top-gap-height,width,height,visible:height>0&&caret.bottom>viewport.top&&caret.top<viewport.bottom};
}
