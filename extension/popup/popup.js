const API_BASE = 'API_BASE_URL_PLACEHOLDER';

function getApiBase() {
  if (API_BASE && API_BASE !== 'API_BASE_URL_PLACEHOLDER') return API_BASE;
  return localStorage.getItem('fitright_api_base') || '';
}

function setApiBase(url) {
  localStorage.setItem('fitright_api_base', url);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  const onboarding = document.getElementById('onboarding');
  const saved = document.getElementById('saved');
  const msg = document.getElementById('msg');
  const msg2 = document.getElementById('msg2');
  const submitBtn = document.getElementById('submitBtn');
  const demoLink = document.getElementById('demoLink');

  const apiBaseInput = document.getElementById('apiBase');
  chrome.storage.local.get(['profileId', 'apiBase'], (data) => {
    if (data.profileId) {
      onboarding.style.display = 'none';
      saved.style.display = 'block';
    }
    if (data.apiBase) {
      setApiBase(data.apiBase);
      apiBaseInput.value = data.apiBase;
    }
  });
  apiBaseInput.addEventListener('change', () => setApiBase(apiBaseInput.value));
  apiBaseInput.addEventListener('blur', () => {
    const v = apiBaseInput.value.trim();
    if (v) chrome.storage.local.set({ apiBase: v });
  });

  demoLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('demo/product.html') });
  });
  const demoLink2 = document.getElementById('demoLink2');
  if (demoLink2) {
    demoLink2.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('demo/product2.html') });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const base = (apiBaseInput && apiBaseInput.value.trim()) || getApiBase();
    if (!base) {
      msg.textContent = 'Enter API base URL above (from backend deploy output).';
      msg.className = 'error';
      return;
    }
    chrome.storage.local.set({ apiBase: base });
    submitBtn.disabled = true;
    const measurements = {
      height: parseFloat(form.height.value),
      weight: parseFloat(form.weight.value),
      bust: parseFloat(form.bust.value),
      waist: parseFloat(form.waist.value),
      hips: parseFloat(form.hips.value),
    };
    const fitPreference = form.fitPreference.value;
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurements, fitPreference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg.textContent = data.error || res.statusText || 'Request failed';
        msg.className = 'error';
        submitBtn.disabled = false;
        return;
      }
      const profileId = data.profileId;
      chrome.storage.local.set({ profileId, apiBase: base }, () => {
        onboarding.style.display = 'none';
        saved.style.display = 'block';
        msg2.textContent = '';
      });
    } catch (err) {
      msg.textContent = err.message || 'Network error';
      msg.className = 'error';
    }
    submitBtn.disabled = false;
  });
});
