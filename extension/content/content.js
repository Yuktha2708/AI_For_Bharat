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
    if (/^\d+$/.test(t)) return t.length >= 1 && t.length <= 5;
    return true;
  }

  function getProductContextFromRealPage() {
    const host = window.location.hostname.replace(/^www\./, '');
    if (!REAL_PRODUCT_HOSTS.some(function (h) { return host === h || host.endsWith('.' + h); })) return null;
    const pathname = window.location.pathname || '';
    if (!isProductDetailPage(host, pathname)) return null;
    var titleEl = document.querySelector('h1, [data-product-name], .product-title, #productTitle, .pdp-title, .pdp-name');
    if (!titleEl && (host === 'amazon.in' || host.endsWith('.amazon.in'))) titleEl = document.querySelector('#title, .product-title-word-break, [data-cel-widget*="title"] #productTitle, [data-cel-widget*="title"]');
    const title = titleEl ? titleEl.textContent.trim().slice(0, 200) : '';
    const pageText = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 3000) : '';
    const docTitle = (typeof document.title === 'string') ? document.title : '';
    var amazonProductText = '';
    if (host === 'amazon.in' || host.endsWith('.amazon.in')) {
      var main = document.querySelector('#ppd, #centerCol, #dp-container, #dp');
      if (main) amazonProductText = (main.innerText || main.textContent || '').slice(0, 4000);
    }
    const textForType = title + ' ' + pageText.slice(0, 2000) + ' ' + docTitle + ' ' + pathname + ' ' + amazonProductText;
    const isMakeupPage = /\b(highlighter|blush|eyeshadow|eyeliner|mascara|lip(stick| crayon| gloss| balm)?|liquid\s*lipstick|foundation|concealer|makeup|compact|primer|bb\s*cream|cc\s*cream|face\s*powder)\b/i.test(textForType);
    const onAmazon = host === 'amazon.in' || host.endsWith('.amazon.in');
    const isMakeupFromUrl = onAmazon && /lipstick|foundation|concealer|highlighter|mascara|blush|eyeshadow|eyeliner|makeup|lip-stick|lipstick|primer|compact|bb-cream|cc-cream|face-powder|liquid-foundation|matte-foundation|cream-foundation/i.test(pathname);
    var titleAndPath = title + ' ' + pathname;
    const isApparelPage = !isMakeupFromUrl && !isMakeupPage && /\b(kurta|kurti|saree|sari|dress|shirt|pants|palazzo|ethnic\s*wear|clothing|dupatta|suit|lehenga|blouse|jeans|trouser|jacket|coat|jumper)\b/i.test(titleAndPath) || /\b(flared\s+top|crop\s+top|women'?s\s+top|men'?s\s+top)\b/i.test(titleAndPath);
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
          var amzApparel = amzOpts.some(function (t) { return /^(XS|S|M|L|XL|XXL|2XL|3XL|\d{2,3}\s*cm|\d+)$/i.test(t) && !/\d+\s*(ml|g|oz)/i.test(t); });
          if (amzApparel && amzOpts.length) sizeChart = amzOpts.join('\n');
        }
        if (!sizeChart) {
          var amzSizeRe = /^(XS|S|M|L|XL|XXL|2XL|3XL)$/i;
          var amzSizeBtns = document.querySelectorAll('.po-size .a-button-inner, .po-size .a-button-text, [data-cel-widget*="size"] .a-button-inner, [data-cel-widget*="size"] .a-button-text, #variation_size_name .selection, #variation_size_name .a-button-inner, #variation_size_name .a-button-text, #variation_size_name li a, #twisterContainer [id*="size"] .a-button-inner, #twisterContainer [id*="size"] .a-button-text');
          if (amzSizeBtns.length) {
            var btnTexts = Array.from(amzSizeBtns).map(function (b) { return b.textContent.trim(); }).filter(Boolean);
            if (btnTexts.some(function (t) { return amzSizeRe.test(t); })) sizeChart = btnTexts.filter(function (t) { return amzSizeRe.test(t); }).join('\n');
          }
        }
        if (!sizeChart) {
          var sizeSection = document.querySelector('#variation_size_name, [data-cel-widget*="twister"]');
          if (sizeSection) {
            var sizeNodes = sizeSection.querySelectorAll('a, button, span[class*="button"], li');
            var collected = [];
            sizeNodes.forEach(function (n) {
              var t = n.textContent.trim();
              if (/^(XS|S|M|L|XL|XXL|2XL|3XL)$/i.test(t) && collected.indexOf(t) === -1) collected.push(t);
            });
            if (collected.length) sizeChart = collected.join('\n');
          }
        }
      }
    }
    var hasAmzColorVariation = onAmazon && !!document.querySelector('#variation_color_name, #variation_colour_name, [id*="variation_color"], [id*="variation_colour"]');
    var hasAmzShadeVariation = onAmazon && !!document.querySelector('#variation_style_name, #variation_shade_name, [id*="variation_style"], [id*="variation_shade"], #native_dropdown_selected_style_name');
    var isMakeupFromColorOnly = onAmazon && !sizeChart && (hasAmzColorVariation || hasAmzShadeVariation);
    var treatAsMakeup = isMakeupPage || isMakeupFromColorOnly || isMakeupFromUrl;
    let reviews = [];
    if (!treatAsMakeup) {
      const reviewEls = document.querySelectorAll('[data-hook="review-body"], .review-text, .review-content, [class*="review"] p, .cr-original-review-content, .index-review-desc, [class*="Review"]');
      if (reviewEls.length) reviews = Array.from(reviewEls).slice(0, 25).map(function (el) { return el.textContent.trim().slice(0, 300); }).filter(Boolean);
    }
    var shades = [];
    if (onAmazon) {
      if (treatAsMakeup) {
        var amzColorSelect = document.querySelector('#native_dropdown_selected_color_name, #variation_color_name select, #variation_colour_name select, [id*="variation_color"] select, [id*="variation_colour"] select, #native_dropdown_selected_style_name, #variation_style_name select, #variation_shade_name select, [id*="variation_style"] select, [id*="variation_shade"] select');
        if (amzColorSelect && amzColorSelect.options) {
          shades = Array.from(amzColorSelect.options).map(function (o) { return o.text.trim(); }).filter(Boolean);
        }
        if (!shades.length) {
          var amzColorBtns = document.querySelectorAll('#variation_color_name .selection, #variation_color_name .a-button-inner, #variation_color_name .a-button-text, #variation_colour_name .selection, #variation_colour_name .a-button-inner, #variation_colour_name .a-button-text, [id*="variation_color"] .a-button-text, [id*="variation_colour"] .a-button-text, .po-color .a-button-inner, .po-color .a-button-text, #variation_style_name .selection, #variation_style_name .a-button-inner, #variation_style_name .a-button-text, #variation_shade_name .a-button-inner, #variation_shade_name .a-button-text, .po-style .a-button-inner, .po-style .a-button-text');
          if (amzColorBtns.length) shades = Array.from(amzColorBtns).map(function (b) { return b.textContent.trim(); }).filter(Boolean);
        }
        if (!shades.length) {
          var amzColorLinks = document.querySelectorAll('#variation_color_name a, #variation_colour_name a, [id*="variation_color"] a, [id*="variation_colour"] a, #twisterContainer [id*="color"] a, #twisterContainer [id*="colour"] a');
          if (amzColorLinks.length) {
            shades = Array.from(amzColorLinks).map(function (a) { return a.textContent.trim(); }).filter(Boolean);
          }
        }
        if (!shades.length) {
          var colorSection = document.querySelector('#variation_color_name, #variation_colour_name, [id*="variation_color_name"], [id*="variation_colour_name"]');
          if (colorSection) {
            var allClickable = colorSection.querySelectorAll('a, button, [role="button"], span[class*="button"], li');
            var seen = {};
            allClickable.forEach(function (el) {
              var t = el.textContent.trim();
              if (t && t.length >= 2 && t.length <= 40 && !/^(See|Make a|Select|Choose|Image|—|–|-)$/i.test(t) && !/^See\s+/i.test(t) && !/^\d+\.?\d*\s*(g|ml|oz)/i.test(t)) {
                if (!seen[t]) { seen[t] = true; shades.push(t); }
              }
            });
          }
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
    if (!hasData && (title || brand !== 'Unknown' || treatAsMakeup || isApparelPage)) hasData = true;
    if (!hasData) return null;
    var category = isApparelPage ? 'apparel' : ((treatAsMakeup || shades.length) ? 'makeup' : 'apparel');
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
            var noRecMsg = data.message;
            if (!noRecMsg) {
              if (ctx && ctx.category === 'makeup') {
                noRecMsg = (!ctx.shades || !ctx.shades.length) ? 'Shade options weren\'t found on this page. Scroll to the Colour/Shade selector, then click Get recommendation again.' : 'No shade recommendation. Add a face photo in the extension popup (Analyze and save skin profile) for shade recommendations.';
              } else {
                noRecMsg = 'No size recommendation. Size chart or reviews weren\'t found for this product.';
              }
            }
            errEl.textContent = noRecMsg;
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
    document.addEventListener('DOMContentLoaded', function () {
      maybeInject();
      var host = window.location.hostname.replace(/^www\./, '');
      if ((host === 'amazon.in' || host.endsWith('.amazon.in')) && /\/dp\//.test(window.location.pathname || '') && !document.getElementById('fitright-panel')) {
        setTimeout(maybeInject, 2000);
      }
    });
  } else {
    maybeInject();
    var host = window.location.hostname.replace(/^www\./, '');
    if ((host === 'amazon.in' || host.endsWith('.amazon.in')) && /\/dp\//.test(window.location.pathname || '') && !document.getElementById('fitright-panel')) {
      setTimeout(maybeInject, 2000);
    }
  }
})();
