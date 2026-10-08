export const defectLabels = {sunburn: 'Quemadura de sol', cracking: 'Rajado', russet: 'Russet / roña'};

export function validDefectBox(box) {
  return box && ['left','top','right','bottom'].every(k => Number.isFinite(box[k]) && box[k] >= 0 && box[k] <= 1000)
    && box.left < box.right && box.top < box.bottom ? box : null;
}

// Model uses original image pixels; stored overlays use a single 0..1000 convention.
export function normalizeDefect(d, {width, height}) {
  const confidence = Number.isFinite(d.confidence) && d.confidence >= 0 && d.confidence <= 1 ? d.confidence : 0;
  const b = d.region;
  const locationConfidence = d.location_confidence;
  let region = null;
  if (b && ['left','top','right','bottom'].every(k=>Number.isFinite(b[k])) && width > 0 && height > 0 && Number.isFinite(locationConfidence) && locationConfidence > 0 && locationConfidence <= 1) {
    region = validDefectBox({left:b.left/width*1000, right:b.right/width*1000, top:b.top/height*1000, bottom:b.bottom/height*1000});
  }
  return {type:d.type, severity:d.severity, confidence, region, location_confidence:region ? locationConfidence : null, localization_status:region ? locationConfidence >= .85 ? 'located' : 'tentative' : 'uncertain', localization_version:1};
}

export function drawableDefect(d) {
  return d.localization_version === 1 && ['located','tentative'].includes(d.localization_status) && d.location_confidence > 0 && d.location_confidence <= 1 && validDefectBox(d.region);
}
