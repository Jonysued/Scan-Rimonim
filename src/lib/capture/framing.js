// A visual framing heuristic only. No pixel width is converted into cm or mm.
export function framing(image){
  const {width:w,height:h,data}=image;
  const mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];mask[i]=r>65&&r>g*1.18&&r>b*1.15&&r-Math.min(g,b)>28?1:0;}
  let best=null;
  for(let i=0;i<mask.length;i++){if(mask[i]!==1)continue;const stack=[i];mask[i]=2;let n=0,x0=w,x1=0,y0=h,y1=0,cx=0,cy=0;
    while(stack.length){const p=stack.pop(),x=p%w,y=Math.floor(p/w);n++;cx+=x;cy+=y;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]===1){mask[q]=2;stack.push(q);}}
    if(n<w*h*.01)continue;const ratio=(x1-x0+1)/(y1-y0+1);if(ratio<.55||ratio>1.8||n/((x1-x0+1)*(y1-y0+1))<.35)continue;
    const score=n/(1+Math.hypot(cx/n/w-.5,cy/n/h-.5)*5);if(!best||score>best.score)best={score,x0,x1,y0,y1,cx:cx/n/w,cy:cy/n/h};
  }
  if(!best)return {status:'search',message:'Centrar una sola fruta y buscar buena luz'};
  const fraction=Math.max((best.x1-best.x0+1)/w,(best.y1-best.y0+1)/h);
  if(Math.hypot(best.cx-.5,best.cy-.5)>.18)return {status:'center',message:'Centrar la fruta'};
  if(best.x0===0||best.y0===0||best.x1===w-1||best.y1===h-1||fraction>.72)return {status:'farther',message:'Alejate: la fruta debe verse completa'};
  if(fraction<.3)return {status:'closer',message:'Acercate: la fruta ocupa poco espacio'};
  return {status:'ready',message:'Encuadre correcto · mantené quieto'};
}
