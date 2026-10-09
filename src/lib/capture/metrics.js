export function measuredMean(values) {
  const measured = values.filter(v => Number.isFinite(v) && v > 0);
  return measured.length ? measured.reduce((a,b)=>a+b,0)/measured.length : null;
}
