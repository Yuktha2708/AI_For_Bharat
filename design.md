# FitRight AI — design.md

_Last updated: 2026-02-06_

## 1. Overview
FitRight AI delivers **size** and **color** recommendations at shopping time using:
- A **browser extension** (primary MVP surface)
- A lightweight **serverless backend**
- **Amazon Bedrock** for LLM-powered review understanding and recommendation generation
- Optional **Amazon Q** assistant experience for Q&A (e.g., “What size should I pick?”)

This design is optimized for hackathon delivery: fast to prototype, scalable by default, and compliant with synthetic/public data constraints.

## 2. Architecture (high level)
### 2.1 Components
- **Client (Extension / App)**
  - Collects user inputs
  - Extracts product page fields (site adapter)
  - Displays recommendations + explanations

- **API Layer**
  - Amazon API Gateway
  - AWS Lambda functions

- **AI Layer**
  - Amazon Bedrock
    - Review summarization into structured fit signals
    - Recommendation generation with explanations
  - (Optional) Amazon Q

- **Data Layer**
  - DynamoDB: user profiles, preferences, feedback
  - S3: (optional) encrypted selfies for limited retention; artifacts/log exports
  - Cache (optional): DynamoDB TTL cache for repeated product analysis

- **Observability**
  - CloudWatch logs/metrics

### 2.2 Request path
`Extension/App → API Gateway → Lambda Orchestrator → (Bedrock + deterministic logic) → Response`

## 3. Data flow
### 3.1 Onboarding
1. User enters measurements + preferences.
2. Optional selfie:
   - Client uploads via pre-signed S3 URL.
   - Backend derives a compact **color profile** and stores derived fields in DynamoDB.
   - Raw selfie storage is optional, encrypted, and short-retention.

### 3.2 Product analysis (runtime)
1. Extension extracts:
   - brand, category, size chart (table), available sizes
   - product images (URLs) and/or listed color name
   - public review text OR synthetic review bundle
2. Extension calls `POST /recommendations`.
3. Lambda orchestrator:
   - Validates and normalizes units (cm/in)
   - Fetches user profile
   - Calls Bedrock to extract structured fit signals from reviews
   - Computes baseline size from size chart
   - Merges baseline + review signals → final recommendation + confidence
   - Produces short explanation bullets + caution note
4. Response returned to extension.

## 4. Bedrock usage (core AI)
Bedrock is used for:
- **Review → structured JSON** extraction (fit verdict, issues)
- **Natural-language explanation** generation (transparent rationale)

Design principles:
- Strict JSON schemas
- Short prompts, minimal PII
- Parse-validate-retry (on invalid JSON)

### 4.1 Review-to-JSON prompt (example)
```text
SYSTEM: You extract apparel fit information from customer reviews.

USER:
Given:
- Product category: {category}
- Brand: {brand}
- Size chart notes: {size_chart_summary}
- Reviews: {reviews}

Return ONLY valid JSON with:
{
  "fit_verdict": "runs_small|true_to_size|runs_large|mixed|unknown",
  "signals": {
    "runs_small": 0.0,
    "true_to_size": 0.0,
    "runs_large": 0.0
  },
  "common_issues": ["..."],
  "supporting_quotes": ["short quote", "..."]
}
```

### 4.2 Recommendation generation prompt (example)
```text
SYSTEM: You are a cautious shopping assistant. Never guarantee fit/color.

USER:
User profile: {measurements}, {fit_preferences}
Baseline size suggestion: {baseline}
Review signals: {review_json}
Product context: {fabric}, {stretch}, {cut}

Write:
- recommended_size
- alternate_size (optional)
- confidence (low|medium|high)
- 3 bullet reasons
- 1 caution note
Return JSON.
```

## 5. Size recommendation logic (MVP)
### 5.1 Baseline from size chart
- Parse chart into structured ranges.
- Choose the size whose key measurement best matches user measurement.
- Apply preference offset:
  - snug → bias down
  - relaxed → bias up

### 5.2 Review-based adjustment
- If `runs_small` is high → suggest size up (or alternate size up)
- If `runs_large` is high → suggest size down
- If `mixed/unknown` → keep baseline and lower confidence

### 5.3 Confidence heuristic
- **High**: chart present + sufficient reviews + consistent signals
- **Medium**: chart present, signals mixed
- **Low**: chart missing or reviews sparse

## 6. Color guidance (MVP)
Because true color is hard, MVP is conservative:
- Extract dominant colors from product image(s) (simple CV) or use listed color name.
- Derive coarse user tone/undertone from selfie (optional) or manual selection.
- Provide guidance with disclaimers.

## 7. API design
### 7.1 `POST /profiles`
Creates a profile.

### 7.2 `POST /recommendations`
Generates recommendations.

**Request (example)**
```json
{
  "profileId": "uuid",
  "productContext": {"brand": "Brand", "category": "tops", "sizeChart": "..."},
  "reviews": ["..."],
  "images": ["https://..."]
}
```

**Response (example)**
```json
{
  "recommended_size": "M",
  "alternate_size": "L",
  "confidence": "high",
  "reasons": ["..."],
  "caution": "...",
  "fit_verdict": "runs_small",
  "color": {
    "match": "good",
    "notes": ["..."],
    "disclaimer": "Color perception varies by lighting and screen settings."
  }
}
```

### 7.3 `POST /feedback`
Stores user feedback to improve future versions.

## 8. Storage
- DynamoDB tables:
  - `Profiles` (PK: profileId)
  - `Feedback` (PK: feedbackId)
  - `ProductCache` (PK: productKey, TTL)
- S3:
  - Encrypted objects (optional), lifecycle policy for deletion

## 9. Security & privacy
- Auth: Cognito (recommended) or minimal auth for MVP.
- Encryption at rest and in transit.
- Data minimization; derived color features preferred.
- Delete endpoint for user data.

## 10. Observability
- CloudWatch logs/metrics:
  - request latency
  - Bedrock invocation count
  - error rate
  - cache hit rate

## 11. Testing
- Unit tests for parsing and heuristics.
- Contract tests for Bedrock JSON schema.
- End-to-end tests on demo pages.

## 12. Deployment
- CI/CD optional; package lambdas and extension build artifacts.
- Use environment variables for configuration.

## 13. Demo plan (hackathon)
- Use synthetic reviews + a few static product pages.
- Demonstrate:
  - onboarding
  - live recommendation
  - explanation + confidence
  - feedback capture

## 14. Limitations
- Fit and color guidance are probabilistic; not guarantees.
- Color guidance depends on camera/lighting/screen.

## 15. Future enhancements
- RAG over a brand sizing knowledge base.
- Multilingual UI + translation.
- Better color calibration.
- Retailer partnerships for structured data.
