# FitRight AI Backend

## Deploy (AWS SAM)

```bash
cd backend
sam build
sam deploy --guided
```

First run: set stack name (e.g. `fitright-demo`), region, confirm. Note the `ApiEndpoint` output.

## Endpoints

- `POST /profiles` — body: `{ "measurements": { "height", "weight", "bust", "waist", "hips" }, "fitPreference": "snug|regular|relaxed" }` → `{ "profileId": "uuid" }`
- `POST /recommendations` — body: `{ "profileId", "productContext": { "brand", "category", "sizeChart", "listedColor", ... }, "reviews": ["..."] }` → size + reasons + caution + color
- `POST /feedback` — body: `{ "profileId", "rating", "productContext" }` → `{ "feedbackId" }`

## Prerequisites

- Enable Claude 3.5 Haiku in Bedrock (AWS Console → Bedrock → Model access).
- Lambda runs in same region as Bedrock.
