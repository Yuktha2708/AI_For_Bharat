"""
Bedrock: review -> structured JSON (fit signals), recommendation explanation.
Uses Converse API (e.g. Amazon Nova 2 Lite inference profile); parse-validate-retry on invalid JSON.
"""
import json
import os
from typing import Optional
import boto3
from botocore.exceptions import ClientError

BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID",
    "arn:aws:bedrock:ap-south-1:046971095960:inference-profile/global.amazon.nova-2-lite-v1:0",
)
BEDROCK_REGION = os.environ.get("AWS_REGION", "us-east-1")
client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

MAX_REVIEW_CHARS = 5000


def _invoke(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """Call Bedrock Converse API; return assistant text."""
    messages = [{"role": "user", "content": [{"text": prompt}]}]
    kwargs = {
        "modelId": BEDROCK_MODEL_ID,
        "messages": messages,
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.3},
    }
    if system:
        kwargs["system"] = [{"text": system}]
    # Nova 2 Lite optional reasoning config
    if "nova" in BEDROCK_MODEL_ID.lower():
        kwargs["additionalModelRequestFields"] = {
            "reasoningConfig": {"type": "enabled", "maxReasoningEffort": "low"},
        }
    resp = client.converse(**kwargs)
    text = ""
    for block in resp.get("output", {}).get("message", {}).get("content", []):
        if "text" in block:
            text += block["text"]
    return text.strip()


def _extract_json(text: str) -> dict:
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    return json.loads(text)


def extract_fit_signals(
    category: str,
    brand: str,
    size_chart_summary: str,
    reviews: str,
) -> dict:
    """Call Bedrock to get fit_verdict, signals, common_issues, supporting_quotes."""
    reviews = (reviews or "")[:MAX_REVIEW_CHARS]
    system = "You extract apparel fit information from customer reviews. Return ONLY valid JSON, no markdown."
    user = f"""Given:
- Product category: {category}
- Brand: {brand}
- Size chart notes: {size_chart_summary[:800] if size_chart_summary else 'None'}

Reviews:
{reviews or 'No reviews provided.'}

Return ONLY valid JSON with this exact structure:
{{
  "fit_verdict": "runs_small|true_to_size|runs_large|mixed|unknown",
  "signals": {{
    "runs_small": 0.0,
    "true_to_size": 0.0,
    "runs_large": 0.0
  }},
  "common_issues": ["issue1", "issue2"],
  "supporting_quotes": ["short quote", "another quote"]
}}
"""
    out = _invoke(user, system=system, max_tokens=512)
    try:
        data = _extract_json(out)
    except json.JSONDecodeError:
        out = _invoke(
            user + "\nRemember: output only the JSON object, no other text.",
            system=system,
            max_tokens=512,
        )
        try:
            data = _extract_json(out)
        except json.JSONDecodeError:
            data = {
                "fit_verdict": "unknown",
                "signals": {"runs_small": 0.0, "true_to_size": 0.5, "runs_large": 0.0},
                "common_issues": [],
                "supporting_quotes": [],
            }
    verdict = data.get("fit_verdict", "unknown")
    if verdict not in ("runs_small", "true_to_size", "runs_large", "mixed", "unknown"):
        data["fit_verdict"] = "unknown"
    return data


def generate_recommendation(
    profile: dict,
    baseline_size: str,
    review_json: dict,
    product_context: dict,
    recommended_size: str,
    alternate_size: Optional[str],
    confidence: str,
) -> dict:
    """Get 3 bullet reasons and 1 caution from Bedrock."""
    system = "You are a cautious shopping assistant. Never guarantee fit/color. Return ONLY valid JSON."
    user = f"""User profile: measurements={profile.get('measurements', {})}, fitPreference={profile.get('fitPreference', 'regular')}
Baseline size: {baseline_size}
Review signals: {json.dumps(review_json)[:600]}
Product: {product_context}
Recommended size: {recommended_size}, Alternate: {alternate_size or 'none'}, Confidence: {confidence}

Write JSON with:
- "reasons": array of exactly 3 short bullet reasons
- "caution": one short caution sentence
"""
    out = _invoke(user, system=system, max_tokens=512)
    try:
        data = _extract_json(out)
    except json.JSONDecodeError:
        data = {
            "reasons": [
                "Based on size chart and your measurements.",
                "Review signals considered.",
                "Fit preference applied.",
            ],
            "caution": "Fit may vary. Check return policy.",
        }
    if "reasons" not in data or not isinstance(data["reasons"], list):
        data["reasons"] = data.get("reasons", []) or ["Based on chart and reviews.", "See size guide.", "Fit may vary."]
    data["reasons"] = data["reasons"][:3]
    if "caution" not in data or not isinstance(data["caution"], str):
        data["caution"] = "Color and fit can vary. Check return policy."
    return data


def _invoke_with_image(
    image_bytes: bytes,
    image_format: str,
    prompt: str,
    system: str = "",
    max_tokens: int = 512,
) -> str:
    """Call Bedrock Converse API with image + text; return assistant text."""
    content = [
        {"image": {"format": image_format, "source": {"bytes": image_bytes}}},
        {"text": prompt},
    ]
    messages = [{"role": "user", "content": content}]
    kwargs = {
        "modelId": BEDROCK_MODEL_ID,
        "messages": messages,
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.2},
    }
    if system:
        kwargs["system"] = [{"text": system}]
    if "nova" in BEDROCK_MODEL_ID.lower():
        kwargs["additionalModelRequestFields"] = {
            "reasoningConfig": {"type": "enabled", "maxReasoningEffort": "low"},
        }
    resp = client.converse(**kwargs)
    text = ""
    for block in resp.get("output", {}).get("message", {}).get("content", []):
        if "text" in block:
            text += block["text"]
    return text.strip()


def analyze_skin_from_image(image_bytes: bytes, image_format: str = "jpeg") -> dict:
    """Analyze face image; return skinTone, undertone, summary. No image stored."""
    system = "You are a skin analysis assistant. Return ONLY valid JSON, no markdown."
    prompt = """Analyze this face photo for makeup shade matching. Consider skin tone and undertone only.
Return ONLY valid JSON with this exact structure:
{
  "skinTone": "fair|light|medium|tan|deep|rich",
  "undertone": "warm|cool|neutral",
  "summary": "One short sentence describing the complexion for makeup matching."
}"""
    out = _invoke_with_image(image_bytes, image_format, prompt, system=system, max_tokens=256)
    try:
        data = _extract_json(out)
    except json.JSONDecodeError:
        data = {"skinTone": "medium", "undertone": "neutral", "summary": "Unable to analyze; using default."}
    for key in ("skinTone", "undertone", "summary"):
        if key not in data or not isinstance(data[key], str):
            data[key] = "medium" if key == "skinTone" else "neutral" if key == "undertone" else "See shade guide."
    return data


def recommend_shade_for_complexion(
    skin_profile: dict,
    shades: list,
    product_type: str = "makeup",
) -> dict:
    """Recommend shade(s) that suit the user's complexion. Returns recommended_shade, alternate_shades, reasons, caution."""
    if not shades:
        return {"recommended_shade": None, "alternate_shades": [], "reasons": [], "caution": "No shades provided."}
    shades_text = "\n".join(f"- {s}" for s in shades[:50])
    system = "You are a makeup advisor. Suggest which shade suits the complexion. Return ONLY valid JSON, no markdown."
    user = f"""User complexion: skinTone={skin_profile.get('skinTone')}, undertone={skin_profile.get('undertone')}. Summary: {skin_profile.get('summary', '')}
Product type: {product_type}
Available shades:
{shades_text}

Pick the best matching shade and 1-2 alternates. Return ONLY valid JSON:
{{
  "recommended_shade": "exact shade name from the list",
  "alternate_shades": ["alt1", "alt2"],
  "reasons": ["reason1", "reason2", "reason3"],
  "caution": "One short disclaimer about lighting and screen."
}}"""
    out = _invoke(user, system=system, max_tokens=512)
    try:
        data = _extract_json(out)
    except json.JSONDecodeError:
        data = {
            "recommended_shade": shades[0] if shades else None,
            "alternate_shades": shades[1:3] if len(shades) > 1 else [],
            "reasons": ["Based on your complexion.", "Try in person if possible.", "Lighting may vary."],
            "caution": "Color may vary by screen and lighting.",
        }
    if not data.get("recommended_shade") and shades:
        data["recommended_shade"] = shades[0]
    return data
