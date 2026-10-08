// Geometry comes from the learned foreground mask, not RGB thresholds.
export function maskContour(values,w,h,seed) {
  if(values.length!==w*h || !Number.isFinite(seed?.x) || !Number.isFinite(seed?.y) || seed.x<=0 || seed.y<=0 || seed.x>=1 || seed.y>=1) return null;
  const start=Math.floor(seed.y*h)*w+Math.floor(seed.x*w);
  if(values[start]<.5) return null;
  const seen=new Uint8Array(w*h), queue=new Int32Array(w*h);
  let count=1,read=0,sumX=0,sumY=0,minX=w,minY=h,maxX=0,maxY=0;
  queue[0]=start;seen[start]=1;
  while(read<count) {
    const i=queue[read++],x=i%w,y=Math.floor(i/w);
    sumX+=x;sumY+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    const add=j=>{if(!seen[j] && values[j]>=.5){seen[j]=1;queue[count++]=j;}};
    if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w);
  }
  if(count<w*h*.005 || count>w*h*.8 || minX===0 || minY===0 || maxX===w-1 || maxY===h-1) return null;
  const cx=sumX/count,cy=sumY/count;
  if(!seen[Math.floor(cy)*w+Math.floor(cx)]) return null;
  const points=[];
  for(let k=0;k<160;k++) {
    const angle=-Math.PI/2+k*Math.PI*2/160,dx=Math.cos(angle),dy=Math.sin(angle);
    let edge=null;
    for(let r=0;r<=Math.hypot(w,h);r+=.5) {
      const x=Math.round(cx+dx*r),y=Math.round(cy+dy*r);
      if(x<0 || x>=w || y<0 || y>=h) break;
      if(seen[y*w+x]) edge={x:(x+.5)*1000/w,y:(y+.5)*1000/h};
    }
    if(!edge) return null;
    points.push(edge);
  }
  return points;
}
