(function () {
  // Parts start collapsed. A link into a part opens it; closing a part pauses its videos.
  const parts = [...document.querySelectorAll("details.part-block")];

  function openPartOf(target) {
    const part = target.closest("details.part-block");
    if (part && !part.open) part.open = true;
  }

  document.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (target) openPartOf(target);
    });
  });

  // A shared link to something inside a part opens that part; a link to a part's own bar leaves it closed.
  function revealHash() {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (!target || target.tagName === "SUMMARY") return;
    openPartOf(target);
    target.scrollIntoView({ behavior: "instant" });
  }
  revealHash();
  window.addEventListener("hashchange", () => {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && target.tagName !== "SUMMARY") openPartOf(target);
  });

  // Before / after: every pair plays together on a loop while Part 2 is open; buttons restart or pause them all.
  const clips = [...document.querySelectorAll("#upgrades video")];
  const clipsPart = clips.length ? clips[0].closest("details.part-block") : null;
  const pauseButton = document.querySelector("[data-pause-all]");

  function playAll() {
    clips.forEach((video) => {
      const played = video.play();
      if (played && played.catch) played.catch(() => {});
    });
    if (pauseButton) pauseButton.textContent = "Pause all";
  }

  function restartAll() {
    clips.forEach((video) => { video.currentTime = 0; });
    playAll();
  }

  const restartButton = document.querySelector("[data-restart-all]");
  if (restartButton) restartButton.addEventListener("click", restartAll);
  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      if (clips.some((video) => !video.paused)) {
        clips.forEach((video) => video.pause());
        pauseButton.textContent = "Play all";
      } else {
        playAll();
      }
    });
  }

  // Start all clips, then restart them from zero together once each can play.
  let opening = 0;
  function startClips() {
    const run = ++opening;
    playAll();
    const waiting = clips.filter((video) => video.readyState < 3);
    let left = waiting.length;
    if (!left) return restartAll();
    waiting.forEach((video) => {
      video.addEventListener("canplay", () => {
        left -= 1;
        if (left === 0 && run === opening && clipsPart.open) restartAll();
      }, { once: true });
    });
  }

  parts.forEach((part) => {
    part.addEventListener("toggle", () => {
      if (part.open) {
        if (part === clipsPart) startClips();
      } else {
        opening += 1;
        part.querySelectorAll("video").forEach((video) => video.pause());
      }
    });
  });

  // Highlight the nav link of the part in view.
  const links = [...document.querySelectorAll(".nav a[href^='#']")];
  const targets = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && targets.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            if (link.getAttribute("href") === "#" + entry.target.id) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    targets.forEach((target) => spy.observe(target));
  }
})();
