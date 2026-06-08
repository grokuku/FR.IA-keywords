/**
 * FR.IA Ideogram 4 Caption Builder — Custom DOM widget for ComfyUI node.
 *
 * Layout :
 *   - Widgets ComfyUI NATIFS (visibles) : seed, width, height, description,
 *     element_1..4. Sauvegardes/restaures automatiquement par ComfyUI.
 *   - DOM widget custom (sous les widgets natifs) :
 *     - Preset IA + Style (grille 2 col)
 *     - Bouton Generate
 *     - Resultat (le JSON caption)
 *
 * Seul _api_config est cache (contient api_url, api_key, preset_id, style_id).
 * Plus de widgets preset_id/style_id separees -> pas de "points superposes"
 * sur la zone d'inputs du node.
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

                // ---- Cacher UNIQUEMENT _api_config ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        if (w.inputEl) w.inputEl.style.display = "none";
                        if (w.parentEl) w.parentEl.style.display = "none";
                    }
                };
                ["_api_config"].forEach(n => hideWidget(node, n));

                // ---- Utilitaires ----
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

                // ---- Cache de rafraichissement ----
                const _cache = (window.__FRIA_cache = window.__FRIA_cache || { presets: 0, styles: 0 });
                const CACHE_TTL = 15000;

                async function populateSelect(select, apiPath, labelKey, valKey, placeholder, onDone) {
                    select.innerHTML = `<option value="0">${placeholder}</option>`;
                    try {
                        const items = await apiGet(apiPath);
                        if (Array.isArray(items)) {
                            items.forEach(item => {
                                const o = document.createElement("option");
                                o.value = item[valKey || "id"];
                                o.textContent = item[labelKey || "name"];
                                select.appendChild(o);
                            });
                        }
                    } catch {}
                    onDone?.();
                }
                async function refreshIfStale(select, apiPath, cacheKey) {
                    const now = Date.now();
                    if (now - (_cache[cacheKey] || 0) < CACHE_TTL) return;
                    _cache[cacheKey] = now;
                    const oldVal = select.value;
                    await populateSelect(select, apiPath, "name", "id", select.options[0]?.textContent || "--", () => {
                        if ([...select.options].some(o => o.value === oldVal)) select.value = oldVal;
                    });
                }

                // ========================================
                // DOM WIDGET
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

                const selectStyle = {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e",
                    color: "#ccc", fontSize: "11px", cursor: "pointer",
                };

                // ---- 1. Preset + Style (grille 2 col) ----
                const psRow = document.createElement("div");
                Object.assign(psRow.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });

                const presetDiv = document.createElement("div");
                const presetSelect = document.createElement("select");
                Object.assign(presetSelect.style, selectStyle);
                presetSelect.addEventListener("mousedown", () => refreshIfStale(presetSelect, "presets", "presets"));
                presetDiv.appendChild(mkLabel("Preset IA"));
                presetDiv.appendChild(presetSelect);
                psRow.appendChild(presetDiv);

                const styleDiv = document.createElement("div");
                const styleSelect = document.createElement("select");
                Object.assign(styleSelect.style, selectStyle);
                styleSelect.addEventListener("mousedown", () => refreshIfStale(styleSelect, "styles", "styles"));
                styleDiv.appendChild(mkLabel("Style"));
                styleDiv.appendChild(styleSelect);
                psRow.appendChild(styleDiv);
                container.appendChild(psRow);

                // ---- 2. Bouton Generate ----
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

                // ---- 3. Resultat (textarea) ----
                const resultTextarea = document.createElement("textarea");
                Object.assign(resultTextarea.style, {
                    width: "100%",
                    height: "220px", minHeight: "220px", maxHeight: "220px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "none", boxSizing: "border-box",
                });
                resultTextarea.placeholder = "JSON caption Ideogram 4...";
                resultTextarea.readOnly = true;
                container.appendChild(mkLabel("Resultat (JSON caption)"));
                container.appendChild(resultTextarea);

                // ---- 4. Note preview ----
                const previewNote = document.createElement("div");
                Object.assign(previewNote.style, {
                    fontSize: "10px", color: "#888", textAlign: "center",
                    fontStyle: "italic", padding: "4px",
                });
                previewNote.textContent = "💡 La preview visuelle est dans la sortie IMAGE du node";
                container.appendChild(previewNote);

                // ---- Integration DOM Widget ----
                const domWidget = node.addDOMWidget("ideogram4_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                    getMinHeight: () => 320,
                    getMaxHeight: () => 800,
                });

                node._resultArea = resultTextarea;
                node._domWidget = domWidget;

                // ========================================
                // _api_config : tout en un (api_url, api_key, preset_id, style_id)
                // ========================================
                function readApiConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a || !a.value) {
                        return { api_url: getApiUrl(), api_key: getApiKey(), preset_id: 0, style_id: 0 };
                    }
                    try {
                        const parsed = JSON.parse(a.value);
                        return {
                            api_url: parsed.api_url || getApiUrl(),
                            api_key: parsed.api_key || getApiKey(),
                            preset_id: parsed.preset_id || 0,
                            style_id: parsed.style_id || 0,
                        };
                    } catch {
                        return { api_url: getApiUrl(), api_key: getApiKey(), preset_id: 0, style_id: 0 };
                    }
                }

                function saveApiConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a) return;
                    a.value = JSON.stringify({
                        api_url: getApiUrl(),
                        api_key: getApiKey(),
                        preset_id: parseInt(presetSelect.value) || 0,
                        style_id: parseInt(styleSelect.value) || 0,
                    });
                }

                presetSelect.onchange = saveApiConfig;
                styleSelect.onchange = saveApiConfig;

                // ========================================
                // RESTORE : _api_config → dropdowns
                // ========================================
                function restoreFromWidgets(n) {
                    const cfg = readApiConfig();
                    try {
                        if (cfg.preset_id > 0 && [...presetSelect.options].some(o => o.value === String(cfg.preset_id))) {
                            presetSelect.value = String(cfg.preset_id);
                        }
                        if (cfg.style_id > 0 && [...styleSelect.options].some(o => o.value === String(cfg.style_id))) {
                            styleSelect.value = String(cfg.style_id);
                        }
                        return true;
                    } catch { return false; }
                }
                node._friaRestore = restoreFromWidgets.bind(null, node);

                let ra = 0;
                function delayedRestore() {
                    if (restoreFromWidgets(node)) return;
                    if (++ra < 20) setTimeout(delayedRestore, 300);
                }
                setTimeout(delayedRestore, 100);

                // Peupler les dropdowns (apres init, restoreFromWidgets peut tourner)
                populateSelect(presetSelect, "presets", "name", "id", "-- Preset IA --",
                    () => {
                        restoreFromWidgets(node);
                        saveApiConfig();
                    });
                populateSelect(styleSelect, "styles", "name", "id", "-- Style --",
                    () => {
                        restoreFromWidgets(node);
                        saveApiConfig();
                    });

                // Init : sauvegarder l'api_config
                saveApiConfig();

                // ========================================
                // GENERATE
                // ========================================
                generateBtn.onclick = async () => {
                    const get = (name) => node.widgets?.find(w => w.name === name);
                    const description = (get("description")?.value || "").trim();
                    const elTexts = ["element_1", "element_2", "element_3", "element_4"]
                        .map(n => (get(n)?.value || "").trim())
                        .filter(Boolean);
                    const seedW = get("seed")?.value;
                    const widthW = get("width")?.value;
                    const heightW = get("height")?.value;

                    const payload = {
                        text: description,
                        seed: seedW > 0 ? seedW : null,
                        prompt_type: "ideogram4",
                        width: widthW || 1024,
                        height: heightW || 1024,
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
                        const prompt = data.output || "";
                        resultTextarea.value = prompt;
                        saveApiConfig();
                    } catch (err) {
                        resultTextarea.value = "Erreur: " + err.message;
                    }
                };

                // ========================================
                // onExecuted (Python run completed)
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
    });
})();
