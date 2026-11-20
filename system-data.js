// Contents of the layered system figure (index.html, #system; drawn by system.js). PARTS describe each part of the
// drawing; every layer can relabel parts (status), fade the ones it does not use (parts: "dim" | "off") and add to a
// part's card (tips: text replaces, rows are appended). Sources: the code repository's branches flight-dit,
// flight-dit-train, b-tok (= b-ctrl) and b-hid (pipeline/flight_dit, pipeline/stage_b and their READMEs), and notes.html.
window.LX_DATA = (() => {
  const PARTS = {
    loop: { name: "The loop", text: "The vehicle moves; the cameras take new frames and the state updates; both models plan again.",
      rows: [["Rates", "physics, IK and PID 120 Hz · cameras 20 Hz · π0.5 re-plans every 0.4 s and flies 8 of its 50 actions"]] },
    cams: { name: "Two cameras · 20 Hz", text: "The end-effector (EE) camera and the body camera, 384 × 384 RGB at 20 Hz.",
      rows: [["π0.5", "both frames through SigLIP"],
        ["FlightFlow", "both frames through a frozen DINOv2-S at 224 px: CLS + 4 × 4 pooled patches, 17 tokens of 384 per camera"]] },
    state: { name: "State · 120 Hz", text: "35 numbers per tick: end-effector pose (3 + 4), gripper width, arm joints (4), base pose (3 + 4), end-effector and base velocities (6 + 6), arm joint velocities (4).",
      rows: [["FlightFlow", "the last 24 ticks (0.2 s), relative to the base, in its heading frame"],
        ["π0.5", "only the gripper width: its state is zero position, identity orientation and the width; the hand's pose only re-expresses its actions relative to the hand. It sees the base through the cameras"]] },
    instr: { name: "Instruction", text: "The task in words.",
      rows: [["π0.5", "reads it as text tokens"], ["FlightFlow", "gets only the task's number, as a learned embedding"]] },
    wires: { name: "Inputs", text: "The same cameras, state and task reach both models; each reads them its own way. Hover an input for how." },
    ffbox: { name: "FlightFlow", text: "A 43.8 M-parameter flow-matching transformer (FD-40) that forecasts where the base will be over the next 2.5 s. Develop mode and earlier notes call it the Flight DiT.",
      rows: [["Trained on", "2,102 demonstrations by the scripted experts: 11 tasks, default physics, recorded 11–12 Nov; 88 more held out"],
        ["Recipe", "50k steps, batch 256, AdamW, learning rate 3e-4 with cosine decay, EMA 0.999; one RTX 4090, about 1.8 h"]] },
    dino: { name: "DINOv2-S · frozen", text: "facebook/dinov2-small, no gradient. Per camera the CLS token and 4 × 4 average-pooled patches: 17 tokens of 384, 34 for the two cameras, read by every block through cross-attention. Training reads a float16 cache of them." },
    senc: { name: "State encoder", text: "A causal temporal convolution over the last 24 ticks (0.2 s) of the state: 1 × 1 convolution to 512, then four residual causal convolutions (kernel 3, dilations 1, 2, 4, 8). The ends of the window's four quarters become 4 state tokens." },
    task: { name: "Task", text: "A learned embedding of the task's number (11 tasks; Toss ball is left out). With the flow time and the image age it forms the condition vector that modulates every block (adaRMSNorm-Zero)." },
    fmt: { name: "Flow-matching transformer", text: "55 tokens (50 path, 4 state, one learned [Z]) through 14 blocks of self-attention, cross-attention to the 34 image tokens and a feed-forward layer; width 512, 8 heads.",
      rows: [["Training", "noisy path x_τ = τ·x + (1 − τ)·ε; the path tokens predict the velocity x − ε (squared error); images or state dropped in 10 %"],
        ["Sampling", "4 Euler steps from Gaussian noise; 8 paths, averaged"],
        ["Loss", "flow + 0.5 × the latent's auxiliary loss"]] },
    fc: { name: "The forecast", text: "The base's x, y, z displacement at the next 50 policy steps (0.05 s apart, so 2.5 s), in its heading frame. Yaw is not predicted; the IK holds it.",
      rows: [["Latent z", "256 numbers from the [Z] token, trained only to predict the base's displacement and velocity 0.4 s ahead (weight 0.5)"],
        ["Error at 1.0 s", "1.25 cm on held-out demonstrations (constant velocity: 12.7 cm)"]] },
    pibox: { name: "π0.5", text: "OpenPI's π0.5, 3,353.7 M parameters: SigLIP and Gemma-2B read the images and words; a 300 M action expert writes 50 actions by flow matching.",
      rows: [["Step 3", "all weights fine-tuned for 30k steps on 960 default-physics demonstrations, both cameras: the 30k checkpoint"],
        ["Plans", "every 0.4 s: 50 end-effector targets (pose and gripper); the first 8 are flown"]] },
    siglip: { name: "SigLIP", text: "π0.5's image encoder: both camera frames become image tokens at the front of the prefix." },
    text: { name: "Text tokens", text: "The instruction, tokenised, after the image tokens in π0.5's prefix." },
    vlm: { name: "Gemma-2B VLM", text: "Reads the prefix, image and text tokens. The action expert attends to it in every layer." },
    ax: { name: "Action expert", text: "A Gemma-300M (18 layers, width 1024, 8 heads) that writes 50 actions of 8 numbers, the end effector's target pose relative to itself and the gripper, by flow matching in 10 steps, attending to the prefix in every layer." },
    tok: { name: "FlightFlow → π0.5", text: "FlightFlow's forecast as extra tokens in π0.5's action expert. Used in stage A and test 3 (10 waypoints and z) and in B-hid (44 hidden states)." },
    chunk: { name: "π0.5 → FlightFlow", text: "π0.5's planned chunk as an input to FlightFlow. Used in tests 1 and 2." },
    ctl: { name: "Inverse kinematics + PID", text: "Pyroki floating-base inverse kinematics and a PID, at 120 Hz like the physics, turn the targets into rotor and joint commands. Roll, pitch and yaw are held fixed." },
    veh: { name: "FA-Hexa", text: "AM-Bench's fully actuated hexarotor (6.6 kg) with a 4-DoF arm, simulated in Isaac Lab." },
    wbase: { name: "The base's command", text: "From FlightFlow to the controller. Not used in this layer: the IK places the base." },
    whand: { name: "The hand's target pose", text: "π0.5's first 8 actions, each interpolated over 6 ticks (0.05 s), are the end effector's targets." },
  };

  // FlightFlow → π0.5 as 11 tokens: the message of stage A and test 3
  const MSG = [
    ["Waypoints", "the mean path's base displacement at 0.25, 0.5, …, 2.5 s: 10 × 3, rotated into π0.5's end-effector frame, scaled"],
    ["Latent z", "256 numbers: the mean of the 8 samples' [Z] outputs"],
    ["Projection", "Linear 3 → 1024 per waypoint, Linear 256 → 1024 for z, plus a learned slot embedding: about 0.28 M parameters"],
    ["Placement", "[11 message][50 action] tokens in the action expert; the prefix never sees the message, the actions see it in every layer; off for Toss ball"],
  ];
  const MSG_TEXT = "At each π0.5 re-plan the frozen FlightFlow (fdcl_nc) forecasts with one fixed noise, so the message is the same offline and online.";
  const AX = (data) => [
    ["Trained", "430.4 M of 3,353.7 M parameters: action expert, its projections, time MLPs, message projections; Gemma-2B and SigLIP frozen"],
    ["Recipe", "from the 30k checkpoint, 15k steps, batch 32, learning rate 1e-5 → 1e-6, EMA 0.99, message dropped in 10 %; one RTX 4090, about 5.7 h"],
    ["Data", data],
  ];
  const FROZEN_FF = { ffbox: ["trained first, then frozen", "fd"], fmt: ["fdcl_nc", "fd"], fmt2: ["chunk-blind", "fd"], dino: "frozen", senc: "frozen", task: "frozen" };
  const FDCL = ["This model", "fdcl_nc: fine-tuned on π0.5's own flights (test 2), chunk-blind, frozen"];
  const PULL = { name: "The pull on the base", text: "The newest forecast's point 0.1 s ahead, blended over 6 ticks, shifts the anchor of the IK's base-smoothness term: prev + α (ref − prev), α = 0.2 (w = 0.5, tuned on seeds 1000–1009). The base moves mostly in stand-off and height." };
  const PIN = { name: "The base's stand-off and height", text: "A new forecast at every π0.5 re-plan; the executor pins the base's x (stand-off) and z (height) to the path, blended over 6 ticks. The IK solves y and the arm; the base yields when the hand would miss by more than 1 mm.",
    rows: [["Tracking", "base command 0.4–1.5 cm from the path on ten tasks, 4.3 cm on inspection"]] };

  const LAYERS = [
    {
      name: "π0.5 alone", sub: "The reference; the IK flies the base", colour: "#5c6470", soft: "#f4f5f7", short: "π0.5 alone",
      title: "π0.5 alone", when: "the reference in every test",
      parts: { ffbox: "dim", dino: "dim", senc: "dim", task: "dim", fmt: "dim", fc: "dim", tok: "dim", chunk: "dim", wbase: "off" },
      flow: ["whand"],
      status: { pibox: ["all weights fine-tuned", "pi"], siglip: ["fine-tuned", "pi"], vlm: ["fine-tuned", "pi"], ax: ["fine-tuned", "pi"],
        axnote: "50 action tokens; the first 8 are flown", ctl: "solves base and arm, 120 Hz", ffbox: "not used" },
      summary: "<b>82.1 %</b> judged success on default physics: 271 of 330 rollouts (11 tasks × 30 seeds; every test uses the same seeds). The base simply follows: the IK solves base and arm together so that the hand reaches π0.5's target.",
      tips: { ctl: { text: "Pyroki floating-base inverse kinematics and a PID at 120 Hz solve base and arm together so that the hand reaches π0.5's target; nothing else steers the base." } },
    },
    {
      name: "Test 1 · π0.5 → FlightFlow", sub: "FlightFlow reads π0.5's chunk and pulls the base", colour: "#74bf8b", soft: "#f2faf4", short: "test 1",
      title: "Test 1: the forecast pulls the base", when: "13–16 Nov · π0.5 frozen, never sees the forecast",
      parts: { tok: "dim" }, flow: ["chunk", "wbase", "whand"],
      status: { ffbox: ["trained on demonstrations, frozen", "fd"], fmt: ["fd40_c", "fd"], fmt2: ["reads the chunk", "fd"], fmt3: ["every frame, 20 Hz", "fd"],
        dino: "frozen", senc: ["trained", "fd"], task: ["trained", "fd"], pibox: "frozen: the 30k checkpoint", siglip: "frozen", vlm: "frozen", ax: "frozen",
        axnote: "50 action tokens; the first 8 are flown", ctl: "base anchor pulled, 120 Hz", wbase: "a pull on the base", wbase2: "toward 0.1 s ahead", chunk: "π0.5’s chunk, 50 × 8" },
      summary: "<b>68.8 %</b> against 82.1 % for π0.5 alone (227 against 271 of 330). The chunk-blind twin scored 229, so the loss comes from moving the base, not from reading the chunk. Inspection fell from 30 to 0 of 30, lemon from 28 to 13.",
      tips: {
        chunk: { name: "π0.5 → FlightFlow: the chunk", text: "FlightFlow (fd40_c) reads π0.5's newest chunk: 50 actions × 8 numbers, the end effector's absolute target position, quaternion and gripper width. Not separate tokens, not a latent.",
          rows: [["Aligned", "path step k reads chunk index age / 6 + k, interpolated; steps past the chunk's end are zeroed and flagged"],
            ["Enters", "concatenated into each of the 50 path tokens, [noisy path 3 | chunk 8 | valid 1] → MLP, base-relative in the heading frame; the age, a valid flag and the base's motion since the plan join the condition vector"],
            ["Trained with", "half the samples π0.5's chunks computed offline on the demonstrations' own images (74,960), half the demonstrations' targets plus drift; dropped in 20 %"],
            ["Worth", "2.2 % lower error at 1.0 s offline; in the loop 227 against 229 of 330 for the chunk-blind twin (p = 0.88)"]] },
        fmt: { rows: [["This model", "fd40_c reads the chunk; its chunk-blind twin fd40_nc ran beside it"], ["Runs", "a forecast at every camera frame (20 Hz)"]] },
        ffbox: { rows: [["In this test", "frozen at its best checkpoint (lowest 1.0 s error)"]] },
        wbase: PULL,
        ctl: { text: "The same inverse kinematics and PID as π0.5 alone, with the anchor of the base pulled toward FlightFlow's forecast." },
        pibox: { rows: [["In this test", "the 30k checkpoint, unchanged; it never sees the forecast"]] },
      },
    },
    {
      name: "Test 2 · FlightFlow on π0.5's flights", sub: "The same, FlightFlow fine-tuned on π0.5's flights", colour: "#46a86e", soft: "#eff8f2", short: "test 2",
      title: "Test 2: FlightFlow fine-tuned in the loop", when: "17 Nov · four tasks, 30 rollouts each",
      parts: { tok: "dim" }, flow: ["chunk", "wbase", "whand"],
      status: { ffbox: ["fine-tuned on π0.5’s flights", "fd"], fmt: ["fdcl_c, fdcl_nc", "fd"], fmt2: ["tuned on flights", "fd"], fmt3: ["every frame, 20 Hz", "fd"],
        dino: "frozen", senc: ["trained", "fd"], task: ["trained", "fd"], pibox: "frozen: the 30k checkpoint", siglip: "frozen", vlm: "frozen", ax: "frozen",
        axnote: "50 action tokens; the first 8 are flown", ctl: "base anchor pulled, 120 Hz", wbase: "a pull on the base", wbase2: "toward 0.1 s ahead", chunk: "π0.5’s chunk (fdcl_c)" },
      summary: "<b>Inspection 0 %, lemon 50 %</b> against 100 % and 93 % for π0.5 alone. The rule fixed in advance (inspection at least 26, lemon at least 24 of 30) failed; an IK replay that learns nothing also lost inspection, so what costs is moving the base under a frozen π0.5.",
      tips: {
        ffbox: { rows: [["π0.5's flights", "200 rollouts of the frozen π0.5 with FlightFlow watching, not acting (w = 0): inspection 60, lemon 60, peg 40, frame 40; 69,622 frames; 160 train, 40 held out"],
          ["Fine-tuning", "10k steps from the EMA weights, batch 256, half demonstrations and half flights, learning rate 1e-4 → 1e-5"],
          ["Error at 1.0 s", "held-out flights 1.63 cm (fdcl_c) and 1.83 cm (fdcl_nc), from 4.21 and 4.79"]] },
        chunk: { name: "π0.5 → FlightFlow: the chunk", text: "As in test 1, fdcl_c reads π0.5's chunk in its path tokens; in fine-tuning the flights' chunk is the one π0.5 was executing. fdcl_nc is its chunk-blind twin.",
          rows: [["Worth", "11 % lower error with the chunk, but chunks whose 1.0 s targets lie 17.3 cm apart move the forecast only 3.3 cm; lemon 15 (reads it) against 18 (blind) of 30, p = 0.61"]] },
        fmt: { rows: [["Runs", "a forecast at every camera frame (20 Hz); fdcl_c on four tasks, fdcl_nc on inspection and lemon"]] },
        wbase: PULL,
        pibox: { rows: [["In this test", "the 30k checkpoint, unchanged"]] },
      },
    },
    {
      name: "Stage A · FlightFlow → π0.5", sub: "Tokens into π0.5; the IK still flies the base", colour: "#2f9e8f", soft: "#eef8f6", short: "stage A",
      title: "Stage A: the message on its own", when: "18 Nov · checked offline before any rollout",
      parts: { chunk: "dim", wbase: "off" }, flow: ["tok"],
      status: { ...FROZEN_FF, fmt3: ["at each re-plan", "fd"], pibox: ["action expert retrained", "pi"], siglip: "frozen", vlm: "frozen", ax: ["retrained", "pi"],
        axnote: "11 message + 50 action tokens", ctl: "solves base and arm, 120 Hz", tok1: "10 waypoints", tok2: "+ 1 latent z" },
      summary: "<b>Not read.</b> Offline, on 3,020 observations of held-out demonstrations, masking the message moved π0.5's first 8 actions by a median of 1.4 mm and swapping in another demonstration's by 0.8 mm; the rule fixed in advance needed 2 mm for both. The closed-loop steps were skipped and stage B went ahead.",
      tips: {
        tok: { name: "FlightFlow → π0.5: 11 tokens", text: MSG_TEXT,
          rows: [...MSG, ["Trained on", "π0.5's own 960 demonstrations: 880 with a message, Toss ball's 80 masked"]] },
        ax: { rows: AX("π0.5's 960 demonstrations; A-ctrl, the same with the message always masked, ends at the same loss (0.0009)") },
        ffbox: { rows: [FDCL] },
      },
    },
    {
      name: "Test 3 · the full system", sub: "Tokens into π0.5; FlightFlow flies the base", colour: "#178a47", soft: "#ecf7f0", short: "test 3", default: true,
      title: "Test 3: the full system (B-tok)", when: "18–20 Nov · as described on this page",
      parts: { chunk: "dim" }, flow: ["tok", "wbase", "whand"],
      status: { ...FROZEN_FF, fmt3: ["path every 0.4 s", "fd"], pibox: ["action expert retrained", "pi"], siglip: "frozen", vlm: "frozen", ax: ["retrained", "pi"],
        axnote: "11 message + 50 action tokens", ctl: "base x, z pinned to the path", wbase: "the base’s stand-off", wbase2: "and height", tok1: "10 waypoints", tok2: "+ 1 latent z" },
      summary: "<b>81.8 %</b> against 82.1 % for π0.5 alone (270 against 271 of 330, p = 1). FlightFlow flying the base under the unchanged π0.5 costs (74.8 %); retraining π0.5 on demonstrations flown that way brings it back (82.7 %, +7.9 points, p = 0.0013); the tokens add nothing measurable (−0.9 points, p = 0.76).",
      tips: {
        tok: { name: "FlightFlow → π0.5: 11 tokens", text: MSG_TEXT,
          rows: [...MSG, ["Trained on", "880 new demonstrations recorded with FlightFlow flying the base (219,905 frames)"],
            ["Read test", "masking moves the first 8 actions 1.59 mm, swapping 0.76 mm: under the 2 mm that count as read"]] },
        ax: { rows: AX("the 880 new demonstrations; B-ctrl, the same with the message always masked, is the control") },
        ffbox: { rows: [FDCL] },
        fc: { rows: [["Rate", "a new path at every π0.5 re-plan (0.4 s), the third of three settings tried (20 of 20 with the scripted expert)"]] },
        wbase: PIN,
        ctl: { text: "The inverse kinematics and PID at 120 Hz, with the base's stand-off and height pinned to FlightFlow's path; the IK solves the rest." },
      },
    },
    {
      name: "B-hid · hidden states", sub: "Hidden states instead of the 11 tokens", colour: "#0d6772", soft: "#ecf5f6", short: "B-hid",
      title: "B-hid: FlightFlow's hidden states as the message", when: "20 Nov · the newest run",
      parts: { chunk: "dim" }, flow: ["tok", "wbase", "whand"],
      status: { ...FROZEN_FF, fmt3: ["path every 0.4 s", "fd"], pibox: ["action expert retrained", "pi"], siglip: "frozen", vlm: "frozen", ax: ["retrained", "pi"], ax2: ["+ MLP adapter", "pi"],
        axnote: "44 message + 50 action tokens", ctl: "base x, z pinned to the path", wbase: "the base’s stand-off", wbase2: "and height", tok1: "44 hidden states", tok2: "of 512 numbers" },
      summary: "<b>84.5 %</b> (279 of 330) against 82.1 % for π0.5 alone, 82.7 % for B-ctrl and 81.8 % for B-tok: no measurable difference to any of them (p = 0.21–0.41). Offline the message is still not read (masked 1.84 mm, swapped 1.31 mm), though training ends at an 11 % lower loss than with no message.",
      tips: {
        tok: { name: "FlightFlow → π0.5: 44 hidden states", text: "Instead of the waypoints and z, π0.5 gets what FlightFlow's decoders read them from (after AC-DiT's latent mobility feature). The base is flown as in test 3.",
          rows: [["What", "the last block's output at the 10 waypoint path tokens and at [Z], at each of the 4 Euler steps, averaged over the 8 samples: 44 × 512, read off the sampling that gives the flown path"],
            ["Scaled", "standardised per token and dimension, clipped at 8 σ; not rotated"],
            ["Adapter", "a three-layer GELU MLP (512 → 1024 → 1024 → 1024) and a learned position embedding that starts as sine-cosine; same slots and masks as the 11"],
            ["Trained", "432.8 M of 3,356.1 M parameters, B-tok's recipe and data; messages replayed from the recorded frames"]] },
        ax: { rows: AX("the 880 demonstrations of test 3, with hidden-state messages") },
        ffbox: { rows: [FDCL] },
        wbase: PIN,
      },
    },
  ];
  return { PARTS, LAYERS };
})();
