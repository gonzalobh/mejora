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

  let selectedTones = toneCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  if (!selectedTones.length) {
    selectedTones = ['professional'];
  }

  const payload = {
    spanish_input: spanishText,
    mode: antiLatino.checked ? 'anti_latino' : '',
    tone_preferences: selectedTones,
    context: '',
  };

  setLoading(true);
  clearError();
  improvedSpanish.textContent = 'Optimizing…';
  resultsContainer.innerHTML = '';

  try {
    const response = await fetch('/api/mejorar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      showError('Server returned invalid JSON.');
      improvedSpanish.textContent = '';
      return;
    }

    if (!response.ok) {
      showError(data?.error || 'Internal server error.');
      improvedSpanish.textContent = '';
      return;
    }

    renderResponse(data);

  } catch (err) {
    showError('Network error. Please try again.');
    improvedSpanish.textContent = '';
  } finally {
    setLoading(false);
  }
});

function renderResponse(data) {
  if (!data || typeof data !== 'object') {
    showError('Unexpected response format.');
    return;
  }

  const improvedText =
    data.improved_spanish ||
    data.mejorado ||
    '';

  improvedSpanish.textContent = improvedText || 'No improved Spanish returned.';

  const toneResults = normalizeToneResults(data);

  if (!toneResults.length) {
    resultsContainer.textContent = 'No tone results returned.';
    return;
  }

  const fragment = document.createDocumentFragment();

  toneResults.forEach((result) => {
    if (!result.text) return;

    const card = document.createElement('article');
    card.className = 'result-card';

    const title = document.createElement('h3');
    title.textContent = capitalize(result.tone);

    const body = document.createElement('p');
    body.textContent = result.text;

    const score = document.createElement('p');
    score.className = 'result-meta';
    score.textContent = `Naturalness score: ${safeValue(result.naturalness_score)}`;

    const flags = document.createElement('p');
    flags.className = 'result-meta';
    flags.textContent = `Flags: ${formatArray(result.flags)}`;

    const why = document.createElement('p');
    why.className = 'result-meta';
    why.textContent = `Why natural: ${formatArray(result.why_natural)}`;

    card.append(title, body, score, flags, why);
    fragment.appendChild(card);
  });

  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(fragment);
}

function normalizeToneResults(data) {
  if (!data.results || typeof data.results !== 'object') {
    return [];
  }

  return Object.entries(data.results)
    .filter(([_, value]) => value && typeof value === 'object')
    .map(([tone, value]) => ({
      tone,
      text: value.text || '',
      naturalness_score: value.naturalness_score ?? 'N/A',
      flags: value.flags || [],
      why_natural: value.why_natural || []
    }));
}

function formatArray(arr) {
  if (!Array.isArray(arr) || !arr.length) {
    return 'none';
  }
  return arr.join(', ');
}

function safeValue(val) {
  if (val === undefined || val === null || val === '') {
    return 'N/A';
  }
  return String(val);
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setLoading(state) {
  optimizeBtn.disabled = state;
  optimizeBtn.textContent = state ? 'Optimizing…' : 'Optimize';
}

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
  }
}

function clearError() {
  if (errorMessage) {
    errorMessage.textContent = '';
  }
}
