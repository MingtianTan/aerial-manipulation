(function () {
  // Before / after: every pair plays together on a loop; buttons restart or pause them all.
  const clips = [...document.querySelectorAll("#upgrades video")];
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

  // Start all clips from zero together once each can play.
  let ready = 0;
  clips.forEach((video) => {
    const onReady = () => {
      ready += 1;
      if (ready === clips.length) restartAll();
    };
    if (video.readyState >= 3) onReady();
    else video.addEventListener("canplay", onReady, { once: true });
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
