// Validate model geometry, without using fruit/background colour thresholds.
export function validatedContour(points) {
  if (!Array.isArray(points) || points.length < 12 || points.length > 64) return null;
  if (!points.every(p => p && ['x','y'].every(k => Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1000))) return null;
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const between = (a,b,c) => Math.min(a.x,b.x)<=c.x && c.x<=Math.max(a.x,b.x) && Math.min(a.y,b.y)<=c.y && c.y<=Math.max(a.y,b.y);
  const intersects = (a,b,c,d) => {
    const u=cross(a,b,c), v=cross(a,b,d), w=cross(c,d,a), z=cross(c,d,b);
    return (u*v<0 && w*z<0) || (u===0 && between(a,b,c)) || (v===0 && between(a,b,d)) || (w===0 && between(c,d,a)) || (z===0 && between(c,d,b));
  };
  let area=0;
  for(let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length];
    if(a.x===b.x && a.y===b.y) return null;
    area+=a.x*b.y-b.x*a.y;
    for(let j=i+2;j<points.length;j++) {
      if(i===0 && j===points.length-1) continue;
      if(intersects(a,b,points[j],points[(j+1)%points.length])) return null;
    }
  }
  if(Math.abs(area)/2<100) return null;
  return points.map(({x,y})=>({x,y}));
}
