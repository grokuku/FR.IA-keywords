/**
 * FR.IA Ideogram Parse — DOM widget for FRIAIdeogramParseNode.
 *
 * Le node Parse est minimal : il prend llm_response + context, appelle
 * le backend, sort le prompt + preview + validation_prompt.
 *
 * Le DOM widget ne sert qu'à synchroniser le widget caché _api_config
 * (api_url + api_key) avec le localStorage ComfyUI. Pas de dropdown,
 * pas de texte d'aide visible.
 */
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) { setTimeout(waitForApp, 100); return; }

    app.registerExtension({
        name: "FR.IA.IdeogramParse",
        async beforeRegisterNodeDef(nodeType, nodeData) {
            if (nodeData.name !== "FRIAIdeogramParseNode") return;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);
                const node = this;

                // ---- Cacher le widget _api_config (piloté par le DOM) ----
                const w = node.widgets?.find(x => x.name === "_api_config");
                if (w) {
                    w.hidden = true;
                    w.computeSize = () => [0, -4];
                    if (w.inputEl) w.inputEl.style.display = "none";
                    if (w.parentEl) w.parentEl.style.display = "none";
                }

                // ---- Supprimer la socket d'entrée de _api_config ----
                {
                    const slot = node.findInputSlot?.("_api_config");
                    if (slot !== undefined && slot !== -1) {
                        node.removeInput(slot);
                    }
                }

                // ---- Sync _api_config depuis localStorage ----
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

                function syncApiConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a) return;
                    a.value = JSON.stringify({
                        api_url: getApiUrl(),
                        api_key: getApiKey(),
                    });
                }

                // Sync initial + restauration depuis la valeur sérialisée
                function restoreFromConfig() {
                    const a = node.widgets?.find(x => x.name === "_api_config");
                    if (!a || !a.value || a.value === "{}") return false;
                    // On a déjà une valeur (sérialisée du workflow), on garde
                    // mais on s'assure que api_url pointe bien vers le serveur actuel
                    try {
                        const cfg = JSON.parse(a.value);
                        if (!cfg.api_url || cfg.api_url === "https://kw.holaf.fr/api") {
                            // Valeur par défaut : on ré-écrit avec localStorage
                            return false;
                        }
                        return true;
                    } catch { return false; }
                }

                restoreFromConfig();
                syncApiConfig();

                return r;
            };
        },
    });
})();
