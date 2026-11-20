// The full system as layers (index.html, #system). Each layer on the left is one way the two models were wired; the
// drawing keeps the parts that layer uses, fades the others and relabels what was trained or frozen. Hovering,
// focusing or tapping a part opens a card with its details for the chosen layer. Layer contents: LAYERS, PARTS below.
(() => {
  const root = document.getElementById("system");
  const svg = root && root.querySelector("svg.lx-svg");
  if (!svg || !window.LX_DATA) return;
  const { PARTS, LAYERS } = window.LX_DATA;
  const NS = "http://www.w3.org/2000/svg";
  const stage = root.querySelector(".lx-stage");
  const nav = root.querySelector(".lx-nav");
  const pop = root.querySelector(".lx-pop");
  const head = root.querySelector(".lx-head");
  const sum = root.querySelector(".lx-sum");

  const el = (tag, attrs = {}, parent = null) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.append(node);
    return node;
  };
  const text = (parent, x, y, str, cls, anchor = "middle") => {
    const node = el("text", { x, y, "text-anchor": anchor, class: cls }, parent);
    node.textContent = str;
    return node;
  };

  /* ---------------- the drawing (viewBox 1000 x 650), in the style of the earlier static figure ---------------- */
  const defs = el("defs", {}, svg);
  for (const [id, cls, size] of [["lx-m-grey", "head-grey", 7], ["lx-m-fd", "head-fd", 6], ["lx-m-pi", "head-pi", 6]]) {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: size, markerHeight: size, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0.6 10 5 0 9.4z", class: cls }, m);
  }
  const parts = {};   // id -> <g>
  const status = {};  // id -> <text> whose words change with the layer
  const part = (id, parent = svg) => {
    const g = el("g", { "data-part": id, tabindex: 0, role: "button", "aria-label": PARTS[id] ? PARTS[id].name : id }, parent);
    parts[id] = g;
    return g;
  };
  const wire = (g, points, colour, thick = false, dashed = false) =>
    el("polyline", { points, class: `wire w-${colour}${thick ? " thick" : ""}${dashed ? " w-dash" : ""}`, "marker-end": `url(#lx-m-${colour})` }, g);
  const pills = (g, x, y, n, cls, step = 10) => { for (let k = 0; k < n; k++) el("rect", { x: x + k * step, y, width: 7, height: 16, rx: 2.5, class: `pill ${cls}` }, g); };
  // A block with a title of one or more lines and, when it has an id, a status line under it (frozen, trained, ...).
  const block = (g, x, y, w, h, cls, lines, id) => {
    el("rect", { x, y, width: w, height: h, rx: 9, class: `block ${cls}` }, g);
    const cx = x + w / 2, top = y + (h - lines.length * 19 - (id ? 15 : 0)) / 2 + 14;
    lines.forEach((line, k) => text(g, cx, top + k * 19, line, "t-block"));
    if (id) status[id] = text(g, cx, top + (lines.length - 1) * 19 + 17, "", "t-status");
  };
  const badge = (g, x, y, n) => { el("circle", { cx: x, cy: y, r: 12, class: "badge" }, g); text(g, x, y + 4.5, String(n), "t-badge"); };

  // the loop back from the vehicle
  const gLoop = part("loop");
  el("polyline", { points: "890,44 890,24 85,24 85,39", class: "wire w-grey", "marker-end": "url(#lx-m-grey)" }, gLoop);
  el("rect", { x: 300, y: 4, width: 380, height: 26, class: "lx-hit" }, gLoop);
  text(gLoop, 488, 15, "the vehicle moves: new images, new state", "t-lbl muted");

  // inputs
  const gCams = part("cams");
  text(gCams, 85, 56, "two cameras · 20 Hz", "t-lbl");
  [["assets/overview/cam_ee.jpg", 0], ["assets/overview/cam_body.jpg", 88]].forEach(([src, x], k) => {
    const clip = el("clipPath", { id: `lx-cam-${k}` }, defs);
    el("rect", { x, y: 62, width: 82, height: 82, rx: 8 }, clip);
    el("image", { href: src, x, y: 62, width: 82, height: 82, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#lx-cam-${k})` }, gCams);
    el("rect", { x, y: 62, width: 82, height: 82, rx: 8, class: "photo-edge" }, gCams);
  });
  const gState = part("state");
  el("rect", { x: 0, y: 162, width: 170, height: 48, rx: 9, class: "block in" }, gState);
  text(gState, 85, 181, "State · 120 Hz", "t-block");
  text(gState, 85, 199, "poses, velocities, joints", "t-state");
  const gInstr = part("instr");
  el("rect", { x: 0, y: 230, width: 170, height: 78, rx: 9, class: "block in" }, gInstr);
  text(gInstr, 85, 250, "INSTRUCTION", "t-caps");
  text(gInstr, 85, 272, "“pick the yellow lemon", "t-quote");
  text(gInstr, 85, 290, "and place it in the bin”", "t-quote");

  // FlightFlow
  const gFfBox = part("ffbox");
  el("rect", { x: 210, y: 36, width: 530, height: 294, rx: 16, class: "box fd" }, gFfBox);
  text(gFfBox, 230, 70, "FlightFlow", "t-title fd-ink", "start");
  status.ffbox = text(gFfBox, 722, 66, "", "t-status s-fd", "end");
  const gDino = part("dino");
  block(gDino, 230, 92, 130, 44, "frozen", ["DINOv2-S"], "dino");
  pills(gDino, 368, 106, 4, "p-grey");
  wire(gDino, "408,114 427,114", "grey");
  const gSenc = part("senc");
  block(gSenc, 230, 172, 130, 44, "fd-soft", ["State encoder"], "senc");
  pills(gSenc, 368, 186, 4, "p-fdsoft");
  wire(gSenc, "408,194 427,194", "grey");
  const gTask = part("task");
  block(gTask, 230, 252, 130, 44, "fd-soft", ["Task"], "task");
  pills(gTask, 368, 266, 1, "p-fdsoft");
  wire(gTask, "378,274 427,274", "grey");
  const gFmt = part("fmt");
  block(gFmt, 430, 92, 150, 204, "fd-core", ["Flow-matching", "transformer"], "fmt");
  status.fmt2 = text(gFmt, 505, 235, "", "t-status");
  status.fmt3 = text(gFmt, 505, 253, "", "t-status");
  badge(gFfBox, 230, 92, 1);
  badge(gFmt, 430, 92, 2);
  const gFc = part("fc");
  el("rect", { x: 600, y: 88, width: 126, height: 212, rx: 12, class: "msg" }, gFc);
  wire(gFc, "580,160 598,160", "fd");
  wire(gFc, "580,262 598,262", "fd");
  text(gFc, 663, 110, "THE FORECAST", "t-caps");
  const glyph = Array.from({ length: 11 }, (_, k) => [612 + k * 10.2, 196 - 40 * Math.pow(k / 10, 0.62)]);
  el("polyline", { points: glyph.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "), class: "fc-glyph" }, gFc);
  glyph.slice(1).forEach(([x, y]) => el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.2, class: "fc-dot" }, gFc));
  el("circle", { cx: 612, cy: 196, r: 4, class: "fc-now" }, gFc);
  text(gFc, 663, 222, "base path,", "t-lbl");
  text(gFc, 663, 238, "next 2.5 s", "t-lbl");
  el("rect", { x: 641, y: 254, width: 44, height: 18, rx: 4, class: "pill p-fd" }, gFc);
  text(gFc, 663, 267.5, "z", "t-z");
  text(gFc, 663, 290, "latent", "t-lbl");

  // π0.5
  const gPiBox = part("pibox");
  el("rect", { x: 210, y: 380, width: 530, height: 250, rx: 16, class: "box pi" }, gPiBox);
  text(gPiBox, 230, 414, "π0.5", "t-title pi-ink", "start");
  status.pibox = text(gPiBox, 292, 411, "", "t-status s-trained", "start");
  const gSig = part("siglip");
  block(gSig, 230, 440, 130, 44, "frozen", ["SigLIP"], "siglip");
  pills(gSig, 368, 454, 4, "p-grey");
  wire(gSig, "408,462 427,462", "grey");
  const gTxt = part("text");
  block(gTxt, 230, 520, 130, 44, "frozen", ["Text tokens"], "text");
  pills(gTxt, 368, 534, 4, "p-grey");
  wire(gTxt, "408,542 427,542", "grey");
  const gVlm = part("vlm");
  block(gVlm, 430, 440, 140, 124, "frozen", ["Gemma-2B", "VLM"], "vlm");
  wire(gVlm, "570,502 587,502", "grey");
  const gAx = part("ax");
  block(gAx, 590, 440, 136, 124, "pi-core", ["Action", "expert"], "ax");
  status.ax2 = text(gAx, 658, 542, "", "t-status");
  status.axnote = text(gAx, 578, 596, "", "t-tiny");

  // the two directions between the models
  const gTok = part("tok");
  wire(gTok, "663,300 663,410", "fd", true);
  pills(gTok, 608, 418, 11, "p-fd", 9);
  pills(gTok, 711, 418, 3, "p-pi", 9);
  el("rect", { x: 540, y: 300, width: 200, height: 136, class: "lx-hit" }, gTok);
  status.tok1 = text(gTok, 652, 351, "", "t-path fd", "end");
  status.tok2 = text(gTok, 652, 368, "", "t-path fd", "end");
  badge(gTok, 682, 356, 3);
  const gChunk = part("chunk");
  wire(gChunk, "597,438 597,394 470,394 470,298", "pi", true, true);
  el("rect", { x: 292, y: 334, width: 190, height: 52, class: "lx-hit" }, gChunk);
  el("rect", { x: 462, y: 386, width: 140, height: 16, class: "lx-hit" }, gChunk);
  status.chunk = text(gChunk, 460, 362, "", "t-path pi", "end");

  // the input wires (shared)
  const gIn = part("wires");
  wire(gIn, "170,114 228,114", "grey");
  wire(gIn, "212,114 212,462 228,462", "grey");
  el("circle", { cx: 212, cy: 114, r: 3, class: "dot-grey" }, gIn);
  wire(gIn, "170,194 228,194", "grey");
  wire(gIn, "170,274 228,274", "grey");
  wire(gIn, "196,274 196,542 228,542", "grey");
  el("circle", { cx: 196, cy: 274, r: 3, class: "dot-grey" }, gIn);

  // the vehicle, the controller and what each model sends it
  const gVeh = part("veh");
  const vclip = el("clipPath", { id: "lx-veh" }, defs);
  el("rect", { x: 780, y: 46, width: 220, height: 124, rx: 10 }, vclip);
  el("image", { href: "assets/overview/vehicle.jpg", x: 780, y: 46, width: 220, height: 124, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#lx-veh)" }, gVeh);
  el("rect", { x: 780, y: 46, width: 220, height: 124, rx: 10, class: "photo-edge" }, gVeh);
  el("rect", { x: 780, y: 142, width: 220, height: 28, class: "photo-band" }, gVeh);
  text(gVeh, 790, 161, "FA-Hexa: hexarotor + 4-DoF arm", "t-photo", "start");
  const gCtl = part("ctl");
  el("rect", { x: 780, y: 300, width: 220, height: 72, rx: 9, class: "block ctrl" }, gCtl);
  text(gCtl, 890, 331, "Inverse kinematics + PID", "t-block");
  status.ctl = text(gCtl, 890, 351, "", "t-state");
  badge(gCtl, 780, 300, 4);
  wire(gCtl, "986,298 986,174", "grey");
  text(gCtl, 976, 200, "rotor and joint", "t-lbl", "end");
  text(gCtl, 976, 216, "commands", "t-lbl", "end");
  const gBase = part("wbase");
  wire(gBase, "726,150 754,150 754,322 778,322", "fd", true);
  el("rect", { x: 740, y: 140, width: 30, height: 190, class: "lx-hit" }, gBase);
  status.wbase = text(gBase, 784, 268, "", "t-lbl", "start");
  status.wbase2 = text(gBase, 784, 284, "", "t-lbl", "start");
  const gHand = part("whand");
  wire(gHand, "726,502 754,502 754,350 778,350", "pi", true);
  el("rect", { x: 740, y: 340, width: 30, height: 175, class: "lx-hit" }, gHand);
  text(gHand, 784, 394, "the hand’s target pose", "t-lbl", "start");

  /* ---------------- layers ---------------- */
  let layer = null, hot = null;
  const buttons = LAYERS.map((L, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lx-layer";
    b.style.setProperty("--lc", L.colour);
    b.style.setProperty("--lc-soft", L.soft);
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="k">L${k + 1}</span><b></b><span class="s"></span>`;
    b.querySelector("b").textContent = L.name;
    b.querySelector(".s").textContent = L.sub;
    b.addEventListener("click", () => use(k));
    nav.insertBefore(b, nav.querySelector(".lx-hint"));
    return b;
  });
  const use = (k) => {
    layer = LAYERS[k];
    buttons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === k)));
    for (const [id, g] of Object.entries(parts)) {
      const s = (layer.parts && layer.parts[id]) || "on";
      g.classList.toggle("lx-dim", s === "dim");
      g.classList.toggle("lx-off", s === "off");
      g.classList.toggle("lx-flow", (layer.flow || []).includes(id));
      g.setAttribute("tabindex", s === "off" ? -1 : 0);
    }
    for (const [id, node] of Object.entries(status)) {
      const value = (layer.status && layer.status[id]) ?? "";
      const [words, tone] = Array.isArray(value) ? value : [value, ""];
      node.textContent = words;
      if (node.classList.contains("t-status")) {
        node.classList.toggle("s-trained", tone === "pi");
        node.classList.toggle("s-fd", tone === "fd");
      }
    }
    head.querySelector("b").textContent = layer.title;
    head.querySelector("span").textContent = layer.when;
    sum.innerHTML = layer.summary;
    if (hot) open(hot);
  };

  /* ---------------- the details card ---------------- */
  // A part's card for the chosen layer: the layer's text replaces the part's, its rows follow the part's. A part
  // the layer does not use says so and keeps only its general description.
  const card = (id) => {
    const base = PARTS[id] || { name: id };
    const unused = parts[id].classList.contains("lx-dim");
    const over = (!unused && layer.tips && layer.tips[id]) || {};
    return {
      name: over.name || base.name,
      text: (unused ? "Not used in this layer. " : "") + (over.text || base.text || ""),
      rows: unused ? [] : [...(base.rows || []), ...(over.rows || [])],
      src: over.src || base.src,
    };
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); // `code` in the data becomes <code>
  const open = (g) => {
    const id = g.dataset.part;
    const c = card(id);
    if (hot && hot !== g) hot.classList.remove("lx-hot");
    hot = g;
    g.classList.add("lx-hot");
    pop.style.setProperty("--tc", layer.colour);
    pop.innerHTML = `<span class="tag">${esc(layer.short)}</span><h4>${esc(c.name)}</h4>` +
      (c.text ? `<p>${fmt(c.text)}</p>` : "") +
      (c.rows.length ? `<dl>${c.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${fmt(v)}</dd>`).join("")}</dl>` : "") +
      (c.src ? `<div class="src">${fmt(c.src)}</div>` : "");
    pop.hidden = false;
    // beside the part, inside the stage: to its right, else to its left, else under it
    const s = stage.getBoundingClientRect(), r = g.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const fit = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    let x = r.right - s.left + 12, y = r.top - s.top;
    if (x + w > s.width) x = r.left - s.left - w - 12;
    if (x < 0) { x = fit(r.left - s.left, 0, s.width - w); y = r.bottom - s.top + 10; }
    y = fit(y, 0, Math.max(0, s.height - h));
    pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const close = () => {
    if (hot) hot.classList.remove("lx-hot");
    hot = null;
    pop.hidden = true;
  };
  svg.addEventListener("pointerover", (e) => {
    const g = e.target.closest("[data-part]");
    if (g && e.pointerType === "mouse") open(g);
  });
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") close(); });
  svg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-part]");
    if (!g) return close();
    if (hot === g && e.pointerType !== "mouse") close();
    else open(g);
  });
  svg.addEventListener("focusin", (e) => { const g = e.target.closest("[data-part]"); if (g) open(g); });
  svg.addEventListener("focusout", () => close());
  document.addEventListener("pointerdown", (e) => { if (hot && !svg.contains(e.target)) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  use(LAYERS.findIndex((L) => L.default) >= 0 ? LAYERS.findIndex((L) => L.default) : 0);
})();
