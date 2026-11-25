// Cálculo del calibre (mm) a partir de las cajas que devuelve la IA y un objeto de referencia.
// Coordenadas de la IA: normalizadas 0-1000 por eje ([y, x]); W/H = tamaño de la imagen en px.

export const REFERENCIAS = {
  tarjeta: { label: "Tarjeta (crédito, DNI, SUBE)", long_mm: 85.6, short_mm: 53.98 },
  pelota: { label: "Pelota de tenis", diameter_mm: 67 },
  ninguna: { label: "Sin referencia (calibre estimado)" },
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const toPx = ([y, x], W, H) => [(y / 1000) * H, (x / 1000) * W];

// Devuelve mm por píxel, o null si la referencia no es usable.
export function mmPerPixel(reference, type, W, H) {
  if (!reference?.found) return null;

  if (type === "pelota") {
    const b = reference.box_2d;
    if (!Array.isArray(b) || b.length !== 4) return null;
    const [ymin, xmin, ymax, xmax] = b;
    const wPx = ((xmax - xmin) / 1000) * W;
    const hPx = ((ymax - ymin) / 1000) * H;
    const dPx = Math.max(wPx, hPx); // la esfera no se acorta por perspectiva
    return dPx > 10 ? REFERENCIAS.pelota.diameter_mm / dPx : null;
  }

  if (type === "tarjeta") {
    const c = reference.corners;
    if (!Array.isArray(c) || c.length !== 4 || c.some((p) => !Array.isArray(p) || p.length !== 2)) return null;
    const p = c.map((pt) => toPx(pt, W, H));
    const edges = [dist(p[0], p[1]), dist(p[1], p[2]), dist(p[2], p[3]), dist(p[3], p[0])];
    // Lados opuestos promediados
    const a = (edges[0] + edges[2]) / 2;
    const b = (edges[1] + edges[3]) / 2;
    const longPx = Math.max(a, b);
    const shortPx = Math.min(a, b);
    if (shortPx < 10) return null;
    // Una tarjeta inclinada solo se ACORTA en un eje. La escala correcta es la del lado
    // menos acortado, o sea el que da más px por mm.
    const sLong = longPx / REFERENCIAS.tarjeta.long_mm;
    const sShort = shortPx / REFERENCIAS.tarjeta.short_mm;
    const pxPerMm = Math.max(sLong, sShort);
    return 1 / pxPerMm;
  }

  return null;
}

// Calidad de la referencia: proporción de la tarjeta vs. la real (1.586). Muy lejos = muy inclinada.
export function referenceQuality(reference, type, W, H) {
  if (type !== "tarjeta" || !reference?.found || !Array.isArray(reference.corners) || reference.corners.length !== 4) return null;
  const p = reference.corners.map((pt) => toPx(pt, W, H));
  const a = (dist(p[0], p[1]) + dist(p[2], p[3])) / 2;
  const b = (dist(p[1], p[2]) + dist(p[3], p[0])) / 2;
  const ratio = Math.max(a, b) / Math.min(a, b);
  const ideal = REFERENCIAS.tarjeta.long_mm / REFERENCIAS.tarjeta.short_mm;
  return Math.abs(ratio - ideal) / ideal; // 0 = perfecta
}

// Diámetro ecuatorial de la fruta en px (ancho horizontal de la caja).
export function fruitDiameterPx(box, W) {
  const [, xmin, , xmax] = box;
  return ((xmax - xmin) / 1000) * W;
}

// Convierte la respuesta de la IA en frutos con diámetro medido.
export function buildFruits({ fruits = [], reference }, referenceType, W, H) {
  const mmPx = mmPerPixel(reference, referenceType, W, H);
  const quality = referenceQuality(reference, referenceType, W, H);
  return fruits.map(({ box_2d, diameter_mm_estimate, ...rest }) => {
    const [ymin, xmin, ymax, xmax] = box_2d;
    const measured = mmPx ? fruitDiameterPx(box_2d, W) * mmPx : null;
    return {
      ...rest,
      defects: rest.defects || [],
      diameter_mm: measured ?? diameter_mm_estimate ?? null,
      diameter_source: measured ? "referencia" : "estimado",
      reference_tilt: quality,
      center_x_pct: (xmin + xmax) / 20,
      center_y_pct: (ymin + ymax) / 20,
      radius_pct: (xmax - xmin) / 20,
      radius_y_pct: (ymax - ymin) / 20,
    };
  });
}
