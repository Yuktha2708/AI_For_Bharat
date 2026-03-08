# Working Prototype Link (for evaluators)

Use the following as the **Working Prototype Link** in your submission.

---

## Live URL (after you enable GitHub Pages)

**Replace `YOUR_GITHUB_USERNAME` with your GitHub username** (and ensure the repo is public).

```
https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/
```

Example: if your username is `ym`, the link is:
**https://ym.github.io/AI_For_Bharat/**

That page explains how to test and links to demo pages (size + shade).

---

## How to get this URL

1. **Push this project to GitHub** (if not already).
   - Create a repo named `AI_For_Bharat` (or use your existing repo name and adjust the URL).
   - Push the code including the `docs/` folder.

2. **Turn on GitHub Pages**
   - On GitHub: repo → **Settings** → **Pages**.
   - Under **Build and deployment**, **Source**: choose **Deploy from a branch**.
   - **Branch**: `main` (or your default branch), folder: **/docs**.
   - Save. After a minute or two, the site will be at:
     `https://<YOUR_GITHUB_USERNAME>.github.io/AI_For_Bharat/`

3. **Provide the API URL to evaluators**  
   The prototype needs your deployed backend. Either:
   - **Option A:** Put the API base URL on the prototype page (e.g. in `docs/index.html`) or in the submission form so evaluators can paste it into the extension.
   - **Option B:** Deploy the backend (e.g. AWS SAM), leave it running during evaluation, and share that API base URL in your submission notes.

---

## What to submit as “Working Prototype Link”

You can submit **one** of these, depending on what evaluators accept:

- **Single link (preferred):**  
  The GitHub Pages URL above, e.g.  
  `https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/`  
  With a short note: *“Install the FitRight AI Chrome extension (Load unpacked from the `extension` folder), set the API URL in the popup, create a profile, then open the demo links on this page or try Amazon.in product pages.”*

- **If they allow multiple links:**  
  - Prototype home: `https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/`  
  - Direct demo (size): `https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/demo/product.html`  
  - Direct demo (shade): `https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/demo/lipstick.html`

---

## Is the extension on the Chrome Web Store?

**No.** The extension is not published on the Chrome Web Store. Evaluators install it from the repo:

- Clone or download the repository.
- In Chrome: open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose the **`extension`** folder in the project.

If you want a one-click install link later, you can publish the extension to the Chrome Web Store (developer account one-time fee, then upload the extension zip and submit for review). For most evaluations, “clone repo + Load unpacked” is acceptable.

---

## Quick test steps (for evaluators)

1. Clone or download the repo; in Chrome go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **`extension`** folder.
2. Click the FitRight icon → enter **API base URL** (from the team) → enter measurements → **Create profile**. (Optional: add a face photo → **Analyze and save skin profile** for shade recommendations.)
3. Open **https://YOUR_GITHUB_USERNAME.github.io/AI_For_Bharat/** and click any demo link (e.g. “Size: Classic Tee” or “Shade: Lipstick”).
4. On the demo page, click **Get recommendation** in the FitRight panel.
5. Optionally, go to an Amazon.in product page (e.g. a kurta or lipstick) and use **Get recommendation** there.
