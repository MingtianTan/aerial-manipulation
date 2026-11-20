// The system figure (index.html, #system), played like the concept figure above it in five steps chosen on the left:
// 1 π0.5 alone, 2 FlightFlow and what it learned, 3–5 our three attempts at wiring the two models. Each step plays
// in beats (inputs flow in, π0.5 plans, FlightFlow turns noise into paths, the plan or the forecast travels between
// the models, one controller flies both) and lights the detail card under the drawing that the beat is about.
// Hovering, focusing or tapping a part of the drawing opens its card for the chosen step. Contents: system-data.js.
// With "reduce motion" set nothing moves by itself and the beats change without animation.
(() => {
  const root = document.getElementById("system");
  const svg = root && root.querySelector("svg.lx-svg");
  if (!svg || !window.LX_DATA) return;
  const { PARTS, SCENES } = window.LX_DATA;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s) => root.querySelector(s);
  const stage = $(".lx-stage"), nav = $(".lx-nav"), pop = $(".lx-pop"), head = $(".lx-head"), cardsBox = $(".lx-cards");
  const say = $(".cx-say"), ind = $(".cx-ind"), tabList = $(".cx-tabs");
  const bPrev = $('[data-act="prev"]'), bPlay = $('[data-act="play"]'), bNext = $('[data-act="next"]'), bReset = $('[data-act="reset"]');
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches;
  const REPO = "https://github.com/MingtianTan/Aerial_Manipulation_Code/tree/";

  /* ---------------- helpers ---------------- */
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
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, f) => a + (b - a) * f;
  const n1 = (v) => v.toFixed(1);
  const pts = (list) => list.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ");
  const show = (node, on) => { node.style.display = on ? "" : "none"; };
  const fade = (node, a) => { node.setAttribute("opacity", a.toFixed(3)); show(node, a > 0.001); };
  const track = (points) => {
    const len = [0];
    for (let k = 1; k < points.length; k++) len.push(len[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
    return { points, len, total: len[len.length - 1] };
  };
  const at = (tr, f) => {
    const d = clamp(f) * tr.total;
    let k = 1;
    while (k < tr.len.length - 1 && tr.len[k] < d) k++;
    const [x0, y0] = tr.points[k - 1], [x1, y1] = tr.points[k];
    const u = (d - tr.len[k - 1]) / (tr.len[k] - tr.len[k - 1] || 1);
    return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
  };
  const cut = (tr, a, b) => {
    const out = [at(tr, a)];
    for (let k = 1; k < tr.points.length - 1; k++) if (tr.len[k] > a * tr.total && tr.len[k] < b * tr.total) out.push(tr.points[k]);
    out.push(at(tr, b));
    return out;
  };
  const random = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------------- the drawing (viewBox 1000 x 650) ---------------- */
  const defs = el("defs", {}, svg);
  for (const [id, cls, size] of [["lx-m-grey", "head-grey", 7], ["lx-m-fd", "head-fd", 6], ["lx-m-pi", "head-pi", 6], ["lx-m-hid", "head-hid", 6]]) {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: size, markerHeight: size, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0.6 10 5 0 9.4z", class: cls }, m);
  }
  const parts = {};   // id -> <g>
  const status = {};  // id -> <text> whose words change with the attempt
  const part = (id, parent = svg) => {
    const g = el("g", { "data-part": id, tabindex: 0, role: "button", "aria-label": PARTS[id] ? PARTS[id].name : id }, parent);
    parts[id] = g;
    return g;
  };
  const wire = (g, points, colour, thick = false) =>
    el("polyline", { points, class: `wire w-${colour}${thick ? " thick" : ""}`, "marker-end": `url(#lx-m-${colour})` }, g);
  const pills = (g, x, y, n, cls, step = 10) => { for (let k = 0; k < n; k++) el("rect", { x: x + k * step, y, width: 7, height: 16, rx: 2.5, class: `pill ${cls}` }, g); };
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
  badge(gDino, 230, 92, 1);
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
  badge(gFmt, 430, 92, 2);
  // the forecast: samples that flow from noise into paths, their mean, and the latent
  const gFc = part("fc");
  el("rect", { x: 600, y: 88, width: 126, height: 212, rx: 12, class: "msg" }, gFc);
  wire(gFc, "580,160 598,160", "fd");
  wire(gFc, "580,262 598,262", "fd");
  text(gFc, 663, 110, "THE FORECAST", "t-caps");
  text(gFc, 663, 232, "base path,", "t-lbl");
  text(gFc, 663, 247, "next 2.5 s", "t-lbl");
  const glyphAt = (u) => [612 + 102 * u, 196 - 40 * Math.pow(u, 0.62)];
  const rnd = random(11);
  const samples = Array.from({ length: 8 }, (_, k) => {
    const off = (k - 3.5) * 3.2, goal = [], noise = [];
    for (let j = 0; j < 12; j++) {
      const u = j / 11, [x, y] = glyphAt(u);
      goal.push([x, y + off * Math.pow(u, 1.3) + Math.sin(Math.PI * u) * ((k % 3) - 1) * 2.5]);
      noise.push([x + (rnd() - 0.5) * 8, 130 + rnd() * 76]);
    }
    return { node: el("polyline", { class: "fc-sample", points: pts(goal) }, gFc), goal, noise };
  });
  const meanTr = track(Array.from({ length: 21 }, (_, k) => glyphAt(k / 20)));
  const mean = el("polyline", { class: "fc-glyph", points: "" }, gFc);
  const dots = Array.from({ length: 10 }, (_, k) => { const [x, y] = glyphAt((k + 1) / 10); return el("circle", { cx: n1(x), cy: n1(y), r: 3.2, class: "fc-dot" }, gFc); });
  const nowDot = el("circle", { cx: 612, cy: 196, r: 4, class: "fc-now" }, gFc);
  const zGroup = el("g", {}, gFc);
  el("rect", { x: 641, y: 258, width: 44, height: 17, rx: 4, class: "pill p-fd" }, zGroup);
  text(zGroup, 663, 271, "z", "t-z");
  text(zGroup, 663, 293, "latent", "t-lbl");

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
  const act = [0, 1, 2].map((k) => el("rect", { x: 711 + 9 * k, y: 418, width: 7, height: 16, rx: 2.5, class: "pill p-pi" }, gAx));

  // attempt 2: FlightFlow → π0.5 as 11 tokens
  const gTok = part("tok");
  wire(gTok, "663,300 663,410", "fd", true);
  el("rect", { x: 540, y: 300, width: 200, height: 136, class: "lx-hit" }, gTok);
  status.tok1 = text(gTok, 652, 351, "", "t-path fd", "end");
  status.tok2 = text(gTok, 652, 368, "", "t-path fd", "end");
  badge(gTok, 682, 356, 3);
  const msg = Array.from({ length: 11 }, (_, k) => el("rect", { x: 608 + 9 * k, y: 418, width: 7, height: 16, rx: 2.5, class: "pill p-fd" }, gTok));
  // attempt 1: π0.5's plan → FlightFlow
  const gChunk = part("chunk");
  wire(gChunk, "597,438 597,394 470,394 470,298", "pi", true);
  el("rect", { x: 292, y: 334, width: 190, height: 52, class: "lx-hit" }, gChunk);
  el("rect", { x: 462, y: 386, width: 140, height: 16, class: "lx-hit" }, gChunk);
  status.chunk = text(gChunk, 460, 362, "", "t-path pi", "end");
  const chunkRow = Array.from({ length: 8 }, (_, k) => el("rect", { x: 457 + 12 * k, y: 268, width: 6, height: 12, rx: 2, class: "pill p-pi" }, gChunk));
  // attempt 3: FlightFlow's hidden states → an adapter → π0.5
  const gHid = part("hid");
  wire(gHid, "548,298 548,352 611,352", "hid", true);
  const adapter = el("g", { class: "lx-adapter" }, gHid);
  el("rect", { x: 614, y: 340, width: 98, height: 24, rx: 6 }, adapter);
  text(adapter, 663, 356, "MLP adapter", "t-adapter");
  wire(gHid, "663,364 663,398", "hid", true);
  status.hid1 = text(gHid, 540, 344, "", "t-path hid", "end");
  status.hid2 = text(gHid, 540, 361, "", "t-path hid", "end");
  const grid = [];
  for (let r = 0; r < 4; r++) grid.push(Array.from({ length: 11 }, (_, k) => el("rect", { x: 608 + 9 * k, y: 402 + 8 * r, width: 6, height: 6, rx: 1.5, class: "pill p-hid" }, gHid)));

  // the input wires: to π0.5 and to FlightFlow
  const gInPi = part("wires_pi");
  wire(gInPi, "170,114 212,114 212,462 228,462", "grey");
  wire(gInPi, "170,274 196,274 196,542 228,542", "grey");
  const gInFf = part("wires_ff");
  wire(gInFf, "170,114 228,114", "grey");
  el("circle", { cx: 212, cy: 114, r: 3, class: "dot-grey" }, gInFf);
  wire(gInFf, "170,194 228,194", "grey");
  wire(gInFf, "170,274 228,274", "grey");
  el("circle", { cx: 196, cy: 274, r: 3, class: "dot-grey" }, gInFf);

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

  // step 2's pictures: the IK taught FlightFlow; its path is the IK's; the same steps; the bar a controller fix sets
  const gIns = part("insets");
  const teach = el("g", {}, gIns);
  el("polyline", { points: "850,298 850,264 731,264", class: "wire w-grey w-dash", "marker-end": "url(#lx-m-grey)" }, teach);
  text(teach, 764, 256, "taught by the IK’s base", "t-lbl", "start");
  const ikpath = el("g", {}, gFc);
  el("polyline", { points: pts(Array.from({ length: 21 }, (_, k) => { const [x, y] = glyphAt(k / 20); return [x, y + 4]; })), class: "lx-ikpath" }, ikpath);
  text(ikpath, 612, 140, "dashed: the IK", "t-tiny lx-iklab", "start");
  const inset = (y, h, title) => {
    const g = el("g", {}, gIns);
    el("rect", { x: 780, y, width: 220, height: h, rx: 10, class: "keybox" }, g);
    text(g, 796, y + 22, title, "t-caps", "start");
    return g;
  };
  const bar = (g, y, label, value, max, cls, shown) => {
    text(g, 796, y, label, "t-tiny", "start");
    el("rect", { x: 796, y: y + 7, width: 150, height: 10, rx: 3, class: "lx-track" }, g);
    el("rect", { x: 796, y: y + 7, width: (150 * value) / max, height: 10, rx: 3, class: cls }, g);
    text(g, 990, y + 16, shown, "t-val", "end");
  };
  const fallback = inset(408, 104, "STEPS THE IK DECIDES");
  bar(fallback, 452, "π0.5 alone: IK off > 1 mm", 63, 100, "lx-bar grey", "63 %");
  bar(fallback, 488, "FlightFlow: back to the IK", 62, 100, "lx-bar fd", "62 %");
  const crash = inset(522, 104, "CRASHES, 4 DISTURBED CELLS");
  bar(crash, 566, "π0.5 alone", 43, 43, "lx-bar grey", "43");
  bar(crash, 602, "+ controller fix, no learning", 3, 43, "lx-bar pi", "3");

  /* ---------------- moving things (on top of the drawing) ---------------- */
  const top = el("g", { class: "lx-top", "aria-hidden": "true" }, svg);
  // packets that run along wires while a step plays
  const lane = (points, colour) => {
    const tr = track(points), n = clamp(Math.round(tr.total / 34), 1, 8);
    const dotsOn = Array.from({ length: n }, () => el("circle", { r: 3.6, class: `lx-pk pk-${colour}` }, top));
    return {
      set(p, secs) {
        const on = p > 0 && p < 1;
        const a = Math.min(1, p / 0.08, (1 - p) / 0.08);
        dotsOn.forEach((d, k) => {
          show(d, on);
          if (!on) return;
          const [x, y] = at(tr, ((secs * 120) / tr.total + k / n) % 1);
          d.setAttribute("cx", n1(x));
          d.setAttribute("cy", n1(y));
          d.setAttribute("opacity", a.toFixed(2));
        });
      },
    };
  };
  const LANES = {
    in_pi: [[[170, 114], [212, 114], [212, 462], [228, 462]], [[170, 274], [196, 274], [196, 542], [228, 542]]].map((p) => lane(p, "grey")),
    in_ff: [[[170, 114], [228, 114]], [[170, 194], [228, 194]], [[170, 274], [228, 274]]].map((p) => lane(p, "grey")),
    ff_in: [[[408, 114], [427, 114]], [[408, 194], [427, 194]], [[378, 274], [427, 274]], [[580, 160], [598, 160]], [[580, 262], [598, 262]]].map((p) => lane(p, "fd")),
    pi_in: [[[408, 462], [427, 462]], [[408, 542], [427, 542]]].map((p) => lane(p, "grey")),
    vlm_ax: [lane([[570, 502], [587, 502]], "grey")],
    hand: [lane([[726, 502], [754, 502], [754, 350], [778, 350]], "pi")],
    base: [lane([[726, 150], [754, 150], [754, 322], [778, 322]], "fd")],
    cmd: [lane([[986, 298], [986, 174]], "grey")],
    loop: [lane([[890, 44], [890, 24], [85, 24], [85, 39]], "grey")],
  };
  // tokens that travel between the models and land in their slots
  const traveller = (build) => { const g = el("g", {}, top); build(g); return g; };
  const msgGo = msg.map((_, k) => ({
    node: traveller((g) => el("rect", { x: -3.5, y: -8, width: 7, height: 16, rx: 2.5, class: "pill p-fd" }, g)),
    tr: track([[663, 300], [663, 396], [611.5 + 9 * k, 426]]),
  }));
  const hidGo = [0, 1, 2, 3].map((r) => ({
    node: traveller((g) => { for (let k = 0; k < 11; k++) el("rect", { x: -48 + 9 * k, y: -3, width: 6, height: 6, rx: 1.5, class: "pill p-hid" }, g); }),
    tr: track([[548, 300], [548, 352], [663, 352], [663, 392], [656, 405 + 8 * r]]),
  }));
  const chunkGo = {
    node: traveller((g) => { for (let k = 0; k < 6; k++) el("rect", { x: -23 + 8 * k, y: -6, width: 6, height: 12, rx: 2, class: "pill p-pi" }, g); }),
    tr: track([[597, 438], [597, 394], [470, 394], [470, 300], [505, 274]]),
  };
  const zGo = {
    node: traveller((g) => { el("rect", { x: -15, y: -9, width: 30, height: 18, rx: 4, class: "pill p-fd" }, g); text(g, 0, 4.5, "[Z]", "t-z"); }),
    tr: track([[548, 276], [600, 270], [663, 266]]),
  };
  const place = (node, [x, y]) => node.setAttribute("transform", `translate(${n1(x)} ${n1(y)})`);

  /* ---------------- effects: what a step does, drawn at progress p (0 not yet, 1 done) ---------------- */
  const SHOWN = { teach, ikpath, fallback, crash };
  const FX = {
    flow(what, p, secs) { for (const name of what.split(" ")) for (const l of LANES[name]) l.set(p, secs); },
    show(what, p) { fade(SHOWN[what], easeOut(p)); },
    pills(what, p) {
      act.forEach((n, k) => fade(n, easeOut(seg(p, k * 0.25, k * 0.25 + 0.5))));
    },
    morph(what, p) {
      const m = ease(seg(p, 0, 0.6));
      for (const s of samples) {
        s.node.setAttribute("points", pts(s.noise.map((q, j) => [lerp(q[0], s.goal[j][0], m), lerp(q[1], s.goal[j][1], m)])));
        fade(s.node, seg(p, 0, 0.06) * lerp(0.7, 0.3, seg(p, 0.6, 0.75)));
      }
      const mm = seg(p, 0.58, 0.82);
      show(mean, mm > 0);
      if (mm > 0) mean.setAttribute("points", pts(cut(meanTr, 0, mm)));
      dots.forEach((d, k) => fade(d, seg(mm, (k + 1) / 10 - 0.05, (k + 1) / 10)));
      fade(nowDot, seg(p, 0, 0.06));
      if (what !== "fcpath") fade(zGroup, seg(p, 0.85, 1));
    },
    send(what, p) {
      if (what === "msg") {
        msgGo.forEach(({ node, tr }, k) => {
          const s = ease(seg(p, k * 0.05, k * 0.05 + 0.45));
          show(node, s > 0 && s < 1);
          if (s > 0 && s < 1) place(node, at(tr, s));
          fade(msg[k], s >= 1 ? 1 : 0);
        });
      } else if (what === "hid") {
        hidGo.forEach(({ node, tr }, r) => {
          const s = ease(seg(p, r * 0.18, r * 0.18 + 0.42));
          show(node, s > 0 && s < 1);
          if (s > 0 && s < 1) place(node, at(tr, s));
          grid[r].forEach((q) => fade(q, s >= 1 ? 1 : 0));
        });
      } else if (what === "z") {
        const s = ease(seg(p, 0, 0.75));
        show(zGo.node, s > 0 && s < 1);
        if (s > 0 && s < 1) place(zGo.node, at(zGo.tr, s));
        fade(zGroup, s >= 1 ? 1 : seg(p, 0.75, 0.8) * 0);
        if (s >= 1) fade(zGroup, 1);
      } else if (what === "chunk") {
        const s = ease(seg(p, 0, 0.8));
        show(chunkGo.node, s > 0 && s < 1);
        if (s > 0 && s < 1) place(chunkGo.node, at(chunkGo.tr, s));
        chunkRow.forEach((q, k) => fade(q, easeOut(seg(p, 0.78 + k * 0.02, 0.9 + k * 0.02))));
      }
    },
  };
  // everything that moves starts hidden; an attempt's steps bring in what they own
  const reset = () => {
    for (const ls of Object.values(LANES)) for (const l of ls) l.set(0, 0);
    for (const n of [...act, ...msg, ...chunkRow, ...grid.flat(), mean, nowDot, zGroup, ...dots, ...samples.map((s) => s.node), ...Object.values(SHOWN),
      ...msgGo.map((m) => m.node), ...hidGo.map((h) => h.node), chunkGo.node, zGo.node]) show(n, false);
  };

  /* ---------------- small drawings in the detail cards (SVG markup) ---------------- */
  const sq = (x, y, w, h, cls, rx = 2) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${rx}" class="${cls}"/>`;
  const tx = (x, y, words, cls = "v-t", anchor = "middle") => `<text x="${n1(x)}" y="${n1(y)}" text-anchor="${anchor}" class="${cls}">${words}</text>`;
  const arrow = (x1, y1, x2, y2, cls = "v-line") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#lx-v-head)"/>`;
  const svgOf = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true"><defs><marker id="lx-v-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10z" class="v-head"/></marker></defs>${body}</svg>`;
  const VIZ = {
    action8() {
      let b = "";
      for (let k = 0; k < 8; k++) b += sq(6 + 26 * k, 6, 22, 20, k < 3 ? "v-pi" : k < 7 ? "v-pisoft" : "v-grey");
      return svgOf(220, 50, b + tx(42, 42, "position x y z") + tx(136, 42, "orientation (4)") + tx(201, 42, "grip"));
    },
    tokens55() {
      let b = "";
      for (let k = 0; k < 50; k++) b += sq(2 + 3.4 * k, 6, 2.6, 18, "v-fdsoft", 1);
      for (let k = 0; k < 4; k++) b += sq(177 + 6 * k, 6, 5, 18, "v-fd", 1);
      b += sq(203, 4, 15, 22, "v-fd2", 3) + tx(210.5, 19, "Z", "v-w");
      return svgOf(220, 44, b + tx(86, 40, "50 path tokens") + tx(186, 40, "4 state"));
    },
    flow() {
      const r = random(5);
      let b = "";
      for (let k = 0; k < 4; k++) b += `<polyline class="v-noise" points="${Array.from({ length: 9 }, (_, j) => `${n1(6 + j * 8)},${n1(8 + r() * 30)}`).join(" ")}"/>`;
      for (let k = 0; k < 4; k++) b += `<polyline class="v-path" points="${Array.from({ length: 9 }, (_, j) => `${n1(132 + j * 10)},${n1(36 - 22 * Math.pow(j / 8, 0.7) + (k - 1.5) * 1.6 * j / 8)}`).join(" ")}"/>`;
      b += `<polyline class="v-mean" points="${Array.from({ length: 9 }, (_, j) => `${n1(132 + j * 10)},${n1(36 - 22 * Math.pow(j / 8, 0.7))}`).join(" ")}"/>`;
      return svgOf(220, 56, b + arrow(84, 24, 122, 24) + tx(103, 18, "4 steps", "v-s") + tx(40, 54, "noise") + tx(172, 54, "8 paths, mean"));
    },
    latent() {
      let b = "";
      for (let k = 0; k < 7; k++) b += sq(2 + 7 * k, 10, 5, 16, "v-fdsoft", 1);
      b += sq(51, 8, 16, 20, "v-fd2", 3) + tx(59, 22, "Z", "v-w") + tx(34, 40, "last block");
      b += arrow(70, 18, 92, 18) + sq(94, 8, 34, 20, "v-box", 4) + tx(111, 22, "linear", "v-s");
      b += arrow(130, 18, 146, 18);
      for (let k = 0; k < 16; k++) b += sq(148 + 4.2 * k, 10, 3.4, 16, k % 2 ? "v-fd" : "v-fd2", 1);
      b += tx(182, 40, "z: 256 values");
      b += sq(4, 50, 8, 8, "v-dashbox", 2) + tx(18, 57.5, "trained on: where the base is 0.4 s later", "v-s", "start");
      b += sq(4, 64, 8, 8, "v-fd2", 2) + tx(18, 71.5, "used in test 2: one of the 11 tokens", "v-s", "start");
      return svgOf(220, 78, b);
    },
    zmake() {
      let b = tx(125, 13, "50 path tokens: the noisy path", "v-s") + tx(262, 13, "4 state", "v-s");
      for (let k = 0; k < 50; k++) b += sq(10 + 4.6 * k, 20, 3.6, 18, "v-fdsoft", 1);
      for (let k = 0; k < 4; k++) b += sq(248 + 7 * k, 20, 5, 18, "v-fd", 1);
      b += sq(280, 18, 22, 22, "v-fd2", 4) + tx(291, 33, "Z", "v-w");
      b += tx(312, 27, "[Z]: one learned token, the same", "v-s", "start") + tx(312, 41, "at the start of every sample", "v-s", "start");
      b += sq(6, 52, 300, 82, "v-blocks", 8) + sq(280, 52, 22, 82, "v-zlane", 0);
      b += tx(140, 86, "14 blocks", "v-b") + tx(140, 104, "in each, [Z] reads the path and", "v-s") + tx(140, 118, "state tokens (self-attention)", "v-s");
      b += sq(336, 58, 132, 26, "v-box", 6) + tx(402, 75, "34 image tokens", "v-s") + arrow(336, 71, 306, 71);
      b += tx(472, 75, "cross-attention", "v-s", "start");
      b += sq(336, 98, 132, 26, "v-box", 6) + tx(402, 115, "task + flow time", "v-s") + arrow(336, 111, 306, 111);
      b += tx(472, 115, "scale and shift each block", "v-s", "start");
      b += arrow(291, 134, 291, 150) + sq(274, 152, 34, 20, "v-fd2", 3) + tx(291, 166, "512", "v-w");
      b += tx(244, 166, "[Z] after the last block", "v-s", "end");
      b += arrow(310, 162, 334, 162) + sq(336, 151, 92, 22, "v-box", 5) + tx(382, 166, "linear → 256", "v-s");
      b += arrow(430, 162, 448, 162);
      for (let k = 0; k < 16; k++) b += sq(450 + 4.4 * k, 153, 3.4, 18, k % 2 ? "v-fd" : "v-fd2", 1);
      b += tx(526, 167, "z: 256 values", "v-b", "start");
      b += `<path d="M462 172 V188 H425 V202" class="v-dash" marker-end="url(#lx-v-head)"/>`;
      b += sq(326, 204, 198, 42, "v-train", 6) + tx(425, 221, "trained only to predict", "v-s") + tx(425, 238, "where the base is 0.4 s later", "v-b");
      b += `<path d="M508 172 V188 H594 V202" class="v-line" marker-end="url(#lx-v-head)"/>`;
      b += sq(530, 204, 128, 42, "v-use", 6) + tx(594, 221, "mean of 8 samples", "v-s") + tx(594, 238, "→ test 2’s 11th token", "v-b");
      return svgOf(660, 252, b);
    },
    versions() {
      const cell = (x, y, name, use, hot) => sq(x, y, 140, 42, hot ? "v-cell hot" : "v-cell", 6) + tx(x + 70, y + 18, name, "v-code") + tx(x + 70, y + 34, use, "v-s");
      let b = tx(215, 14, "reads π0.5's plan", "v-t") + tx(365, 14, "no plan input", "v-t");
      b += sq(2, 24, 128, 42, "v-data", 6) + tx(66, 41, "offline", "v-b") + tx(66, 57, "2,102 expert demos", "v-s");
      b += sq(2, 96, 128, 42, "v-data on", 6) + tx(66, 113, "online", "v-b") + tx(66, 129, "+ 200 π0.5 flights", "v-s");
      b += cell(145, 24, "fd40_c", "test 1, offline", false) + cell(295, 24, "fd40_nc", "for comparison", false);
      b += cell(145, 96, "fdcl_c", "test 1, online", false) + cell(295, 96, "fdcl_nc", "then frozen: tests 2 and 3", true);
      b += arrow(66, 68, 66, 92) + tx(72, 84, "fine-tune 10k steps", "v-s", "start");
      return svgOf(440, 142, b);
    },
    plan() {
      let b = "";
      for (let r = 0; r < 5; r++) for (let k = 0; k < 8; k++) b += sq(40 + 18 * k, 4 + 9 * r, 15, 7, k < 3 ? "v-pi" : k < 7 ? "v-pisoft" : "v-grey", 1);
      for (let r = 0; r < 5; r++) b += tx(34, 10 + 9 * r, `+${((r + 1) * 0.05).toFixed(2)} s`, "v-s", "end");
      return svgOf(220, 64, b + tx(112, 56, "⋮ 50 targets, one per 0.05 s", "v-s"));
    },
    standin() {
      return svgOf(220, 54, sq(2, 6, 86, 18, "v-pi", 3) + sq(88, 6, 86, 18, "v-grey", 3) + sq(174, 6, 44, 18, "v-none", 3) +
        tx(45, 38, "π0.5's own plan", "v-s") + tx(45, 50, "40 %", "v-b") + tx(131, 38, "expert + small offset", "v-s") + tx(131, 50, "40 %", "v-b") +
        tx(196, 38, "no plan", "v-s") + tx(196, 50, "20 %", "v-b"));
    },
    message() {
      let b = `<polyline class="v-path" points="6,40 30,34 54,27 78,21 102,17"/>`;
      for (let k = 0; k < 10; k++) b += `<circle cx="${n1(6 + 10.6 * (k + 0.5))}" cy="${n1(40 - 23 * Math.pow((k + 0.5) / 10, 0.8))}" r="2.6" class="v-fd"/>`;
      b += sq(112, 22, 14, 18, "v-fd2", 3) + tx(119, 35, "z", "v-w");
      b += arrow(130, 31, 146, 31);
      for (let k = 0; k < 11; k++) b += sq(150 + 4.4 * k, 22, 3.4, 18, "v-fd", 1);
      for (let k = 0; k < 4; k++) b += sq(200 + 4.4 * k, 22, 3.4, 18, "v-pi", 1);
      return svgOf(220, 60, b + tx(56, 56, "10 waypoints + z") + tx(174, 56, "11 tokens") + tx(208, 16, "50 actions", "v-s", "middle"));
    },
    hidden() {
      let b = sq(2, 18, 92, 100, "v-box", 6) + tx(48, 12, "FlightFlow", "v-b") + tx(48, 64, "14 blocks", "v-s") + sq(8, 98, 80, 14, "v-fdsoft", 3) + tx(48, 109, "last block", "v-s");
      b += arrow(96, 104, 128, 68);
      const taus = ["τ = 0", "0.25", "0.5", "0.75"];
      for (let r = 0; r < 4; r++) {
        b += tx(150, 39 + 20 * r, taus[r], "v-s", "end");
        for (let k = 0; k < 11; k++) b += sq(156 + 12 * k, 28 + 20 * r, 10, 14, k === 10 ? "v-fd2" : "v-hid", 2);
      }
      b += tx(222, 18, "10 waypoint tokens + [Z]", "v-s") + tx(222, 120, "4 Euler steps × 11, averaged over 8 samples", "v-s");
      b += arrow(292, 68, 318, 68) + sq(320, 50, 60, 36, "v-box", 6) + tx(350, 66, "MLP", "v-b") + tx(350, 80, "3 layers", "v-s");
      b += arrow(382, 68, 400, 68) + sq(402, 52, 34, 32, "v-pisoft", 6) + tx(419, 72, "π0.5", "v-s") + tx(419, 100, "44 tokens", "v-s");
      return svgOf(440, 128, b);
    },
    bars(rows) {
      let b = "";
      rows.forEach(([label, v, cls], k) => {
        const y = 4 + 28 * k;
        b += tx(2, y + 9, label, "v-s", "start") + sq(2, y + 13, 170 * v / 100, 9, `v-${cls}`, 2) + tx(176, y + 21, `${v} %`, "v-b", "start");
      });
      return svgOf(220, 8 + 28 * rows.length, b);
    },
  };
  const vizOf = (viz) => { if (!viz) return ""; const [kind, data] = Array.isArray(viz) ? viz : [viz]; return `<div class="viz">${VIZ[kind](data)}</div>`; };

  /* ---------------- the player ---------------- */
  const BEATS = SCENES.flatMap((S, a) => S.beats.map((s, i) => ({ a, i, s })));
  const LAST = BEATS.length - 1;
  const HOLD = 2600;
  let g = 0, t = 1, running = false, auto = false, held = 0, raf = 0, last = 0, touched = false, resume = false, shown = -1, hot = null;
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const paint = () => {
    const { a, i } = BEATS[g];
    reset();
    SCENES[a].beats.forEach((s, k) => {
      const tt = k < i ? 1 : k > i ? 0 : t;
      for (const [kind, what, t0, t1] of s.fx) FX[kind](what, seg(tt, t0, t1), k === i ? Math.max(0, tt - t0) * (s.dur / 1000) : 0);
    });
  };

  const navButtons = SCENES.map((S, a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lx-layer";
    b.style.setProperty("--lc", S.colour);
    b.style.setProperty("--lc-soft", S.soft);
    b.innerHTML = `<span class="k">${a + 1}</span><b></b><span class="s"></span><span class="br"></span>`;
    b.querySelector("b").textContent = S.name;
    b.querySelector(".s").textContent = S.sub;
    b.querySelector(".br").textContent = S.branches.join(" · ");
    b.addEventListener("click", () => jump(BEATS.findIndex((x) => x.a === a)));
    nav.insertBefore(b, nav.querySelector(".lx-hint"));
    return b;
  });
  const useScene = (a) => {
    const S = SCENES[a];
    navButtons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === a)));
    for (const [id, node] of Object.entries(parts)) {
      const st = (S.parts && S.parts[id]) || "on";
      node.classList.toggle("lx-dim", st === "dim");
      node.classList.toggle("lx-off", st === "off");
      node.setAttribute("tabindex", st === "off" ? -1 : 0);
    }
    for (const [id, node] of Object.entries(status)) {
      const value = (S.status && S.status[id]) ?? "";
      const [words, tone] = Array.isArray(value) ? value : [value, ""];
      node.textContent = words;
      if (node.classList.contains("t-status")) {
        node.classList.toggle("s-trained", tone === "pi");
        node.classList.toggle("s-fd", tone === "fd");
      }
    }
    head.querySelector("b").textContent = `${a + 1} · ${S.name}`;
    const when = head.querySelector("span");
    when.textContent = `${S.when} · branches `;
    S.branches.forEach((name, k) => {
      const link = document.createElement("a");
      link.href = REPO + name;
      link.textContent = name;
      link.rel = "noopener";
      if (k) when.append(", ");
      when.append(link);
    });
    cardsBox.style.setProperty("--sc", S.colour);
    cardsBox.style.setProperty("--sc-soft", S.soft);
    cardsBox.replaceChildren(...S.cards.map((c, k) => {
      const d = document.createElement("div");
      d.className = c.full ? "lx-card full" : c.wide ? "lx-card wide" : "lx-card";
      d.innerHTML = `<p class="t"><span class="n">${k + 1}</span>${esc(c.t)}</p>` + (c.big ? `<p class="big">${esc(c.big)}</p>` : "") + vizOf(c.viz) + `<p class="x">${esc(c.text)}</p>`;
      return d;
    }));
    tabList.replaceChildren(...S.beats.map((s, k) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.style.setProperty("--sc", S.colour);
      b.innerHTML = `<span class="n">${k + 1}</span>`;
      b.append(s.tab);
      b.addEventListener("click", () => jump(BEATS.findIndex((x) => x.a === a && x.i === k)));
      li.append(b);
      return li;
    }));
    shown = a;
    if (hot) open(hot);
  };
  const mark = (quiet) => {
    const { a, i, s } = BEATS[g];
    if (a !== shown) useScene(a);
    for (const [id, node] of Object.entries(parts)) node.classList.toggle("lx-now", s.now.includes(id));
    [...tabList.querySelectorAll("button")].forEach((b, k) => {
      b.classList.toggle("is-done", k < i);
      if (k === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    [...cardsBox.children].forEach((d, k) => {
      d.classList.toggle("is-now", k === s.card);
      d.classList.toggle("is-done", s.card != null && k < s.card);
    });
    ind.innerHTML = `Step ${a + 1} · beat <b>${i + 1}</b> of ${SCENES[a].beats.length}`;
    bPrev.disabled = g === 0;
    bNext.disabled = g === LAST;
    say.setAttribute("aria-live", quiet ? "off" : "polite");
    say.textContent = s.line;
  };

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
        t = Math.min(1, t + dt / BEATS[g].s.dur);
        paint();
      } else if (auto) {
        held += dt;
        if (held >= HOLD) {
          if (g < LAST) enter(g + 1, true);
          else { setAuto(false); running = false; }
        }
      } else running = false;
    }
    if (running) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  function enter(k, quiet) {
    g = clamp(k, 0, LAST);
    held = 0;
    t = still() ? 1 : 0;
    mark(quiet);
    paint();
    running = t < 1 || auto;
    if (running) kick();
  }
  const play = () => {
    if (still()) return;
    setAuto(true);
    if (g === LAST && t >= 1) enter(0, true);
    else { running = true; kick(); }
  };
  const pause = () => { setAuto(false); running = false; };
  const jump = (k) => { touched = true; resume = false; setAuto(false); enter(k, false); };
  bPlay.addEventListener("click", () => { touched = true; resume = false; if (auto) pause(); else play(); });
  bPrev.addEventListener("click", () => jump(g - 1));
  bNext.addEventListener("click", () => jump(g + 1));
  bReset.addEventListener("click", () => jump(0));
  const sync = () => {
    bPlay.hidden = still();
    if (still()) { pause(); t = 1; paint(); }
  };
  motion.addEventListener ? motion.addEventListener("change", sync) : motion.addListener(sync);

  /* ---------------- the details card of a part ---------------- */
  const card = (id) => {
    const S = SCENES[BEATS[g].a];
    const base = PARTS[id] || { name: id };
    const unused = parts[id].classList.contains("lx-dim");
    const over = (!unused && S.tips && S.tips[id]) || {};
    // notes say what each model makes of the part; a step shows only the models it uses (S.models)
    const heads = { pi: S.piName || "π0.5", ff: "FlightFlow", ik: "The IK and the PID" };
    const notes = unused ? [] : (over.notes || base.notes || []).filter(([who]) => (S.models || ["pi", "ff", "ik"]).includes(who))
      .map(([who, words]) => [heads[who], words, who]);
    return {
      name: over.name || base.name,
      text: (unused ? "Not used in this step. " : "") + (over.text || base.text || ""),
      rows: unused ? [] : [...(base.rows || []), ...(over.rows || [])],
      notes,
    };
  };
  function open(node) {
    const S = SCENES[BEATS[g].a];
    const c = card(node.dataset.part);
    if (hot && hot !== node) hot.classList.remove("lx-hot");
    hot = node;
    node.classList.add("lx-hot");
    pop.style.setProperty("--tc", S.colour);
    pop.innerHTML = `<span class="tag">${esc(S.short)}</span><h4>${esc(c.name)}</h4>` + (c.text ? `<p>${esc(c.text)}</p>` : "") +
      (c.rows.length ? `<dl>${c.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "") +
      c.notes.map(([h, words, who]) => `<div class="lx-note ${who}"><b>${esc(h)}</b><p>${esc(words)}</p></div>`).join("");
    pop.hidden = false;
    const sr = stage.getBoundingClientRect(), r = node.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const fit = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    let x = r.right - sr.left + 12, y = r.top - sr.top;
    if (x + w > sr.width) x = r.left - sr.left - w - 12;
    if (x < 0) { x = fit(r.left - sr.left, 0, sr.width - w); y = r.bottom - sr.top + 10; }
    y = fit(y, 0, Math.max(0, sr.height - h));
    pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const close = () => {
    if (hot) hot.classList.remove("lx-hot");
    hot = null;
    pop.hidden = true;
  };
  svg.addEventListener("pointerover", (e) => { const node = e.target.closest("[data-part]"); if (node && e.pointerType === "mouse") open(node); });
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") close(); });
  svg.addEventListener("click", (e) => {
    const node = e.target.closest("[data-part]");
    if (!node) return close();
    if (hot === node && e.pointerType !== "mouse") close();
    else open(node);
  });
  svg.addEventListener("focusin", (e) => { const node = e.target.closest("[data-part]"); if (node) open(node); });
  svg.addEventListener("focusout", () => close());
  document.addEventListener("pointerdown", (e) => { if (hot && !svg.contains(e.target)) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // At rest the figure shows the full system (step 4), finished. It plays all five steps once when it first comes
  // into view, pauses while scrolled away and carries on when it is back.
  setAuto(false);
  sync();
  const rest = Math.max(0, SCENES.findIndex((S) => S.default));
  g = BEATS.findIndex((x) => x.a === rest && x.i === SCENES[rest].beats.length - 1);
  t = 1;
  mark(true);
  paint();
  if ("IntersectionObserver" in window) {
    let started = false;
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          if (!started && !touched && !still()) { started = true; setAuto(true); enter(0, true); }
          else if (resume) { resume = false; play(); }
        } else if (entry.intersectionRatio < 0.1 && auto) {
          resume = true;
          pause();
        }
      }
    }, { threshold: [0, 0.1, 0.35] }).observe(root);
  }
  root.system = { show(k, f = 1) { pause(); g = k; t = f; mark(true); paint(); } }; // for screenshots and tests
})();
