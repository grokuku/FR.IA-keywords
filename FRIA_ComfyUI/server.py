"""
FR.IA — ComfyUI Server Routes.
Ajoute des routes proxy sur le serveur ComfyUI pour éviter les soucis CORS.
Les appels JS passent par /fria/... au lieu d'appeler kw.holaf.fr directement.
"""
import os
import json
import requests
from aiohttp import web

import server

routes = server.PromptServer.instance.routes


def _get_config():
    """Lit la config depuis le fichier de préférences ComfyUI ou env."""
    import folder_paths
    try:
        settings_path = os.path.join(folder_paths.base_path, "user", "default", "comfy.settings.json")
        if os.path.exists(settings_path):
            with open(settings_path) as f:
                data = json.load(f)
                return data.get("FRIA", {})
    except Exception:
        pass
    return {}


def _get_api_url():
    cfg = _get_config()
    return (cfg.get("serverUrl") or "https://kw.holaf.fr/api").rstrip("/")


@routes.post("/fria/generate")
async def fria_generate(request):
    """Proxy pour POST /api/generate."""
    try:
        body = await request.json()
        api_url = _get_api_url()
        headers = {"Content-Type": "application/json"}
        # Propager le token du header original
        auth = request.headers.get("Authorization", "")
        if auth:
            headers["Authorization"] = auth
        resp = requests.post(f"{api_url}/generate", json=body, headers=headers, timeout=30)
        return web.json_response(resp.json(), status=resp.status_code)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=502)


@routes.post("/fria/enhance")
async def fria_enhance(request):
    """Proxy pour POST /api/enhance."""
    try:
        body = await request.json()
        api_url = _get_api_url()
        headers = {"Content-Type": "application/json"}
        auth = request.headers.get("Authorization", "")
        if auth:
            headers["Authorization"] = auth
        resp = requests.post(f"{api_url}/enhance", json=body, headers=headers, timeout=60)
        return web.json_response(resp.json(), status=resp.status_code)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=502)


@routes.get("/fria/filters")
async def fria_filters(request):
    """Proxy pour GET /api/filters."""
    try:
        api_url = _get_api_url()
        headers = {}
        auth = request.headers.get("Authorization", "")
        if auth:
            headers["Authorization"] = auth
        resp = requests.get(f"{api_url}/filters", headers=headers, timeout=30)
        return web.json_response(resp.json(), status=resp.status_code)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=502)


@routes.get("/fria/styles")
async def fria_styles(request):
    """Proxy pour GET /api/styles."""
    try:
        api_url = _get_api_url()
        headers = {}
        auth = request.headers.get("Authorization", "")
        if auth:
            headers["Authorization"] = auth
        resp = requests.get(f"{api_url}/styles", headers=headers, timeout=30)
        return web.json_response(resp.json(), status=resp.status_code)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=502)


@routes.get("/fria/presets")
async def fria_presets(request):
    """Proxy pour GET /api/presets."""
    try:
        api_url = _get_api_url()
        headers = {}
        auth = request.headers.get("Authorization", "")
        if auth:
            headers["Authorization"] = auth
        resp = requests.get(f"{api_url}/presets", headers=headers, timeout=30)
        return web.json_response(resp.json(), status=resp.status_code)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=502)
