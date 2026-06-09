/**
 * FR.IA Ideogram 4 Caption Builder — Widget ComfyUI
 *
 * Widgets natifs ComfyUI (visibles) : seed, width, height, description, element_1..4
 * Widget cache : _api_config (JSON interne)
 * DOM widget : preset IA, style, generate, resultat
 *
 * DIAGNOSTIC : ajoute un bouton "🔍 Debug" qui affiche dans la console
 * l'etat complet des widgets (nom, type, valeur) pour debugger la
 * serialisation.
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

                // ---- Masquer _api_config ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        return w;
                    }
                    return null;
                };
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
                // DIAGNOSTIC
                // ========================================

                function dumpWidgets() {
                    console.group(`%c[FR.IA] Node #${node.id} — Diagnostic widgets`, "font-weight:bold;color:#6366f1");
                    console.log("node.widgets.length =", node.widgets?.length);
                    console.log("node.inputs.length =", node.inputs?.length);
                    console.table(
                        (node.widgets || []).map((w, i) => ({
                            index: i,
                            name: w.name,
                            type: w.type,
                            value: typeof w.value === "string" ? w.value.substring(0, 80) + (w.value.length > 80 ? "..." : "") : w.value,
                            hidden: !!w.hidden,
                        }))
                    );
                    console.log("node.inputs:");
                    console.table(
                        (node.inputs || []).map((inp, i) => ({
                            index: i,
                            name: inp.name,
                            type: inp.type,
                            link: inp.link,
                        }))
                    );

                    // Lire le workflow serialise
                    try {
                        const graphData = app.graphToPrompt ? null : app.serialize?.();
                        if (graphData) {
                            const myNode = (graphData.nodes || []).find(n => n.id === node.id);
                            if (myNode) {
                                console.log("widgets_values (dans workflow):", JSON.stringify(myNode.widgets_values));
                            }
                        }
                    } catch {}

                    console.groupEnd();
                }

                // ========================================
                // DOM WIDGET : juste preset/style/generate/result/debug
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

                // ---- Preset + Style ----
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

                // ---- Generate ----
                const generateBtn = document.createElement("button");
                generateBtn.textContent = "🔄  Generate Ideogram 4 caption";
                Object.assign(generateBtn.style, {
                    width: "100%", padding: "6px", borderRadius: "4px",
                    border: "none", background: "#6366f1", color: "white",
                    fontSize: "11px", fontWeight: "600", cursor: "pointer",
                });
                generateBtn.onmouseenter = () => generateBtn.style.background = "#5558e8";
                generateBtn.onmouseleave = () => generateBtn.style.background = "#6366f1";
                container.appendChild(generateBtn);

                // ---- Resultat ----
                const resultTextarea = document.createElement("textarea");
                Object.assign(resultTextarea.style, {
                    width: "100%",
                    height: "160px", minHeight: "120px", maxHeight: "260px",
                    borderRadius: "4px", border: "1px solid #555",
                    padding: "4px", background: "#1a1a1e", color: "#fff",
                    fontSize: "11px", resize: "vertical", boxSizing: "border-box",
                });
                resultTextarea.placeholder = "JSON caption Ideogram 4...";
                resultTextarea.readOnly = true;
                container.appendChild(mkLabel("Resultat"));
                container.appendChild(resultTextarea);

                // ---- Debug bouton ----
                const debugBtn = document.createElement("button");
                debugBtn.textContent = "🔍 Debug widgets (console)";
                Object.assign(debugBtn.style, {
                    width: "100%", padding: "4px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e", color: "#ccc",
                    fontSize: "10px", cursor: "pointer",
                });
                debugBtn.onclick = () => dumpWidgets();
                container.appendChild(debugBtn);

                // ---- Preview note ----
                const previewNote = document.createElement("div");
                Object.assign(previewNote.style, {
                    fontSize: "10px", color: "#888", textAlign: "center",
                    fontStyle: "italic", padding: "2px",
                });
                previewNote.textContent = "💡 Preview visuelle = sortie IMAGE du node";
                container.appendChild(previewNote);

                // ---- Integration DOM Widget ----
                const domWidget = node.addDOMWidget("ideogram4_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                });
                domWidget.options = domWidget.options || {};
                domWidget.options.height = 320;

                const MIN_WIDTH = 340;
                const origOnResize = node.onResize;
                node.onResize = function (size) {
                    if (origOnResize) origOnResize.call(this, size);
                    if (size[0] < MIN_WIDTH) size[0] = MIN_WIDTH;
                };
                requestAnimationFrame(() => {
                    if (node.size && node.size[0] < MIN_WIDTH) node.setSize([MIN_WIDTH, node.size[1]]);
                });

                node._resultArea = resultTextarea;
                node._domWidget = domWidget;

                // ========================================
                // _api_config sync
                // ========================================

                function readApiConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a || !a.value) return { api_url: getApiUrl(), api_key: getApiKey(), preset_id: 0, style_id: 0 };
                    try { return { ...{ api_url: getApiUrl(), api_key: getApiKey(), preset_id: 0, style_id: 0 }, ...JSON.parse(a.value) }; }
                    catch { return { api_url: getApiUrl(), api_key: getApiKey(), preset_id: 0, style_id: 0 }; }
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
                // RESTORE
                // ========================================

                function restoreFromWidgets(n) {
                    let restored = false;
                    const cfg = readApiConfig();
                    try {
                        if (cfg.preset_id > 0 && [...presetSelect.options].some(o => o.value === String(cfg.preset_id))) {
                            presetSelect.value = String(cfg.preset_id);
                            restored = true;
                        }
                        if (cfg.style_id > 0 && [...styleSelect.options].some(o => o.value === String(cfg.style_id))) {
                            styleSelect.value = String(cfg.style_id);
                            restored = true;
                        }
                    } catch {}
                    return restored;
                }
                node._friaRestore = restoreFromWidgets.bind(null, node);

                populateSelect(presetSelect, "presets", "-- Preset IA --")
                    .then(() => restoreFromWidgets(node));
                populateSelect(styleSelect, "styles", "-- Style --")
                    .then(() => restoreFromWidgets(node));

                saveApiConfig();

                // ========================================
                // DIAGNOSTIC : intercepter onConfigure pour voir les valeurs entrantes
                // ========================================

                const origConfigure = node.onConfigure;
                node.onConfigure = function (info) {
                    if (origConfigure) origConfigure.call(this, info);
                    console.log(`%c[FR.IA] Node #${node.id} onConfigure`, "color:#f59e0b;font-weight:bold");
                    console.log("  widgets_values entrant:", JSON.stringify(info?.widgets_values));
                    console.table(
                        (info?.widgets_values || []).map((v, i) => ({
                            index: i,
                            value: typeof v === "string" ? v.substring(0, 60) + (v.length > 60 ? "..." : "") : v,
                        }))
                    );
                    // Log post-restore
                    setTimeout(() => {
                        console.log(`%c[FR.IA] Node #${node.id} post-restore:`, "color:#22c55e;font-weight:bold");
                        console.table(
                            (node.widgets || []).map((w, i) => ({
                                index: i,
                                name: w.name,
                                value: typeof w.value === "string" ? w.value.substring(0, 60) + (w.value.length > 60 ? "..." : "") : w.value,
                            }))
                        );
                    }, 50);
                };

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
                        resultTextarea.value = data.output || "";
                        saveApiConfig();
                    } catch (err) {
                        resultTextarea.value = "Erreur: " + err.message;
                    }
                };

                // ========================================
                // onExecuted
                // ========================================

                const origExec = node.onExecuted;
                node.onExecuted = function (output) {
                    if (origExec) origExec.call(this, output);
                    const arr = output?.prompt;
                    if (Array.isArray(arr) && arr.length > 0) {
                        resultTextarea.value = String(arr[0]);
                    }
                };

                // ---- Dump initial ----
                setTimeout(() => {
                    console.log(`%c[FR.IA] Node #${node.id} onNodeCreated (initial)`, "color:#06b6d4;font-weight:bold");
                    console.table(
                        (node.widgets || []).map((w, i) => ({
                            index: i,
                            name: w.name,
                            type: w.type,
                            value: typeof w.value === "string" ? w.value.substring(0, 60) + (w.value.length > 60 ? "..." : "") : w.value,
                            hidden: !!w.hidden,
                        }))
                    );
                }, 100);

                return r;
            };
        },

        async loadedGraphNode(node) {
            if (node._friaRestore) {
                setTimeout(() => {
                    node._friaRestore();
                    console.log(`%c[FR.IA] Node #${node.id} loadedGraphNode`, "color:#a855f7;font-weight:bold");
                    console.table(
                        (node.widgets || []).map((w, i) => ({
                            index: i,
                            name: w.name,
                            value: typeof w.value === "string" ? w.value.substring(0, 60) + (w.value.length > 60 ? "..." : "") : w.value,
                        }))
                    );
                }, 0);
            }
        },
    });
})();