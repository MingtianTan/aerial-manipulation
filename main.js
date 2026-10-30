(function () {
  // Parts start collapsed. A link into a part opens it; closing a part pauses its videos.
  const parts = [...document.querySelectorAll("details.part-block, details.method-block")];

  // Open every collapsible box around the target: the part and, inside Part 5, the model's own box.
  function openPartOf(target) {
    for (let box = target.closest("details"); box; box = box.parentElement?.closest("details")) {
      if (!box.open) box.open = true;
    }
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

  // Clip groups that play together on a loop while every box around them is open: Part 2's before / after pairs
  // (with the restart / pause buttons) and, in Part 5, the 3 × 3 gallery and the three cameras of the hardest task.
  const play = (video) => {
    const played = video.play();
    if (played && played.catch) played.catch(() => {});
  };
  const boxesOf = (el) => {
    const boxes = [];
    for (let box = el.closest("details"); box; box = box.parentElement?.closest("details")) boxes.push(box);
    return boxes;
  };
  const groups = ["#upgrades", "#benchmark-demos", "#benchmark-hardest"]
    .map((selector) => [...document.querySelectorAll(selector + " video")])
    .filter((videos) => videos.length)
    .map((videos) => ({ videos, boxes: boxesOf(videos[0]), run: 0 }));
  const isOpen = (group) => group.boxes.every((box) => box.open);
  const clipsGroup = groups.find((group) => group.videos[0].closest("#upgrades")) || null;
  const pauseButton = document.querySelector("[data-pause-all]");
  const restartButton = document.querySelector("[data-restart-all]");

  function playGroup(group) {
    group.videos.forEach(play);
    if (group === clipsGroup && pauseButton) pauseButton.textContent = "Pause all";
  }

  function restartGroup(group) {
    group.videos.forEach((video) => { video.currentTime = 0; });
    playGroup(group);
  }

  // Start every clip of the group, then restart them from zero together once each can play.
  function startGroup(group) {
    const run = ++group.run;
    playGroup(group);
    const waiting = group.videos.filter((video) => video.readyState < 3);
    let left = waiting.length;
    if (!left) return restartGroup(group);
    waiting.forEach((video) => {
      video.addEventListener("canplay", () => {
        left -= 1;
        if (left === 0 && run === group.run && isOpen(group)) restartGroup(group);
      }, { once: true });
    });
  }

  function stopGroup(group) {
    group.run += 1;
    group.videos.forEach((video) => video.pause());
  }

  if (restartButton && clipsGroup) restartButton.addEventListener("click", () => restartGroup(clipsGroup));
  if (pauseButton && clipsGroup) {
    pauseButton.addEventListener("click", () => {
      if (clipsGroup.videos.some((video) => !video.paused)) {
        clipsGroup.videos.forEach((video) => video.pause());
        pauseButton.textContent = "Play all";
      } else {
        playGroup(clipsGroup);
      }
    });
  }

  parts.forEach((part) => {
    part.addEventListener("toggle", () => {
      groups.forEach((group) => {
        if (!group.boxes.includes(part)) return;
        if (isOpen(group)) startGroup(group);
        else stopGroup(group);
      });
      if (!part.open) part.querySelectorAll("video").forEach((video) => video.pause());
    });
  });

  // All tasks (Part 2): hover a cell to play it. Every clip: click to enlarge it; the benchmark clips keep playing
  // in their group afterwards.
  const lightbox = document.querySelector(".lightbox");
  const canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  let lightboxSource = null;
  document.querySelectorAll(".matrix video, .bench-clip").forEach((video) => {
    const isBenchClip = video.classList.contains("bench-clip");
    if (canHover && !isBenchClip) {
      video.addEventListener("mouseenter", () => play(video));
      video.addEventListener("mouseleave", () => video.pause());
    }
    video.addEventListener("click", () => {
      if (!lightbox || typeof lightbox.showModal !== "function") {
        if (video.paused) play(video);
        else video.pause();
        return;
      }
      const big = lightbox.querySelector("video");
      lightboxSource = video;
      video.pause();
      big.poster = video.getAttribute("poster") || "";
      big.src = video.getAttribute("src");
      lightbox.querySelector("[data-lightbox-title]").textContent = video.getAttribute("aria-label");
      lightbox.showModal();
      play(big);
    });
  });
  if (lightbox) {
    lightbox.querySelector("[data-lightbox-close]").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => {
      const big = lightbox.querySelector("video");
      big.pause();
      big.removeAttribute("src");
      big.load();
      if (lightboxSource && lightboxSource.classList.contains("bench-clip")) {
        const group = groups.find((g) => g.videos.includes(lightboxSource));
        if (!group || isOpen(group)) play(lightboxSource);
      }
      lightboxSource = null;
    });
  }

  // Highlight the nav link for what is in view: the section's own link if it has one, else its part's.
  const links = [...document.querySelectorAll(".nav a[href^='#']")];
  const linkFor = new Map();
  document.querySelectorAll("main section, summary.part").forEach((el) => {
    const own = links.find((link) => link.getAttribute("href") === "#" + el.id);
    const summary = el.closest("details.part-block")?.querySelector("summary.part");
    const link = own || links.find((l) => summary && l.getAttribute("href") === "#" + summary.id);
    if (link) linkFor.set(el, link);
  });
  if ("IntersectionObserver" in window && linkFor.size) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const current = linkFor.get(entry.target);
          links.forEach((link) => {
            if (link === current) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    linkFor.forEach((_, el) => spy.observe(el));
  }
})();
