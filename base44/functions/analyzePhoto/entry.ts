import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { signed_url, variedad_name } = await req.json();
    if (!signed_url) return Response.json({ error: 'signed_url requerido' }, { status: 400 });

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
              diameter_mm: { type: 'number' },
              color_category: { type: 'string', enum: ['verde', 'rosado', 'rojo', 'rojo_oscuro'] },
              color_score: { type: 'number' },
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
            required: ['box_2d', 'diameter_mm', 'color_category']
          }
        }
      },
      required: ['fruits']
    };

    const prompt = `Detectá la granada principal (variedad ${variedad_name || 'Wonderful'}) visible en la imagen: la que está en primer plano y mejor enfocada, centro de atención de la foto.
Para esa granada devolvé:
- box_2d: caja delimitadora ajustada al borde exterior de la cáscara, formato [ymin, xmin, ymax, xmax] con coordenadas normalizadas 0-1000 (0,0 = esquina superior izquierda). No incluyas hojas, ramas ni la corona más allá del contorno del fruto.
- diameter_mm: diámetro aproximado en mm (Wonderful madura: 60-100mm). Si hay un objeto de referencia (pelota de tenis ≈ 67mm), usalo para calibrar.
- color_category: verde, rosado, rojo o rojo_oscuro según el color dominante.
- color_score: 0-100 según intensidad de rojo.
- defects: sunburn, cracking o russet con severity (leve/media/grave) y confidence (0-1). Lista vacía si no hay.
Ignorá objetos que no sean granadas y toda granada que no sea la principal. Si en la imagen hay más de una granada, evaluá únicamente la principal: la que está en primer plano y mejor enfocada (el centro de atención de la foto). No incluyas granadas de fondo, borrosas, parciales o fuera de foco. El array fruits debe contener como máximo 1 elemento. Si no hay granadas, devolvé fruits: [].`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [signed_url],
      response_json_schema: schema,
      model: 'gemini_3_8_flash'
    });

    const fruits = (result.fruits || [])
      .filter((f) => Array.isArray(f.box_2d) && f.box_2d.length === 4)
      .map(({ box_2d, ...rest }) => {
        const [ymin, xmin, ymax, xmax] = box_2d;
        return {
          ...rest,
          defects: rest.defects || [],
          center_x_pct: (xmin + xmax) / 20,
          center_y_pct: (ymin + ymax) / 20,
          radius_pct: (xmax - xmin) / 20,
          radius_y_pct: (ymax - ymin) / 20
        };
      });

    return Response.json({ fruit_count_estimate: fruits.length, fruits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}