export const outputFormats=Object.freeze({svg:{kind:'vector'},pdf:{kind:'vector'},eps:{kind:'vector'},png:{kind:'raster'},jpeg:{kind:'raster'},tiff:{kind:'raster'},latex:{kind:'source'},typst:{kind:'source'},mathml:{kind:'source'},project:{kind:'source'}});
export const isRasterFormat=format=>outputFormats[format]?.kind==='raster';
export const isVectorFormat=format=>outputFormats[format]?.kind==='vector';
export const outputScale=(format,scale)=>isRasterFormat(format)?Number(scale):1;
