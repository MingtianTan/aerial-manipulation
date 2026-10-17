(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const film = document.querySelector("[data-film]");
  if (film) {
    const frames = [...film.querySelectorAll(".stage img")];
    const dots = [...film.querySelectorAll(".dots button")];
    const playBtn = film.querySelector("[data-play]");
    let index = 0;
    let timer = null;

    function show(next) {
      index = (next + frames.length) % frames.length;
      frames.forEach((img, i) => img.classList.toggle("on", i === index));
      dots.forEach((dot, i) => {
        dot.classList.toggle("on", i === index);
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
    }

    function play() {
      if (reduce || timer) return;
      timer = window.setInterval(() => show(index + 1), 1200);
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-pressed", "true");
    }

    function pause() {
      if (timer) window.clearInterval(timer);
      timer = null;
      playBtn.textContent = "Play";
      playBtn.setAttribute("aria-pressed", "false");
    }

    film.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.hasAttribute("data-play")) {
        timer ? pause() : play();
        return;
      }
      if (target.dataset.dir) {
        pause();
        show(index + Number(target.dataset.dir));
        return;
      }
      if (target.dataset.frame) {
        pause();
        show(Number(target.dataset.frame));
      }
    });

    show(0);
    play();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
    });
  }

  const beats = [...document.querySelectorAll(".beat")];
  if (beats.length && !reduce) {
    let step = 0;
    const tick = () => {
      beats.forEach((beat, i) => beat.classList.toggle("on", i === step));
      step = (step + 1) % beats.length;
    };
    tick();
    window.setInterval(tick, 2200);
  } else if (beats[0]) {
    beats[0].classList.add("on");
  }

  document.querySelectorAll(".todo input[type='checkbox']").forEach((box) => {
    const key = "am-todo:" + box.id;
    try {
      box.checked = localStorage.getItem(key) === "1";
      box.addEventListener("change", () => {
        localStorage.setItem(key, box.checked ? "1" : "0");
      });
    } catch (err) {
      /* file pages can block storage; the checkbox still toggles */
    }
  });

  // A link to anything inside a collapsed page opens that page first.
  function revealHash(hash) {
    if (!hash || hash === "#") return;
    let target = null;
    try { target = document.querySelector(hash); } catch (err) { return; }
    if (!target) return;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
    }
    if (target.tagName === "DETAILS") target.open = true;
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (link) revealHash(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", () => revealHash(location.hash));
  if (location.hash) {
    revealHash(location.hash);
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView();
  }

  // Before / after: restart both videos together.
  document.querySelectorAll("[data-sync]").forEach((button) => {
    const pair = button.previousElementSibling;
    button.addEventListener("click", () => {
      pair.querySelectorAll("video").forEach((video) => {
        video.currentTime = 0;
        const played = video.play();
        if (played && played.catch) played.catch(() => {});
      });
    });
  });

  // All-tasks gallery: switch every tile between Demo 1 and Demo 2.
  const gallery = document.querySelector("[data-gallery]");
  const seg = document.querySelector(".seg");
  if (gallery && seg) {
    const chipClass = (result) =>
      result.startsWith("5/5") ? "ok" : parseInt(result, 10) > 0 ? "part" : "bad";
    seg.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-demo]");
      if (!button) return;
      const demo = button.dataset.demo;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      gallery.querySelectorAll(".tile").forEach((tile) => {
        const task = tile.dataset.task;
        const video = tile.querySelector("video");
        video.pause();
        video.poster = `assets/dataset/poster/${demo}_${task}.jpg`;
        video.querySelector("source").src = `assets/dataset/${demo}/${task}.mp4`;
        video.load();
        const result = demo === "demo1" ? tile.dataset.r1 : tile.dataset.r2;
        const chip = tile.querySelector(".tile-result .chip");
        chip.textContent = result;
        chip.className = "chip " + chipClass(result);
      });
    });
  }

  const links = [...document.querySelectorAll(".nav a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => {
          const on = link.getAttribute("href") === "#" + visible.target.id;
          if (on) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    sections.forEach((section) => spy.observe(section));
  }
})();
