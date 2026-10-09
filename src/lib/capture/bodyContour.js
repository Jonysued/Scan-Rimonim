// Conservative visible-skin check. This is not a metric measurement or model training.
export function bodyContour({width:w,height:h,data}, prior) {
  if(!prior || prior.localization_status !== 'located') return null;
  const px=prior.center_x_pct*w/100, py=prior.center_y_pct*h/100;
  const rx=prior.radius_pct*w/100, ry=prior.radius_y_pct*h/100;
  if(![px,py,rx,ry].every(Number.isFinite)||rx<=0||ry<=0)return null;
  const mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++){
    const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
    // Dark shadows and neutral/brown backgrounds do not define the body.
    mask[i]=r>70&&r>g*1.18&&r>b*1.25&&r-b>30?1:0;
  }
  let best=null;
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    const stack=[i],pixels=[];mask[i]=0;
    let x0=w,y0=h,x1=0,y1=0;
    while(stack.length){
      const p=stack.pop(),x=p%w,y=Math.floor(p/w);pixels.push(p);
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]){
        if(q>=0&&mask[q]){mask[q]=0;stack.push(q);}
      }
    }
    const bw=x1-x0+1,bh=y1-y0+1,cx=(x0+x1+1)/2,cy=(y0+y1+1)/2;
    const distance=Math.hypot((cx-px)/rx,(cy-py)/ry);
    const fill=pixels.length/(bw*bh);
    if(pixels.length<w*h*.01||x0===0||y0===0||x1===w-1||y1===h-1||bw/bh<.7||bw/bh>1.4||fill<.6||fill>.9||distance>1.5)continue;
    const round=pixels.filter(p=>((p%w+.5-cx)/(bw/2))**2+((Math.floor(p/w)+.5-cy)/(bh/2))**2<=1.15).length/pixels.length;
    if(round<.94)continue;
    const score=pixels.length/(1+distance);
    if(!best||score>best.score)best={score,center_x_pct:cx/w*100,center_y_pct:cy/h*100,radius_pct:bw/w*50,radius_y_pct:bh/h*50};
  }
  return best;
}
