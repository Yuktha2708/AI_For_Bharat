(function () {
  if (!document.body) return;

  const API_BASE = 'API_BASE_URL_PLACEHOLDER';
  const REAL_PRODUCT_HOSTS = ['myntra.com', 'nykaa.com', 'nykaafashion.com', 'ajio.com', 'amazon.in', 'flipkart.com', 'meesho.com', 'purplle.com'];

  function getApiBase(cb) {
    if (API_BASE && API_BASE !== 'API_BASE_URL_PLACEHOLDER') {
      cb(API_BASE);
      return;
    }
    chrome.storage.local.get(['apiBase'], (d) => cb(d.apiBase || ''));
  }

  function isProductDetailPage(host, pathname) {
    if (host === 'amazon.in' || host.endsWith('.amazon.in')) return /\/dp\/[A-Z0-9]{10}/.test(pathname) || /\/gp\/product\//.test(pathname);
    if (host === 'myntra.com' || host === 'www.myntra.com') return /\/p\//.test(pathname);
    if (host === 'nykaa.com' || host === 'www.nykaa.com' || host === 'purplle.com') return /\/p\//.test(pathname) || /\/product\//.test(pathname);
    if (host === 'flipkart.com' || host.endsWith('.flipkart.com')) return /\/p\//.test(pathname) || /\/dl\//.test(pathname);
    if (host === 'ajio.com' || host.endsWith('.ajio.com')) return /\/p\//.test(pathname) || /\/product\//.test(pathname);
    if (host === 'meesho.com' || host.endsWith('.meesho.com')) return /\/product\//.test(pathname);
    return /\/(p|product|prd|pd)\//i.test(pathname) || /\/dp\//.test(pathname);
  }

  function isValidShadeName(s) {
    if (!s || typeof s !== 'string') return false;
    var t = s.trim();
    if (t.length > 40 || t.length < 1) return false;
    if (/\{|\}|!important|#([0-9a-fA-F]{3,8})|px\b|₹|\d+\s*percent|savings|\.centralized|margin-|font-weight|!important/i.test(t)) return false;
    if (/^\d+$/.test(t)) return false;
    return true;
  }

  function getProductContextFromRealPage() {
    const host = window.location.hostname.replace(/^www\./, '');
    if (!REAL_PRODUCT_HOSTS.some(function (h) { return host === h || host.endsWith('.' + h); })) return null;
    const pathname = window.location.pathname || '';
    if (!isProductDetailPage(host, pathname)) return null;
    const titleEl = document.querySelector('h1, [data-product-name], .product-title, #productTitle, .pdp-title, .pdp-name');
    const title = titleEl ? titleEl.textContent.trim().slice(0, 200) : '';
    const pageText = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 3000) : '';
    const isMakeupPage = /\b(highlighter|blush|eyeshadow|eyeliner|mascara|lip(stick| crayon| gloss| balm)?|foundation|concealer|makeup|compact|primer)\b|shade|colour|color\s*:/i.test(title + ' ' + pageText);
    const isApparelPage = /\b(kurta|kurti|saree|sari|dress|shirt|pants|palazzo|ethnic\s*wear|clothing|dupatta|suit|lehenga|lehenga|blouse|top|jeans|trouser|jacket|coat|jumper)\b/i.test(title + ' ' + pageText.slice(0, 1500));
    const onAmazon = host === 'amazon.in' || host.endsWith('.amazon.in');
    let brand = 'Unknown';
    const brandEl = document.querySelector('[data-brand], .pdp-brand, .product-brand, #bylineInfo, .pdp-product-brand');
    if (brandEl) brand = brandEl.textContent.trim().slice(0, 100);
    let sizeChart = '';
    if (!isMakeupPage) {
      const table = document.querySelector('table');
      if (table && /size|inch|cm|waist|chest/i.test(table.textContent)) sizeChart = table.innerText.trim().slice(0, 3000);
      const sizeSelect = document.querySelector('select[id*="size"], select[name*="size"], select[id*="Size"], #native_dropdown_selected_size_name');
      if (!sizeChart && sizeSelect && sizeSelect.options) {
        var opts = Array.from(sizeSelect.options).map(function (o) { return o.text.trim(); }).filter(Boolean);
        var looksLikeApparel = opts.some(function (t) { return /^(XS|S|M|L|XL|XXL|\d{2,3}\s*cm)$/i.test(t); });
        var looksLikeVolumeOrQty = opts.some(function (t) { return /\d+\s*(ml|g|oz|gram)/i.test(t) || /^\d+$/.test(t); });
        if (looksLikeApparel && !looksLikeVolumeOrQty) sizeChart = opts.join('\n');
      }
      if (!sizeChart && (host === 'myntra.com' || host === 'www.myntra.com')) {
        var sizeButtons = document.querySelectorAll('.size-buttons-container button, .size-variant-container button, [class*="sizeChart"] button, .pdp-size-button, ul[class*="size"] li, [class*="SizeChart"] span');
        if (sizeButtons.length) sizeChart = Array.from(sizeButtons).map(function (b) { return b.textContent.trim(); }).filter(Boolean).join('\n');
      }
      if (!sizeChart && (host === 'amazon.in' || host.endsWith('.amazon.in'))) {
        var amzSizeSelect = document.querySelector('#native_dropdown_selected_size_name, #dropdown_selected_size_name, [data-cel-widget*="size"] select, .po-size select');
        if (amzSizeSelect && amzSizeSelect.options) {
          var amzOpts = Array.from(amzSizeSelect.options).map(function (o) { return o.text.trim(); }).filter(Boolean);
          var amzApparel = amzOpts.some(function (t) { return /^(XS|S|M|L|XL|XXL|\d{2,3}\s*cm|\d+)$/i.test(t) && !/\d+\s*(ml|g|oz)/i.test(t); });
          if (amzApparel && amzOpts.length) sizeChart = amzOpts.join('\n');
        }
        if (!sizeChart) {
          var amzSizeBtns = document.querySelectorAll('.po-size .a-button-inner, [data-cel-widget*="size"] .a-button-inner, #variation_size_name .selection');
          if (amzSizeBtns.length) {
            var btnTexts = Array.from(amzSizeBtns).map(function (b) { return b.textContent.trim(); }).filter(Boolean);
            if (btnTexts.some(function (t) { return /^(XS|S|M|L|XL|XXL)$/i.test(t); })) sizeChart = btnTexts.join('\n');
          }
        }
      }
    }
    let reviews = [];
    if (!isMakeupPage) {
      const reviewEls = document.querySelectorAll('[data-hook="review-body"], .review-text, .review-content, [class*="review"] p, .cr-original-review-content, .index-review-desc, [class*="Review"]');
      if (reviewEls.length) reviews = Array.from(reviewEls).slice(0, 25).map(function (el) { return el.textContent.trim().slice(0, 300); }).filter(Boolean);
    }
    var shades = [];
    if (onAmazon) {
      if (isMakeupPage) {
        var amzColorSelect = document.querySelector('#native_dropdown_selected_color_name, #variation_color_name select');
        if (amzColorSelect && amzColorSelect.options) {
          shades = Array.from(amzColorSelect.options).map(function (o) { return o.text.trim(); }).filter(Boolean);
        }
        if (!shades.length) {
          var amzColorBtns = document.querySelectorAll('#variation_color_name .selection, #variation_color_name .a-button-inner');
          if (amzColorBtns.length) shades = Array.from(amzColorBtns).map(function (b) { return b.textContent.trim(); }).filter(Boolean);
        }
      }
    } else {
      const shadeEls = document.querySelectorAll('[data-shade], [data-color-name], .swatch, .shade-name, [class*="swatch"], [class*="colour"] img, [class*="color"] img, .pdp-color-container span, [class*="ColorVariant"]');
      if (shadeEls.length) {
        shades = Array.from(shadeEls).slice(0, 50).map(function (el) {
          if (el.dataset && (el.dataset.shade || el.dataset.colorName)) return el.dataset.shade || el.dataset.colorName;
          if (el.getAttribute('alt')) return el.getAttribute('alt').trim();
          if (el.getAttribute('title')) return el.getAttribute('title').trim();
          return el.textContent.trim();
        }).filter(Boolean);
      }
      const shadeSelect = document.querySelector('select[id*="shade"], select[name*="shade"], select[id*="color"], select[name*="color"]');
      if (!shades.length && shadeSelect && shadeSelect.options) shades = Array.from(shadeSelect.options).map(function (o) { return o.text.trim(); }).filter(Boolean).slice(0, 50);
      if (isMakeupPage && !shades.length && (host === 'myntra.com' || host === 'www.myntra.com')) {
        var colourItems = document.querySelectorAll('img[alt*="shade"], img[alt*="color"], [class*="colour"] [class*="circle"], .pdp-color-palette span');
        if (colourItems.length) shades = Array.from(colourItems).map(function (el) { return (el.getAttribute && (el.getAttribute('alt') || el.getAttribute('title'))) || el.textContent.trim(); }).filter(Boolean).slice(0, 50);
      }
    }
    shades = shades.filter(function (s) { return isValidShadeName(s); }).slice(0, 50);
    var hasData = sizeChart || shades.length || reviews.length;
    var isProductPath = /\/(p|product|prd|pd)\//i.test(pathname) || /\/product\b/i.test(pathname);
    if (!hasData && isProductPath && (title || brand !== 'Unknown' || isMakeupPage || isApparelPage)) hasData = true;
    if (!hasData) return null;
    var category = isApparelPage ? 'apparel' : ((isMakeupPage || shades.length) ? 'makeup' : 'apparel');
    var productType = category === 'makeup' ? (/\blip\b/i.test(title) ? 'lipstick' : 'makeup') : 'apparel';
    var sendShades = category === 'makeup' && shades.length ? shades : undefined;
    return {
      brand: brand || 'Unknown',
      category: category,
      sizeChart: sizeChart || undefined,
      listedColor: 'See product',
      reviews: reviews,
      shades: sendShades,
      productType: productType,
    };
  }

  function getProductContext() {
    const root = document.querySelector('[data-fitright-demo]');
    if (root) {
      const brand = root.dataset.fitrightBrand || document.querySelector('[data-fitright-brand]')?.textContent?.trim() || 'Unknown';
    const category = root.dataset.fitrightCategory || document.querySelector('[data-fitright-category]')?.textContent?.trim() || 'apparel';
    const sizeChartEl = document.querySelector('[data-fitright-size-chart]');
    const sizeChart = sizeChartEl ? sizeChartEl.textContent.trim() : (root.dataset.fitrightSizeChart || '');
    const listedColor = root.dataset.fitrightColor || document.querySelector('[data-fitright-color]')?.textContent?.trim() || 'See product';
    const reviewEls = document.querySelectorAll('[data-fitright-review]');
    const reviews = Array.from(reviewEls).map((el) => el.textContent.trim()).filter(Boolean);
    let shades = [];
    const shadeEls = document.querySelectorAll('[data-fitright-shade]');
    if (shadeEls.length) {
      shades = Array.from(shadeEls).map((el) => (el.dataset.fitrightShade != null ? el.dataset.fitrightShade : el.textContent.trim())).filter(Boolean);
    } else if (root.dataset.fitrightShades) {
      try {
        shades = JSON.parse(root.dataset.fitrightShades);
        if (!Array.isArray(shades)) shades = [];
      } catch (_) {}
    }
    const productType = root.dataset.fitrightProductType || (shades.length ? 'makeup' : 'apparel');
    return { brand, category, sizeChart, listedColor, reviews, shades, productType };
    }
    return getProductContextFromRealPage();
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
        const url = base.replace(/\/$/, '') + '/recommendations';
        const body = {
          profileId,
          productContext: {
            brand: ctx.brand,
            category: ctx.category,
            sizeChart: ctx.sizeChart,
            listedColor: ctx.listedColor,
            productType: ctx.productType,
          },
          reviews: ctx.reviews,
        };
        if (ctx.shades && ctx.shades.length) body.productContext.shades = ctx.shades;
        chrome.runtime.sendMessage({ type: 'fetchRecommendations', url, body }, (response) => {
          btn.disabled = false;
          if (chrome.runtime.lastError) {
            errEl.textContent = chrome.runtime.lastError.message || 'Request failed';
            return;
          }
          if (!response || !response.ok) {
            errEl.textContent = (response && response.error) || 'Request failed';
            return;
          }
          const data = response.data || {};
          if (response.status >= 400 || data.error) {
            errEl.textContent = data.error || data.message || 'Request failed (check API and Bedrock access).';
            return;
          }
          if (!data.recommended_size && !data.recommended_shade) {
            errEl.textContent = data.message || 'No recommendation returned. Add a face photo in the extension for shade recommendations.';
            return;
          }
          resultEl.style.display = 'block';
          var parts = [];
          if (data.recommended_size) {
            parts.push('<div class="size">Size: ' + (data.recommended_size || '—') + (data.alternate_size ? ' <span class="confidence">(alt: ' + data.alternate_size + ')</span>' : '') + ' <span class="confidence">' + (data.confidence || '') + '</span></div>');
            if (data.reasons && data.reasons.length) parts.push('<ul><li>' + data.reasons.join('</li><li>') + '</li></ul>');
            if (data.caution) parts.push('<div class="caution">' + data.caution + '</div>');
          }
          if (data.recommended_shade) {
            parts.push('<div class="size" style="margin-top:10px">Shade: ' + data.recommended_shade + (data.shade_alternates && data.shade_alternates.length ? ' <span class="confidence">(alts: ' + data.shade_alternates.join(', ') + ')</span>' : '') + '</div>');
            if (data.shade_reasons && data.shade_reasons.length) parts.push('<ul><li>' + data.shade_reasons.join('</li><li>') + '</li></ul>');
            if (data.shade_caution) parts.push('<div class="caution">' + data.shade_caution + '</div>');
          }
          if (data.color && !data.recommended_shade) parts.push('<div class="color">' + (data.color.notes && data.color.notes[0] ? data.color.notes[0] : '') + ' ' + (data.color.disclaimer || '') + '</div>');
          resultEl.innerHTML = parts.join('');
          feedbackEl.style.display = 'block';
          feedbackEl.innerHTML = '<span>Was this helpful?</span> <button type="button" data-rating="1">Yes</button> <button type="button" data-rating="0">No</button> <span class="thanks" id="fitright-thanks" style="display:none">Thanks!</span>';
          feedbackEl.querySelectorAll('button[data-rating]').forEach((b) => {
            b.addEventListener('click', () => {
              const rating = b.dataset.rating;
              chrome.runtime.sendMessage({
                type: 'fetchFeedback',
                url: base.replace(/\/$/, '') + '/feedback',
                body: { profileId, rating: parseInt(rating, 10), productContext: ctx },
              }, () => {
                document.getElementById('fitright-thanks').style.display = 'inline';
                feedbackEl.querySelectorAll('button[data-rating]').forEach((x) => x.disabled = true);
              });
            });
          });
        });
      });
    });
  }

  function maybeInject() {
    if (!getProductContext()) return;
    injectPanel();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInject);
  } else {
    maybeInject();
  }
})();
