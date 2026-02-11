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

  // Default tone if none selected
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

    const textResponse = await response.text();

    let data = null;
    try {
      data = JSON.parse(textResponse);
    } catch {
      showError('Server returned invalid JSON.');
      improvedSpanish.textContent = '';
      return;
    }

    if (!response.ok) {
      showError(data?.error || 'Unable to optimize this request.');
      improvedSpanish.textContent = '';
      return;
    }

    renderResponse(data);

  } catch (error) {
    showError('Network error. Please try again.');
    improvedSpanish.textContent = '';
  } finally {
    setLoading(false);
  }
});

function renderResponse(data) {
  const improvedText =
    data?.improved_spanish ||
    data?.mejorado ||
    data?.improvedSpanish ||
    '';

  improvedSpanish.textContent = improvedText || 'No improved Spanish returned.';

  const toneResults = extractToneResults(data);

  if (!toneResults.length) {
    resultsContainer.textContent = 'No tone results returned.';
    return;
  }

  const fragment = document.createDocumentFragment();

  toneResults.forEach((toneResult) => {
    if (!toneResult?.text) return;

    const card = document.createElement('article');
    card.className = 'result-card';

    const title = document.createElement('h3');
    title.textContent = capitalizeLabel(toneResult.tone || 'Tone');

    const text = document.createElement('p');
    text.textContent = toneResult.text;

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
  if (!data) return [];

  if (data.results && typeof data.results === 'object') {
    return Object.entries(data.results)
      .filter(([_, value]) => value && typeof value === 'object')
      .map(([tone, value]) => ({ tone, ...value }));
  }

  return [];
}

function formatFlags(flags) {
  if (!flags || !Array.isArray(flags)) {
    return 'none';
  }
  return flags.length ? flags.join(', ') : 'none';
}

function formatMetaValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'N/A';
  }
  return String(value);
}

function capitalizeLabel(label) {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function setLoading(isLoading) {
  optimizeBtn.disabled = isLoading;
  optimizeBtn.textContent = isLoading ? 'Optimizing…' : 'Optimize';
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
