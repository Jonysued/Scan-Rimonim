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
  // Pale/green fruit may not pass the warm-color mask. Look for a compact,
  // round region near the center that contrasts with its surroundings.
  if(!best)best=centralBody(image);
  if(!best)return {status:'search',message:'Centrar una sola fruta y buscar buena luz'};
  const box={x:best.x0/w,y:best.y0/h,width:(best.x1-best.x0+1)/w,height:(best.y1-best.y0+1)/h};
  const fraction=Math.max(best.x1-best.x0+1,best.y1-best.y0+1)/Math.min(w,h);
  if(Math.hypot(best.cx-.5,best.cy-.5)>.18)return {status:'center',message:'Centrar la fruta',box};
  if(best.x0===0||best.y0===0||best.x1===w-1||best.y1===h-1||fraction>.72)return {status:'farther',message:'Alejate: la fruta debe verse completa',box};
  if(fraction<.3)return {status:'closer',message:'Acercate: la fruta ocupa poco espacio',box};
  return {status:'ready',message:'Encuadre correcto · tocá Tomar foto',box};
}

function centralBody({width:w,height:h,data}){
  let best=null;
  for(const sx of [.4,.5,.6])for(const sy of [.4,.5,.6]){
    const seed=Math.floor(sy*h)*w+Math.floor(sx*w),offset=seed*4;
    const total=data[offset]+data[offset+1]+data[offset+2];if(total<60)continue;
    const red=data[offset]/total,green=data[offset+1]/total;
    const seen=new Uint8Array(w*h),stack=[seed];seen[seed]=1;
    let n=0,cx=0,cy=0,x0=w,x1=0,y0=h,y1=0;const pixels=[];
    while(stack.length){
      const p=stack.pop(),i=p*4,t=data[i]+data[i+1]+data[i+2];
      if(t<total*.4||t>total*2||Math.hypot(data[i]/t-red,data[i+1]/t-green)>.10)continue;
      const x=p%w,y=Math.floor(p/w);n++;pixels.push(p);cx+=x;cy+=y;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!seen[q]){seen[q]=1;stack.push(q);}
    }
    const bw=x1-x0+1,bh=y1-y0+1,fill=n/(bw*bh);
    if(n<w*h*.003||x0===0||y0===0||x1===w-1||y1===h-1||bw/bh<.7||bw/bh>1.4||fill<.55||fill>.88)continue;
    // Reject rectangular backgrounds and irregular clusters of foliage.
    const mx=(x0+x1)/2,my=(y0+y1)/2;
    const round=pixels.filter(p=>((p%w-mx)/(bw/2))**2+((Math.floor(p/w)-my)/(bh/2))**2<=1.12).length/n;
    if(round<.94)continue;
    const score=n/(1+Math.hypot(cx/n/w-.5,cy/n/h-.5)*5);
    if(!best||score>best.score)best={score,x0,x1,y0,y1,cx:cx/n/w,cy:cy/n/h};
  }
  return best;
}

