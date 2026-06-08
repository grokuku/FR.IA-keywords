/**
 * FR.IA Ideogram 4 Caption Builder — Custom DOM widget for ComfyUI node.
 *
 * Flux :
 *   - "Run" (workflow) : Python lit tous les widgets, appelle l'API
 *   - "Generate" : JS appelle l'API pour un aperçu instantané
 *
 * Inputs : seed, width, height, description, element_1..4, preset_id, style_id
 * Output : prompt (STRING) = JSON caption Ideogram 4
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

                // ---- Cacher les widgets standards ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        if (w.inputEl) w.inputEl.style.display = "none";
                        if (w.parentEl) w.parentEl.style.display = "none";
                    }
                };
                ["seed", "width", "height", "description",
                 "element_1", "element_2", "element_3", "element_4",
                 "preset_id", "style_id", "_api_config"].forEach(
                    n => hideWidget(node, n)
                );

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

                // ---- Sync widgets caches (le Python les lira) ----
                function syncIdeogram4Widget() {
                    const set = (name, val) => {
                        const w = node.widgets?.find(x => x.name === name);
                        if (w) w.value = val;
                    };
                    set("seed", parseInt(seedInput.value) || 0);
                    set("width", parseInt(widthInput.value) || 1024);
                    set("height", parseInt(heightInput.value) || 1024);
                    set("description", descTextarea.value);
                    set("element_1", elem1.value);
                    set("element_2", elem2.value);
                    set("element_3", elem3.value);
                    set("element_4", elem4.value);
                    set("preset_id", parseInt(presetSelect.value) || 0);
                    set("style_id", parseInt(styleSelect.value) || 0);
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (a) a.value = JSON.stringify({ api_url: getApiUrl(), api_key: getApiKey() });
                }

                // ---- Cache de rafraîchissement intelligent ----
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

                // ---- Container ----
                const container = document.createElement("div");
                Object.assign(container.style, {
                    width: "100%", height: "100%", padding: "8px", boxSizing: "border-box",
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

                // ---- 1. Dimensions + Seed (ligne compacte) ----
                const dimRow = document.createElement("div");
                Object.assign(dimRow.style, {
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px",
                });

                function mkNumberInput(label, defVal, min, max) {
                    const wrap = document.createElement("div");
                    const inp = document.createElement("input");
                    inp.type = "number"; inp.value = defVal;
                    if (min != null) inp.min = min;
                    if (max != null) inp.max = max;
                    Object.assign(inp.style, {
                        width: "100%", padding: "3px 6px", borderRadius: "4px",
                        border: "1px solid #555", background: "#1a1a1e",
                        color: "#fff", fontSize: "11px", boxSizing: "border-box",
                    });
                    inp.onchange = inp.oninput = syncIdeogram4Widget;
                    wrap.appendChild(mkLabel(label));
                    wrap.appendChild(inp);
                    return { wrap, inp };
                }

                const { inp: seedInput } = mkNumberInput("Seed", 0, 0);
                const { inp: widthInput } = mkNumberInput("Width", 1024, 64, 4096);
                const { inp: heightInput } = mkNumberInput("Height", 1024, 64, 4096);
                dimRow.appendChild(seedInput.parentElement);
                dimRow.appendChild(widthInput.parentElement);
                dimRow.appendChild(heightInput.parentElement);
                container.appendChild(dimRow);

                // ---- 2. Preset + Style (ligne compacte) ----
                const psRow = document.createElement("div");
                Object.assign(psRow.style, {
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px",
                });

                // Preset
                const presetDiv = document.createElement("div");
                const presetSelect = document.createElement("select");
                Object.assign(presetSelect.style, selectStyle);
                presetSelect.onchange = syncIdeogram4Widget;
                presetSelect.dataset.filled = "false";
                presetSelect.addEventListener("mousedown", () => refreshIfStale(presetSelect, "presets", "presets"));
                presetDiv.appendChild(mkLabel("Preset IA"));
                presetDiv.appendChild(presetSelect);
                psRow.appendChild(presetDiv);

                // Style
                const styleDiv = document.createElement("div");
                const styleSelect = document.createElement("select");
                Object.assign(styleSelect.style, selectStyle);
                styleSelect.onchange = syncIdeogram4Widget;
                styleSelect.dataset.filled = "false";
                styleSelect.addEventListener("mousedown", () => refreshIfStale(styleSelect, "styles", "styles"));
                styleDiv.appendChild(mkLabel("Style"));
                styleDiv.appendChild(styleSelect);
                psRow.appendChild(styleDiv);
                container.appendChild(psRow);

                // ---- 3. Description generale (textarea) ----
                const descTextarea = document.createElement("textarea");
                Object.assign(descTextarea.style, {
                    width: "100%", height: "60px", minHeight: "60px", maxHeight: "60px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "none", boxSizing: "border-box",
                });
                descTextarea.placeholder = "Description generale (style, decor, lumiere, ambiance...)";
                descTextarea.onchange = descTextarea.oninput = syncIdeogram4Widget;
                container.appendChild(mkLabel("Description generale"));
                container.appendChild(descTextarea);

                // ---- 4. 4 Elements ----
                const elemLabels = ["Element 1 (sujet principal)", "Element 2", "Element 3", "Element 4"];
                const elemPlaceholders = [
                    "ex: une jeune barista aux cheveux boucles",
                    "ex: une tasse en porcelaine avec latte art",
                    "ex: une machine a espresso en laiton",
                    "ex: un comptoir en bois",
                ];
                const elems = [elem1, elem2, elem3, elem4] = [];
                for (let i = 0; i < 4; i++) {
                    container.appendChild(mkLabel(elemLabels[i]));
                    const ta = document.createElement("textarea");
                    Object.assign(ta.style, {
                        width: "100%", height: "40px", minHeight: "40px", maxHeight: "40px",
                        borderRadius: "4px", border: "1px solid #555",
                        padding: "4px", background: "#1a1a1e", color: "#fff",
                        fontSize: "11px", resize: "none", boxSizing: "border-box",
                    });
                    ta.placeholder = elemPlaceholders[i];
                    ta.onchange = ta.oninput = syncIdeogram4Widget;
                    container.appendChild(ta);
                    elems.push(ta);
                }

                // ---- 5. Bouton Generate ----
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
                generateBtn.onclick = async () => {
                    syncIdeogram4Widget();
                    const payload = {
                        text: descTextarea.value,
                        seed: parseInt(seedInput.value) || null,
                        prompt_type: "ideogram4",
                        width: parseInt(widthInput.value) || 1024,
                        height: parseInt(heightInput.value) || 1024,
                        ep_elements: elems
                            .filter(e => e.value.trim())
                            .map(e => ({ type: "text", text: e.value.trim() })),
                        preset_id: parseInt(presetSelect.value) || null,
                        style_id: parseInt(styleSelect.value) || null,
                    };
                    if (!descTextarea.value.trim() && payload.ep_elements.length === 0) {
                        resultTextarea.value = "Decris au moins la scene generale ou un element.";
                        return;
                    }
                    resultTextarea.value = "Generation en cours...";
                    try {
                        const data = await apiPost("enhance", payload);
                        const prompt = data.output || "";
                        if (node._resultArea) node._resultArea.value = prompt;
                        syncIdeogram4Widget();
                    } catch (err) {
                        if (node._resultArea) node._resultArea.value = "Erreur: " + err.message;
                    }
                };
                container.appendChild(generateBtn);

                // ---- 6. Resultat (remplit l'espace) ----
                const resultTextarea = document.createElement("textarea");
                Object.assign(resultTextarea.style, {
                    width: "100%", flex: "1", minHeight: "40px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "none", boxSizing: "border-box",
                });
                resultTextarea.placeholder = "JSON caption Ideogram 4...";
                resultTextarea.readOnly = true;
                container.appendChild(resultTextarea);

                // ---- Integration DOM Widget ----
                const domWidget = node.addDOMWidget("ideogram4_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                    getMinHeight: () => 420,
                    getMaxHeight: () => 1500,
                });

                node._resultArea = resultTextarea;
                node._domWidget = domWidget;

                // Peupler les dropdowns
                populateSelect(presetSelect, "presets", "name", "id", "-- Preset IA --",
                    () => restoreFromWidgets(node));
                populateSelect(styleSelect, "styles", "name", "id", "-- Style --",
                    () => restoreFromWidgets(node));

                // Restauration workflow
                function restoreFromWidgets(n) {
                    const read = (name) => n.widgets?.find(w => w.name === name);
                    try {
                        const sd = read("seed"); if (sd && sd.value) seedInput.value = sd.value;
                        const w = read("width"); if (w && w.value) widthInput.value = w.value;
                        const h = read("height"); if (h && h.value) heightInput.value = h.value;
                        const d = read("description"); if (d && d.value) descTextarea.value = d.value;
                        const e1 = read("element_1"); if (e1 && e1.value) elems[0].value = e1.value;
                        const e2 = read("element_2"); if (e2 && e2.value) elems[1].value = e2.value;
                        const e3 = read("element_3"); if (e3 && e3.value) elems[2].value = e3.value;
                        const e4 = read("element_4"); if (e4 && e4.value) elems[3].value = e4.value;
                        const p = read("preset_id");
                        if (p && p.value > 0 && [...presetSelect.options].some(o => o.value === String(p.value))) {
                            presetSelect.value = String(p.value);
                        }
                        const s = read("style_id");
                        if (s && s.value > 0 && [...styleSelect.options].some(o => o.value === String(s.value))) {
                            styleSelect.value = String(s.value);
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

                // onExecuted : le Python a appele l'API et a recupere un prompt
                const origExec = node.onExecuted;
                node.onExecuted = function (output) {
                    if (origExec) origExec.call(this, output);
                    const arr = output?.prompt;
                    if (Array.isArray(arr) && arr.length > 0 && node._resultArea) {
                        node._resultArea.value = String(arr[0]);
                    }
                };

                syncIdeogram4Widget();
                return r;
            };
        },
    });
})();
