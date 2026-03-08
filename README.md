# FitRight AI ✅

Size and color recommendations for online fashion: Chrome extension + serverless backend (Lambda, Bedrock, DynamoDB, API Gateway).

PS: This was a fantastic learning experience. I really enjoyed the challenge of building this out alongside my core tasks and I'm happy to see it live. Thanks for the opportunity!

## Essential Links
- API link as input for extension- https://u7isurjq51.execute-api.ap-south-1.amazonaws.com/dev
- Prototype- https://yuktha2708.github.io/AI_For_Bharat/
- Demo product 1- https://yuktha2708.github.io/AI_For_Bharat/demo/product.html
- Demo product 2- https://yuktha2708.github.io/AI_For_Bharat/demo/product2.html
- Demo makeup product- https://yuktha2708.github.io/AI_For_Bharat/demo/makeup.html
- Demo makeup product- https://yuktha2708.github.io/AI_For_Bharat/demo/lipstick.html
- Demo Video- https://drive.google.com/file/d/1QckDgGkYFMyYpVeic3-xepZMJq-p29B4/view?usp=sharing
- PPT- https://github.com/Yuktha2708/AI_For_Bharat/blob/main/Prototype%20Development%20Submission%20_%20AWS%20AI%20for%20Bharat%20Hackathon.pdf

## Amazon Product link to try on
- Apparels-
-- https://amzn.in/d/06ECBXwv
-- https://amzn.in/d/02Y5dqMf
- Foundation-
-- https://amzn.in/d/07v8nG9u
-- https://amzn.in/d/054yznpL
- Lipstick-
-- https://amzn.in/d/05RHpBPh
-- https://amzn.in/d/05tuoGFI

## Quick start
How to test (evaluators)
Note: This extension is not on the Chrome Web Store. Install it from the project source (see below).

- Install the Chrome extension from source
- Clone or download this repo. In Chrome go to chrome://extensions → turn on Developer mode (top right) → Load unpacked → select the extension folder inside the project. The FitRight AI icon will appear in the toolbar.
- Create a profile & set API URL
- Click the FitRight AI icon in the toolbar. Enter the API base URL "https://u7isurjq51.execute-api.ap-south-1.amazonaws.com/dev" Enter your measurements (height, weight, bust, waist, hips) and fit preference, then click “Create profile”. Optionally add a face photo and click “Analyze and save skin profile” for makeup shade recommendations.
- Try the demo pages (this site)
- With the extension installed, open any demo link below. You should see a FitRight AI panel at the top with a “Get recommendation” button. Click it to get a size or shade recommendation.
- Try on Amazon.in (optional)
- Go to a product page on Amazon.in (e.g. a kurta or a lipstick). The FitRight panel appears on product pages. Click “Get recommendation” for size (apparel) or shade (makeup).
- Demo pages (use with extension)
- These pages work when the FitRight AI extension is installed and the API URL is set. Click a link below, then click Get recommendation in the panel.

## Tech Stuff
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
