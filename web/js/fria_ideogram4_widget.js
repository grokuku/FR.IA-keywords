/**
 * FR.IA Ideogram 4 Caption Builder — Custom DOM widget for ComfyUI node.
 *
 * Pattern aligné sur fria_elements_widget.js (PROUVÉ FONCTIONNEL) :
 *   - Widgets natifs ComfyUI : seed, width, height (3 INT simples)
 *   - 2 widgets caches JSON : _ideogram4_data, _api_config
 *   - TOUT l'etat est dans les 2 JSON caches
 *   - Restauration via loadedGraphNode (appelé APRÈS restore des widgets)
 *   - Le DOM widget ne stocke PAS d'etat (getValue: () => "")
 *
 * Le DOM affiche : description, element_1..4, preset, style, generate, result.
 * Les valeurs sont syncées vers _ideogram4_data et _api_config pour que
 * Python puisse les lire.
 *
 * Sortie IMAGE (preview) generee cote Python : voir build_caption().
 */
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) { setTimeout(waitForApp, 100); return; }

    app.registerExtension({
        name: "FR.IA.Ideogram4",
        async beforeRegisterNodeDef(nodeType, nodeData) {
            if (nodeData.name !== "FRIAIdeogram4Node") return;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);
                const node = this;

                // ---- Masquer les widgets caches (pattern elements) ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        return w;
                    }
                    return null;
                };
                hideWidget(node, "_ideogram4_data");
                hideWidget(node, "_api_config");

                // ---- Utilitaires API ----
                const getApiUrl = () => "https://kw.holaf.fr/api";
                const getApiKey = () => {
                    try { return JSON.parse(localStorage.getItem("FRIA_config") || "{}").apiKey || ""; }
                    catch { return ""; }
                };
                const apiHeaders = () => {
                    const h = { "Content-Type": "application/json" };
                    const key = getApiKey();
                    if (key) h["Authorization"] = `Bearer ${key}`;
                    return h;
                };
                const apiGet = async (path) => {
                    const resp = await fetch(`${getApiUrl()}/${path.replace(/^\//, "")}`, { headers: apiHeaders() });
                    if (!resp.ok) return [];
                    return resp.json().catch(() => []);
                };
                const apiPost = async (path, body) => {
                    const resp = await fetch(`${getApiUrl()}/${path.replace(/^\//, "")}`, {
                        method: "POST", headers: apiHeaders(), body: JSON.stringify(body),
                    });
                    if (!resp.ok) { const t = await resp.text().catch(() => ""); throw new Error(`HTTP ${resp.status}: ${t.substring(0, 200)}`); }
                    return resp.json();
                };

                // ---- Cache ----
                const _cache = (window.__FRIA_cache = window.__FRIA_cache || { presets: 0, styles: 0 });
                const CACHE_TTL = 15000;

                async function populateSelect(select, apiPath, placeholder) {
                    select.innerHTML = `<option value="0">${placeholder}</option>`;
                    try {
                        const items = await apiGet(apiPath);
                        if (Array.isArray(items)) {
                            items.forEach(item => {
                                const o = document.createElement("option");
                                o.value = item.id;
                                o.textContent = item.name;
                                select.appendChild(o);
                            });
                        }
                    } catch {}
                }
                async function refreshIfStale(select, apiPath, cacheKey) {
                    const now = Date.now();
                    if (now - (_cache[cacheKey] || 0) < CACHE_TTL) return;
                    _cache[cacheKey] = now;
                    const oldVal = select.value;
                    await populateSelect(select, apiPath, select.options[0]?.textContent || "--");
                    if ([...select.options].some(o => o.value === oldVal)) select.value = oldVal;
                }

                // ========================================
                // DOM WIDGET (construction)
                // ========================================

                const container = document.createElement("div");
                Object.assign(container.style, {
                    width: "100%",
                    padding: "8px", boxSizing: "border-box",
                    background: "#2a2a2e", borderRadius: "8px",
                    display: "flex", flexDirection: "column", gap: "6px",
                    fontSize: "12px", color: "#ccc", overflow: "hidden",
                });

                function mkLabel(text) {
                    const l = document.createElement("label");
                    l.textContent = text;
                    l.style.cssText = "font-size:10px;color:#888;display:block;margin-bottom:2px;";
                    return l;
                }

                const inputStyle = {
                    width: "100%", padding: "4px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", boxSizing: "border-box",
                };

                // ---- Description ----
                const descArea = document.createElement("textarea");
                Object.assign(descArea.style, inputStyle, {
                    height: "60px", minHeight: "40px", resize: "vertical",
                });
                descArea.placeholder = "Description generale de la scene...";
                descArea.id = "fria-ideo-desc-" + node.id;
                container.appendChild(mkLabel("Description"));
                container.appendChild(descArea);

                // ---- Elements 1..4 ----
                const elemInputs = [];
                for (let i = 1; i <= 4; i++) {
                    const inp = document.createElement("input");
                    Object.assign(inp.style, inputStyle);
                    inp.type = "text";
                    inp.placeholder = `Element ${i} (optionnel)`;
                    inp.id = `fria-ideo-el${i}-${node.id}`;
                    container.appendChild(mkLabel(`Element ${i}`));
                    container.appendChild(inp);
                    elemInputs.push(inp);
                }

                // ---- Preset + Style (grille 2 col) ----
                const psRow = document.createElement("div");
                Object.assign(psRow.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });

                const presetDiv = document.createElement("div");
                const presetSelect = document.createElement("select");
                Object.assign(presetSelect.style, { width: "100%", padding: "3px 6px", borderRadius: "4px", border: "1px solid #555", background: "#3a3a3e", color: "#ccc", fontSize: "11px", cursor: "pointer" });
                presetSelect.addEventListener("mousedown", () => refreshIfStale(presetSelect, "presets", "presets"));
                presetDiv.appendChild(mkLabel("Preset IA"));
                presetDiv.appendChild(presetSelect);
                psRow.appendChild(presetDiv);

                const styleDiv = document.createElement("div");
                const styleSelect = document.createElement("select");
                Object.assign(styleSelect.style, { width: "100%", padding: "3px 6px", borderRadius: "4px", border: "1px solid #555", background: "#3a3a3e", color: "#ccc", fontSize: "11px", cursor: "pointer" });
                styleSelect.addEventListener("mousedown", () => refreshIfStale(styleSelect, "styles", "styles"));
                styleDiv.appendChild(mkLabel("Style"));
                styleDiv.appendChild(styleSelect);
                psRow.appendChild(styleDiv);
                container.appendChild(psRow);

                // ---- Generate bouton ----
                const generateBtn = document.createElement("button");
                generateBtn.textContent = "🔄  Generate Ideogram 4 caption";
                Object.assign(generateBtn.style, {
                    width: "100%", padding: "6px", borderRadius: "4px",
                    border: "none", background: "#6366f1", color: "white",
                    fontSize: "11px", fontWeight: "600", cursor: "pointer",
                    flex: "0 0 auto",
                });
                generateBtn.onmouseenter = () => generateBtn.style.background = "#5558e8";
                generateBtn.onmouseleave = () => generateBtn.style.background = "#6366f1";
                container.appendChild(generateBtn);

                // ---- Resultat ----
                const resultTextarea = document.createElement("textarea");
                Object.assign(resultTextarea.style, inputStyle, {
                    height: "180px", minHeight: "120px", maxHeight: "260px",
                    resize: "vertical",
                });
                resultTextarea.placeholder = "JSON caption Ideogram 4...";
                resultTextarea.readOnly = true;
                container.appendChild(mkLabel("Resultat"));
                container.appendChild(resultTextarea);

                // ---- Note preview ----
                const previewNote = document.createElement("div");
                Object.assign(previewNote.style, {
                    fontSize: "10px", color: "#888", textAlign: "center",
                    fontStyle: "italic", padding: "2px",
                });
                previewNote.textContent = "💡 La preview visuelle est dans la sortie IMAGE";
                container.appendChild(previewNote);

                // ---- Integration DOM Widget (pattern elements : simple, fiable) ----
                const domWidget = node.addDOMWidget("ideogram4_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                });
                domWidget.options = domWidget.options || {};
                domWidget.options.height = 480;

                // ---- Taille minimum ----
                const MIN_WIDTH = 340;
                const origOnResize = node.onResize;
                node.onResize = function (size) {
                    if (origOnResize) origOnResize.call(this, size);
                    if (size[0] < MIN_WIDTH) size[0] = MIN_WIDTH;
                };
                requestAnimationFrame(() => {
                    if (node.size && node.size[0] < MIN_WIDTH) {
                        node.setSize([MIN_WIDTH, node.size[1]]);
                    }
                });

                node._resultArea = resultTextarea;
                node._domWidget = domWidget;

                // ========================================
                // SYNC DOM → widgets caches (pattern elements)
                // ========================================

                function syncDataWidget() {
                    const w = node.widgets?.find(x => x.name === "_ideogram4_data");
                    if (!w) return;
                    w.value = JSON.stringify({
                        description: descArea.value,
                        elements: elemInputs.map(inp => inp.value),
                    });
                }

                function syncApiConfigWidget() {
                    const w = node.widgets?.find(x => x.name === "_api_config");
                    if (!w) return;
                    w.value = JSON.stringify({
                        api_url: getApiUrl(),
                        api_key: getApiKey(),
                        preset_id: parseInt(presetSelect.value) || 0,
                        style_id: parseInt(styleSelect.value) || 0,
                    });
                }

                // Chaque changement dans le DOM sync vers les widgets caches
                descArea.oninput = syncDataWidget;
                elemInputs.forEach(inp => { inp.oninput = syncDataWidget; });
                presetSelect.onchange = () => { syncApiConfigWidget(); };
                styleSelect.onchange = () => { syncApiConfigWidget(); };

                // ========================================
                // RESTORE : widgets caches → DOM
                // ========================================

                function restoreFromWidgets(n) {
                    let restored = false;

                    // Restaurer _ideogram4_data → description + elements
                    const dataW = n.widgets?.find(w => w.name === "_ideogram4_data");
                    if (dataW && dataW.value) {
                        try {
                            const data = JSON.parse(dataW.value);
                            if (data.description !== undefined) {
                                descArea.value = data.description || "";
                                restored = true;
                            }
                            if (Array.isArray(data.elements)) {
                                for (let i = 0; i < 4; i++) {
                                    elemInputs[i].value = data.elements[i] || "";
                                }
                                restored = true;
                            }
                        } catch {}
                    }

                    // Restaurer _api_config → preset + style
                    const cfgW = n.widgets?.find(w => w.name === "_api_config");
                    if (cfgW && cfgW.value) {
                        try {
                            const cfg = JSON.parse(cfgW.value);
                            if (cfg.preset_id > 0 && [...presetSelect.options].some(o => o.value === String(cfg.preset_id))) {
                                presetSelect.value = String(cfg.preset_id);
                                restored = true;
                            }
                            if (cfg.style_id > 0 && [...styleSelect.options].some(o => o.value === String(cfg.style_id))) {
                                styleSelect.value = String(cfg.style_id);
                                restored = true;
                            }
                        } catch {}
                    }

                    return restored;
                }

                // Stocker sur l'instance pour loadedGraphNode
                node._friaRestore = restoreFromWidgets.bind(null, node);

                // Peupler les dropdowns puis restaurer
                populateSelect(presetSelect, "presets", "-- Preset IA --")
                    .then(() => restoreFromWidgets(node));
                populateSelect(styleSelect, "styles", "-- Style --")
                    .then(() => restoreFromWidgets(node));

                // Sync initial
                syncDataWidget();
                syncApiConfigWidget();

                // ========================================
                // GENERATE
                // ========================================

                generateBtn.onclick = async () => {
                    const get = (name) => node.widgets?.find(w => w.name === name);
                    const seedW = get("seed");
                    const widthW = get("width");
                    const heightW = get("height");

                    const description = descArea.value.trim();
                    const elTexts = elemInputs.map(inp => inp.value.trim()).filter(Boolean);

                    const payload = {
                        text: description,
                        seed: parseInt(seedW?.value) > 0 ? parseInt(seedW.value) : null,
                        prompt_type: "ideogram4",
                        width: parseInt(widthW?.value) || 1024,
                        height: parseInt(heightW?.value) || 1024,
                        ep_elements: elTexts.map(t => ({ type: "text", text: t })),
                        preset_id: parseInt(presetSelect.value) || null,
                        style_id: parseInt(styleSelect.value) || null,
                    };

                    if (!description && elTexts.length === 0) {
                        resultTextarea.value = "Decris au moins la scene generale ou un element.";
                        return;
                    }

                    resultTextarea.value = "Generation en cours...";
                    try {
                        const data = await apiPost("enhance", payload);
                        resultTextarea.value = data.output || "";
                        syncDataWidget();
                        syncApiConfigWidget();
                    } catch (err) {
                        resultTextarea.value = "Erreur: " + err.message;
                    }
                };

                // ========================================
                // onExecuted (Python run completed, sur l'INSTANCE)
                // ========================================

                const origExec = node.onExecuted;
                node.onExecuted = function (output) {
                    if (origExec) origExec.call(this, output);
                    const arr = output?.prompt;
                    if (Array.isArray(arr) && arr.length > 0) {
                        resultTextarea.value = String(arr[0]);
                    }
                };

                return r;
            };
        },

        // Hook appelé APRÈS que ComfyUI a restauré les widgets depuis le workflow
        async loadedGraphNode(node) {
            if (node._friaRestore) {
                setTimeout(() => node._friaRestore(), 0);
            }
        },
    });
})();