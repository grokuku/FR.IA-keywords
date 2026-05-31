/**
 * FR.IA — Menu & Settings extension for ComfyUI.
 * Adds a [FR.IA] button to the menu bar with dropdown options.
 */

const STORAGE_KEY = "FRIA_config";

function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function setConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Wait for ComfyUI app to be available, then register
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) {
        setTimeout(waitForApp, 100);
        return;
    }

    app.registerExtension({
        name: "FR.IA.Menu",
        async setup() {
            setTimeout(initMenu, 50);
        }
    });
})();

function initMenu() {
    const menu = document.querySelector(".comfy-menu");
    if (!menu) {
        setTimeout(initMenu, 300);
        return;
    }

    // --- Bouton FR.IA ---
    const btn = document.createElement("button");
    btn.textContent = "FR.IA ▾";
    Object.assign(btn.style, {
        background: "#6366f1", color: "white", border: "none",
        padding: "4px 12px", borderRadius: "6px", cursor: "pointer",
        fontSize: "13px", fontWeight: "600", margin: "0 4px",
    });

    // --- Dropdown ---
    const dd = document.createElement("div");
    Object.assign(dd.style, {
        display: "none", position: "absolute", top: "100%", left: "0",
        background: "#2a2a2e", border: "1px solid #444", borderRadius: "8px",
        minWidth: "200px", zIndex: "9999", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    });

    const mkItem = (txt, icon, cb) => {
        const el = document.createElement("div");
        el.textContent = `${icon}  ${txt}`;
        Object.assign(el.style, {
            padding: "10px 16px", cursor: "pointer", fontSize: "13px",
            borderBottom: "1px solid #444",
        });
        el.onmouseenter = () => el.style.background = "#3a3a3e";
        el.onmouseleave = () => el.style.background = "";
        el.onclick = () => { cb(); dd.style.display = "none"; };
        return el;
    };

    dd.appendChild(mkItem("Open Webpage", "🌐", () => {
        const cfg = getConfig();
        window.open(cfg.serverUrl || "https://kw.holaf.fr", "_blank");
    }));

    const paramsItem = mkItem("Paramètres", "⚙️", () => openSettings());
    paramsItem.style.borderBottom = "none";
    dd.appendChild(paramsItem);

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { position: "relative", display: "inline-block" });
    wrapper.appendChild(btn);
    wrapper.appendChild(dd);

    btn.onclick = (e) => {
        e.stopPropagation();
        dd.style.display = dd.style.display === "none" ? "block" : "none";
    };
    document.addEventListener("click", () => dd.style.display = "none");

    menu.appendChild(wrapper);
    console.log("[FR.IA] Menu initialized");
}

function openSettings() {
    const cfg = getConfig();

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed", inset: "0", zIndex: "99999",
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center",
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
        background: "#2a2a2e", borderRadius: "12px", padding: "24px",
        width: "420px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
    });

    modal.innerHTML = `
        <h2 style="margin:0 0 16px; font-size:16px; color:#fff;">⚙️ Paramètres FR.IA</h2>

        <label style="display:block; margin-bottom:4px; font-size:12px; color:#aaa;">URL du serveur</label>
        <input id="fria-url" type="url" value="${cfg.serverUrl || 'https://kw.holaf.fr'}"
               style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid #555;
                      background:#1a1a1e; color:#fff; font-size:13px; margin-bottom:16px; box-sizing:border-box;">

        <label style="display:block; margin-bottom:4px; font-size:12px; color:#aaa;">Clé API</label>
        <input id="fria-key" type="password" value="${cfg.apiKey || ''}"
               style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid #555;
                      background:#1a1a1e; color:#fff; font-size:13px; margin-bottom:4px; box-sizing:border-box;">
        <p style="margin:0 0 16px; font-size:11px; color:#888;">
            Générez votre clé sur le site web → Settings → Clé API
        </p>

        <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button id="fria-cancel" style="padding:8px 16px; border-radius:6px; border:1px solid #555;
                   background:transparent; color:#ccc; cursor:pointer; font-size:13px;">Annuler</button>
            <button id="fria-save" style="padding:8px 16px; border-radius:6px; border:none;
                   background:#6366f1; color:white; cursor:pointer; font-size:13px; font-weight:600;">Sauvegarder</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById("fria-cancel").onclick = () => overlay.remove();
    document.getElementById("fria-save").onclick = () => {
        setConfig({
            serverUrl: document.getElementById("fria-url").value.trim(),
            apiKey: document.getElementById("fria-key").value.trim(),
        });
        overlay.remove();
    };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}
