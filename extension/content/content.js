(function () {
  if (!document.body || !document.querySelector('[data-fitright-demo]')) return;

  const API_BASE = 'API_BASE_URL_PLACEHOLDER';
  function getApiBase(cb) {
    if (API_BASE && API_BASE !== 'API_BASE_URL_PLACEHOLDER') {
      cb(API_BASE);
      return;
    }
    chrome.storage.local.get(['apiBase'], (d) => cb(d.apiBase || ''));
  }

  function getProductContext() {
    const root = document.querySelector('[data-fitright-demo]');
    if (!root) return null;
    const brand = root.dataset.fitrightBrand || document.querySelector('[data-fitright-brand]')?.textContent?.trim() || 'Unknown';
    const category = root.dataset.fitrightCategory || document.querySelector('[data-fitright-category]')?.textContent?.trim() || 'apparel';
    const sizeChartEl = document.querySelector('[data-fitright-size-chart]');
    const sizeChart = sizeChartEl ? sizeChartEl.textContent.trim() : (root.dataset.fitrightSizeChart || '');
    const listedColor = root.dataset.fitrightColor || document.querySelector('[data-fitright-color]')?.textContent?.trim() || 'See product';
    const reviewEls = document.querySelectorAll('[data-fitright-review]');
    const reviews = Array.from(reviewEls).map((el) => el.textContent.trim()).filter(Boolean);
    return { brand, category, sizeChart, listedColor, reviews };
  }

  function injectPanel() {
    if (document.getElementById('fitright-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'fitright-panel';
    panel.className = 'fitright-panel';
    panel.innerHTML = [
      '<h3>FitRight AI</h3>',
      '<button class="get-rec" type="button">Get recommendation</button>',
      '<div id="fitright-error" class="fitright-error"></div>',
      '<div id="fitright-result" class="fitright-result" style="display:none"></div>',
      '<div id="fitright-feedback" class="fitright-feedback" style="display:none"></div>',
    ].join('');
    const insert = document.querySelector('[data-fitright-demo]') || document.querySelector('main') || document.body;
    insert.insertAdjacentElement('afterbegin', panel);

    panel.querySelector('.get-rec').addEventListener('click', async () => {
      const btn = panel.querySelector('.get-rec');
      const errEl = document.getElementById('fitright-error');
      const resultEl = document.getElementById('fitright-result');
      const feedbackEl = document.getElementById('fitright-feedback');
      errEl.textContent = '';
      resultEl.style.display = 'none';
      feedbackEl.style.display = 'none';
      let profileId;
      try {
        profileId = await new Promise((resolve) => {
          chrome.storage.local.get(['profileId'], (d) => resolve(d.profileId));
        });
      } catch (_) {}
      if (!profileId) {
        errEl.textContent = 'Create a profile in the FitRight extension first.';
        return;
      }
      getApiBase((base) => {
        if (!base) {
          errEl.textContent = 'Set API URL in extension (e.g. in popup or storage).';
          return;
        }
        const ctx = getProductContext();
        if (!ctx) {
          errEl.textContent = 'Could not read product data from this page.';
          return;
        }
        btn.disabled = true;
        fetch(base.replace(/\/$/, '') + '/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId,
            productContext: {
              brand: ctx.brand,
              category: ctx.category,
              sizeChart: ctx.sizeChart,
              listedColor: ctx.listedColor,
            },
            reviews: ctx.reviews,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            btn.disabled = false;
            if (data.error) {
              errEl.textContent = data.error;
              return;
            }
            resultEl.style.display = 'block';
            resultEl.innerHTML = [
              '<div class="size">Recommended: ' + (data.recommended_size || '—') + (data.alternate_size ? ' <span class="confidence">(alt: ' + data.alternate_size + ')</span>' : '') + ' <span class="confidence">' + (data.confidence || '') + '</span></div>',
              data.reasons && data.reasons.length ? '<ul><li>' + data.reasons.join('</li><li>') + '</li></ul>' : '',
              data.caution ? '<div class="caution">' + data.caution + '</div>' : '',
              data.color ? '<div class="color">' + (data.color.notes && data.color.notes[0] ? data.color.notes[0] : '') + ' ' + (data.color.disclaimer || '') + '</div>' : '',
            ].join('');
            feedbackEl.style.display = 'block';
            feedbackEl.innerHTML = '<span>Was this helpful?</span> <button type="button" data-rating="1">Yes</button> <button type="button" data-rating="0">No</button> <span class="thanks" id="fitright-thanks" style="display:none">Thanks!</span>';
            feedbackEl.querySelectorAll('button[data-rating]').forEach((b) => {
              b.addEventListener('click', () => {
                const rating = b.dataset.rating;
                fetch(base.replace(/\/$/, '') + '/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    profileId,
                    rating: parseInt(rating, 10),
                    productContext: ctx,
                  }),
                }).then(() => {
                  document.getElementById('fitright-thanks').style.display = 'inline';
                  feedbackEl.querySelectorAll('button[data-rating]').forEach((x) => x.disabled = true);
                });
              });
            });
          })
          .catch((e) => {
            btn.disabled = false;
            errEl.textContent = e.message || 'Request failed';
          });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }
})();
