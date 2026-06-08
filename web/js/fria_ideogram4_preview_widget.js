/**
 * FR.IA Ideogram 4 Preview — Affiche un template de l'image avec bounding boxes.
 *
 * Inputs : width, height, prompt (STRING = JSON caption Ideogram 4)
 * Output : prompt (pass-through pour chainage)
 *
 * Le widget dessine un cadre (ratio width:height) sur fond gris, et pour
 * chaque element du JSON, trace un rectangle a l'echelle avec le texte `desc`.
 */
(function waitForApp() {
    const app = window.app || window.comfyAPI?.app?.app;
    if (!app) { setTimeout(waitForApp, 100); return; }

    app.registerExtension({
        name: "FR.IA.Ideogram4Preview",
        async beforeRegisterNodeDef(nodeType, nodeData) {
            if (nodeData.name !== "FRIAIdeogram4PreviewNode") return;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated?.apply(this, arguments);
                const node = this;

                // Cacher les widgets standards (on n'en a pas besoin dans l'UI)
                const hideWidget = (n, name) => {
                    const w = n.widgets?.find(x => x.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, -4];
                        if (w.inputEl) w.inputEl.style.display = "none";
                        if (w.parentEl) w.parentEl.style.display = "none";
                    }
                };
                ["width", "height", "prompt"].forEach(n => hideWidget(node, n));

                // ---- Lecture des inputs depuis les widgets caches ----
                function readInputs() {
                    const read = (name) => node.widgets?.find(w => w.name === name);
                    return {
                        width: parseInt(read("width")?.value) || 1024,
                        height: parseInt(read("height")?.value) || 1024,
                        prompt: read("prompt")?.value || "",
                    };
                }

                // ---- Parse le JSON Ideogram 4 ----
                function parseCaption(raw) {
                    if (!raw || !raw.trim()) return null;
                    try {
                        // Le LLM peut mettre ```json ... ``` ou rien
                        let s = raw.trim();
                        const m = s.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
                        if (m) s = m[1];
                        return JSON.parse(s);
                    } catch (e) {
                        return null;
                    }
                }

                // ---- Container ----
                const container = document.createElement("div");
                Object.assign(container.style, {
                    width: "100%", height: "100%", padding: "8px", boxSizing: "border-box",
                    background: "#2a2a2e", borderRadius: "8px",
                    display: "flex", flexDirection: "column", gap: "6px",
                    fontSize: "12px", color: "#ccc", overflow: "hidden",
                });

                // ---- En-tete : dimensions ----
                const header = document.createElement("div");
                Object.assign(header.style, {
                    fontSize: "10px", color: "#888", display: "flex", justifyContent: "space-between",
                });
                container.appendChild(header);

                // ---- Zone canvas ----
                const canvasWrap = document.createElement("div");
                Object.assign(canvasWrap.style, {
                    flex: "1", minHeight: "200px", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "#1a1a1e", borderRadius: "4px", overflow: "hidden",
                });
                const canvas = document.createElement("canvas");
                Object.assign(canvas.style, {
                    maxWidth: "100%", maxHeight: "100%",
                    objectFit: "contain", display: "block",
                });
                canvasWrap.appendChild(canvas);
                container.appendChild(canvasWrap);

                // ---- Footer : nb d'elements + status ----
                const footer = document.createElement("div");
                Object.assign(footer.style, {
                    fontSize: "10px", color: "#888", textAlign: "center",
                });
                container.appendChild(footer);

                // ---- Dessin ----
                function draw() {
                    const { width, height, prompt } = readInputs();
                    header.innerHTML = `<span>Image: <b>${width}x${height}</b></span><span>${(width / Math.gcd(width, height))}:${(height / Math.gcd(width, height))}</span>`;

                    const caption = parseCaption(prompt);
                    if (!caption) {
                        // Dessiner un cadre vide
                        drawEmpty(width, height);
                        footer.textContent = "JSON invalide ou absent";
                        return;
                    }

                    const elements = caption?.compositional_deconstruction?.elements || [];
                    const background = caption?.compositional_deconstruction?.background || "";
                    const highLevel = caption?.high_level_description || "";
                    const palette = caption?.style_description?.color_palette || [];

                    if (elements.length === 0 && !background && !highLevel) {
                        drawEmpty(width, height);
                        footer.textContent = "JSON vide";
                        return;
                    }

                    drawFilled(width, height, elements, background, highLevel, palette);
                    footer.textContent = `${elements.length} element(s)`;
                }

                function drawEmpty(w, h) {
                    const ctx = canvas.getContext("2d");
                    const { cw, ch } = sizeCanvas(w, h);
                    ctx.fillStyle = "#1a1a1e";
                    ctx.fillRect(0, 0, cw, ch);
                    ctx.strokeStyle = "#555";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(1, 1, cw - 2, ch - 2);
                    ctx.fillStyle = "#555";
                    ctx.font = "12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("Aucune bbox a afficher", cw / 2, ch / 2);
                }

                function sizeCanvas(w, h) {
                    // Le canvas garde le ratio w:h, ajuste a la zone dispo
                    const wrap = canvasWrap;
                    const aw = wrap.clientWidth - 16;
                    const ah = wrap.clientHeight - 16;
                    if (aw <= 0 || ah <= 0) return { cw: 100, ch: 100 };
                    const r = w / h;
                    let cw, ch;
                    if (aw / ah > r) {
                        ch = ah;
                        cw = ch * r;
                    } else {
                        cw = aw;
                        ch = cw / r;
                    }
                    // Resize
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = cw * dpr;
                    canvas.height = ch * dpr;
                    canvas.style.width = cw + "px";
                    canvas.style.height = ch + "px";
                    const ctx = canvas.getContext("2d");
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    return { cw, ch };
                }

                function drawFilled(w, h, elements, background, highLevel, palette) {
                    const ctx = canvas.getContext("2d");
                    const { cw, ch } = sizeCanvas(w, h);

                    // Fond du canvas (gris sombre, comme dans le mockup)
                    ctx.fillStyle = "#2a2a2e";
                    ctx.fillRect(0, 0, cw, ch);

                    // Palette de couleurs vives (style mockup)
                    const colors = [
                        "#22d3ee", // cyan
                        "#84cc16", // lime
                        "#a855f7", // violet
                        "#eab308", // jaune
                        "#f97316", // orange
                        "#ec4899", // rose
                        "#06b6d4", // teal
                    ];

                    // Pour chaque element avec bbox, dessiner le rectangle
                    let drawn = 0;
                    elements.forEach((el, idx) => {
                        if (!el.bbox || !Array.isArray(el.bbox) || el.bbox.length !== 4) return;
                        drawn++;
                        const [yMin, xMin, yMax, xMax] = el.bbox;
                        const rx = xMin / 1000, ry = yMin / 1000;
                        const rw = (xMax - xMin) / 1000, rh = (yMax - yMin) / 1000;
                        const x = rx * cw, y = ry * ch;
                        const bw = rw * cw, bh = rh * ch;

                        const color = colors[idx % colors.length];

                        // Fond très transparent (pour qu'on devine le "fond" derriere)
                        ctx.fillStyle = hexToRgba(color, 0.08);
                        ctx.fillRect(x, y, bw, bh);

                        // Bordure fine
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);

                        // Pill d'index dans le coin haut-gauche
                        const idxLabel = String(idx + 1).padStart(2, "0");
                        ctx.font = "bold 11px monospace";
                        const pillW = Math.max(ctx.measureText(idxLabel).width + 10, 22);
                        const pillH = 16;
                        // Fond plein de la couleur
                        ctx.fillStyle = color;
                        ctx.fillRect(x, y, pillW, pillH);
                        // Texte noir sur la pill
                        ctx.fillStyle = "#000";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(idxLabel, x + pillW / 2, y + pillH / 2 + 0.5);

                        // Contenu textuel
                        const textX = x + 6;
                        const textY = y + pillH + 6;
                        const textW = bw - 12;
                        ctx.textAlign = "left";
                        ctx.textBaseline = "top";

                        if (el.type === "text" && el.text) {
                            // Type "text" : on affiche le texte a rendre en plus gros
                            ctx.fillStyle = color;
                            ctx.font = "bold 11px sans-serif";
                            wrapText(ctx, `"${el.text}"`, textX, textY, textW, 13, 2);
                            if (el.desc) {
                                ctx.fillStyle = "rgba(255,255,255,0.75)";
                                ctx.font = "10px sans-serif";
                                wrapText(ctx, el.desc, textX, textY + 30, textW, 12, 4);
                            }
                        } else if (el.desc) {
                            // Type "obj" : juste la description
                            ctx.fillStyle = "#fff";
                            ctx.font = "11px sans-serif";
                            wrapText(ctx, el.desc, textX, textY, textW, 13, 5);
                        }
                    });

                    // Barre de "background description" en bas
                    if (background) {
                        const bgH = Math.min(50, ch * 0.18);
                        const bgY = ch - bgH;
                        ctx.fillStyle = "rgba(0,0,0,0.7)";
                        ctx.fillRect(0, bgY, cw, bgH);
                        ctx.strokeStyle = "rgba(255,255,255,0.15)";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(0, bgY);
                        ctx.lineTo(cw, bgY);
                        ctx.stroke();
                        ctx.fillStyle = "rgba(255,255,255,0.5)";
                        ctx.font = "italic 9px sans-serif";
                        ctx.textAlign = "left";
                        ctx.textBaseline = "top";
                        wrapText(ctx, "BG: " + background, 6, bgY + 4, cw - 12, 11, 3);
                    }

                    // Si aucun element dessine, message
                    if (drawn === 0) {
                        ctx.fillStyle = "rgba(255,255,255,0.4)";
                        ctx.font = "12px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("(JSON valide, mais aucun element avec bbox)", cw / 2, ch / 2);
                    }
                }

                // Helper : texte wrap sur N lignes max
                function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
                    const words = text.split(/\s+/);
                    let line = "";
                    let yy = y;
                    let lines = 0;
                    for (let i = 0; i < words.length; i++) {
                        const test = line ? line + " " + words[i] : words[i];
                        if (ctx.measureText(test).width > maxW && line) {
                            ctx.fillText(line, x, yy);
                            line = words[i];
                            yy += lineH;
                            lines++;
                            if (lines >= maxLines) {
                                ctx.fillText(line + (i < words.length - 1 ? "..." : ""), x, yy);
                                return;
                            }
                        } else {
                            line = test;
                        }
                    }
                    if (line) ctx.fillText(line, x, yy);
                }

                function hexToRgba(hex, alpha) {
                    const h = hex.replace("#", "");
                    const r = parseInt(h.substring(0, 2), 16);
                    const g = parseInt(h.substring(2, 4), 16);
                    const b = parseInt(h.substring(4, 6), 16);
                    return `rgba(${r},${g},${b},${alpha})`;
                }

                // ---- Integration DOM Widget ----
                const domWidget = node.addDOMWidget("ideogram4_preview_ui", "custom", container, {
                    getValue: () => "",
                    setValue: (v) => {},
                    getMinHeight: () => 320,
                    getMaxHeight: () => 1200,
                });

                // ---- Redessiner quand la taille change ou quand les inputs changent ----
                function scheduleRedraw() {
                    clearTimeout(node._friaPreviewTimer);
                    node._friaPreviewTimer = setTimeout(draw, 50);
                }
                // Observer la zone pour redessiner quand le node est redimensionne
                const ro = new ResizeObserver(scheduleRedraw);
                ro.observe(canvasWrap);
                // Redessiner immediatement
                setTimeout(draw, 100);
                // Re-dessiner apres chaque modification des widgets caches
                // (ComfyUI ne previent pas le DOM widget, donc on poll periodiquement)
                setInterval(draw, 1000);

                // onExecuted : le prompt a peut-etre ete recalcule par Python
                const origExec = node.onExecuted;
                node.onExecuted = function (output) {
                    if (origExec) origExec.call(this, output);
                    // Forcer une relecture depuis les widgets
                    scheduleRedraw();
                };

                return r;
            };
        },
    });
})();
