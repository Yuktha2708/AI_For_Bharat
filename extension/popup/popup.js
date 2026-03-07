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
  chrome.storage.local.get(['profileId', 'apiBase', 'skinProfileSaved'], (data) => {
    if (data.profileId) {
      onboarding.style.display = 'none';
      saved.style.display = 'block';
      if (data.skinProfileSaved) {
        const skinDone = document.getElementById('skinDone');
        const facePhoto = document.getElementById('facePhoto');
        const skinAnalyzeBtn = document.getElementById('skinAnalyzeBtn');
        const skinMsg = document.getElementById('skinMsg');
        if (skinDone) {
          skinDone.style.display = 'block';
          skinDone.textContent = 'Skin profile saved ✓ You can get shade recommendations on makeup pages.';
        }
        const facePhotoLabel = document.getElementById('facePhotoLabel');
        if (facePhotoLabel) facePhotoLabel.style.display = 'none';
        if (facePhoto) facePhoto.style.display = 'none';
        if (skinAnalyzeBtn) skinAnalyzeBtn.style.display = 'none';
        if (skinMsg) skinMsg.style.display = 'none';
      }
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
  const demoMakeupLink = document.getElementById('demoMakeupLink');
  if (demoMakeupLink) {
    demoMakeupLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('demo/makeup.html') });
    });
  }
  const demoLipstickLink = document.getElementById('demoLipstickLink');
  if (demoLipstickLink) {
    demoLipstickLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('demo/lipstick.html') });
    });
  }

  const facePhoto = document.getElementById('facePhoto');
  const skinAnalyzeBtn = document.getElementById('skinAnalyzeBtn');
  const skinMsg = document.getElementById('skinMsg');
  const skinDone = document.getElementById('skinDone');
  if (skinAnalyzeBtn && facePhoto) {
    skinAnalyzeBtn.addEventListener('click', async () => {
      const file = facePhoto.files[0];
      if (!file) {
        skinMsg.textContent = 'Choose a face photo first.';
        skinMsg.style.display = 'block';
        skinDone.style.display = 'none';
        return;
      }
      const base = (apiBaseInput && apiBaseInput.value.trim()) || getApiBase();
      if (!base) {
        skinMsg.textContent = 'Set API base URL first.';
        skinMsg.style.display = 'block';
        skinDone.style.display = 'none';
        return;
      }
      let profileId;
      try {
        const d = await new Promise((resolve) => chrome.storage.local.get(['profileId'], resolve));
        profileId = d.profileId;
      } catch (_) {}
      if (!profileId) {
        skinMsg.textContent = 'Create a profile first.';
        skinMsg.style.display = 'block';
        skinDone.style.display = 'none';
        return;
      }
      skinMsg.textContent = '';
      skinDone.style.display = 'none';
      skinAnalyzeBtn.disabled = true;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let b64 = reader.result;
          if (b64.indexOf('base64,') !== -1) b64 = b64.split('base64,')[1];
          const imageFormat = file.type === 'image/png' ? 'png' : 'jpeg';
          fetch(`${base.replace(/\/$/, '')}/skin-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, imageBase64: b64, imageFormat }),
          })
            .then((res) => res.json())
            .then((data) => {
              skinAnalyzeBtn.disabled = false;
              if (data.error) {
                skinMsg.textContent = data.error;
                skinMsg.style.display = 'block';
                return;
              }
              skinMsg.style.display = 'none';
              skinDone.style.display = 'block';
              skinDone.textContent = 'Skin profile saved. Get shade recommendations on makeup pages.';
              chrome.storage.local.set({ skinProfileSaved: true });
            })
            .catch((e) => {
              skinAnalyzeBtn.disabled = false;
              skinMsg.textContent = e.message || 'Request failed';
              skinMsg.style.display = 'block';
            });
        };
        reader.readAsDataURL(file);
      });
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
