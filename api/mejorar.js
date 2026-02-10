import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY.' });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Se requiere un texto válido.' });
    }

    const mejoraResponse = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'Eres un editor experto en español. Corrige ortografía y puntuación, mejora redacción con cambios mínimos, mantén significado y tono. Responde SOLO con el texto mejorado, sin comillas ni explicaciones.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const mejorado = (mejoraResponse.output_text || '').trim();

    if (!mejorado) {
      return res.status(502).json({ error: 'No se pudo mejorar el texto.' });
    }

    const translationResponse = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'Eres un traductor profesional al inglés. Traduce fielmente el texto proporcionado, manteniendo tono y significado. Responde SOLO con la traducción en inglés, sin comillas ni explicaciones.',
        },
        {
          role: 'user',
          content: mejorado,
        },
      ],
    });

    const english = (translationResponse.output_text || '').trim();

    if (!english) {
      return res.status(502).json({ error: 'No se pudo traducir el texto.' });
    }

    return res.status(200).json({ mejorado, english });
  } catch (error) {
    console.error('Error en /api/mejorar:', error);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud.' });
  }
}
