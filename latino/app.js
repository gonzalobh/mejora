const spanishInput = document.getElementById('spanishInput');
const antiLatino = document.getElementById('antiLatino');
const toneSimple = document.getElementById('toneSimple');
const toneProfessional = document.getElementById('toneProfessional');
const toneExecutive = document.getElementById('toneExecutive');
const optimizeBtn = document.getElementById('optimizeBtn');
const improvedSpanish = document.getElementById('improvedSpanish');
const resultsContainer = document.getElementById('resultsContainer');
const errorMessage = document.getElementById('errorMessage');

const toneCheckboxes = [toneSimple, toneProfessional, toneExecutive];

optimizeBtn.addEventListener('click', async () => {
  const spanishText = spanishInput.value.trim();

  if (!spanishText) {
    showError('Please add Spanish input before optimizing.');
    return;
  }

  const selectedTones = toneCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  const payload = {
    spanish_input: spanishText,
    mode: antiLatino.checked ? 'anti_latino' : '',
    tone_preferences: selectedTones,
    context: '',
  };

  setLoading(true);
  clearError();
  improvedSpanish.textContent = 'Optimizing…';
  resultsContainer.textContent = '';

  try {
    const response = await fetch('/api/mejorar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const { data, isJson } = await parseApiResponse(response);

    if (!response.ok) {
      const safeMessage =
        (isJson && data && data.error) || 'Unable to optimize this request right now.';
      showError(safeMessage);
      improvedSpanish.textContent = '';
      return;
    }

    if (!isJson || !data) {
      showError('Invalid server response format.');
      improvedSpanish.textContent = '';
      return;
    }

    renderResponse(data);
  } catch (error) {
    showError(error.message || 'Unable to complete the optimization request.');
    improvedSpanish.textContent = '';
  } finally {
    setLoading(false);
  }
});

function renderResponse(data) {
  const improvedText =
    data.improved_spanish || data.mejorado || data.improvedSpanish || 'No improved Spanish returned.';

  improvedSpanish.textContent = improvedText;

  const toneResults = extractToneResults(data);

  if (!toneResults.length) {
    resultsContainer.textContent = 'No tone results returned.';
    return;
  }

  const fragment = document.createDocumentFragment();

  toneResults.forEach((toneResult) => {
    const card = document.createElement('article');
    card.className = 'result-card';

    const title = document.createElement('h3');
    title.textContent = capitalizeLabel(toneResult.tone || 'Tone');

    const text = document.createElement('p');
    text.textContent = toneResult.text || 'No text provided.';

    const score = document.createElement('p');
    score.className = 'result-meta';
    score.textContent = `Naturalness score: ${formatMetaValue(toneResult.naturalness_score)}`;

    const flags = document.createElement('p');
    flags.className = 'result-meta';
    flags.textContent = `Flags: ${formatFlags(toneResult.flags)}`;

    const whyNatural = document.createElement('p');
    whyNatural.className = 'result-meta';
    whyNatural.textContent = `Why natural: ${formatMetaValue(toneResult.why_natural)}`;

    card.append(title, text, score, flags, whyNatural);
    fragment.appendChild(card);
  });

  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(fragment);
}

function extractToneResults(data) {
  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (data.results && typeof data.results === 'object') {
    return Object.entries(data.results).map(([tone, value]) => ({ tone, ...value }));
  }

  const knownTones = ['simple', 'professional', 'executive'];
  const fallback = knownTones
    .filter((tone) => data[tone] && typeof data[tone] === 'object')
    .map((tone) => ({ tone, ...data[tone] }));

  return fallback;
}

function formatFlags(flags) {
  if (!flags) {
    return 'none';
  }

  if (Array.isArray(flags)) {
    return flags.length ? flags.join(', ') : 'none';
  }

  return String(flags);
}

function formatMetaValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'N/A';
  }

  return String(value);
}

function capitalizeLabel(label) {
  if (!label) {
    return '';
  }

  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function parseApiResponse(response) {
  try {
    const data = await response.json();
    return { data, isJson: true };
  } catch {
    return { data: null, isJson: false };
  }
}

function setLoading(isLoading) {
  optimizeBtn.disabled = isLoading;
  optimizeBtn.textContent = isLoading ? 'Optimizing…' : 'Optimize';
}

function showError(message) {
  errorMessage.textContent = message;
}

function clearError() {
  errorMessage.textContent = '';
}
