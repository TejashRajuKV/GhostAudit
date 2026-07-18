import os
import json
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv(override=True)

API_KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
MODEL   = os.environ.get("GEMMA_MODEL", "gemma-4-31b-it")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def call_gemma(prompt: str, max_tokens: int = 1024, retries: int = 3) -> str:
    """Call Gemma via raw REST API (works with AQ. format keys)."""
    url = f"{BASE_URL}/{MODEL}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": max_tokens,
            "topP": 0.95,
            "responseMimeType": "application/json"
        }
    }
    headers = {"Content-Type": "application/json"}

    for attempt in range(retries):
        api_key = API_KEYS[attempt % len(API_KEYS)] if API_KEYS else ""
        params  = {"key": api_key}

        try:
            resp = requests.post(url, headers=headers, params=params, json=payload, timeout=90)
            if resp.status_code == 429:
                wait = 2 ** (attempt + 2)   # 4s, 8s, 16s
                print(f"Rate limited — waiting {wait}s before retry {attempt+1}/{retries}")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            parts = data["candidates"][0]["content"]["parts"]
            # Extract the actual text response, bypassing any 'thought' parts
            for part in reversed(parts):
                if not part.get("thought", False):
                    return part["text"]
            return parts[-1]["text"]
        except requests.HTTPError as e:
            err_body = {}
            try:
                err_body = resp.json()
            except Exception:
                pass
            raise RuntimeError(f"Gemma API HTTP {resp.status_code}: {err_body.get('error', {}).get('message', str(e))}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise

    raise RuntimeError("Gemma API failed after all retries")


def extract_json(text: str) -> dict:
    """Extract JSON from model response even if wrapped in markdown code blocks."""
    try:
        return json.loads(text.strip())
    except Exception:
        pass
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        match = re.search(r'\{[\s\S]+\}', cleaned)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        raise ValueError(f"Could not extract JSON from response. Raw text (first 300 chars): {text[:300]}")
