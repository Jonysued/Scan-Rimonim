import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// La IA solo LOCALIZA (fruta + objeto de referencia) y detecta defectos.
// El calibre en mm y el color se calculan en el frontend (src/lib/calibre.js y
// src/lib/colorAnalysis.js) con geometría y píxeles, no con la estimación del modelo.

const point = {
  type: 'array',
  items: { type: 'number' },
  description: '[y, x] normalizado 0-1000'
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { signed_url, variedad_name, reference_type } = await req.json();
    if (!signed_url) return Response.json({ error: 'signed_url requerido' }, { status: 400 });

    const refDesc =
      reference_type === 'pelota'
        ? 'una pelota de tenis'
        : 'una tarjeta plástica rectangular tamaño tarjeta de crédito (crédito, débito, DNI, SUBE, etc.)';

    const schema = {
      type: 'object',
      properties: {
        fruits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              box_2d: {
                type: 'array',
                items: { type: 'number' },
                description: '[ymin, xmin, ymax, xmax] normalizado 0-1000'
              },
              diameter_mm_estimate: { type: 'number' },
              color_category: { type: 'string', enum: ['verde', 'rosado', 'rojo', 'rojo_oscuro'] },
              defects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['sunburn', 'cracking', 'russet'] },
                    severity: { type: 'string', enum: ['leve', 'media', 'grave'] },
                    confidence: { type: 'number' }
                  }
                }
              }
            },
            required: ['box_2d', 'color_category']
          }
        },
        reference: {
          type: 'object',
          properties: {
            found: { type: 'boolean' },
            corners: {
              type: 'array',
              items: point,
              description: 'Tarjeta: las 4 esquinas en orden (horario), cada una [y, x] 0-1000'
            },
            box_2d: {
              type: 'array',
              items: { type: 'number' },
              description: 'Pelota: [ymin, xmin, ymax, xmax] 0-1000'
            }
          },
          required: ['found']
        }
      },
      required: ['fruits', 'reference']
    };

    const prompt = `Analizá esta foto de muestreo de granadas (variedad ${variedad_name || 'Wonderful'}). Tu trabajo es LOCALIZAR con precisión, no medir.

1) GRANADA PRINCIPAL: la que está en primer plano, mejor enfocada y junto al objeto de referencia. Devolvé:
- box_2d: [ymin, xmin, ymax, xmax] normalizado 0-1000 (0,0 = esquina superior izquierda), ajustado EXACTAMENTE al borde exterior de la cáscara, de mejilla a mejilla. Excluí la corona (cáliz/sépalos), hojas y ramas. La precisión de esta caja es crítica: tocá el borde de la cáscara, sin margen.
- diameter_mm_estimate: tu estimación del diámetro ecuatorial en mm (solo como respaldo).
- color_category: verde, rosado, rojo o rojo_oscuro según el color dominante.
- defects: sunburn, cracking o russet con severity (leve/media/grave) y confidence (0-1). Lista vacía si no hay.
Como máximo 1 granada. Ignorá granadas de fondo, borrosas o parciales. Si no hay, fruits: [].

2) OBJETO DE REFERENCIA: buscá ${refDesc} en la foto.
${reference_type === 'pelota'
  ? '- Si está: found=true y box_2d ajustado al borde de la pelota (sin pelusa suelta ni sombra).'
  : '- Si está: found=true y corners con sus 4 esquinas visibles en orden horario, cada una [y, x] 0-1000. Si las esquinas son redondeadas, ubicá donde se cruzarían los bordes rectos.'}
- Si no está o está muy tapado: found=false.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [signed_url],
      response_json_schema: schema,
      model: 'gemini_3_8_flash'
    });

    const fruits = (result.fruits || []).filter((f) => Array.isArray(f.box_2d) && f.box_2d.length === 4);
    return Response.json({ fruits, reference: result.reference || { found: false } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
