from flask import Flask, request, jsonify
import requests
import os
from config import TRANSLATOR_ENGINE, JIGSAWSTACK_API_KEY, GCP_PROJECT_ID, GCP_CREDENTIALS_JSON
from google.cloud import translate_v2 as translate

app = Flask(__name__)

# Initialize GCP client if needed
if TRANSLATOR_ENGINE == 'gcp':
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = GCP_CREDENTIALS_JSON
    gcp_client = translate.Client()

@app.route("/translate", methods=["POST"])
def translate_text():
    data = request.json
    text = data.get("text")
    target_lang = data.get("target")

    if not text or not target_lang:
        return jsonify({"error": "Missing parameters"}), 400

    # Split lines for batch mapping
    lines = text.split("\n")
    translated_lines = []

    if TRANSLATOR_ENGINE == 'jigsawstack':
        url = "https://api.jigsawstack.com/v1/ai/translate"
        headers = {"Authorization": f"Bearer {JIGSAWSTACK_API_KEY}"}
        for line in lines:
            payload = {"text": line, "target": target_lang}
            resp = requests.post(url, json=payload)
            if resp.status_code == 200:
                translated_lines.append(resp.json().get("translated_text", line))
            else:
                translated_lines.append(line)
    elif TRANSLATOR_ENGINE == 'gcp':
        for line in lines:
            result = gcp_client.translate(line, target_language=target_lang)
            translated_lines.append(result["translatedText"])
    else:
        translated_lines = lines

    return jsonify({"translated_text": "\n".join(translated_lines)})

if __name__ == "__main__":
    app.run(debug=True)
