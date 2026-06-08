"""
FR.IA Ideogram 4 Caption Builder — Construit un JSON caption Ideogram 4 via LLM.

Le widget DOM custom permet de saisir :
- description generale (style, ambiance, decor, lumiere)
- 4 elements (sujets principaux a placer dans la scene)
- width, height, seed, style

La generation se fait cote site web via /api/enhance (prompt_type=ideogram4).
Le node se contente de collecter les entrees et d'appeler l'API.

Sortie : prompt (STRING) = le JSON caption Ideogram 4
"""

import json


class FRIAIdeogram4Node:
    CATEGORY = "FR.IA"
    FUNCTION = "build_caption"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "description": ("STRING", {"multiline": True, "default": ""}),
                "element_1": ("STRING", {"multiline": True, "default": ""}),
                "element_2": ("STRING", {"multiline": True, "default": ""}),
                "element_3": ("STRING", {"multiline": True, "default": ""}),
                "element_4": ("STRING", {"multiline": True, "default": ""}),
                "preset_id": ("INT", {"default": 0, "min": 0}),
                "style_id": ("INT", {"default": 0, "min": 0}),
            },
            "optional": {
                # JSON serialise par le JS : api_url + api_key
                "_api_config": ("STRING", {"default": "{}", "multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING", "INT", "INT")
    RETURN_NAMES = ("prompt", "width", "height")

    def build_caption(self, seed=0, width=1024, height=1024,
                      description="", element_1="", element_2="", element_3="", element_4="",
                      preset_id=0, style_id=0, _api_config="{}"):
        try:
            api_cfg = json.loads(_api_config) if _api_config else {}
        except json.JSONDecodeError:
            api_cfg = {}

        api_url = (api_cfg.get("api_url") or "https://kw.holaf.fr/api").rstrip("/")
        api_key = api_cfg.get("api_key", "")

        # Construire le payload pour /api/enhance
        # Les 4 elements sont envoyes comme ep_elements (type "text")
        ep_elements = []
        for el in [element_1, element_2, element_3, element_4]:
            if el and el.strip():
                ep_elements.append({"type": "text", "text": el.strip()})

        payload = {
            "text": description.strip(),
            "seed": seed if seed > 0 else None,
            "prompt_type": "ideogram4",
            "width": width,
            "height": height,
            "ep_elements": ep_elements,
            "preset_id": preset_id if preset_id > 0 else None,
            "style_id": style_id if style_id > 0 else None,
        }

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            import requests
            r = requests.post(f"{api_url}/enhance",
                              json=payload, headers=headers, timeout=60)
            r.raise_for_status()
            data = r.json()
            prompt = data.get("output", "")
            return {"ui": {"prompt": [prompt]}, "result": (prompt, width, height)}
        except ImportError:
            msg = "Erreur: module 'requests' manquant. pip install requests"
            return {"ui": {"prompt": [msg]}, "result": (msg, width, height)}
        except Exception as e:
            msg = str(e)
            if "401" in msg:
                msg = "Erreur : cle API invalide ou manquante."
            elif "429" in msg:
                msg = "Erreur : rate limit atteint. Attendez un instant."
            else:
                msg = f"Erreur API : {msg}"
            return {"ui": {"prompt": [msg]}, "result": (msg, width, height)}
