// The idea, one step at a time: the concept figure under the overview's first paragraph (index.html, #concept).
// A five-step player: each step lights its part of the drawing and animates what happens there. Press play, use the
// step buttons, or click a step's name or a part of the drawing. With "reduce motion" set nothing moves by itself and
// the steps change without animation.
(() => {
  const fig = document.getElementById("concept");
  const svg = fig && fig.querySelector("svg.cx-svg");
  if (!svg) return;
  const say = fig.querySelector(".cx-say");
  const ind = fig.querySelector(".cx-ind");
  const tabs = [...fig.querySelectorAll(".cx-tabs [data-go]")];
  const button = (act) => fig.querySelector(`[data-act="${act}"]`);
  const bPrev = button("prev"), bPlay = button("play"), bNext = button("next"), bReset = button("reset");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches;
  const NS = "http://www.w3.org/2000/svg";

  /* ---------------- helpers ---------------- */
  const el = (tag, attrs = {}, parent = null) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.append(node);
    return node;
  };
  const write = (parent, x, y, str, cls, attrs = {}) => {
    const node = el("text", { x, y, class: cls, ...attrs }, parent);
    node.textContent = str;
    return node;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, f) => a + (b - a) * f;
  const n1 = (v) => v.toFixed(1);
  const show = (node, on) => { node.style.display = on ? "" : "none"; };
  const fade = (node, a) => { node.setAttribute("opacity", a.toFixed(3)); show(node, a > 0.001); };
  const pts = (list) => list.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ");
  // Paths are point lists, so that any of them can be drawn part of the way, and things can travel along them.
  const track = (points) => {
    const len = [0];
    for (let k = 1; k < points.length; k++) {
      len.push(len[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
    }
    return { points, len, total: len[len.length - 1] };
  };
  const at = (tr, f) => { // the point at fraction f of the length, and the direction there
    const d = clamp(f) * tr.total;
    let k = 1;
    while (k < tr.len.length - 1 && tr.len[k] < d) k++;
    const [x0, y0] = tr.points[k - 1], [x1, y1] = tr.points[k];
    const u = (d - tr.len[k - 1]) / (tr.len[k] - tr.len[k - 1] || 1);
    return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, Math.atan2(y1 - y0, x1 - x0)];
  };
  const part = (tr, a, b) => {
    const out = [at(tr, a).slice(0, 2)];
    const da = a * tr.total, db = b * tr.total;
    for (let k = 1; k < tr.points.length - 1; k++) if (tr.len[k] > da && tr.len[k] < db) out.push(tr.points[k]);
    out.push(at(tr, b).slice(0, 2));
    return out;
  };
  const cubic = (p0, p1, p2, p3, n = 48) => {
    const out = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, v = 1 - u;
      out.push([0, 1].map((i) => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]));
    }
    return out;
  };
  const random = (seed) => () => { // mulberry32: the same "noise" on every visit
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  const defs = el("defs", {}, svg);
  const HEAD = "M0 0L-10 -5L-10 5Z";
  // A dashed connector that can be drawn part of the way; its arrowhead rides on the drawing tip.
  const connector = (parent, points, colour, now, head = true) => {
    const g = el("g", { class: `cx-conn cx-c-${colour}`, "data-now": now }, parent);
    const line = el("polyline", { class: "cx-line", points: "" }, g);
    const tip = head ? el("path", { class: "cx-head", d: HEAD }, g) : null;
    const tr = track(points);
    return {
      set(f) {
        show(g, f > 0);
        if (f <= 0) return;
        const end = tip ? Math.max(0.001, f - 6 / tr.total) : f;
        line.setAttribute("points", pts(part(tr, 0, end)));
        if (tip) {
          const [x, y, a] = at(tr, f);
          tip.setAttribute("transform", `translate(${n1(x)} ${n1(y)}) rotate(${n1((a * 180) / Math.PI)})`);
        }
      },
    };
  };
  // A label in a box. A chip with `fit` grows or shrinks to its text once the fonts are in, keeping its left edge.
  const chips = [];
  const chip = (parent, x, y, w, h, str, cls = "", attrs = {}, fit = false) => {
    const g = el("g", { class: `cx-chip ${cls}`, ...attrs }, parent);
    const box = el("rect", { x, y, width: w, height: h, rx: 6 }, g);
    const label = write(g, x + w / 2, y + h / 2 + 4, str, "", { "text-anchor": "middle" });
    if (fit) chips.push({ box, label, x });
    return g;
  };
  const fitChips = () => {
    for (const { box, label, x } of chips) {
      const w = label.getComputedTextLength();
      if (!w) continue;
      box.setAttribute("width", n1(w + 24));
      label.setAttribute("x", n1(x + (w + 24) / 2));
    }
  };
  const hit = (parent, go, name, attrs = {}) =>
    el("g", { class: "cx-hit", "data-go": go, tabindex: 0, role: "button", "aria-label": `Step ${go + 1}: ${name}`, ...attrs }, parent);

  /* ---------------- the drawing (viewBox 1160 x 556) ---------------- */
  write(svg, 0, 14, "SEE", "cx-col");
  write(svg, 196, 14, "THINK", "cx-col");
  write(svg, 744, 14, "MOVE", "cx-col");

  // See: the two cameras, the task and the flight state
  const gSee = hit(svg, 1, "the inputs", { class: "cx-hit cx-see", "data-from": 1, "data-now": "1" });
  [["assets/overview/cam_body.jpg", 30, "body camera"], ["assets/overview/cam_ee.jpg", 188, "wrist camera"]].forEach(([src, y, name], k) => {
    const clip = el("clipPath", { id: `cx-cam-${k}` }, defs);
    el("rect", { x: 0, y, width: 130, height: 130, rx: 7 }, clip);
    el("image", { href: src, x: 0, y, width: 130, height: 130, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#cx-cam-${k})` }, gSee);
    el("rect", { class: "cx-photo-edge", x: 0.5, y: y + 0.5, width: 129, height: 129, rx: 7 }, gSee);
    write(gSee, 0, y + 146, name, "cx-cap");
  });
  chip(gSee, 0, 348, 130, 26, "“harvest lemon”");
  chip(gSee, 0, 384, 130, 26, "flight state");

  // Think, top: π0.5, with what it learned from
  const gPi = hit(svg, 1, "keep π0.5 for the arm");
  el("rect", { class: "cx-block pi", x: 196, y: 36, width: 452, height: 250, rx: 14, "data-now": "0 1 3" }, gPi);
  write(gPi, 216, 70, "π0.5", "cx-name pi-ink");
  write(gPi, 216, 90, "pretrained vision-language-action model", "cx-sub");
  write(gPi, 216, 118, "LEARNED FROM", "cx-mini");
  const planToks = [];
  for (let k = 0; k < 8; k++) {
    const x = 312 + 29 * k;
    planToks.push({ node: el("rect", { class: "cx-tok pi", x, y: 214, width: 24, height: 24, rx: 5 }, gPi), cx: x + 12, cy: 226 });
  }
  const planLab = write(gPi, 425, 258, "hand plan", "cx-lab pi-ink", { "text-anchor": "middle" });

  const gDeck = hit(svg, 0, "what VLAs know", { "data-now": "0" });
  const card = (x, y, kind) => {
    const g = el("g", {}, gDeck);
    el("rect", { class: `cx-card ${kind}`, x, y, width: 46, height: 32, rx: 4 }, g);
    const d = kind === "arm"
      ? `M${x + 7} ${y + 26}h11M${x + 12.5} ${y + 26}V${y + 13}L${x + 27} ${y + 9}M${x + 32} ${y + 5}L${x + 27} ${y + 9}L${x + 32} ${y + 13}M${x + 33} ${y + 27}h7v-6h-7z`
      : `M${x + 8} ${y + 12}H${x + 38}M${x + 5} ${y + 8}h8M${x + 33} ${y + 8}h8M${x + 18} ${y + 12}v5h10v-5M${x + 27} ${y + 17}l5 5l5 -2`;
    el("path", { class: `cx-picto ${kind}`, d }, g);
    return g;
  };
  const armCards = [], airCards = [];
  for (let k = 9; k >= 0; k--) armCards.push(card(216 + 8 * k, 158 - 3 * k, "arm")); // back to front
  for (let k = 1; k >= 0; k--) airCards.push(card(452 + 8 * k, 158 - 3 * k, "air"));
  const armLab = el("g", {}, gDeck);
  write(armLab, 346, 160, "arm data", "cx-deck-lab");
  write(armLab, 346, 177, "plentiful", "cx-deck-sub");
  const airLab = el("g", {}, gDeck);
  write(airLab, 518, 160, "aerial data", "cx-deck-lab");
  write(airLab, 518, 177, "scarce", "cx-deck-sub");

  // the forecast's place in π0.5: three slots in front of the hand plan
  const gSlots = hit(svg, 3, "share the forecast");
  const slots = [0, 1, 2].map((k) => el("rect", { class: "cx-slot", x: 216 + 29 * k, y: 214, width: 24, height: 24, rx: 5 }, gSlots));
  write(gSlots, 257, 258, "forecast", "cx-lab fd-ink", { "text-anchor": "middle" });

  // Think, bottom: FlightFlow and its forecast
  const gFf = hit(svg, 2, "learn flight", { "data-from": 2 });
  el("rect", { class: "cx-block fd", x: 196, y: 362, width: 152, height: 104, rx: 12, "data-now": "2" }, gFf);
  write(gFf, 212, 394, "FlightFlow", "cx-name sm fd-ink");
  write(gFf, 212, 415, "small model", "cx-sub");
  write(gFf, 212, 432, "flow matching", "cx-sub");
  el("rect", { class: "cx-plot", x: 368, y: 340, width: 280, height: 160, rx: 10 }, gFf);
  write(gFf, 382, 360, "BASE PATH", "cx-mini");
  write(gFf, 634, 360, "noise → paths", "cx-tick", { "text-anchor": "end" });
  el("line", { class: "cx-axis", x1: 384, x2: 632, y1: 476, y2: 476 }, gFf);
  write(gFf, 384, 492, "now", "cx-tick");
  write(gFf, 632, 492, "ahead", "cx-tick", { "text-anchor": "end" });
  const meanAt = (u) => [392 + 232 * u, 452 - 70 * u * u * (3 - 2 * u)];
  const meanTr = track(Array.from({ length: 41 }, (_, k) => meanAt(k / 40)));
  const rnd = random(7);
  const samples = [-16, -10, -5, 0, 5, 10, 16].map((off, k) => {
    const wig = [4, -5, 3, -2, 5, -4, 2][k];
    const goal = [], noise = [];
    for (let j = 0; j < 18; j++) {
      const u = j / 17, [x, y] = meanAt(u);
      goal.push([x, y + off * Math.pow(u, 1.4) + wig * Math.sin(Math.PI * u)]);
      noise.push([x + (rnd() - 0.5) * 10, 352 + rnd() * 118]);
    }
    return { node: el("polyline", { class: "cx-sample", points: pts(goal) }, gFf), goal, noise };
  });
  const mean = el("polyline", { class: "cx-mean", points: "" }, gFf);
  el("circle", { class: "cx-now-dot", cx: 392, cy: 452, r: 4.5 }, gFf);
  const wayAt = [1 / 3, 2 / 3, 1].map((u) => meanAt(u));
  const wps = wayAt.map(([x, y]) => el("circle", { class: "cx-wp", cx: n1(x), cy: n1(y), r: 4.5 }, gFf));

  // connectors
  const gConn = el("g", {}, svg);
  const inputs = [
    [[130, 95], [166, 95]], [[130, 253], [166, 253]], [[130, 361], [166, 361]], [[130, 397], [166, 397]], [[166, 95], [166, 414]],
  ].map((p) => connector(gConn, p, "grey", "1 4", false));
  inputs.push(connector(gConn, [[166, 160], [194, 160]], "grey", "1 4"));
  const toFf = connector(gConn, [[166, 414], [194, 414]], "grey", "2 4");
  const toPlot = connector(gConn, [[348, 414], [366, 414]], "fd", "2");
  const hand = connector(gConn, [[648, 226], [742, 226]], "pi", "1 4");
  const handLab = write(gConn, 695, 216, "hand target", "cx-lab pi-ink", { "text-anchor": "middle" });
  const base = connector(gConn, [[648, 420], [742, 420]], "fd", "2 4");
  const baseLab = write(gConn, 695, 410, "base path", "cx-lab fd-ink", { "text-anchor": "middle" });
  const tokPath = cubic([452, 338], [452, 312], [262, 318], [257, 290], 40);
  const tok = connector(gConn, tokPath, "fd", "3");
  const tokLab = write(gConn, 466, 326, "forecast as tokens", "cx-lab fd-ink");
  const loop = connector(gConn, [[952, 520], [952, 540], [65, 540], [65, 414]], "grey", "4");
  const loopLab = el("g", {}, gConn);
  el("rect", { class: "cx-labbg", x: 362, y: 532, width: 292, height: 16 }, loopLab);
  write(loopLab, 508, 544, "new camera frames · both models plan again", "cx-cap", { "text-anchor": "middle" });

  // Move: one vehicle, a wall of lemons
  const S = [858, 430], E = [964, 316], T = [1080, 262], WR = [1068, 262];
  const flightTr = track(cubic(S, [868, 360], [905, 316], E, 60));
  const gMove = hit(svg, 4, "fly together");
  el("rect", { class: "cx-scene", x: 744, y: 26, width: 416, height: 494, rx: 14, "data-now": "4" }, gMove);
  const sceneClip = el("clipPath", { id: "cx-scene-clip" }, defs);
  el("rect", { x: 744, y: 26, width: 416, height: 494, rx: 14 }, sceneClip);
  const world = el("g", { "clip-path": "url(#cx-scene-clip)" }, gMove);
  el("rect", { class: "cx-ground", x: 744, y: 494, width: 416, height: 26 }, world);
  el("rect", { class: "cx-wall", x: 1088, y: 64, width: 80, height: 430 }, world);
  for (let r = 0; r < 21; r++) {
    const y = 64 + r * 20.5;
    if (r) el("line", { class: "cx-brick", x1: 1088, x2: 1168, y1: n1(y), y2: n1(y) }, world);
    for (let x = 1088 + (r % 2 ? 20 : 40); x < 1168; x += 40) el("line", { class: "cx-brick", x1: x, x2: x, y1: n1(y), y2: n1(y + 20.5) }, world);
  }
  for (const [x, y, r] of [[1081, 172, 6.5], [1082, 214, 6], [T[0], T[1], 9], [1082, 318, 6.5], [1081, 356, 6]]) {
    el("ellipse", { class: "cx-lemon", cx: x, cy: y, rx: r * 1.15, ry: r * 0.92 }, world);
  }
  chip(gMove, 760, 40, 196, 26, "one controller · flies both", "cx-ctl", { "data-from": 4, "data-now": "4" }, true);
  const scenePath = el("polyline", { class: "cx-scenepath", points: "" }, gMove);
  const sceneWps = [1 / 3, 2 / 3].map((f) => {
    const [x, y] = at(flightTr, f);
    return el("circle", { class: "cx-wp", cx: n1(x), cy: n1(y), r: 4 }, gMove);
  });
  const rotorsAt = [-58, -20, 20, 58];
  const ghost = el("g", { class: "cx-ghost", transform: `translate(${E[0]} ${E[1]})` }, gMove);
  el("line", { x1: -58, x2: 58, y1: -16, y2: -16 }, ghost);
  el("rect", { x: -28, y: -13, width: 56, height: 25, rx: 8 }, ghost);
  for (const x of rotorsAt) el("ellipse", { cx: x, cy: -23, rx: 17, ry: 2.6 }, ghost);
  const cross = el("g", { transform: `translate(${T[0]} ${T[1]})` }, gMove);
  el("circle", { class: "cx-cross-halo", r: 17 }, cross);
  el("circle", { class: "cx-cross", r: 15 }, cross);
  el("path", { class: "cx-cross", d: "M-23 0H-17M17 0H23M0 -23V-17M0 17V23" }, cross);
  el("circle", { class: "cx-pulse", r: 15 }, cross);
  const veh = el("g", { class: "cx-veh" }, gMove);
  const bob = el("g", { class: "cx-bob" }, veh);
  el("path", { class: "cx-leg", d: "M-16 12L-24 28M16 12L24 28M-30 28H-18M18 28H30" }, bob);
  for (const x of rotorsAt) {
    el("line", { class: "cx-mast", x1: x, x2: x, y1: -16, y2: -21 }, bob);
    el("ellipse", { class: "cx-rotor", cx: x, cy: -23, rx: 17, ry: 2.6 }, bob);
  }
  el("line", { class: "cx-rotorbar", x1: -58, x2: 58, y1: -16, y2: -16 }, bob);
  el("rect", { class: "cx-body", x: -28, y: -13, width: 56, height: 25, rx: 8 }, bob);
  el("rect", { class: "cx-cam", x: 20, y: 1, width: 9, height: 8, rx: 2 }, bob);
  const link = el("polyline", { class: "cx-link", points: "" }, bob);
  const grip = el("path", { class: "cx-grip", d: "" }, bob);
  const SH = [4, -18];
  el("circle", { class: "cx-joint", cx: SH[0], cy: SH[1], r: 4 }, bob);
  const elbow = el("circle", { class: "cx-joint", r: 4 }, bob);

  // tokens that carry the forecast from FlightFlow into π0.5
  const gFly = el("g", { "aria-hidden": "true" }, svg);
  const flyers = wayAt.map(([x, y], k) => {
    const node = el("g", {}, gFly);
    el("rect", { class: "cx-tok fd", x: -10, y: -10, width: 20, height: 20, rx: 4 }, node);
    return { node, tr: track([[x, y], ...tokPath, [228 + 29 * k, 226]]) };
  });

  /* ---------------- the arm: two links, solved for the wrist (elbow up) ---------------- */
  const L1 = 62, L2 = 70, FOLD = [50, -20], FIN = [WR[0] - E[0] - SH[0], WR[1] - E[1] - SH[1]];
  const OPEN = 0.45, SHUT = -0.12;
  const pose = (reach, closed) => {
    const hx = lerp(FOLD[0], FIN[0], reach), hy = lerp(FOLD[1], FIN[1], reach);
    const a = Math.atan2(hy, hx);
    const d = clamp(Math.hypot(hx, hy), Math.abs(L1 - L2) + 1, L1 + L2 - 1);
    const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const e = [SH[0] + L1 * Math.cos(a - b), SH[1] + L1 * Math.sin(a - b)];
    const w = [SH[0] + d * Math.cos(a), SH[1] + d * Math.sin(a)];
    link.setAttribute("points", pts([SH, e, w]));
    elbow.setAttribute("cx", n1(e[0]));
    elbow.setAttribute("cy", n1(e[1]));
    const ux = (w[0] - e[0]) / L2, uy = (w[1] - e[1]) / L2, nx = -uy, ny = ux;
    const th = lerp(OPEN, SHUT, closed), c = Math.cos(th), s = Math.sin(th);
    const p1 = [w[0] + 6 * nx, w[1] + 6 * ny], p2 = [w[0] - 6 * nx, w[1] - 6 * ny];
    const t1 = [p1[0] + 13 * (ux * c + nx * s), p1[1] + 13 * (uy * c + ny * s)];
    const t2 = [p2[0] + 13 * (ux * c - nx * s), p2[1] + 13 * (uy * c - ny * s)];
    grip.setAttribute("d", `M${pts([t1])}L${pts([p1])}L${pts([p2])}L${pts([t2])}`);
  };

  /* ---------------- the five steps ---------------- */
  // Each step owns some parts of the drawing and draws them at progress t (0: not yet, 1: done). The vehicle's state
  // is shared between steps 3 and 5 and drawn once per frame from `shared`.
  const shared = { reveal: 0, ghost: 0, flight: 0, reach: 0, grip: 0 };
  const STEPS = [
    {
      dur: 2600,
      line: "Robot-arm demonstrations are plentiful, and vision-language-action models such as π0.5 have learned from them. Demonstrations of an arm on a flying vehicle are scarce.",
      draw(t) {
        armCards.forEach((g, k) => {
          const p = easeOut(seg(t, 0.04 + k * 0.055, 0.24 + k * 0.055));
          g.setAttribute("transform", `translate(0 ${n1(-16 * (1 - p))})`);
          fade(g, p);
        });
        fade(armLab, seg(t, 0.5, 0.66));
        airCards.forEach((g, k) => {
          const p = easeOut(seg(t, 0.68 + k * 0.08, 0.86 + k * 0.08));
          g.setAttribute("transform", `translate(0 ${n1(-16 * (1 - p))})`);
          fade(g, p);
        });
        fade(airLab, seg(t, 0.84, 1));
      },
    },
    {
      dur: 3000,
      line: "So we keep π0.5 for the arm. It reads the two cameras and the task, and decides where the hand should go.",
      draw(t) {
        for (const c of inputs) c.set(seg(t, 0, 0.3));
        planToks.forEach(({ node, cx, cy }, k) => {
          const p = easeOut(seg(t, 0.28 + k * 0.035, 0.42 + k * 0.035));
          node.setAttribute("transform", `translate(${cx} ${cy}) scale(${(0.4 + 0.6 * p).toFixed(3)}) translate(${-cx} ${-cy})`);
          fade(node, p);
        });
        fade(planLab, seg(t, 0.45, 0.6));
        hand.set(seg(t, 0.58, 0.8));
        fade(handLab, seg(t, 0.66, 0.8));
        const c = easeOut(seg(t, 0.78, 1));
        fade(cross, c);
        cross.setAttribute("transform", `translate(${T[0]} ${T[1]}) scale(${(1.7 - 0.7 * c).toFixed(3)})`);
        veh.classList.toggle("is-pi", t >= 0.8);
      },
    },
    {
      dur: 4200,
      line: "What π0.5 never learned is how the vehicle flies. FlightFlow, a small model, learns that from our demonstrations: by flow matching, it turns noise into a forecast of the base’s path.",
      draw(t) {
        toFf.set(seg(t, 0, 0.14));
        toPlot.set(seg(t, 0.08, 0.16));
        const m = ease(seg(t, 0.16, 0.56));
        for (const s of samples) {
          s.node.setAttribute("points", pts(s.noise.map((p, j) => [lerp(p[0], s.goal[j][0], m), lerp(p[1], s.goal[j][1], m)])));
          fade(s.node, seg(t, 0.14, 0.2) * lerp(0.75, 0.32, seg(t, 0.56, 0.68)));
        }
        const mm = seg(t, 0.56, 0.7);
        show(mean, mm > 0);
        if (mm > 0) mean.setAttribute("points", pts(part(meanTr, 0, mm)));
        wps.forEach((w, k) => fade(w, seg(t, 0.62 + 0.03 * k, 0.68 + 0.03 * k)));
        base.set(seg(t, 0.7, 0.84));
        fade(baseLab, seg(t, 0.76, 0.86));
        shared.reveal = ease(seg(t, 0.8, 0.98));
        shared.ghost = seg(t, 0.9, 1);
        veh.classList.toggle("is-fd", t >= 0.8);
      },
    },
    {
      dur: 3200,
      line: "The forecast reaches π0.5 as a few extra tokens, so π0.5 plans the hand with the base’s path in view.",
      draw(t) {
        fade(gSlots, seg(t, 0, 0.12));
        tok.set(seg(t, 0.05, 0.3));
        fade(tokLab, seg(t, 0.18, 0.3));
        flyers.forEach(({ node, tr }, k) => {
          const s = ease(seg(t, 0.25 + 0.15 * k, 0.63 + 0.15 * k));
          show(node, s > 0 && s < 1);
          if (s > 0 && s < 1) {
            const [x, y] = at(tr, s);
            node.setAttribute("transform", `translate(${n1(x)} ${n1(y)})`);
          }
          slots[k].classList.toggle("is-full", s >= 1);
        });
      },
    },
    {
      dur: 4600,
      line: "One controller flies both: the hand goes to π0.5’s target, and the base follows FlightFlow’s path. The cameras see the new scene, and both models plan again.",
      draw(t) {
        shared.flight = ease(seg(t, 0, 0.72));
        shared.reach = ease(seg(t, 0.25, 0.8));
        shared.grip = ease(seg(t, 0.8, 0.9));
        cross.classList.toggle("is-hit", t >= 0.9);
        loop.set(seg(t, 0.86, 1));
        fade(loopLab, seg(t, 0.9, 1));
      },
    },
  ];
  const LAST = STEPS.length - 1;

  const paint = (i, t) => {
    STEPS.forEach((s, k) => s.draw(k < i ? 1 : k > i ? 0 : t));
    const a = shared.flight, b = shared.reveal;
    show(scenePath, b > a + 0.002);
    if (b > a + 0.002) scenePath.setAttribute("points", pts(part(flightTr, a, b)));
    sceneWps.forEach((w, k) => fade(w, b >= (k + 1) / 3 && a < (k + 1) / 3 - 0.02 ? 1 : 0));
    fade(ghost, shared.ghost * (1 - seg(a, 0.75, 1)));
    const [x, y] = at(flightTr, a);
    veh.setAttribute("transform", `translate(${n1(x)} ${n1(y)})`);
    pose(shared.reach, shared.grip);
  };

  /* ---------------- the player ---------------- */
  const ICON = {
    prev: '<path d="M18 5l-9 7 9 7z" fill="currentColor"/><rect x="4.5" y="5" width="2.5" height="14" fill="currentColor"/>',
    next: '<path d="M6 5l9 7-9 7z" fill="currentColor"/><rect x="17" y="5" width="2.5" height="14" fill="currentColor"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    pause: '<rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const icon = (b, name) => { b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`; };
  icon(bPrev, "prev");
  icon(bNext, "next");
  icon(bReset, "reset");

  const HOLD = 2200; // time to read a step's sentence before the next one starts
  let step = LAST, t = 1, running = false, auto = false, held = 0, raf = 0, last = 0, touched = false, resume = false;

  const mark = (i, quiet) => {
    for (const n of svg.querySelectorAll("[data-now]")) n.classList.toggle("is-now", n.dataset.now.split(" ").includes(String(i)));
    for (const n of svg.querySelectorAll("[data-from]")) n.classList.toggle("is-ahead", i < Number(n.dataset.from));
    tabs.forEach((b, k) => {
      b.classList.toggle("is-done", k < i);
      if (k === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    ind.innerHTML = `Step <b>${i + 1}</b> of ${STEPS.length}`;
    bPrev.disabled = i === 0;
    bNext.disabled = i === LAST;
    say.setAttribute("aria-live", quiet ? "off" : "polite");
    say.textContent = STEPS[i].line;
  };
  const setAuto = (on) => {
    auto = on;
    bPlay.setAttribute("aria-pressed", String(on));
    bPlay.setAttribute("aria-label", on ? "Pause" : "Play");
    icon(bPlay, on ? "pause" : "play");
  };
  const frame = (now) => {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (running) {
      if (t < 1) {
        t = Math.min(1, t + dt / STEPS[step].dur);
        paint(step, t);
      } else if (auto) {
        held += dt;
        if (held >= HOLD) {
          if (step < LAST) enter(step + 1, true);
          else { setAuto(false); running = false; }
        }
      } else running = false;
    }
    if (running) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  function enter(k, quiet) {
    step = clamp(k, 0, LAST);
    held = 0;
    t = still() ? 1 : 0;
    mark(step, quiet);
    paint(step, t);
    running = t < 1 || auto;
    if (running) kick();
  }
  const play = () => {
    if (still()) return;
    setAuto(true);
    if (step === LAST && t >= 1) enter(0, true);
    else { running = true; kick(); }
  };
  const pause = () => { setAuto(false); running = false; };
  const jump = (k) => { touched = true; resume = false; setAuto(false); enter(k, false); };

  bPlay.addEventListener("click", () => { touched = true; resume = false; if (auto) pause(); else play(); });
  bPrev.addEventListener("click", () => jump(step - 1));
  bNext.addEventListener("click", () => jump(step + 1));
  bReset.addEventListener("click", () => jump(0));
  fig.addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target && fig.contains(target)) jump(Number(target.dataset.go));
  });
  svg.addEventListener("keydown", (event) => {
    const target = event.target.closest && event.target.closest("[data-go]");
    if (target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); jump(Number(target.dataset.go)); }
  });
  const sync = () => {
    bPlay.hidden = still();
    if (still()) { pause(); t = 1; paint(step, 1); }
  };
  motion.addEventListener ? motion.addEventListener("change", sync) : motion.addListener(sync);

  // At rest the figure shows the whole picture. It plays once from the start when it first comes into view, pauses
  // while scrolled away and carries on when it is back.
  setAuto(false);
  sync();
  mark(step, true);
  paint(step, t);
  fitChips();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitChips);
  if ("IntersectionObserver" in window) {
    let started = false;
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          if (!started && !touched && !still()) { started = true; setAuto(true); enter(0, true); }
          else if (resume) { resume = false; play(); }
        } else if (entry.intersectionRatio < 0.1 && auto) {
          resume = true;
          pause();
        }
      }
    }, { threshold: [0, 0.1, 0.45] }).observe(fig);
  }
  fig.concept = { show(i, f = 1) { pause(); step = i; t = f; mark(i, true); paint(i, f); } }; // for screenshots and tests
})();
