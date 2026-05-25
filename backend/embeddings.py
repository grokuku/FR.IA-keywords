"""
Module d'embeddings via Ollama API.
Configurez dans le panneau Admin : adresse du serveur + nom du modèle.

Ou via variables d'environnement :
  OLLAMA_URL    défaut: http://localhost:11434
  OLLAMA_MODEL  défaut: nomic-embed-text
"""

import os
import json
import urllib.request
import urllib.error


# Configuration par défaut (surchargée par la BDD ou les vars d'env)
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "nomic-embed-text")

# Configuration surchargeable dynamiquement (depuis la BDD admin)
_OVERRIDE_URL = None
_OVERRIDE_MODEL = None


def set_config(url: str | None = None, model: str | None = None):
    """Surcharge la config Ollama (appelé depuis l'app avec les valeurs stockées en BDD)."""
    global _OVERRIDE_URL, _OVERRIDE_MODEL
    if url:
        _OVERRIDE_URL = url
    if model:
        _OVERRIDE_MODEL = model


def _get_url() -> str:
    return _OVERRIDE_URL or DEFAULT_OLLAMA_URL


def _get_model() -> str:
    return _OVERRIDE_MODEL or DEFAULT_OLLAMA_MODEL


def generate_embedding(text: str) -> list[float]:
    """Appelle l'API Ollama et retourne un vecteur d'embedding."""
    url = _get_url().rstrip("/") + "/api/embed"
    model = _get_model()

    payload = json.dumps({"model": model, "input": text}).encode("utf-8")
    headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")[:300]
        raise RuntimeError(f"Erreur Ollama ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Impossible de se connecter à Ollama ({url}): {e.reason}\n"
            "Vérifie que le serveur Ollama est bien lancé."
        )

    # Réponse : {"model":"...","embeddings":[[0.1, 0.2, ...]]}
    if isinstance(result, dict):
        embeddings = result.get("embeddings")
        if embeddings and len(embeddings) > 0 and isinstance(embeddings[0], list):
            return [float(x) for x in embeddings[0]]

    raise RuntimeError(f"Réponse Ollama inattendue: {json.dumps(result)[:200]}")


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Cosine similarity entre deux vecteurs."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = sum(a * a for a in vec_a) ** 0.5
    norm_b = sum(b * b for b in vec_b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def is_available() -> bool:
    """Vérifie si Ollama est joignable."""
    try:
        url = _get_url().rstrip("/") + "/api/tags"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            model = _get_model()
            models = data.get("models", [])
            return any(m["name"].startswith(model) for m in models)
    except Exception:
        return False
