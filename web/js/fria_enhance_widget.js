/**
 * FR.IA Prompt Enhancer — Custom DOM widget for ComfyUI node.
 *
 * Flux :
 *   - "Run" (workflow) : Python lit tous les widgets, appelle l'API
 *   - "Test enhance" : JS appelle l'API pour un aperçu instantané
 */
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) { setTimeout(waitForApp, 100); return; }

    app.registerExtension({
        name: "FR.IA.Enhance",
        async beforeRegisterNodeDef(nodeType, nodeData) {
            if (nodeData.name !== "FRIAEnhanceNode") return;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);
                const node = this;

                // ---- Cacher tous les widgets standards ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) { w.hidden = true; w.computeSize = () => [0, -4]; }
                };
                ["prompt_type", "output_format", "preset_id", "style_id",
                 "special_instructions", "elements", "_api_config"].forEach(
                    n => hideWidget(node, n)
                );

                // ---- Utilitaires ----
                const getApiUrl = () => "https://kw.holaf.fr/api";
                const getApiKey = () => {
                    try {
                        return JSON.parse(localStorage.getItem("FRIA_config") || "{}").apiKey || "";
                    } catch { return ""; }
                };
                const apiHeaders = () => {
                    const h = { "Content-Type": "application/json" };
                    const key = getApiKey();
                    if (key) h["Authorization"] = `Bearer ${key}`;
                    return h;
                };
                const apiCall = async (path, body) => {
                    const opts = { method: "POST", headers: apiHeaders() };
                    if (body) opts.body = JSON.stringify(body);
                    const resp = await fetch(`${getApiUrl()}/${path.replace(/^\//, "")}`, opts);
                    if (!resp.ok) {
                        const txt = await resp.text().catch(() => "");
                        throw new Error(`HTTP ${resp.status}: ${txt.substring(0, 200)}`);
                    }
                    return resp.json();
                };

                // ---- Sync widgets cachés ----
                function syncEnhanceWidget() {
                    const update = (name, val) => {
                        const w = node.widgets?.find(x => x.name === name);
                        if (w) w.value = val;
                    };
                    update("prompt_type", promptTypeSelect.value);
                    update("output_format", outputFormatSelect.value);
                    update("preset_id", parseInt(presetIdInput.value) || 0);
                    update("style_id", parseInt(styleIdInput.value) || 0);
                    update("special_instructions", specialInstrTextarea.value);

                    // API config
                    const apiW = node.widgets?.find(x => x.name === "_api_config");
                    if (apiW) apiW.value = JSON.stringify({
                        api_url: getApiUrl(),
                        api_key: getApiKey(),
                    });
                }

                // ---- Container ----
                const container = document.createElement("div");
                Object.assign(container.style, {
                    width: "100%", padding: "8px", boxSizing: "border-box",
                    background: "#2a2a2e", borderRadius: "8px",
                    display: "flex", flexDirection: "column", gap: "6px",
                    fontSize: "12px", color: "#ccc",
                });



                // 1. Grille 2x2 : [Preset IA | Type  ]
                //                   [Format    | Style ]
                const grid = document.createElement("div");
                Object.assign(grid.style, {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px",
                });

                function mkLabel(text) {
                    const l = document.createElement("label");
                    l.textContent = text;
                    l.style.cssText = "font-size:10px;color:#888;display:block;margin-bottom:2px;";
                    return l;
                }

                // Preset IA (top-left)
                const presetDiv = document.createElement("div");
                const presetIdInput = document.createElement("input");
                presetIdInput.type = "number";
                presetIdInput.min = 0; presetIdInput.max = 9999;
                presetIdInput.value = "0";
                Object.assign(presetIdInput.style, {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#1a1a1e",
                    color: "#fff", fontSize: "11px", textAlign: "center", boxSizing: "border-box",
                });
                presetIdInput.onchange = presetIdInput.oninput = syncEnhanceWidget;
                presetDiv.appendChild(mkLabel("Preset IA"));
                presetDiv.appendChild(presetIdInput);
                grid.appendChild(presetDiv);

                // Type (top-right)
                const promptTypeDiv = document.createElement("div");
                const promptTypeSelect = document.createElement("select");
                ["sdxl", "sd15", "flux", "anima", "qwen", "liste"].forEach(v => {
                    const o = document.createElement("option");
                    o.value = v; o.textContent = v;
                    promptTypeSelect.appendChild(o);
                });
                Object.assign(promptTypeSelect.style, {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e",
                    color: "#ccc", fontSize: "11px", cursor: "pointer",
                });
                promptTypeSelect.onchange = syncEnhanceWidget;
                promptTypeDiv.appendChild(mkLabel("Type"));
                promptTypeDiv.appendChild(promptTypeSelect);
                grid.appendChild(promptTypeDiv);

                // Format (bottom-left)
                const outputFormatDiv = document.createElement("div");
                const outputFormatSelect = document.createElement("select");
                ["text", "markdown", "json"].forEach(v => {
                    const o = document.createElement("option");
                    o.value = v; o.textContent = v;
                    outputFormatSelect.appendChild(o);
                });
                Object.assign(outputFormatSelect.style, {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e",
                    color: "#ccc", fontSize: "11px", cursor: "pointer",
                });
                outputFormatSelect.onchange = syncEnhanceWidget;
                outputFormatDiv.appendChild(mkLabel("Format"));
                outputFormatDiv.appendChild(outputFormatSelect);
                grid.appendChild(outputFormatDiv);

                // Style (bottom-right)
                const styleDiv = document.createElement("div");
                const styleIdInput = document.createElement("input");
                styleIdInput.type = "number";
                styleIdInput.min = 0; styleIdInput.max = 9999;
                styleIdInput.value = "0";
                Object.assign(styleIdInput.style, {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#1a1a1e",
                    color: "#fff", fontSize: "11px", textAlign: "center", boxSizing: "border-box",
                });
                styleIdInput.onchange = styleIdInput.oninput = syncEnhanceWidget;
                styleDiv.appendChild(mkLabel("Style"));
                styleDiv.appendChild(styleIdInput);
                grid.appendChild(styleDiv);

                container.appendChild(grid);

                // 4. Special instructions
                const specialInstrTextarea = document.createElement("textarea");
                Object.assign(specialInstrTextarea.style, {
                    width: "100%", height: "40px", minHeight: "40px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "none", boxSizing: "border-box",
                });
                specialInstrTextarea.placeholder = "Instructions spéciales (optionnel)...";
                specialInstrTextarea.onchange = specialInstrTextarea.oninput = syncEnhanceWidget;
                container.appendChild(specialInstrTextarea);

                // 5. Test enhance button
                const enhanceBtn = document.createElement("button");
                enhanceBtn.textContent = "🔄  Test enhance";
                Object.assign(enhanceBtn.style, {
                    width: "100%", padding: "6px", borderRadius: "4px",
                    border: "none", background: "#6366f1", color: "white",
                    fontSize: "11px", fontWeight: "600", cursor: "pointer",
                });
                enhanceBtn.onmouseenter = () => enhanceBtn.style.background = "#5558e8";
                enhanceBtn.onmouseleave = () => enhanceBtn.style.background = "#6366f1";

                enhanceBtn.onclick = async () => {
                    syncEnhanceWidget();

                    // Lire base_prompt et elements
                    const bpW = node.widgets?.find(w => w.name === "base_prompt");
                    const basePrompt = bpW?.value || "";
                    const elemsW = node.widgets?.find(w => w.name === "elements");
                    let elems = [];
                    try {
                        const parsed = JSON.parse(elemsW?.value || "[]");
                        if (Array.isArray(parsed)) elems = parsed;
                        else if (parsed?.elements && Array.isArray(parsed.elements)) elems = parsed.elements;
                    } catch {}

                    // Transformer les éléments en texte et les coller au prompt
                    function fmtElems(elist) {
                        return elist.map(e => {
                            if (e.type === "filter") return `[Filtre: ${e.name || `ID ${e.id}`}]`;
                            if (e.type === "text") return `[Recherche: ${e.text}]`;
                            if (e.type === "random") return "[Éléments aléatoires]";
                            return "";
                        }).filter(Boolean).join("\n");
                    }
                    const elemsText = fmtElems(elems);
                    const combinedText = elemsText ? elemsText + "\n\n" + basePrompt : basePrompt;

                    const hasElems = Array.isArray(elems) && elems.length > 0;
                    if (!basePrompt && !hasElems) {
                        resultTextarea.value = "Entrez un prompt de base ou connectez des éléments.";
                        return;
                    }

                    resultTextarea.value = "Génération en cours...";

                    const payload = {
                        text: combinedText,
                        prompt_type: promptTypeSelect.value,
                        output_format: outputFormatSelect.value,
                        preset_id: parseInt(presetIdInput.value) || null,
                        style_id: parseInt(styleIdInput.value) || null,
                        special_instructions: specialInstrTextarea.value,
                    };

                    try {
                        const data = await apiCall("enhance", payload);
                        const prompt = data.output || "";
                        if (node._resultArea) node._resultArea.value = prompt;
                        syncEnhanceWidget();
                    } catch (err) {
                        if (node._resultArea) node._resultArea.value = "Erreur: " + err.message;
                    }
                };
                container.appendChild(enhanceBtn);

                // 6. Result textarea
                const resultTextarea = document.createElement("textarea");
                Object.assign(resultTextarea.style, {
                    width: "100%", height: "54px", minHeight: "54px", maxHeight: "54px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "none", boxSizing: "border-box",
                });
                resultTextarea.placeholder = "Résultat...";
                resultTextarea.readOnly = true;
                container.appendChild(resultTextarea);

                // ---- Intégration DOM Widget ----
                const domWidget = node.addDOMWidget("enhance_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                });
                domWidget.options = domWidget.options || {};
                domWidget.options.height = 300;

                // Stocker les refs
                node._resultArea = resultTextarea;
                node._domWidget = domWidget;

                // ---- Restauration workflow ----
                function restoreFromWidgets(n) {
                    const read = (name) => n.widgets?.find(w => w.name === name);
                    try {
                        const pt = read("prompt_type");
                        if (pt && pt.value && promptTypeSelect.value !== pt.value) {
                            promptTypeSelect.value = pt.value;
                        }
                        const of = read("output_format");
                        if (of && of.value && outputFormatSelect.value !== of.value) {
                            outputFormatSelect.value = of.value;
                        }
                        const pi = read("preset_id");
                        if (pi && pi.value !== undefined && pi.value !== "") {
                            presetIdInput.value = pi.value;
                        }
                        const si = read("style_id");
                        if (si && si.value !== undefined && si.value !== "") {
                            styleIdInput.value = si.value;
                        }
                        const sp = read("special_instructions");
                        if (sp && sp.value && specialInstrTextarea.value !== sp.value) {
                            specialInstrTextarea.value = sp.value;
                        }
                        return true;
                    } catch { return false; }
                }

                node._friaRestore = restoreFromWidgets.bind(null, node);

                // Fallback : tente de restaurer périodiquement
                let restoreAttempts = 0;
                function delayedRestore() {
                    if (restoreFromWidgets(node)) return;
                    restoreAttempts++;
                    if (restoreAttempts < 20) {
                        setTimeout(delayedRestore, 300);
                    }
                }
                setTimeout(delayedRestore, 100);

                // ---- onExecuted SUR L'INSTANCE ----
                const origExec = node.onExecuted;
                node.onExecuted = function (output) {
                    if (origExec) origExec.call(this, output);

                    // Pattern HolafToText : output = ui dict
                    // {prompt: ["text"], model_used: ["model name"]}
                    const arr = output?.prompt;
                    if (Array.isArray(arr) && arr.length > 0) {
                        const text = String(arr[0]);
                        if (node._resultArea) {
                            node._resultArea.value = text;
                        }
                    }
                };

                // Sync initial
                syncEnhanceWidget();

                return r;
            };
        },
    });
})();
