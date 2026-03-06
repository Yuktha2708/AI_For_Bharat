# FitRight AI — 36-Hour Demo Prototype

Size and color recommendations for online fashion: Chrome extension + serverless backend (Lambda, Bedrock, DynamoDB, API Gateway).

## Quick start

### 1. Backend (AWS)

- Enable **Claude 3.5 Haiku** in [Bedrock](https://console.aws.amazon.com/bedrock/) → Model access (region e.g. `us-east-1`).
- From project root:
  ```bash
  cd backend
  sam build
  sam deploy --guided
  ```
- Note the **ApiEndpoint** output (e.g. `https://xxx.execute-api.us-east-1.amazonaws.com/dev`).

### 2. Chrome extension

- Open `chrome://extensions/` → Enable **Developer mode** → **Load unpacked** → select the `extension` folder.
- Click the FitRight icon → enter the **API base URL** (the ApiEndpoint from step 1, no trailing slash) → enter measurements (cm) and fit preference → **Create profile**.
- Click **Open demo page** to open the first demo product page.
- On the demo page, click **Get recommendation**; then use **Was this helpful?** to send feedback.

### 3. Demo pages

- **product.html** — “Runs small” scenario (Classic Cotton Tee).
- **product2.html** — “Runs large” scenario (Relaxed Fit Hoodie).

Open from the extension popup (**Open demo page**) or directly:
- From repo: open `demo/product.html` or `demo/product2.html` in the browser (file://). The extension will inject the panel on any page that has `data-fitright-demo` and the content script will run if you allowed file access.
- From extension: the popup links to `extension/demo/product.html` (loaded as `chrome-extension://<id>/demo/product.html`). For product2, open `demo/product2.html` in a new tab from the extension’s demo folder URL.

## Project layout

- **backend/** — SAM app: Lambda (handler, Bedrock, size logic), DynamoDB (Profiles, Feedback), API Gateway.
- **extension/** — Chrome extension (Manifest V3): popup (onboarding), content script (recommendation panel + feedback), demo pages.
- **demo/** — Standalone demo product HTML (same content as in `extension/demo/`) for file:// or local hosting.

## API

- `POST /profiles` — create profile; body: `{ "measurements": { "height", "weight", "bust", "waist", "hips" }, "fitPreference": "snug|regular|relaxed" }`.
- `POST /recommendations` — get size + reasons; body: `{ "profileId", "productContext": { "brand", "category", "sizeChart", "listedColor" }, "reviews": ["..."] }`.
- `POST /feedback` — store feedback; body: `{ "profileId", "rating", "productContext" }`.

## AWS cost (demo)

Bedrock (Claude Haiku) dominates; Lambda, API Gateway, DynamoDB stay within free tier for a 36h prototype. Set a billing alert (e.g. $50) in AWS Budgets.
