# FitRight AI Backend

## Deploy (AWS SAM)

**Build (choose one):**

- **With Docker** (no local Python 3.11 needed):
  ```bash
  cd backend
  sam build --use-container
  sam deploy
  ```
- **With local Python 3.11:** If you have Python 3.11 on your PATH (e.g. `pyenv install 3.11 && pyenv local 3.11`):
  ```bash
  cd backend
  sam build
  sam deploy
  ```

A `samconfig.toml` is included (stack `fitright`, region `ap-south-1`). To change stack name or region, edit that file or run `sam deploy --guided` and **press Enter** to accept defaults (e.g. for "SAM configuration file [samconfig.toml]:"); do not type `y` or the CLI will use it as the filename. Note the `ApiEndpoint` output after deploy.

## Endpoints

- `POST /profiles` — body: `{ "measurements": { "height", "weight", "bust", "waist", "hips" }, "fitPreference": "snug|regular|relaxed" }` → `{ "profileId": "uuid" }`
- `POST /recommendations` — body: `{ "profileId", "productContext": { "brand", "category", "sizeChart", "listedColor", ... }, "reviews": ["..."] }` → size + reasons + caution + color
- `POST /feedback` — body: `{ "profileId", "rating", "productContext" }` → `{ "feedbackId" }`

## Test with curl

Set your API base URL (no trailing slash), then:

```bash
export API_ENDPOINT="https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/dev"

# 1) Create profile
curl -sS -X POST "$API_ENDPOINT/profiles" -H "Content-Type: application/json" \
  -d '{"measurements":{"height":170,"weight":68,"bust":90,"waist":74,"hips":96},"fitPreference":"regular"}'
# → {"profileId":"..."}

# 2) Get recommendation (use the profileId from step 1)
# sizeChart can be a string (e.g. "Size, Waist\nS, 71\nM, 76\nL, 81") or an object (e.g. {"8":"26cm","9":"27cm"})
curl -sS -X POST "$API_ENDPOINT/recommendations" -H "Content-Type: application/json" \
  -d '{"profileId":"PASTE_PROFILE_ID","productContext":{"brand":"DemoBrand","category":"tops","sizeChart":"Size, Waist (cm)\nS, 71\nM, 76\nL, 81","listedColor":"Navy"},"reviews":["Runs small, size up.","True to size."]}'

# 3) Send feedback
curl -sS -X POST "$API_ENDPOINT/feedback" -H "Content-Type: application/json" \
  -d '{"profileId":"PASTE_PROFILE_ID","rating":1,"productContext":{"brand":"DemoBrand"}}'
```

To test the full app: load the Chrome extension (load unpacked from the `extension` folder), set the API URL in the popup, create a profile, then open the demo product page and click **Get recommendation**.

## Prerequisites

- Enable Claude 3.5 Haiku in Bedrock (AWS Console → Bedrock → Model access).
- Lambda runs in same region as Bedrock.
