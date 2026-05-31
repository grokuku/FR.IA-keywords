"""
FR.IA Prompt Enhancer Node — Optimise un prompt via LLM.
Lit la config (URL serveur + clé API) depuis localStorage (menu FR.IA).
Appelle POST /api/enhance avec tous les paramètres de génération.
"""

import json
# Keys matching the menu extension's localStorage keys
LOCAL_KEY = "FRIA_config"


def _get_config():
    """Read config from localStorage injected by ComfyUI."""
    import uuid
    try:
        import comfy
        # Attempt to read via ComfyUI's built-in settings
        cfg = comfy.model_management.get_settings()
        return cfg.get("FRIA", {})
    except Exception:
        pass
    # Fallback: read from environment or use defaults
    return {}


class FRIAEnhanceNode:
    CATEGORY = "FR.IA"
    FUNCTION = "enhance"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt_source": ("STRING", {"multiline": True, "default": ""}),
                "prompt_type": (["sdxl", "sd15", "flux", "anima", "qwen", "liste"], {"default": "sdxl"}),
                "output_format": (["text", "markdown", "json"], {"default": "text"}),
                "preset_id": ("INT", {"default": 0, "min": 0}),
                "style_id": ("INT", {"default": 0, "min": 0}),
            },
            "optional": {
                "user_text": ("STRING", {"default": "", "multiline": True}),
                "special_instructions": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("prompt", "model_used")

    def enhance(self, prompt_source, prompt_type, output_format,
                preset_id=0, style_id=0, user_text="", special_instructions=""):
        # Lire la config
        cfg = _get_config()
        api_url = (cfg.get("serverUrl") or "https://kw.holaf.fr/api").rstrip("/")
        api_key = cfg.get("apiKey") or ""

        # Fusionner les sources
        merged = prompt_source
        if user_text.strip():
            merged = f"[PRIORITE HAUTE] {user_text}\n[PRIORITE MOYENNE] {prompt_source}"

        payload = {
            "text": merged,
            "prompt_type": prompt_type,
            "output_format": output_format,
            "preset_id": preset_id if preset_id > 0 else None,
            "style_id": style_id if style_id > 0 else None,
            "ep_elements": [],
            "random_count": 0,
            "special_instructions": special_instructions,
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
            return (data.get("output", ""), data.get("model_used", ""))
        except ImportError:
            return ("Erreur: module 'requests' manquant. Installez-le avec 'pip install requests'", "")
        except Exception as e:
            return (f"Erreur: {e}", "")
