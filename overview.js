// The overview page: clips that play while on screen, task clips on hover or tap, the carousel's arrows, chart tooltips.
(() => {
  const play = (video) => video.play().catch(() => {});
  // With "reduce motion" set, nothing plays by itself: the clips get controls, and the task clips still play on hover or tap.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll("video[autoplay], video[data-autoplay]").forEach((video) => {
      video.removeAttribute("autoplay");
      video.pause();
      video.controls = true;
    });
  } else if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? play(entry.target) : entry.target.pause();
    }, { threshold: 0.5 });
    document.querySelectorAll("video[data-autoplay]").forEach((video) => seen.observe(video));
  }
  for (const card of document.querySelectorAll(".task")) {
    const video = card.querySelector("video");
    card.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") play(video); });
    card.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") video.pause(); });
    card.addEventListener("click", () => (video.paused ? play(video) : video.pause()));
  }
  for (const wrap of document.querySelectorAll(".carousel-wrap")) {
    const track = wrap.querySelector(".carousel");
    for (const button of wrap.querySelectorAll("[data-dir]")) {
      button.addEventListener("click", () => track.scrollBy({ left: Number(button.dataset.dir) * track.clientWidth * 0.8, behavior: "smooth" }));
    }
  }
  // Tooltips: any element with data-tip; its first line is the heading. Text goes in with textContent.
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  document.body.append(tip);
  let current = null;
  const show = (el, x, y) => {
    if (el !== current) {
      current = el;
      tip.replaceChildren(...el.dataset.tip.split("\n").map((line, i) => {
        const row = document.createElement("div");
        row.textContent = line;
        if (i === 0) row.className = "tip-head";
        return row;
      }));
      tip.hidden = false;
    }
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (top + h > innerHeight - 8) top = y - h - 14;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  };
  const hide = () => { current = null; tip.hidden = true; };
  document.addEventListener("pointermove", (event) => {
    const el = event.target.closest && event.target.closest("[data-tip]");
    if (el) show(el, event.clientX, event.clientY);
    else if (current) hide();
  });
  document.addEventListener("focusin", (event) => {
    const el = event.target.closest && event.target.closest("[data-tip]");
    if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.bottom); }
  });
  document.addEventListener("focusout", hide);
  addEventListener("scroll", () => { if (current && document.activeElement !== current) hide(); }, { passive: true });
})();
