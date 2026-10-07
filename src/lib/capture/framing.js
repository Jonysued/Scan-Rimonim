// A visual framing heuristic only. No pixel width is converted into cm or mm.
export function framing(image){
  const {width:w,height:h,data}=image;
  // Include pink and yellow skins and shaded red areas; green foliage stays out.
  const raw=new Uint8Array(w*h);for(let i=0;i<raw.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];raw[i]=r>35&&r>=g*.98&&r>b*1.10&&r-b>12?1:0;}
  // Close small gaps caused by reflections or mottled skin before finding a body.
  const dilated=new Uint8Array(w*h),mask=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&raw[yy*w+xx])dilated[y*w+x]=1;}
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let filled=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!dilated[yy*w+xx])filled=false;}mask[y*w+x]=filled?1:0;
  }
  let best=null;
  for(let i=0;i<mask.length;i++){if(mask[i]!==1)continue;const stack=[i];mask[i]=2;let n=0,x0=w,x1=0,y0=h,y1=0,cx=0,cy=0;
    while(stack.length){const p=stack.pop(),x=p%w,y=Math.floor(p/w);n++;cx+=x;cy+=y;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]===1){mask[q]=2;stack.push(q);}}
    if(n<w*h*.003)continue;const ratio=(x1-x0+1)/(y1-y0+1);if(ratio<.65||ratio>1.55||n/((x1-x0+1)*(y1-y0+1))<.45)continue;
    const score=n/(1+Math.hypot(cx/n/w-.5,cy/n/h-.5)*5);if(!best||score>best.score)best={score,x0,x1,y0,y1,cx:cx/n/w,cy:cy/n/h};
  }
  if(!best)return {status:'search',message:'Centrar una sola fruta y buscar buena luz'};
  const fraction=Math.max(best.x1-best.x0+1,best.y1-best.y0+1)/Math.min(w,h);
  if(Math.hypot(best.cx-.5,best.cy-.5)>.18)return {status:'center',message:'Centrar la fruta'};
  if(best.x0===0||best.y0===0||best.x1===w-1||best.y1===h-1||fraction>.72)return {status:'farther',message:'Alejate: la fruta debe verse completa'};
  if(fraction<.3)return {status:'closer',message:'Acercate: la fruta ocupa poco espacio'};
  return {status:'ready',message:'Encuadre correcto · mantené quieto'};
}
