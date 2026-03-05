import OpenAI from 'openai';

const ALLOWED_TONES = ['simple', 'professional', 'executive'];

// Context-aware editor prompts (Spanish)
const EDITOR_PROMPTS = {
  general: `Eres un editor experto en español. Corrige ortografía, tildes y puntuación. Mejora la redacción con cambios mínimos, mantén el significado y tono. Responde SOLO con el texto mejorado, sin comillas ni explicaciones.`,

  email: `Eres un editor experto en español especializado en comunicación profesional por email. 
Transforma el texto en un email profesional bien estructurado:
- Añade saludo apropiado (Estimado/a [Nombre]: o similar)
- Organiza el contenido en párrafos claros
- Añade cierre cortés (Quedo a su disposición, Saludos cordiales, etc.)
- Corrige ortografía, tildes y puntuación
- Mantén el significado original
Responde SOLO con el email mejorado, sin comillas ni explicaciones.`,

  slack: `Eres un editor experto en español para mensajes de Slack y chat profesional.
Reescribe el texto para que sea:
- Conciso y directo (sin rodeos)
- Ligeramente informal pero profesional
- Sin estructuras de email (sin saludos formales ni firmas)
- Corrige ortografía, tildes y puntuación
Responde SOLO con el mensaje mejorado, sin comillas ni explicaciones.`,

  formal: `Eres un editor experto en español especializado en documentos formales e institucionales.
Reescribe el texto usando:
- Registro formal y elevado
- Vocabulario preciso y sin coloquialismos
- Estructura clara con párrafos bien definidos
- Ortografía, tildes y puntuación correctas
Responde SOLO con el texto mejorado, sin comillas ni explicaciones.`,

  report: `Eres un editor experto en español especializado en reportes y documentos corporativos.
Reescribe el texto para que sea:
- Objetivo y factual
- Estructurado con claridad (párrafos temáticos)
- Tono neutro y profesional
- Ortografía, tildes y puntuación correctas
Responde SOLO con el texto mejorado, sin comillas ni explicaciones.`,
};

// Context-aware translator prompts (English) — translate the MEJORADO text
const TRANSLATOR_PROMPTS = {
  general: `You are a professional Spanish-to-English translator. Translate the text faithfully, preserving tone and meaning. Respond ONLY with the English translation, no quotes or explanations.`,

  email: `You are a professional Spanish-to-English translator specialized in business emails.
Translate the Spanish email maintaining:
- The email structure (greeting, body, closing)
- Professional business English tone
- Natural email phrasing (not literal translation)
Respond ONLY with the translated email, no quotes or explanations.`,

  slack: `You are a professional Spanish-to-English translator for Slack and professional chat.
Translate the message using:
- Concise, direct phrasing
- Slightly informal but professional tone
- Natural Slack-style English
Respond ONLY with the translated message, no quotes or explanations.`,

  formal: `You are a professional Spanish-to-English translator for formal documents.
Translate using:
- Formal, precise English
- Appropriate institutional vocabulary
- No colloquialisms
Respond ONLY with the translation, no quotes or explanations.`,

  report: `You are a professional Spanish-to-English translator for corporate reports.
Translate using:
- Objective, factual language
- Professional report-style English
- Clear, neutral tone
Respond ONLY with the translation, no quotes or explanations.`,
};

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
    return res.status(500).json({ error: 'Missing API key', hint: "Set OPENAI_API_KEY or 'mejora' env var" });
  }

  const client = new OpenAI({ apiKey });

  try {
    const { text, context, spanish_input: spanishInput, mode, tone_preferences: tonePreferences } = req.body || {};

    // ── Legacy /spanish_input flow ─────────────────────────────────────────
    if (typeof spanishInput === 'string' && spanishInput.trim()) {
      const normalizedMode = typeof mode === 'string' ? mode.trim() : '';
      if (normalizedMode !== '' && normalizedMode !== 'anti_latino') {
        return res.status(400).json({ error: "'mode' debe ser 'anti_latino' o cadena vacía." });
      }
      const requestedTones = normalizeTonePreferences(tonePreferences);

      const mejoraResponse = await client.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: EDITOR_PROMPTS.general },
          { role: 'user', content: spanishInput },
        ],
      });
      const improvedSpanish = (mejoraResponse.output_text || '').trim();
      if (!improvedSpanish) return res.status(502).json({ error: 'No se pudo mejorar el texto.' });

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
            content: 'You are a senior English communication strategist helping Spanish-speaking professionals sound natural in American business English. Return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              improved_spanish: improvedSpanish,
              context: typeof context === 'string' ? context : '',
              mode: normalizedMode,
              requested_tones: requestedTones,
              instructions: 'Generate outputs only for requested_tones. For each: text, naturalness_score (0-100), flags (array), why_natural (array).',
            }),
          },
        ],
      });

      const parsed = safeJsonParse((latinoResponse.output_text || '').trim());
      if (!parsed?.results) return res.status(502).json({ error: 'No se pudo generar la salida estructurada.' });

      const results = {};
      for (const tone of requestedTones) {
        const d = parsed.results[tone];
        if (!d) continue;
        results[tone] = {
          text: typeof d.text === 'string' ? d.text : '',
          naturalness_score: typeof d.naturalness_score === 'number' ? d.naturalness_score : 0,
          flags: Array.isArray(d.flags) ? d.flags.filter(i => typeof i === 'string') : [],
          why_natural: Array.isArray(d.why_natural) ? d.why_natural.filter(i => typeof i === 'string') : [],
        };
      }
      if (!Object.keys(results).length) return res.status(502).json({ error: 'Sin resultados de tonos.' });
      return res.status(200).json({ improved_spanish: improvedSpanish, results });
    }

    // ── Main flow ──────────────────────────────────────────────────────────
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Se requiere un texto válido.' });
    }

    const ctx = typeof context === 'string' ? context.trim() : 'general';
    const editorPrompt = EDITOR_PROMPTS[ctx] || EDITOR_PROMPTS.general;
    const translatorPrompt = TRANSLATOR_PROMPTS[ctx] || TRANSLATOR_PROMPTS.general;

    // Step 1: Improve Spanish first
    const mejoraResponse = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: editorPrompt },
        { role: 'user', content: text },
      ],
    });

    const mejorado = (mejoraResponse.output_text || '').trim();
    if (!mejorado) return res.status(502).json({ error: 'No se pudo mejorar el texto.' });

    // Step 2: Translate the MEJORADO text (not original)
    // This ensures translation inherits the correct context format (email structure, etc.)
    const translationResponse = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: translatorPrompt },
        { role: 'user', content: mejorado },
      ],
    });

    const english = (translationResponse.output_text || '').trim();
    if (!english) return res.status(502).json({ error: 'No se pudo traducir el texto.' });

    return res.status(200).json({ mejorado, english });

  } catch (error) {
    console.error('Error en /api/mejorar:', error);
    return res.status(500).json({ error: 'Error interno.', details: error.message });
  }
}
