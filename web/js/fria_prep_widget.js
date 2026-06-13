/**
 * FR.IA Prompt Prep — Custom DOM widget for ComfyUI node FRIAPromptPrepNode.
 *
 * Ce node est une version "découplée" du FR.IA Prompt Enhancer :
 *   - Il NE fait PAS d'appel LLM
 *   - Il sort 3 strings (llm_prompt, system_prompt, neg_prompt)
 *   - L'utilisateur branche son propre node LLM (LM Studio, Ollama, etc.)
 *
 * DOM widget simplifié :
 *   - 1 selecteur de Style (visuel, pratique) qui set le widget natif style_id
 *   - 1 bouton "↻" pour rafraichir la liste des styles
 *   - Pas de bouton "Test enhance", pas de textarea, pas de dropdown "Preset IA"
 *
 * Les widgets natifs ComfyUI (seed, base_prompt, special_instructions,
 * prompt_type, style_id, elements) sont restaurés automatiquement par
 * ComfyUI au rechargement de la page. Le DOM widget pilote juste
 * style_id (et le dropdown Prompt Type reste natif COMBO).
 *
 * api_key et server_url sont lus depuis ComfyUI/user/default/fria_credentials.json
 * (helper Python _credentials). Plus de widget STRING _api_config.
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

                // ---- Cacher le widget natif style_id (piloté par le DOM) ----
                const styleWidget = node.widgets?.find(x => x.name === "style_id");
                if (styleWidget) {
                    styleWidget.hidden = true;
                    styleWidget.computeSize = () => [0, -4];
                    if (styleWidget.inputEl) styleWidget.inputEl.style.display = "none";
                    if (styleWidget.parentEl) styleWidget.parentEl.style.display = "none";
                }

                // ---- Supprimer la socket d'entrée de style_id ----
                {
                    const slot = node.findInputSlot?.("style_id");
                    if (slot !== undefined && slot !== -1) {
                        node.removeInput(slot);
                    }
                }

                // ---- Cache de rafraîchissement ----
                const _cache = (window.__FRIA_cache = window.__FRIA_cache || { styles: 0 });
                const CACHE_TTL = 15000;

                // URL API pour recuperer la liste des styles
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

                function syncStyleWidget() {
                    if (styleWidget) {
                        styleWidget.value = parseInt(styleSelect.value) || 0;
                    }
                }

                // Restaurer la selection du style depuis le widget natif style_id
                // (restaure par ComfyUI au rechargement de la page)
                function restoreFromNativeWidget() {
                    if (!styleWidget) return false;
                    const sid = parseInt(styleWidget.value) || 0;
                    if (sid > 0 && [...styleSelect.options].some(o => o.value === String(sid))) {
                        styleSelect.value = String(sid);
                        return true;
                    }
                    return false;
                }

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

                // ---- Ligne : sélecteur de style ----
                const styleRow = document.createElement("div");
                Object.assign(styleRow.style, { display: "flex", gap: "4px", alignItems: "center" });

                const styleSelect = document.createElement("select");
                Object.assign(styleSelect.style, {
                    width: "100%", padding: "3px 6px", borderRadius: "4px",
                    border: "1px solid #555", background: "#3a3a3e",
                    color: "#ccc", fontSize: "11px", cursor: "pointer", flex: "1",
                });
                styleSelect.onchange = syncStyleWidget;
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

                container.appendChild(mkLabel("Style"));
                styleRow.appendChild(styleSelect);
                styleRow.appendChild(styleRefreshBtn);
                container.appendChild(styleRow);

                // Mini-explication
                const help = document.createElement("div");
                help.style.cssText = "font-size:10px;color:#777;margin-top:4px;line-height:1.4;";
                help.innerHTML = "Sort 3 strings : <b>llm_prompt</b>, <b>system_prompt</b>, <b>neg_prompt</b>.<br>Branchez votre node LLM sur les 2 premiers.";
                container.appendChild(help);

                // ---- Ajout au node ----
                const widget = node.addDOMWidget("FRIA_PromptPrep", "div", container, {
                    serialize: false,
                    hideOnZoom: false,
                });
                widget.computeSize = () => [node.size[0] - 20, 105];

                // ---- Initialisation ----
                populateStyleSelect().then(() => {
                    restoreFromNativeWidget();
                    syncStyleWidget();
                    // Retry si les options n'étaient pas encore chargées
                    let ra = 0;
                    function delayedRestore() {
                        if (restoreFromNativeWidget()) return;
                        if (++ra < 20) setTimeout(delayedRestore, 300);
                    }
                    setTimeout(delayedRestore, 100);
                });

                // ---- Resize au resize du node ----
                const onResize = node.onResize;
                node.onResize = function (size) {
                    const r = onResize?.apply(this, arguments);
                    widget.computeSize = () => [size[0] - 20, 105];
                    return r;
                };

                return r;
            };
        },
    });
})();
