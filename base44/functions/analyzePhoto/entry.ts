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
        fruit_count_estimate: { type: 'number' },
        fruits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
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
            required: ['diameter_mm', 'color_category']
          }
        }
      },
      required: ['fruit_count_estimate', 'fruits']
    };

    const prompt = `Sos un sistema de visión por computadora especializado en estimar calidad de granadas (variedad ${variedad_name || 'Wonderful'}) a partir de una foto tomada en el árbol.
Analiza la imagen adjunta y para cada granada visible estima:
- diameter_mm: diámetro aproximado en milímetros (granadas Wonderful maduras suelen medir entre 60 y 100mm).
- color_category: una de verde, rosado, rojo, rojo_oscuro según el color dominante de la cáscara.
- color_score: 0-100 según intensidad de rojo.
- defects: lista de defectos detectados entre sunburn (golpe de sol), cracking (rajado), russet (rugosidad), cada uno con severity (leve/media/grave) y confidence (0-1). Si no hay defectos visibles, lista vacía.
Si no se detectan granadas claramente, devuelve fruit_count_estimate: 0 y fruits: [].
Sé realista: una foto de campo normalmente muestra entre 1 y 8 granadas.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [signed_url],
      response_json_schema: schema
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}