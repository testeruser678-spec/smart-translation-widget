# api/translate.py
import os
import json
import base64
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow cross-origin calls from embedded pages (restrict later if you want)

# Config via env
TRANSLATOR_ENGINE = os.environ.get("TRANSLATOR_ENGINE", "jigsawstack").lower()
JIGSAWSTACK_API_KEY = os.environ.get("JIGSAWSTACK_API_KEY", "")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
GCP_CREDS_B64 = os.environ.get("GCP_CREDS_B64", "")  # recommended: base64-encoded JSON

# Initialize GCP client lazily
gcp_client = None
if TRANSLATOR_ENGINE == "gcp" and GCP_CREDS_B64:
    try:
        # write creds to a temp file (serverless runtime)
        creds_path = "/tmp/gcp_creds.json"
        with open(creds_path, "wb") as f:
            f.write(base64.b64decode(GCP_CREDS_B64))
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
        from google.cloud import translate_v2 as translate
        gcp_client = translate.Client()
    except Exception as e:
        # keep gcp_client None to fail gracefully later
        print("Failed to init GCP client:", e)


@app.route("/api/translate", methods=["POST"])
def translate_route():
    try:
        payload = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400

    # Accept either list of strings or newline-separated string
    texts = payload.get("texts") or payload.get("text")
    target = payload.get("target")
    if not texts or not target:
        return jsonify({"error": "Missing 'texts' and/or 'target'"}), 400

    if isinstance(texts, str):
        lines = [line for line in texts.split("\n") if line.strip() != ""]
    elif isinstance(texts, list):
        lines = texts
    else:
        return jsonify({"error": "Invalid 'texts' format"}), 400

    translated = []
    if TRANSLATOR_ENGINE == "jigsawstack":
        if not JIGSAWSTACK_API_KEY:
            return jsonify({"error": "JIGSAWSTACK_API_KEY not set"}), 500
        url = "https://api.jigsawstack.com/v1/ai/translate"
        headers = {"Authorization": f"Bearer {JIGSAWSTACK_API_KEY}"}
        for line in lines:
            try:
                resp = requests.post(url, json={"text": line, "target": target}, headers=headers, timeout=10)
                if resp.ok:
                    j = resp.json()
                    # adjust key names depending on Jigsaw response shape
                    translated.append(j.get("translated_text") or j.get("translation") or line)
                else:
                    translated.append(line)
            except Exception:
                translated.append(line)

    elif TRANSLATOR_ENGINE == "gcp":
        if not gcp_client:
            return jsonify({"error": "GCP not configured correctly"}), 500
        for line in lines:
            try:
                res = gcp_client.translate(line, target_language=target)
                translated.append(res.get("translatedText", line))
            except Exception:
                translated.append(line)

    else:
        # passthrough / dev mode
        translated = lines

    return jsonify({"translated": translated})
