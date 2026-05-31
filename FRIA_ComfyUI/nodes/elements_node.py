"""
FR.IA Elements Picker Node — Custom widget (JavaScript).
The interactive UI is rendered by web/js/fria_elements_widget.js
This Python stub just defines the node's interface and output.
"""


class FRIAElementsNode:
    CATEGORY = "FR.IA"
    FUNCTION = "generate"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(cls):
        return {}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("elements",)

    def generate(self):
        # The JS widget stores the result in this node's widgets.
        # Read the first widget's value (the hidden output).
        prompt = ""
        if hasattr(self, "widgets") and self.widgets:
            for w in self.widgets:
                if w.name == "_result":
                    prompt = w.value or ""
                    break
        return (prompt,)
