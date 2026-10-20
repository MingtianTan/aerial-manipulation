# Aerial manipulation

Project page (GitHub Pages, served from this folder): https://mingtiantan.github.io/aerial-manipulation/

This repository holds the page only: `index.html`, `styles.css`, `main.js` and `assets/` (the task videos, posters and
figures it shows). Everything that produced the results is in the private repository
[`MingtianTan/Aerial_Manipulation_Code`](https://github.com/MingtianTan/Aerial_Manipulation_Code), in the layout this
repository had before the two were split (2026-10-20):

| Folder there | What it holds |
| --- | --- |
| `ambench/` | A snapshot of AM-Bench with the FA-Hexa specialist fixes and the recording changes (`SPECIALIST_FIXES.diff`, `DATAGEN_CHANGES.diff`). |
| `pipeline/datagen/` | Training-data generation: batch recorder, per-episode verifier and selection, OpenPI export and checks. |
| `pipeline/omni_demo/`, `pipeline/ambench_way/` | The demo recorder and probes; the AM-Bench π0.5 record / prepare / serve / evaluate path. |
| `docs/` | `training-data.md`, `disturbance-variants.md`, research notes. |
| `data/videos/` | All recorded runs and logs behind the clips shown here. |
| `datasets/` | The 4,800 training demos (local only, about 300 GB). |
