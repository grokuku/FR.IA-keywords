"""
FR.IA — ComfyUI extension.
ComfyUI charges ce fichier quand le dossier est dans custom_nodes/.
On importe les nodes depuis FRIA_ComfyUI/.
"""
from FRIA_ComfyUI import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
