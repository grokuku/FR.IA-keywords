from .nodes.elements_node import FRIAElementsNode
from .nodes.enhance_node import FRIAEnhanceNode
from .nodes.ideogram4_node import FRIAIdeogram4Node

from .nodes.diagnostic_node import FRIADiagnosticNode

NODE_CLASS_MAPPINGS = {
    "FRIAElementsNode": FRIAElementsNode,
    "FRIAEnhanceNode": FRIAEnhanceNode,
    "FRIAIdeogram4Node": FRIAIdeogram4Node,
    "FRIADiagnosticNode": FRIADiagnosticNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FRIAElementsNode": "FR.IA Elements Picker",
    "FRIAEnhanceNode": "FR.IA Prompt Enhancer",
    "FRIAIdeogram4Node": "FR.IA Ideogram 4 Builder",
    "FRIADiagnosticNode": "FR.IA Diagnostic",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
