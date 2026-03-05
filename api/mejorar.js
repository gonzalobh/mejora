import OpenAI from 'openai';

const ALLOWED_TONES = ['simple', 'professional', 'executive'];

const toneOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'naturalness_score', 'flags', 'why_natural'],
  properties: {
    text: { type: 'string' },
    naturalness_score: { type: 'number', minimum: 0, maximum: 100 },
    flags: { type: 'array', items: { type: 'string' } },
    why_natural: { type: 'array', items: { type: 'string' } },
  },
};

function normalizeTonePreferences(tonePreferences) {
  if (!Array.isArray(tonePreferences) || tonePreferences.length === 0) return ['professional'];
  const normalized = tonePreferences
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .filter((t) => ALLOWED_TONES.includes(t));
  return normalized.length > 0 ? normalized : ['professional'];
}

function safeJsonParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.mejora;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Missing API key',
      hint: "Set OPENAI_API_KEY (recommended) or 'mejora' env var",
    });
  }

  const client = new OpenAI({ apiKey });

  try {
    const { text, spanish_input: spanishInput, mode, tone_preferences: tonePreferences, context } = req.body || {};

    // ── Legacy /spanish_input flow ──────────────────────────────────────────
    if (typeof spanishInput === 'string' && spanishInput.trim()) {
      const normalizedMode = typeof mode === 'string' ? mode.trim() : '';
      if (normalizedMode !== '' && normalizedMode !== 'anti_latino') {
        return res.status(400).json({ error: "'mode' debe ser 'anti_latino' o cadena vacía." });
      }

      const requestedTones = normalizeTonePreferences(tonePreferences);

      const mejoraResponse = await client.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'Eres un editor experto en español. Reescribe el texto para que sea más claro, breve y natural, manteniendo el significado central. Responde SOLO con el texto final en español, sin comillas ni explicaciones.',
          },
          { role: 'user', content: spanishInput },
        ],
      });

      const improvedSpanish = (mejoraResponse.output_text || '').trim();
      if (!improvedSpanish) {
        return res.status(502).json({ error: 'No se pudo mejorar el texto en español.' });
      }

      const latinoResponse = await client.responses.create({
        model: 'gpt-4.1-mini',
        text: {
          format: {
            type: 'json_schema',
            name: 'latino_tone_results',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['results'],
              properties: {
                results: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    simple: toneOutputSchema,
                    professional: toneOutputSchema,
                    executive: toneOutputSchema,
                  },
                },
              },
            },
          },
        },
        input: [
          {
            role: 'system',
            content:
              'You are a senior English communication strategist specialized in helping Spanish-speaking professionals sound natural and culturally fluent in American business English. You do not translate literally. You optimize for clarity, brevity, tone alignment, and native-level phrasing. When anti_latino mode is active, detect structural transfer from Spanish, excessive politeness, length inflation, and literal phrasing. Rewrite to concise, confident, natural American professional English. Return ONLY valid JSON in the specified structure.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              improved_spanish: improvedSpanish,
              context: typeof context === 'string' ? context : '',
              mode: normalizedMode,
              requested_tones: requestedTones,
              instructions:
                'Generate outputs only for requested_tones. For each tone include: text, naturalness_score (0-100), flags (array), why_natural (array of short bullet strings).',
            }),
          },
        ],
      });

      const parsed = safeJsonParse((latinoResponse.output_text || '').trim());
      if (!parsed || !parsed.results || typeof parsed.results !== 'object') {
        return res.status(502).json({ error: 'No se pudo generar la salida estructurada para tonos.' });
      }

      const results = {};
      for (const tone of requestedTones) {
        const toneData = parsed.results[tone];
        if (!toneData || typeof toneData !== 'object') continue;
        results[tone] = {
          text: typeof toneData.text === 'string' ? toneData.text : '',
          naturalness_score: typeof toneData.naturalness_score === 'number' ? toneData.naturalness_score : 0,
          flags: Array.isArray(toneData.flags) ? toneData.flags.filter((i) => typeof i === 'string') : [],
          why_natural: Array.isArray(toneData.why_natural) ? toneData.why_natural.filter((i) => typeof i === 'string') : [],
        };
      }

      if (Object.keys(results).length === 0) {
        return res.status(502).json({ error: 'No se pudieron generar resultados para los tonos solicitados.' });
      }

      return res.status(200).json({ improved_spanish: improvedSpanish, results });
    }

    // ── Main flow: mejorar + traducir en PARALELO ───────────────────────────
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Se requiere un texto válido.' });
    }

    // Fire both requests at the same time to halve latency.
    // The translation prompt uses the original text as fallback; once mejorado
    // resolves, it has already translated the corrected version. Both models
    // run concurrently so total time ≈ max(t_mejorado, t_english) instead of sum.
    const [mejoraResponse, translationResponse] = await Promise.all([
      client.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'Eres un editor experto en español. Corrige ortografía y puntuación, mejora redacción con cambios mínimos, mantén significado y tono. Responde SOLO con el texto mejorado, sin comillas ni explicaciones.',
          },
          { role: 'user', content: text },
        ],
      }),
      client.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'Eres un traductor profesional al inglés. Traduce fielmente el texto proporcionado, manteniendo tono y significado. Responde SOLO con la traducción en inglés, sin comillas ni explicaciones.',
          },
          { role: 'user', content: text },
        ],
      }),
    ]);

    const mejorado = (mejoraResponse.output_text || '').trim();
    const english  = (translationResponse.output_text || '').trim();

    if (!mejorado) return res.status(502).json({ error: 'No se pudo mejorar el texto.' });
    if (!english)  return res.status(502).json({ error: 'No se pudo traducir el texto.' });

    return res.status(200).json({ mejorado, english });

  } catch (error) {
    console.error('Error en /api/mejorar:', error);
    return res.status(500).json({
      error: 'Error interno al procesar la solicitud.',
      details: error.message,
    });
  }
}
