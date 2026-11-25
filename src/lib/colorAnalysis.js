// Color medido sobre los píxeles reales de la cáscara (no a ojo por la IA).
// Se trabaja en CIELAB: a* mide rojo-verde y es bastante estable con cambios de brillo.
// Los umbrales están juntos acá para poder ajustarlos con fotos reales.

export const COLOR_CONFIG = {
  ellipseShrink: 0.85, // usar el 85% interior de la elipse (evita borde, hojas y fondo)
  minL: 12, // descartar sombras profundas
  maxLForLowChroma: 88, // descartar brillos especulares (muy claros y sin color)
  lowChroma: 12,
  redMinA: 20, // a* mínimo para considerar el píxel "rojo"
  redHueMin: -30, // ángulo de tono (grados) permitido para rojo
  redHueMax: 60,
  rosadoMin: 25, // % de cobertura roja: < 25 verde, 25-60 rosado, >= 60 rojo
  rojoMin: 60,
  rojoOscuroMin: 85, // cobertura mínima para rojo oscuro...
  rojoOscuroMaxL: 38, // ...y L* mediano de la zona roja por debajo de esto
  rojoMaxL: 52, // zona roja muy clara (L* mediano > 52) = rosado aunque cubra mucho
};

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(r, g, b) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// pixels: Uint8ClampedArray RGBA de toda la imagen. fruit: con center/radius en %.
export function analyzeFruitColor(pixels, W, H, fruit, cfg = COLOR_CONFIG) {
  const cx = (fruit.center_x_pct / 100) * W;
  const cy = (fruit.center_y_pct / 100) * H;
  const rx = (fruit.radius_pct / 100) * W * cfg.ellipseShrink;
  const ry = ((fruit.radius_y_pct ?? fruit.radius_pct) / 100) * H * cfg.ellipseShrink;
  if (rx < 3 || ry < 3) return null;

  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  // Muestreo con paso para no recorrer millones de píxeles
  const step = Math.max(1, Math.floor(Math.min(rx, ry) / 60));

  let valid = 0;
  let red = 0;
  const redL = [];
  const allA = [];

  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = (y * W + x) * 4;
      const [L, a, b] = rgbToLab(pixels[i], pixels[i + 1], pixels[i + 2]);
      const chroma = Math.hypot(a, b);
      if (L < cfg.minL) continue;
      if (L > cfg.maxLForLowChroma && chroma < cfg.lowChroma) continue;
      valid++;
      allA.push(a);
      const hue = (Math.atan2(b, a) * 180) / Math.PI;
      if (a >= cfg.redMinA && hue >= cfg.redHueMin && hue <= cfg.redHueMax) {
        red++;
        redL.push(L);
      }
    }
  }

  if (valid < 30) return null;
  const coverage = (red / valid) * 100;
  const redMedianL = median(redL);

  let category = "verde";
  if (coverage >= cfg.rojoMin && redMedianL != null && redMedianL > cfg.rojoMaxL) {
    category = "rosado";
  } else if (coverage >= cfg.rojoMin) {
    category = coverage >= cfg.rojoOscuroMin && redMedianL != null && redMedianL < cfg.rojoOscuroMaxL ? "rojo_oscuro" : "rojo";
  } else if (coverage >= cfg.rosadoMin) {
    category = "rosado";
  }

  return {
    color_score: Math.round(coverage), // % de la cáscara visible que es roja
    color_category: category,
    color_a_median: median(allA),
    color_red_L_median: redMedianL,
    color_source: "pixeles",
  };
}

// Nivel 1-6 del histograma a partir del score 0-100 (antes nunca llegaba a 6).
export function colorLevel(score) {
  return Math.min(6, Math.max(1, 1 + Math.floor((score / 100) * 6)));
}

// Lee los píxeles de un File/Blob de imagen ya normalizado.
export async function readPixels(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, W: canvas.width, H: canvas.height };
}
