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
