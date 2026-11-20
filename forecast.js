// The forecast block of the overview page (index.html, #forecast).
// Left: one rollout of the full system, played back. A cursor sweeps its 16 s; the base's flight is drawn up to the cursor;
// each forecast appears when FlightFlow hands it over, the newest bold with its ten waypoints, the older ones fading; the
// two events light up when the cursor reaches them. Every number is read from the static SVG in the page (its polylines,
// time ticks and event lines), which is also what shows without this script and at the end of the playback. It plays once
// when it first comes into view and pauses while scrolled away; with "reduce motion" set it stays on the whole rollout and
// only steps. Right: a bar group and the card under the two figures that explains it light up together.
(() => {
  const root = document.getElementById("forecast");
  if (!root) return;

  /* ---------------- the chart and the cards that explain its bars ---------------- */
  const groups = new Map([...root.querySelectorAll(".grp[data-k]")].map((g) => [g.dataset.k, g]));
  const cards = new Map([...root.querySelectorAll(".fc-pred[data-k]")].map((c) => [c.dataset.k, c]));
  const hot = (k, on) => {
    if (groups.has(k)) groups.get(k).classList.toggle("is-hot", on);
    if (cards.has(k)) cards.get(k).classList.toggle("is-hot", on);
  };
  for (const node of [...groups.values(), ...cards.values()]) {
    node.addEventListener("pointerenter", () => hot(node.dataset.k, true));
    node.addEventListener("pointerleave", () => hot(node.dataset.k, false));
    node.addEventListener("focusin", () => hot(node.dataset.k, true));
    node.addEventListener("focusout", () => hot(node.dataset.k, false));
  }

  /* ---------------- the rollout: read it from the static drawing ---------------- */
  const svg = root.querySelector("svg.fc-roll");
  const bar = root.querySelector(".fc-bar");
  if (!svg || !bar) return;
  const NS = "http://www.w3.org/2000/svg";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches;
  const el = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.append(node);
    return node;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const n1 = (v) => v.toFixed(1);
  const parse = (node) => node.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number));
  const fmt = (list) => list.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ");
  const yAt = (path, x) => {
    if (x <= path[0][0]) return path[0][1];
    let i = 1;
    while (i < path.length - 1 && path[i][0] < x) i++;
    const [x0, y0] = path[i - 1], [x1, y1] = path[i];
    return x >= x1 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  };
  const upTo = (path, x) => {
    const out = [];
    for (const p of path) {
      if (p[0] >= x) break;
      out.push(p);
    }
    out.push([x, yAt(path, x)]);
    return out;
  };

  // time: the axis labels "0 s" ... "16 s"
  const ticks = [...svg.querySelectorAll("text")]
    .map((node) => ({ node, m: /^(\d+(?:\.\d+)?) s$/.exec(node.textContent.trim()) }))
    .filter((o) => o.m)
    .map(({ node, m }) => ({ node, t: Number(m[1]), x: Number(node.getAttribute("x")) }))
    .sort((p, q) => p.t - q.t);
  if (ticks.length < 2) return;
  const first = ticks[0], lastTick = ticks[ticks.length - 1];
  const PX = (lastTick.x - first.x) / (lastTick.t - first.t);
  const X = (t) => first.x + (t - first.t) * PX;
  const T = (x) => first.t + (x - first.x) / PX;
  const tickY = Number(first.node.getAttribute("y"));
  const VIEW_W = svg.viewBox.baseVal.width || 660;

  // the base as flown (forward position on top, height below); the rollout ends where it ends
  const flownEls = [...svg.querySelectorAll("polyline.flown")];
  if (!flownEls.length) return;
  const flown = flownEls.map(parse);
  const flownFull = flownEls.map((node) => node.getAttribute("points"));
  const END = T(Math.max(...flown.map((p) => p[p.length - 1][0])));
  const show1 = (t) => (Math.round(t * 10) / 10).toFixed(1);

  // the forecasts: each starts where the base is when it is handed over, so its panel is the flown path it starts on
  const paths = [...svg.querySelectorAll("polyline.fc")].map((node) => {
    const p = parse(node);
    let panel = 0;
    flown.forEach((f, i) => {
      if (Math.abs(yAt(f, p[0][0]) - p[0][1]) < Math.abs(yAt(flown[panel], p[0][0]) - p[0][1])) panel = i;
    });
    return { node, p, panel, t: T(p[0][0]), full: node.getAttribute("points"), pick: node.classList.contains("fc-pick"), cut: false };
  });
  const issued = []; // one entry per hand-over, with its path in each panel
  for (const path of [...paths].sort((a, b) => a.t - b.t)) {
    const prev = issued[issued.length - 1];
    if (prev && path.t - prev.t < 0.05) prev.paths.push(path);
    else issued.push({ t: path.t, paths: [path] });
  }
  const N = issued.length;
  if (!N) return;
  for (const is of issued) is.pick = is.paths.some((p) => p.pick);
  const EVERY = N > 1 ? (issued[N - 1].t - issued[0].t) / (N - 1) : 0.4; // 0.4 s

  // the events: a dashed line in each panel and one label between them
  const evLines = [...svg.querySelectorAll("line.event")];
  const events = [];
  for (const line of evLines) {
    const x = Number(line.getAttribute("x1"));
    let ev = events.find((e) => Math.abs(e.x - x) < 0.5);
    if (!ev) events.push((ev = { x, t: T(x), lines: [], label: null, glow: null }));
    ev.lines.push(line);
  }
  for (const label of svg.querySelectorAll("text.fc-evlab")) {
    const x = Number(label.getAttribute("x"));
    if (events.length) events.reduce((best, e) => (Math.abs(e.x - x) < Math.abs(best.x - x) ? e : best)).label = label;
  }
  const spans = evLines.map((l) => [Number(l.getAttribute("y1")), Number(l.getAttribute("y2"))]).sort((a, b) => a[0] - b[0]);
  const TOP = spans.length ? spans[0] : [38, 204];
  const BOTTOM = spans.length ? spans[spans.length - 1] : [234, 392];

  // the whole-rollout view marks one forecast with its waypoints; the legend explains it, so the note goes
  const marks = [...svg.querySelectorAll(".fc-dot, .fc-now")];
  for (const node of svg.querySelectorAll(".leader, .note")) node.style.display = "none";

  // what the playback adds: the newest forecast's waypoints, the cursor with its time, the base now, a strip to seek on
  const gWps = el("g", { "aria-hidden": "true" }, svg);
  const wps = flown.map(() => Array.from({ length: 10 }, () => el("circle", { class: "fc-dot", r: 3.4 }, gWps)));
  const cur = el("g", { class: "fc-cur", "aria-hidden": "true" }, svg);
  const curLines = [
    el("line", { y1: TOP[0], y2: TOP[1] }, cur),
    el("line", { y1: BOTTOM[0], y2: tickY - 14 }, cur),
  ];
  const pill = el("rect", { class: "fc-pill", y: tickY - 14, width: 52, height: 20, rx: 10 }, cur);
  const pillText = el("text", { class: "fc-pill-t", y: tickY + 0.5, "text-anchor": "middle" }, cur);
  const now = flown.map(() => el("circle", { class: "fc-base", r: 4.6, "aria-hidden": "true" }, svg));
  const seekStrip = el("rect", { class: "fc-hit", x: n1(X(0)), y: TOP[0] - 10, width: n1(VIEW_W - X(0)), height: tickY + 10 - (TOP[0] - 10) }, svg);

  // the event labels light up on a lemon-coloured patch, sized to the text once the fonts are in
  const placeGlows = () => {
    for (const ev of events) {
      if (!ev.label) continue;
      let box;
      try { box = ev.label.getBBox(); } catch (e) { continue; }
      if (!box.width) continue;
      if (!ev.glow) {
        ev.glow = el("rect", { class: "fc-glow", rx: 6 }, null);
        ev.label.parentNode.insertBefore(ev.glow, ev.label);
      }
      ev.glow.setAttribute("x", n1(box.x - 7));
      ev.glow.setAttribute("y", n1(box.y - 3));
      ev.glow.setAttribute("width", n1(box.width + 14));
      ev.glow.setAttribute("height", n1(box.height + 6));
    }
  };

  /* ---------------- one frame ---------------- */
  // t: the cursor's time; outro: 0 while the cursor runs, rising to 1 as the end turns into the whole-rollout view
  const FIRST = 0.55, FLOOR = 0.12, FADE = 1.2, GROW = 0.18, OUTRO = 0.9, FLASH = 0.9;
  let t = END, outro = 1, playing = false;
  const ind = bar.querySelector(".cx-ind");
  const button = (act) => bar.querySelector(`[data-act="${act}"]`);
  const bPrev = button("prev"), bPlay = button("play"), bNext = button("next"), bReset = button("reset");
  const newest = (time) => {
    let k = -1;
    for (let i = 0; i < N; i++) if (issued[i].t <= time + 1e-6) k = i;
    return k;
  };
  const fade = (node, a) => {
    node.style.opacity = a.toFixed(3);
    node.style.display = a > 0.004 ? "" : "none";
  };

  const render = () => {
    const o = outro, tc = Math.min(t, END), xc = X(tc), k = newest(tc);
    flownEls.forEach((node, i) => node.setAttribute("points", tc >= END - 1e-6 ? flownFull[i] : fmt(upTo(flown[i], xc))));

    let grow = 1;
    issued.forEach((is, i) => {
      const age = tc - is.t;
      const opNow = i > k ? 0 : i === k ? 1 : FLOOR + (FIRST - FLOOR) * Math.exp(-Math.max(0, age - EVERY) / FADE);
      const op = lerp(opNow, is.pick ? 1 : 0.42, o);
      const w = lerp(i === k ? 2.6 : 1.2, is.pick ? 2.6 : 1.2, o);
      const g = i === k && playing && o === 0 ? clamp(age / GROW) : 1;
      if (i === k) grow = g;
      for (const path of is.paths) {
        fade(path.node, op);
        path.node.style.strokeWidth = w.toFixed(2);
        if (g < 1) {
          path.node.setAttribute("points", fmt(path.p.slice(0, Math.max(2, Math.ceil(g * (path.p.length - 1)) + 1))));
          path.cut = true;
        } else if (path.cut) {
          path.node.setAttribute("points", path.full);
          path.cut = false;
        }
      }
    });

    // the newest forecast's waypoints: every 5th point, 0.25 s apart, ten over its 2.5 s
    const fresh = k >= 0 ? issued[k] : null;
    wps.forEach((set, panel) => {
      const path = fresh ? fresh.paths.find((p) => p.panel === panel) : null;
      set.forEach((c, j) => {
        const idx = 5 * (j + 1);
        const ok = path && idx < path.p.length && idx <= grow * (path.p.length - 1) + 1e-6;
        if (ok) {
          c.setAttribute("cx", n1(path.p[idx][0]));
          c.setAttribute("cy", n1(path.p[idx][1]));
        }
        fade(c, ok ? 1 - o : 0);
      });
    });
    for (const node of marks) fade(node, o);

    fade(cur, 1 - o);
    for (const line of curLines) {
      line.setAttribute("x1", n1(xc));
      line.setAttribute("x2", n1(xc));
    }
    const px = clamp(xc, 27, VIEW_W - 27);
    pill.setAttribute("x", n1(px - 26));
    pillText.setAttribute("x", n1(px));
    pillText.textContent = `${show1(tc)} s`;
    now.forEach((c, i) => {
      c.setAttribute("cx", n1(xc));
      c.setAttribute("cy", n1(yAt(flown[i], xc)));
      fade(c, 1 - o);
    });
    for (const { node, x } of ticks) node.style.opacity = lerp(clamp((Math.abs(x - px) - 38) / 10), 1, o).toFixed(3);

    for (const ev of events) {
      const reached = o > 0 || tc >= ev.t - 1e-6;
      const flash = reached && o === 0 ? clamp(1 - (tc - ev.t) / FLASH) : 0;
      for (const line of ev.lines) {
        line.classList.toggle("is-ahead", !reached);
        line.classList.toggle("is-hit", reached);
        line.style.strokeWidth = reached ? (1.2 + 1.6 * flash).toFixed(2) : "";
        line.style.stroke = flash > 0.02 ? "#2f2f2f" : "";
      }
      if (ev.label) ev.label.style.opacity = reached ? "1" : "0";
      if (ev.glow) ev.glow.style.opacity = (0.55 * flash).toFixed(3);
    }

    const total = show1(END);
    ind.innerHTML = o >= 1
      ? `<b>${total} s</b> · all ${N} forecasts`
      : `<b>${show1(tc)} s</b> of ${total} s · forecast ${Math.max(1, k + 1)} of ${N}`;
    bPrev.disabled = o === 0 && tc <= 1e-6;
    bNext.disabled = o >= 1;
  };

  /* ---------------- the player ---------------- */
  const ICON = {
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    pause: '<rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/>',
  };
  let raf = 0, last = 0, touched = false, resume = false, started = false;
  const setPlaying = (on) => {
    playing = on;
    bPlay.setAttribute("aria-pressed", String(on));
    bPlay.setAttribute("aria-label", on ? "Pause" : "Play");
    bPlay.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[on ? "pause" : "play"]}</svg>`;
  };
  const frame = (stamp) => {
    raf = 0;
    const dt = last ? Math.min(0.064, (stamp - last) / 1000) : 0.016;
    last = stamp;
    if (playing) {
      if (t < END) t = Math.min(END, t + dt);
      else if (outro < 1) outro = Math.min(1, outro + dt / OUTRO);
      else setPlaying(false);
      render();
    }
    if (playing) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const play = () => {
    if (still()) return;
    if (outro >= 1) {
      t = 0;
      outro = 0;
    }
    setPlaying(true);
    render();
    kick();
  };
  const pause = () => {
    if (playing) {
      setPlaying(false);
      render();
    }
  };
  const take = () => { // the reader took over: no autoplay from here on
    touched = true;
    resume = false;
    pause();
  };
  const seek = (time, o = 0) => {
    t = clamp(time, 0, END);
    outro = o;
    render();
  };
  const step = (dir) => {
    take();
    if (outro > 0) {
      if (dir < 0) seek(issued[N - 1].t);
      else seek(END, 1);
      return;
    }
    const k = newest(t);
    if (dir > 0) {
      if (k + 1 < N) seek(issued[k + 1].t);
      else seek(END, 1);
    } else if (k >= 0 && t - issued[k].t > 0.05) seek(issued[k].t);
    else seek(k >= 1 ? issued[k - 1].t : 0);
  };

  bPlay.addEventListener("click", () => {
    touched = true;
    resume = false;
    if (playing) pause();
    else play();
  });
  bPrev.addEventListener("click", () => step(-1));
  bNext.addEventListener("click", () => step(1));
  bReset.addEventListener("click", () => {
    take();
    seek(0);
    play();
  });

  // click or drag on the drawing to put the cursor there (touch: a tap, so that the page still scrolls)
  const timeAt = (event) => {
    const m = svg.getScreenCTM();
    if (!m) return t;
    return T(new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse()).x);
  };
  let dragging = false, down = null;
  seekStrip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch") {
      down = [event.clientX, event.clientY];
      return;
    }
    take();
    dragging = true;
    try { seekStrip.setPointerCapture(event.pointerId); } catch (e) { /* a pointer the page did not see go down */ }
    seek(timeAt(event));
    event.preventDefault();
  });
  seekStrip.addEventListener("pointermove", (event) => { if (dragging) seek(timeAt(event)); });
  seekStrip.addEventListener("pointerup", (event) => {
    if (!dragging && down && Math.hypot(event.clientX - down[0], event.clientY - down[1]) < 8) {
      take();
      seek(timeAt(event));
    }
    dragging = false;
    down = null;
  });
  seekStrip.addEventListener("pointercancel", () => { dragging = false; down = null; });

  const sync = () => {
    bPlay.hidden = still();
    if (still()) pause();
  };
  motion.addEventListener ? motion.addEventListener("change", sync) : motion.addListener(sync);

  // At rest the figure shows the whole rollout. It plays once from the start when it first comes into view, pauses while
  // scrolled away and carries on when it is back.
  bar.hidden = false;
  setPlaying(false);
  sync();
  render();
  placeGlows();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeGlows(); render(); });
  if ("IntersectionObserver" in window) {
    const fig = svg.closest("figure") || svg;
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          if (!started && !touched && !still()) {
            started = true;
            seek(0);
            play();
          } else if (resume) {
            resume = false;
            play();
          }
        } else if (entry.intersectionRatio < 0.1 && playing) {
          resume = true;
          pause();
        }
      }
    }, { threshold: [0, 0.1, 0.45] }).observe(fig);
  }
  // for screenshots and tests: show(8.4) freezes the cursor at 8.4 s; show(16.05, 1) is the whole-rollout view
  root.forecastPlayer = {
    show(time, o) {
      take();
      seek(time, o === undefined ? (time >= END ? 1 : 0) : o);
    },
    end: END,
  };
})();
