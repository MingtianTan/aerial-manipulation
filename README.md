# Aerial manipulation

Project page (GitHub Pages, served from this folder): https://mingtiantan.github.io/aerial-manipulation/

This repository holds the page and everything used for its AM-Bench work: the upgraded specialists, the
recording and evaluation pipeline, and the recorded videos.

## Layout

| Folder | What it holds |
| --- | --- |
| `index.html`, `styles.css`, `main.js`, `assets/` | The project page. |
| `ambench/` | A snapshot of [AM-Bench](https://github.com/ambench/ambench) (Apache-2.0, upstream commit `60bf5b7`) with the FA-Hexa specialist fixes from Part 2 applied. |
| `ambench/SPECIALIST_FIXES.diff` | The code changes against upstream (the USD collider change is in the snapshot, not in the diff). |
| `ambench/SUBMODULES.txt` | The commits of the submodules `ext/acados`, `ext/openpi` and `ext/pyroki`, which are not copied. |
| `pipeline/` | Launch, recording, probe and π0.5 serve/eval scripts. |
| `pipeline/omni_demo/` | The demo recorder (`record_demo_videos.py`), the batch recording scripts and the probes. |
| `pipeline/ambench_way/` | The AM-Bench π0.5 path: record, prepare data, serve, evaluate. |
| `pipeline/am_ins.txt` | Launch notes. |
| `data/videos/fahexa_demo2/` | FA-Hexa, 12 tasks × 5 runs, with the upgraded specialists (Part 2 "after" and the gallery). |
| `data/videos/before_clips/` | The official specialists on the 6 changed tasks (Part 2 "before"). |
| `data/videos/omnihexa_demo/` | The first recording on OmniHexa with the official specialists. |
| `data/videos/fahexa_disturbance/` | Logs and summaries of the disturbance recordings (videos: `assets/dataset/{aero,wind05,wind10,wind20}/`, all runs local in `~/Desktop/demo3`). |
| `docs/disturbance-variants.md` | The 48 FA-Hexa disturbance variants: conditions, task IDs, specialists. |
| `data/asset_backup/` | The original `omni_scorpion_physics.usd`, before the collider change. |

## Changed tasks

The specialists and success checks changed for six tasks on `*-Am-FAHexa-Abs-PID-Direct-v0`:

- **Toss ball**: `TossBallLobPolicy` in `policies/scripted/toss_ball.py`.
- **Wipe window**: `WipeWindowPressPolicy` in `policies/scripted/wipe_window.py`.
- **Frame assembly**: `FrameAssemblyBarGraspPolicy` in `policies/scripted/frame_assembly.py`, and a seated success check in `tasks/frame_assembly/frame_assembly_env.py`.
- **Open door**: `OpenDoorHandlePolicy` in `policies/scripted/open_door.py`, and a handle latch in `tasks/open_door/`.
- **Harvest lemon**: `LemonHarvestingCenterDropPolicy` in `policies/scripted/lemon_harvesting.py`.
- **Peg in hole**: a grasp-length fix in `tasks/base/base_env.py` and `robots/fa_hexa.py`.

All paths above are under `ambench/source/ambench/ambench/`.

## Running

The scripts use absolute paths from the machine they were written on (`~/Documents/ambench` for AM-Bench,
`~/Documents/Ambench` for the pipeline, and the Isaac Lab venv at `~/Documents/IsaacLab/env_isaaclab`).
To run from a fresh clone, install AM-Bench from `ambench/` as its own README describes, check out the
submodules at the commits in `ambench/SUBMODULES.txt`, and update those paths.

Example: record all 12 tasks on FA-Hexa, 5 runs each.

```bash
ROBOT=FAHexa OUT=~/Desktop/demo2 bash pipeline/omni_demo/record_all_demos.sh
```

## Not included

- π0.5 checkpoints and the OpenPI cache (about 24 GB).
- Recorded LeRobot datasets from the π0.5 debugging runs (about 3 GB).
- The Python virtual environments and Isaac Lab itself.
