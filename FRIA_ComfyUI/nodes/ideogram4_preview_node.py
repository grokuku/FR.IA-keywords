"""
FR.IA Ideogram 4 Preview — Affiche un template de l'image avec bounding boxes.

Lit le JSON caption Ideogram 4 (sortie du FR.IA Ideogram 4 Builder), parse
les `elements` et dessine un rectangle representant l'image (ratio width:height)
avec chaque bounding box affichee dedans, le texte `desc` superpose.

Le `prompt` est passe en sortie tel quel pour permettre le chainage.
"""

import json


class FRIAIdeogram4PreviewNode:
    CATEGORY = "FR.IA"
    FUNCTION = "preview"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "prompt": ("STRING", {"forceInput": True, "default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)

    def preview(self, width=1024, height=1024, prompt=""):
        # Le widget DOM gere l'affichage. On retourne le prompt tel quel.
        return {"ui": {"prompt": [prompt]}, "result": (prompt,)}
