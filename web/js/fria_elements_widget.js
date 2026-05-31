/**
 * FR.IA Elements Picker — Custom widget for ComfyUI node.
 * Renders an interactive UI inside the node:
 *   - Add saved filter / Add semantic buttons
 *   - List of elements with remove (✕)
 *   - Add random checkbox + count
 *   - Generate button + preview area
 *
 * TODO: Full implementation when Elements Picker node is developed.
 */
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "FR.IA.Elements",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "FRIAElementsNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);

            // Store result in a hidden widget
            this._resultWidget = this.addWidget("hidden", "_result", "", () => {});

            // Create UI container
            const container = document.createElement("div");
            Object.assign(container.style, {
                width: "100%", minHeight: "250px",
                background: "#2a2a2e", borderRadius: "8px",
                padding: "8px", boxSizing: "border-box",
                fontSize: "12px", color: "#ccc",
            });

            // Toolbar
            const tb = document.createElement("div");
            Object.assign(tb.style, {
                display: "flex", gap: "4px", marginBottom: "8px",
            });

            const mkBtn = (text) => {
                const b = document.createElement("button");
                b.textContent = text;
                Object.assign(b.style, {
                    flex: "1", padding: "4px 8px", borderRadius: "4px",
                    border: "1px solid #555", fontSize: "11px",
                    background: "#3a3a3e", color: "#ccc", cursor: "pointer",
                });
                b.onmouseenter = () => b.style.background = "#4a4a4e";
                b.onmouseleave = () => b.style.background = "#3a3a3e";
                return b;
            };

            tb.appendChild(mkBtn("+ Add saved filter"));
            tb.appendChild(mkBtn("+ Add semantic"));

            // Element list
            const list = document.createElement("div");
            Object.assign(list.style, {
                minHeight: "60px", marginBottom: "8px",
                border: "1px dashed #555", borderRadius: "4px",
                padding: "4px", fontSize: "11px", color: "#666",
            });
            list.textContent = "Aucun élément. Ajoutez des filtres ou une recherche sémantique.";

            // Random row
            const randRow = document.createElement("div");
            Object.assign(randRow.style, {
                display: "flex", gap: "8px", alignItems: "center",
                marginBottom: "8px",
            });

            const randCb = document.createElement("input");
            randCb.type = "checkbox";
            randCb.checked = false;

            const randN = document.createElement("input");
            randN.type = "number";
            randN.value = "3";
            Object.assign(randN.style, {
                width: "40px", padding: "2px 4px", borderRadius: "4px",
                border: "1px solid #555", background: "#1a1a1e",
                color: "#fff", fontSize: "11px", textAlign: "center",
            });

            const randLabel = document.createElement("label");
            randLabel.style.fontSize = "11px";
            randLabel.textContent = "Add random";

            randRow.appendChild(randCb);
            randRow.appendChild(randLabel);
            randRow.appendChild(document.createTextNode("N:"));
            randRow.appendChild(randN);

            // Generate button
            const genBtn = mkBtn("🔄  Générer");
            Object.assign(genBtn.style, {
                width: "100%", padding: "6px", marginBottom: "8px",
                background: "#6366f1", color: "white", fontWeight: "600",
                border: "none", fontSize: "12px",
            });
            genBtn.onmouseenter = () => genBtn.style.background = "#5558e8";
            genBtn.onmouseleave = () => genBtn.style.background = "#6366f1";
            genBtn.onclick = () => {
                // TODO: call API / generate, update result area
                const result = document.getElementById("fria-result-" + this.id);
                if (result) {
                    result.value = "Génération... (implémentation à venir)";
                }
            };

            // Result area
            const result = document.createElement("textarea");
            result.id = "fria-result-" + this.id;
            Object.assign(result.style, {
                width: "100%", minHeight: "50px", borderRadius: "4px",
                border: "1px solid #555", padding: "4px",
                background: "#1a1a1e", color: "#fff",
                fontSize: "11px", resize: "vertical", boxSizing: "border-box",
            });
            result.placeholder = "Résultat...";
            result.readOnly = true;

            // Assemble
            container.appendChild(tb);
            container.appendChild(list);
            container.appendChild(randRow);
            container.appendChild(genBtn);
            container.appendChild(result);

            // Add as custom widget
            this.addDOMWidget("elements_ui", "custom", container);

            return r;
        };
    }
});
