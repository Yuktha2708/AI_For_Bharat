"""
FitRight AI - Lambda orchestrator.
Routes: POST /profiles, POST /recommendations, POST /feedback.
"""
import json
import os
import uuid
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

from bedrock import (
    extract_fit_signals,
    generate_recommendation,
    analyze_skin_from_image,
    recommend_shade_for_complexion,
)
from size_logic import compute_baseline_size, apply_review_adjustment, confidence_heuristic

PROFILES_TABLE = os.environ["PROFILES_TABLE"]
FEEDBACK_TABLE = os.environ["FEEDBACK_TABLE"]
dynamo = boto3.resource("dynamodb")
profiles_table = dynamo.Table(PROFILES_TABLE)
feedback_table = dynamo.Table(FEEDBACK_TABLE)


def _json_response(body, status=200, headers=None):
    h = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    if headers:
        h.update(headers)
    return {"statusCode": status, "headers": h, "body": json.dumps(body)}


def _error_response(message, status=400):
    return _json_response({"error": message}, status=status)


def _parse_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw)


def _route(event):
    request_context = event.get("requestContext") or {}
    http = request_context.get("http") or {}
    method = http.get("method", event.get("httpMethod", "")).upper()
    raw = (http.get("path") or event.get("path") or "").strip("/")
    # API Gateway HTTP API often includes stage (e.g. /dev/profiles) -> use last segment
    path = raw.split("/")[-1] if raw else ""
    return method, path


def handle_profiles(body):
    """POST /profiles - create profile, return profileId."""
    measurements = body.get("measurements")
    if not measurements or not isinstance(measurements, dict):
        return _error_response("measurements object required", 400)
    for key in ("height", "weight", "bust", "waist", "hips"):
        if key not in measurements:
            return _error_response(f"measurements.{key} required", 400)
        try:
            v = float(measurements[key])
            if v <= 0:
                raise ValueError("must be positive")
        except (TypeError, ValueError):
            return _error_response(f"measurements.{key} must be a positive number", 400)
    fit_preference = (body.get("fitPreference") or "regular").strip().lower()
    if fit_preference not in ("snug", "regular", "relaxed"):
        fit_preference = "regular"
    profile_id = str(uuid.uuid4())
    item = {
        "profileId": profile_id,
        "measurements": {k: Decimal(str(v)) for k, v in measurements.items()},
        "fitPreference": fit_preference,
        "createdAt": str(uuid.uuid1()),
    }
    profiles_table.put_item(Item=_serialize_dynamo(item))
    return _json_response({"profileId": profile_id})


def handle_skin_analysis(body):
    """POST /skin-analysis - analyze face image, store skinProfile on profile, no image stored."""
    import base64
    profile_id = body.get("profileId")
    image_base64 = body.get("imageBase64")
    if not profile_id:
        return _error_response("profileId required", 400)
    if not image_base64:
        return _error_response("imageBase64 required", 400)
    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception:
        return _error_response("Invalid imageBase64", 400)
    if len(image_bytes) > 5 * 1024 * 1024:  # 5 MB max
        return _error_response("Image too large", 400)
    try:
        resp = profiles_table.get_item(Key={"profileId": profile_id})
    except ClientError:
        return _error_response("Profile not found", 404)
    item = resp.get("Item")
    if not item:
        return _error_response("Profile not found", 404)
    image_format = (body.get("imageFormat") or "jpeg").lower()
    if image_format not in ("jpeg", "jpg", "png"):
        image_format = "jpeg"
    if image_format == "jpg":
        image_format = "jpeg"
    try:
        skin_profile = analyze_skin_from_image(image_bytes, image_format)
    except Exception as e:
        return _error_response(f"Skin analysis failed: {str(e)}", 500)
    profile = _deserialize_dynamo(item)
    profile["skinProfile"] = skin_profile
    update_expr = "SET skinProfile = :sp"
    profiles_table.update_item(
        Key={"profileId": profile_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues={":sp": _serialize_dynamo(skin_profile)},
    )
    return _json_response({"skinProfile": skin_profile})


def _serialize_dynamo(obj):
    if isinstance(obj, dict):
        return {k: _serialize_dynamo(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_dynamo(v) for v in obj]
    if isinstance(obj, float):
        return Decimal(str(obj))
    return obj


def _deserialize_dynamo(obj):
    if isinstance(obj, dict):
        return {k: _deserialize_dynamo(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deserialize_dynamo(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def handle_recommendations(body):
    """POST /recommendations - return size + color + reasons."""
    profile_id = body.get("profileId")
    if not profile_id:
        return _error_response("profileId required", 400)
    try:
        resp = profiles_table.get_item(Key={"profileId": profile_id})
    except ClientError:
        return _error_response("profile not found", 404)
    item = resp.get("Item")
    if not item:
        return _error_response("profile not found", 404)
    profile = _deserialize_dynamo(item)
    product_context = body.get("productContext") or {}
    reviews = body.get("reviews") or []
    if not isinstance(reviews, list):
        reviews = [str(reviews)]
    reviews = [str(r)[:500] for r in reviews][:50]
    category = product_context.get("category") or "apparel"
    brand = product_context.get("brand") or "Unknown"
    raw_size_chart = product_context.get("sizeChart")
    if isinstance(raw_size_chart, dict):
        size_chart = "\n".join(f"{k}, {v}" for k, v in raw_size_chart.items())
    else:
        size_chart = (str(raw_size_chart or "").strip()) or None
    listed_color = product_context.get("listedColor") or "See product"

    # Cap total review text for Bedrock cost
    reviews_text = "\n---\n".join(reviews)[:5000]
    has_apparel_data = bool(size_chart or reviews)

    if has_apparel_data:
        # 1) Baseline size from size chart
        baseline_size, chart_parsed = compute_baseline_size(
            size_chart, profile["measurements"], profile.get("fitPreference", "regular")
        )
        # 2) Bedrock: review -> fit signals
        fit_signals = extract_fit_signals(
            category=category,
            brand=brand,
            size_chart_summary=size_chart[:1000] if size_chart else "",
            reviews=reviews_text,
        )
        # 3) Review-based adjustment
        final_size, alternate_size = apply_review_adjustment(
            baseline_size, chart_parsed, fit_signals
        )
        # 4) Confidence
        confidence = confidence_heuristic(
            has_chart=bool(size_chart),
            review_count=len(reviews),
            fit_signals=fit_signals,
        )
        # 5) Bedrock: explanation + caution
        explanation = generate_recommendation(
            profile=profile,
            baseline_size=baseline_size,
            review_json=fit_signals,
            product_context={
                "category": category,
                "brand": brand,
                "fabric": product_context.get("fabric") or "Not specified",
                "stretch": product_context.get("stretch") or "Not specified",
                "cut": product_context.get("cut") or "Not specified",
            },
            recommended_size=final_size,
            alternate_size=alternate_size,
            confidence=confidence,
        )
        fit_verdict = fit_signals.get("fit_verdict", "unknown")
        reasons = explanation.get("reasons", [])
        caution = explanation.get("caution", "")
    else:
        final_size = None
        alternate_size = None
        confidence = ""
        reasons = []
        caution = ""
        fit_verdict = "unknown"

    # 6) Minimal color block (no selfie)
    color_block = {
        "match": "good",
        "notes": [f"Listed color: {listed_color}. Color perception varies."],
        "disclaimer": "Color perception varies by lighting and screen settings.",
    }

    out = {
        "recommended_size": final_size,
        "alternate_size": alternate_size,
        "confidence": confidence,
        "reasons": reasons,
        "caution": caution,
        "fit_verdict": fit_verdict,
        "color": color_block,
    }

    # 7) Makeup shade recommendation when product has shades and profile has skin
    shades = product_context.get("shades")
    if isinstance(shades, list) and profile.get("skinProfile"):
        product_type = product_context.get("productType") or "makeup"
        shade_list = [str(s).strip() for s in shades if s][:50]
        shade_result = recommend_shade_for_complexion(
            profile["skinProfile"], shade_list, product_type
        )
        out["recommended_shade"] = shade_result.get("recommended_shade")
        out["shade_alternates"] = shade_result.get("alternate_shades") or []
        out["shade_reasons"] = shade_result.get("reasons") or []
        out["shade_caution"] = shade_result.get("caution") or ""
    else:
        out["recommended_shade"] = None
        out["shade_alternates"] = []
        out["shade_reasons"] = []
        out["shade_caution"] = ""

    return _json_response(out)


def handle_feedback(body):
    """POST /feedback - store feedback."""
    profile_id = body.get("profileId")
    rating = body.get("rating")
    product_context = body.get("productContext")
    if not profile_id:
        return _error_response("profileId required", 400)
    if rating is None:
        return _error_response("rating required", 400)
    feedback_id = str(uuid.uuid4())
    item = {
        "feedbackId": feedback_id,
        "profileId": profile_id,
        "rating": int(rating) if isinstance(rating, (int, float)) else str(rating),
        "productContext": product_context if isinstance(product_context, dict) else {},
        "createdAt": str(uuid.uuid1()),
    }
    feedback_table.put_item(Item=_serialize_dynamo(item))
    return _json_response({"feedbackId": feedback_id})


def lambda_handler(event, context):
    method, path = _route(event)
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": "*"}}
    if method != "POST":
        return _error_response("Method not allowed", 405)
    body = _parse_body(event)
    if path == "profiles":
        return handle_profiles(body)
    if path == "recommendations":
        return handle_recommendations(body)
    if path == "feedback":
        return handle_feedback(body)
    if path == "skin-analysis":
        return handle_skin_analysis(body)
    return _error_response("Not found", 404)
