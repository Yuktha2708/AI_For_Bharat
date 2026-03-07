// Run API requests from extension context so file:// pages don't hit CORS.
chrome.runtime.onInstalled.addListener(() => {});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetchRecommendations') {
    fetch(msg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg.body),
    })
      .then((res) => res.json().then((data) => ({ status: res.status, ok: res.ok, data })))
      .then(({ status, ok, data }) => sendResponse({ ok, status, data }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async sendResponse
  }
  if (msg.type === 'fetchFeedback') {
    fetch(msg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg.body),
    })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
