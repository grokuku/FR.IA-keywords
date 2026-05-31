from .nodes.elements_node import FRIAElementsNode
from .nodes.enhance_node import FRIAEnhanceNode

NODE_CLASS_MAPPINGS = {
    "FRIAElementsNode": FRIAElementsNode,
    "FRIAEnhanceNode": FRIAEnhanceNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FRIAElementsNode": "FR.IA Elements Picker",
    "FRIAEnhanceNode": "FR.IA Prompt Enhancer",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
