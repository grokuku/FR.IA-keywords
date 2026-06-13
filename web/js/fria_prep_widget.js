/**
 * FR.IA Prompt Prep — Custom DOM widget for ComfyUI node FRIAPromptPrepNode.
 *
 * Ce node est une version "découplée" du FR.IA Prompt Enhancer :
 *   - Il NE fait PAS d'appel LLM
 *   - Il sort 3 strings (llm_prompt, system_prompt, neg_prompt)
 *   - L'utilisateur branche son propre node LLM (LM Studio, Ollama, etc.)
 *
 * DOM widget : grille 2 colonnes
 *   - Type (gauche) : valeurs fixes SDXL / SD1.5 / Flux / Anima / Qwen / Liste
 *   - Style (droite) : peuplé depuis /api/styles
 *   - Pas de bouton "Test enhance" (n'a plus de sens)
 *   - Pas de textarea de résultat (les sorties sont sur les sockets)
 *   - Pas de dropdown "Preset IA" (pas de preset_id dans ce node)
 *
 * Les widgets natifs ComfyUI (seed, base_prompt, special_instructions,
 * elements) restent visibles au-dessus/dessous de ce DOM widget.
 *
 * Le state (prompt_type + style_id + api_url + api_key) est stocké dans
 * _api_config (widget STRING caché, socket d'entrée supprimée).
 */
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) { setTimeout(waitForApp, 100); return; }

    app.registerExtension({
        name: "FR.IA.PromptPrep",
        async beforeRegisterNodeDef(nodeType, nodeData) {
            if (nodeData.name !== "FRIAPromptPrepNode") return;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);
                const node = this;

                // ---- Cacher le widget _api_config (piloté par le DOM) ----
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        if (w.inputEl) w.inputEl.style.display = "none";
                        if (w.parentEl) w.parentEl.style.display = "none";
                    }
                };
                hideWidget(node, "_api_config");

                // ---- Supprimer la socket d'entrée de _api_config ----
                {
                    const slot = node.findInputSlot?.("_api_config");
                    if (slot !== undefined && slot !== -1) {
                        node.removeInput(slot);
                    }
                }

                // ---- Utilitaires API ----
                const getApiUrl = () => {
                    try {
                        const cfg = JSON.parse(localStorage.getItem("FRIA_config") || "{}");
                        const base = (cfg.serverUrl || "https://kw.holaf.fr").replace(/\/+$/, "");
                        return base + "/api";
                    } catch {
                        return "https://kw.holaf.fr/api";
                    }
                };
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

                // ---- Sync _api_config (api_url + api_key + prompt_type + style_id) ----
                function syncPrepWidget() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a) return;
                    a.value = JSON.stringify({
                        api_url: getApiUrl(),
                        api_key: getApiKey(),
                        prompt_type: typeSelect.value,
                        style_id: parseInt(styleSelect.value) || 0,
                    });
                }

                // ---- Restauration depuis _api_config (au rechargement de la page) ----
                // Au refresh, ComfyUI restaure le widget STRING _api_config avec
                // sa valeur sérialisée dans le workflow. On la lit pour resélectionner
                // les bonnes options dans les <select> du DOM.
                function restoreFromConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a || !a.value) return false;
                    try {
                        const cfg = JSON.parse(a.value);
                        if (cfg.prompt_type && [...typeSelect.options].some(o => o.value === cfg.prompt_type)) {
                            typeSelect.value = cfg.prompt_type;
                        }
                        const sid = parseInt(cfg.style_id) || 0;
                        if (sid > 0 && [...styleSelect.options].some(o => o.value === String(sid))) {
                            styleSelect.value = String(sid);
                        }
                        return true;
                    } catch { return false; }
                }

                // ---- Cache de rafraîchissement intelligent ----
                const _cache = (window.__FRIA_cache = window.__FRIA_cache || { styles: 0 });
                const CACHE_TTL = 15000; // 15 secondes

                async function populateStyleSelect() {
                    styleSelect.innerHTML = `<option value="0">-- Style --</option>`;
                    try {
                        const items = await apiGet("styles");
                        if (Array.isArray(items)) {
                            items.forEach(item => {
                                const o = document.createElement("option");
                                o.value = item.id;
                                o.textContent = item.name;
                                styleSelect.appendChild(o);
                            });
                        }
                    } catch {}
                }

                async function refreshStylesIfStale() {
                    const now = Date.now();
                    if (now - (_cache.styles || 0) < CACHE_TTL) return;
                    _cache.styles = now;
                    const oldVal = styleSelect.value;
                    await populateStyleSelect();
                    if ([...styleSelect.options].some(o => o.value === oldVal)) {
                        styleSelect.value = oldVal;
                    }
                }

                // ---- Container (flex column) ----
                const container = document.createElement("div");
                Object.assign(container.style, {
                    width: "100%", padding: "8px", boxSizing: "border-box",
                    background: "#2a2a2e", borderRadius: "8px",
                    display: "flex", flexDirection: "column", gap: "6px",
                    fontSize: "12px", color: "#ccc", overflow: "hidden",
                });

                const mkLabel = (text) => {
                    const l = document.createElement("label");
                    l.textContent = text;
                    l.style.cssText = "font-size:10px;color:#888;display:block;margin-bottom:2px;";
                    return l;
                };

                // ---- Grille 2 colonnes (Type + Style) ----
                const grid = document.createElement("div");
                Object.assign(grid.style, {
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px",
                });

                const selectStyle = {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e",
                    color: "#ccc", fontSize: "11px", cursor: "pointer",
                };

                // Type (gauche) — valeurs fixes comme sur le site
                const typeDiv = document.createElement("div");
                const typeSelect = document.createElement("select");
                Object.assign(typeSelect.style, selectStyle);
                ["SDXL", "SD1.5", "Flux", "Anima", "Qwen", "Liste"].forEach(v => {
                    const o = document.createElement("option");
                    o.value = v.toLowerCase();
                    o.textContent = v;
                    typeSelect.appendChild(o);
                });
                typeSelect.value = "sdxl";
                typeSelect.onchange = syncPrepWidget;
                typeDiv.appendChild(mkLabel("Type"));
                typeDiv.appendChild(typeSelect);
                grid.appendChild(typeDiv);

                // Style (droite) — peuplé depuis /api/styles
                const styleDiv = document.createElement("div");
                const styleRow = document.createElement("div");
                Object.assign(styleRow.style, { display: "flex", gap: "4px", alignItems: "center" });
                const styleSelect = document.createElement("select");
                Object.assign(styleSelect.style, selectStyle);
                styleSelect.style.flex = "1";
                styleSelect.onchange = syncPrepWidget;
                styleSelect.dataset.filled = "false";
                styleSelect.addEventListener("mousedown", refreshStylesIfStale);
                const styleRefreshBtn = document.createElement("button");
                styleRefreshBtn.textContent = "↻";
                Object.assign(styleRefreshBtn.style, {
                    padding: "2px 5px", fontSize: "10px", cursor: "pointer",
                    border: "1px solid #555", borderRadius: "3px",
                    background: "#3a3a3e", color: "#aaa", flex: "0 0 auto",
                });
                styleRefreshBtn.title = "Rafraîchir la liste des styles";
                styleRefreshBtn.onclick = () => { _cache.styles = 0; refreshStylesIfStale(); };
                styleDiv.appendChild(mkLabel("Style"));
                styleRow.appendChild(styleSelect);
                styleRow.appendChild(styleRefreshBtn);
                styleDiv.appendChild(styleRow);
                grid.appendChild(styleDiv);

                container.appendChild(grid);

                // Mini-explication pour l'utilisateur
                const help = document.createElement("div");
                help.style.cssText = "font-size:10px;color:#777;margin-top:4px;line-height:1.4;";
                help.innerHTML = "Sort 3 strings : <b>llm_prompt</b>, <b>system_prompt</b>, <b>neg_prompt</b>.<br>Branchez votre node LLM sur les 2 premiers.";
                container.appendChild(help);

                // ---- Ajout au node ----
                const widget = node.addDOMWidget("FRIA_PromptPrep", "div", container, {
                    serialize: false,
                    hideOnZoom: false,
                });
                widget.computeSize = () => [node.size[0] - 20, 120];

                // ---- Initialisation ----
                // Au premier chargement, _api_config est "{}" → on initialise avec les
                // valeurs par défaut. Au rechargement d'un workflow sauvegardé,
                // _api_config contient la sélection précédente et restoreFromConfig
                // la restaure dans les <select>.
                populateStyleSelect().then(() => {
                    restoreFromConfig();
                    syncPrepWidget();
                    // Retry si les options n'étaient pas encore chargées
                    let ra = 0;
                    function delayedRestore() {
                        if (restoreFromConfig()) return;
                        if (++ra < 20) setTimeout(delayedRestore, 300);
                    }
                    setTimeout(delayedRestore, 100);
                });

                // ---- Resize au resize du node ----
                const onResize = node.onResize;
                node.onResize = function (size) {
                    const r = onResize?.apply(this, arguments);
                    widget.computeSize = () => [size[0] - 20, 120];
                    return r;
                };

                return r;
            };
        },
    });
})();
