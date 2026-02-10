const inputText = document.getElementById('inputText');
const mejoradoText = document.getElementById('mejoradoText');
const englishText = document.getElementById('englishText');
const mejorarBtn = document.getElementById('mejorarBtn');
const limpiarBtn = document.getElementById('limpiarBtn');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const copyButtons = document.querySelectorAll('[data-copy]');

const STORAGE_KEY = 'mejora:last-input';

inputText.value = localStorage.getItem(STORAGE_KEY) || '';

inputText.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEY, inputText.value);
});

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy');
    const target = document.getElementById(targetId);

    if (!target || !target.value.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(target.value);
      const prevText = button.textContent;
      button.textContent = 'Copiado';
      setTimeout(() => {
        button.textContent = prevText;
      }, 1200);
    } catch {
      showError('No se pudo copiar al portapapeles.');
    }
  });
});

limpiarBtn.addEventListener('click', () => {
  inputText.value = '';
  mejoradoText.value = '';
  englishText.value = '';
  localStorage.removeItem(STORAGE_KEY);
  clearError();
  setStatus('');
});

mejorarBtn.addEventListener('click', async () => {
  const text = inputText.value.trim();

  if (!text) {
    showError('Por favor, escribe un texto en la columna de entrada.');
    return;
  }

  clearError();
  setLoading(true);

  try {
    const response = await fetch('/api/mejorar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const { data, isJson } = await parseApiResponse(response);

    if (!response.ok) {
      const safeMessage =
        (isJson && data && data.error) ||
        'No se pudo procesar la solicitud. Inténtalo de nuevo.';
      showError(safeMessage);
      return;
    }

    if (!isJson || !data) {
      showError('La respuesta del servidor no tiene un formato válido.');
      return;
    }

    mejoradoText.value = data.mejorado || '';
    englishText.value = data.english || '';
  } catch (error) {
    showError(error.message || 'No se pudo completar la solicitud.');
  } finally {
    setLoading(false);
  }
});

async function parseApiResponse(response) {
  try {
    const data = await response.json();
    return { data, isJson: true };
  } catch {
    return { data: null, isJson: false };
  }
}

function setLoading(isLoading) {
  mejorarBtn.disabled = isLoading;
  setStatus(isLoading ? 'Procesando...' : '');
}

function showError(message) {
  errorEl.textContent = message;
}

function clearError() {
  errorEl.textContent = '';
}

function setStatus(message) {
  statusEl.textContent = message;
}
