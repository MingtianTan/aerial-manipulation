// Contents of the Next figure (index.html, #plans in the Next section), drawn and played by system.js, the engine of the
// method figure, on the same drawing of the system. Three layers to try: 1 other ways to send FlightFlow's forecast to
// π0.5, after the three tests; 2 training more of π0.5 than its action expert; 3 training on the aero and wind
// demonstrations already recorded. These are plans, not results: every number is a fact from a test, the code or the data.
// Fields as in system-data.js, plus: a beat may change parts, status and cls (classes put on parts) from that beat on;
// the part state "faded" draws a part lighter but keeps its card; extras names the parts only this figure draws;
// VIZ adds small drawings for the cards, made with the engine's helpers; words names the unit ("Layer").
// Sources: the tests' results in system-data.js and index.html (#dit-training); the code repository's READMEs
// (pipeline/stage_b on the branches b-tok and b-hid: what was trained, the one-way attention, the read test;
// pipeline/flight_dit), docs/training-data.md, docs/disturbance-variants.md and datasets/qa/final_stats.json; the openpi
// fork in AM-Bench (models/pi0.py: the flow time steers the action expert; gemma.py: scale and shift in every layer,
// 18 layers, the LoRA variant with rank 16; pi0_config.py: 200 prompt tokens, actions padded to 32; tokenizer.py: the
// state as whole numbers; training/config.py: the base-and-joints action; README.md: GPU memory for LoRA and full).
window.LX_NEXT = (() => {
  const PARTS = {
    loop: { name: "The loop", text: "The vehicle moves; new images and state come in; both models plan again." },
    cams: { name: "Two cameras · 20 Hz", text: "The gripper camera and the body camera." },
    state: { name: "State · 120 Hz", text: "35 values: poses, velocities, joint angles. π0.5 gets only the gripper width; FlightFlow gets the last 0.2 s of all 35." },
    instr: { name: "Instruction", text: "The task in words." },
    wires_pi: { name: "Inputs to π0.5", text: "Images to SigLIP; the instruction and the gripper width into the prompt." },
    wires_ff: { name: "Inputs to FlightFlow", text: "Both images, 0.2 s of state and the task." },
    ffbox: { name: "FlightFlow", text: "Forecasts the base’s path for the next 2.5 s, and a latent z of 256 values." },
    dino: { name: "DINOv2-S", text: "A frozen image encoder." },
    senc: { name: "State encoder", text: "Turns 0.2 s of state into 4 tokens." },
    task: { name: "Task", text: "A learned vector per task." },
    fmt: { name: "Flow-matching transformer", text: "14 blocks; 4 steps from noise to 8 paths, averaged." },
    fc: { name: "The forecast", text: "Where the base will be over the next 2.5 s, and z, from the same pass. New at every re-plan (0.4 s)." },
    pibox: { name: "π0.5", text: "3.35 B parameters: SigLIP 415 M, Gemma-2B 2.51 B, action expert 428 M." },
    siglip: { name: "SigLIP", text: "The image encoder: 256 tokens per image." },
    text: { name: "The prompt", text: "“Task: …, State: …; Action:”, with the state written as whole numbers." },
    vlm: { name: "Gemma-2B", text: "The language model: reads the images and the prompt together." },
    ax: { name: "Action expert", text: "18 layers that read Gemma-2B in every layer and turn noise into 50 actions in 10 steps." },
    tok: { name: "Test 2: 11 tokens", text: "10 waypoints and z, in front of π0.5’s 50 action tokens." },
    chunk: { name: "Test 1: π0.5’s plan", text: "π0.5’s 50 targets, joined to FlightFlow’s path tokens." },
    hid: { name: "Test 3: hidden states", text: "44 tokens from FlightFlow’s last block, through a small network (adapter)." },
    ctl: { name: "Inverse kinematics + PID", text: "Every tick the IK (inverse kinematics) solves base and arm for the hand’s target; a PID controller makes the base follow." },
    veh: { name: "FA-Hexa", text: "A hexarotor with a 4-joint arm, 6.6 kg, in Isaac Lab." },
    wbase: { name: "The base’s command", text: "FlightFlow’s path pins the base’s stand-off (x) and height (z); the IK does the rest." },
    whand: { name: "The hand’s target", text: "π0.5’s first 8 actions." },
    insets: { name: "Method, step 2", text: "" },
    tried: { name: "Tested so far", text: "Successes in 330 rollouts with and without the message, on default physics." },
    zmod: { name: "A · z in every layer", text: "z added to what the flow time already sets in each layer of the action expert." },
    prompt: { name: "B · The path in the prompt", text: "The forecast written into π0.5’s prompt as numbers." },
    basep: { name: "C · π0.5 plans the base", text: "π0.5 also plans the base, starting from FlightFlow’s path." },
    params: { name: "π0.5’s parameters", text: "SigLIP 415 M, Gemma-2B 2.51 B, action expert 428 M." },
    noback: { name: "One-way attention", text: "The images and the prompt never look at the message." },
    lora: { name: "LoRA adapters", text: "Small trainable matrices beside Gemma-2B’s own weights." },
    c_def: { name: "Default physics", text: "No thrust limit, no aerodynamics, no wind." },
    c_aero: { name: "Aero", text: "Each rotor gives 0 to 23 N; ground effect, wall effect and drag are on." },
    c_w05: { name: "Wind 5 %", text: "Aero plus a steady push toward the work surface: 3.3 N, 5 % of the weight." },
    c_w10: { name: "Wind 10 %", text: "Aero plus a steady push toward the work surface: 6.5 N, 10 % of the weight." },
    c_w20: { name: "Wind 20 %", text: "Aero plus a steady push toward the work surface: 13.0 N, 20 % of the weight." },
    trainff: { name: "Into FlightFlow", text: "The aero and wind demonstrations as training data for FlightFlow." },
    trainpi: { name: "Into π0.5", text: "The aero and wind demonstrations as training data for π0.5." },
    windfx: { name: "Wind", text: "In the recordings: a steady push along +x, toward the work surface." },
    rotors: { name: "Rotor thrust", text: "What the rotors can still give while FA-Hexa hovers." },
  };

  // what stays as in tests 2 and 3: FlightFlow frozen and flying the base, π0.5 retrained
  const AS_TESTED = { ffbox: ["frozen, as in tests 2 and 3", "fd"], dino: "frozen", senc: "frozen", task: "frozen", fmt: "frozen",
    ctl: "base x, z pinned to the path", wbase: "the base’s stand-off", wbase2: "and height" };
  // the forecast and the action tokens are there from the first beat, without an animation
  const READY = [["morph", "fc", 0, 0.02], ["pills", "act", 0, 0.02]];
  const CHIPS = ["c_def", "c_aero", "c_w05", "c_w10", "c_w20"];
  const WINDS = ["c_aero", "c_w05", "c_w10", "c_w20"];
  const each = (ids, value) => Object.fromEntries(ids.map((id) => [id, value]));

  const SCENES = [
    {
      name: "Other ways to send the forecast", sub: "Into every layer, into the prompt, or into π0.5’s own plan of the base",
      colour: "#2f9e8f", soft: "#eef8f6", short: "layer 1 · channels", when: "to try, after tests 1 to 3", br: "to try", default: true,
      parts: { insets: "off", chunk: "faded", tok: "faded", hid: "faded" },
      status: { ...AS_TESTED, pibox: ["action expert retrained", "pi"], siglip: "frozen", vlm: "frozen", ax: ["retrained", "pi"] },
      beats: [
        { tab: "Tested", dur: 3800, card: 0, now: ["chunk", "tok", "hid", "tried"],
          fx: [...READY, ["send", "msg", 0, 0.02], ["send", "chunk", 0, 0.02], ["show", "tried", 0.1, 0.5]],
          line: "Tested: π0.5’s plan into FlightFlow, 11 tokens, 44 hidden states. No gain so far comes from the message itself, and π0.5 barely reads it." },
        { tab: "A · every layer", dur: 4400, card: 1, now: ["zmod", "fc", "ax"], parts: { chunk: "off", tok: "off", hid: "off" },
          fx: [["show", "zmod", 0, 0.15], ["send", "zA", 0.08, 0.55], ["rail", "", 0.5, 0.95]],
          line: "A: z steers all 18 layers of the action expert, the way the flow time already does." },
        { tab: "B · the prompt", dur: 4600, card: 2, now: ["prompt", "text", "vlm"], status: { text: ["+ the path", "fd"] },
          fx: [["show", "prompt", 0, 0.15], ["flow", "prompt", 0.05, 0.75], ["flow", "pi_in vlm_ax", 0.6, 1]],
          line: "B: the path is written into the prompt as numbers, like the state, so Gemma-2B reads it with the images." },
        { tab: "C · the base", dur: 4800, card: 3, now: ["basep", "ax", "whand", "ctl"], parts: { wbase: "off" },
          status: { ctl: "flies π0.5’s plan of the base", whand2: "+ the base’s path", wbase: "", wbase2: "" },
          fx: [["show", "basep", 0, 0.12], ["send", "pathC", 0.06, 0.45], ["base", "", 0.4, 0.6], ["flow", "hand handbase", 0.55, 1]],
          line: "C: π0.5 plans the base too, starting from FlightFlow’s path; the controller flies π0.5’s plan." },
      ],
      cards: [
        { t: "Barely read", big: "< 2 mm", viz: "readtest", text: "With the message masked, π0.5’s first 8 actions move 1.6 mm (11 tokens) or 1.8 mm (hidden states). 2 mm would count as read." },
        { t: "A · z in every layer", big: "18 layers", viz: "adarms", text: "The flow time already sets a scale and a shift in every layer. z joins it through a new layer that starts at zero, so π0.5 starts out unchanged." },
        { t: "B · The path in the prompt", big: "Gemma reads it", viz: "prompt", text: "Written as whole numbers, like the state. The prompt is read at every re-plan, as often as the path changes, and has room: up to 200 tokens, 30 to 49 used." },
        { t: "C · π0.5 plans the base", big: "+ the base", viz: "baseplan", text: "Its action has spare room, and AM-Bench’s π0.5 code already has a version that plans the base. π0.5 would learn only the correction to FlightFlow’s path." },
      ],
      tips: {
        tried: { rows: [["Test 1", "π0.5’s plan into FlightFlow: 227 vs 229"], ["Test 2", "11 tokens into π0.5: 270 vs 273"], ["Test 3", "hidden states into π0.5: 279 vs 273"], ["Rule", "a difference counts from 18 of 330, fixed in advance; none reached it"]] },
        chunk: { text: "π0.5’s 50 targets, joined to FlightFlow’s path tokens. 227 of 330 with it, 229 without. Plans 17 cm apart moved the forecast 3 cm." },
        tok: { text: "10 waypoints and z, in front of π0.5’s 50 action tokens. 270 of 330, against 273 without. Masked, the actions move 1.6 mm." },
        hid: { text: "44 tokens from FlightFlow’s last block, through an adapter. 279 of 330, against 273 without. Masked, the actions move 1.8 mm." },
        zmod: { text: "In each of the action expert’s 18 layers, the flow time sets a scale and a shift. z would be added to it through a new layer that starts at zero, so π0.5 starts out unchanged. To try.",
          rows: [["Trains", "the action expert and the new layer, as in tests 2 and 3"], ["Same route as", "the flow time, inside π0.5"]] },
        prompt: { text: "The path written as whole numbers after the state: “Task: …, State: …, Path: …; Action:”. Gemma-2B reads it with the images; the action expert reads Gemma-2B. To try.",
          rows: [["Rate", "the prompt is read at every re-plan (0.4 s); the path is new at every re-plan"], ["Room", "up to 200 tokens; 30 to 49 used"], ["Goes with", "training Gemma-2B too (layer 2)"]] },
        basep: { text: "π0.5 writes the base’s next positions beside the hand’s, starting from FlightFlow’s path; the controller flies π0.5’s version. To try.",
          rows: [["Room", "8 action values used, padded to 32"], ["In the code", "AM-Bench’s π0.5 has an action with the base: base pose 7, arm joints 4, gripper 1"], ["Labels", "the base’s recorded motion, in the 120 Hz state"]] },
        ax: { text: "18 layers. In each, the flow time sets a scale and a shift; A would add z to it." },
        text: { text: "“Task: …, State: …; Action:”: up to 200 tokens, 30 to 49 used. The state is in it as whole numbers; B would add the path." },
        vlm: { text: "Frozen in tests 2 and 3. With B it would read the path together with the images." },
        ctl: { text: "As in tests 2 and 3, FlightFlow’s path pins the base’s stand-off and height. With C, π0.5’s plan of the base would." },
        whand: { text: "π0.5’s first 8 actions. With C they also carry the base’s path." },
        wbase: { text: "As in tests 2 and 3: FlightFlow’s path pins the base’s stand-off and height." },
      },
    },
    {
      name: "Train more of π0.5", sub: "Let Gemma-2B and SigLIP learn too, not only the action expert",
      colour: "#2a78d6", soft: "#eef4fc", short: "layer 2 · training", when: "to try, after tests 2 and 3", br: "to try",
      parts: { insets: "off", chunk: "off", hid: "off" },
      status: { ...AS_TESTED, pibox: ["430 M trained", "pi"], siglip: "frozen", vlm: "frozen", ax: ["trained", "pi"] },
      beats: [
        { tab: "Trained so far", dur: 3600, card: 0, now: ["ax", "params"],
          fx: [...READY, ["send", "msg", 0, 0.02], ["show", "params", 0.1, 0.5]],
          line: "Tests 2 and 3 trained only the action expert and the message layers: 430 M of 3.35 B parameters." },
        { tab: "One way", dur: 4200, card: 1, now: ["tok", "noback", "vlm"], status: { axnote: "the images and prompt never see the message" },
          fx: [["show", "noback", 0.1, 0.45], ["flow", "pi_in vlm_ax", 0.35, 1]],
          line: "Gemma-2B never sees the message, so the forecast cannot change what it looks at." },
        { tab: "LoRA", dur: 4000, card: 2, now: ["vlm", "lora"], cls: { vlm: "lx-train" }, status: { vlm: ["LoRA adapters", "pi"], pibox: ["+ LoRA on Gemma-2B", "pi"] },
          fx: [["show", "lora", 0.1, 0.5], ["show", "params_lora", 0.3, 0.7]],
          line: "To try: small LoRA adapters on Gemma-2B. π0.5’s code (openpi) ships them and lists one RTX 4090 for LoRA training." },
        { tab: "Every weight", dur: 4000, card: 3, now: ["siglip", "vlm", "ax", "pibox"], cls: { siglip: "lx-train", vlm: "lx-train" },
          status: { siglip: ["trained", "pi"], vlm: ["trained", "pi"], pibox: ["all 3.35 B trained", "pi"] },
          fx: [["hide", "lora", 0, 0.3], ["hide", "params_lora", 0, 0.3], ["show", "params_full", 0.15, 0.6]],
          line: "Or train every weight, as when the 30k checkpoint was made: more than 70 GB of GPU memory." },
        { tab: "With B", dur: 4400, card: 4, now: ["prompt", "text", "vlm"], status: { text: ["+ the path", "fd"], axnote: "with B, Gemma-2B reads the path in the prompt" },
          fx: [["show", "prompt", 0, 0.15], ["flow", "prompt", 0.05, 0.7], ["flow", "pi_in vlm_ax", 0.6, 1]],
          line: "For Gemma-2B to use the forecast it has to see it: the path in the prompt (layer 1, B)." },
      ],
      cards: [
        { t: "Trained in tests 2 and 3", big: "430 M of 3.35 B", viz: "paramsbar", text: "The action expert and the message layers, from the 30k checkpoint, in which every weight had been fine-tuned. Gemma-2B and SigLIP stayed frozen." },
        { t: "One-way attention", big: "one way", viz: "oneway", text: "The images and the prompt look only at each other; the message and the actions read them, never the other way round." },
        { t: "LoRA on Gemma-2B", big: "rank 16", viz: "lora", text: "Small trainable matrices beside Gemma-2B’s attention and MLP weights, which stay as they are. π0.5’s code ships this; it needs more than 22.5 GB." },
        { t: "Every weight", big: "3.35 B", viz: ["paramsbar", "all"], text: "As when the 30k checkpoint was fine-tuned. More than 70 GB of GPU memory: an A100 or H100 with 80 GB." },
        { t: "Goes with B", big: "the path in the prompt", viz: ["prompt", "trained"], text: "Training Gemma-2B helps with the forecast only if Gemma-2B can see it, so this goes with B." },
      ],
      tips: {
        params: { text: "SigLIP 415 M, Gemma-2B 2.51 B, action expert 428 M. Tests 2 and 3 trained 430 M: the action expert and the message layers." },
        noback: { text: "The images and the prompt (the prefix) never look at the message or the actions, so what Gemma-2B passes on is the 30k checkpoint’s, whatever the forecast." },
        lora: { text: "Rank-16 matrices beside Gemma-2B’s attention and MLP weights; only they train. openpi lists more than 22.5 GB of GPU memory, e.g. one RTX 4090. To try." },
        vlm: { text: "2.51 B parameters, frozen in tests 2 and 3. To try: LoRA adapters, or every weight." },
        siglip: { text: "415 M parameters, frozen in tests 2 and 3; trained when every weight trains." },
        ax: { text: "428 M parameters, trained in tests 2 and 3 together with the message layers." },
        pibox: { text: "3.35 B parameters. The 30k checkpoint fine-tuned all of them; tests 2 and 3 started from it and trained 430 M.",
          rows: [["Tests 2, 3", "15k steps, batch 32, about 5.7 h on one RTX 4090"], ["Every weight", "more than 70 GB of GPU memory (openpi)"]] },
        tok: { name: "The message (test 2)", text: "11 tokens in front of the action tokens: the action expert reads them, Gemma-2B never does." },
        prompt: { text: "With the path in the prompt, Gemma-2B reads it with the images; trained, it can learn to use it. To try." },
      },
    },
    {
      name: "Wind and thrust-limit data", sub: "Train on the aero and wind demonstrations that are already recorded",
      colour: "#9a6400", soft: "#fdf6e7", short: "layer 3 · data", when: "to try; the demonstrations are recorded", br: "to try · data recorded",
      parts: { insets: "off", chunk: "off", hid: "off", tok: "faded" },
      status: { ...AS_TESTED, ffbox: ["trained on default physics only", "fd"], pibox: ["trained on default physics only", "pi"],
        ctl: "knows no wind, no thrust limit", c_def: "80 per task · used", ...each(WINDS, ["not used yet", "amb"]) },
      beats: [
        { tab: "Recorded", dur: 3800, card: 0, now: CHIPS,
          fx: [...READY, ["send", "msg", 0, 0.02], ["show", "data", 0.05, 0.5]],
          line: "Recorded: 80 demonstrations per task in each of five conditions. Both models learned from default physics only." },
        { tab: "IK misses", dur: 4400, card: 1, now: ["windfx", "rotors", "ctl", "veh"],
          fx: [["show", "windfx", 0, 0.35], ["show", "rotors", 0.3, 0.75]],
          line: "The IK knows no wind and no thrust limit. Under them the base lags or overshoots, and the recordings hold that motion." },
        { tab: "To FlightFlow", dur: 4400, card: 3, now: ["ffbox", "trainff", ...WINDS], cls: each(WINDS, "lx-used"),
          status: { ffbox: ["+ aero and wind: to try", "fd"], ...each(WINDS, ["→ FlightFlow", "amb"]) },
          fx: [["show", "trainff", 0, 0.15], ["send", "toff", 0.1, 0.85]],
          line: "To try: FlightFlow trains on them and learns where the base really goes, the dynamics the IK is blind to." },
        { tab: "To π0.5", dur: 4400, card: 4, now: ["pibox", "trainpi", ...WINDS],
          status: { pibox: ["+ aero and wind: to try", "pi"], ...each(WINDS, ["→ both models", "amb"]) },
          fx: [["show", "trainpi", 0, 0.15], ["send", "topi", 0.1, 0.85]],
          line: "To try: π0.5 trains on them too, with the forecast as its message." },
        { tab: "Why", dur: 3200, card: 5, now: ["pibox", ...WINDS], fx: [],
          line: "Trained on default physics only, π0.5 alone falls from 82.1 % to 50.6 % under aero, and to 3.3 % in 20 % wind." },
      ],
      cards: [
        { t: "Already recorded", big: "80 per task", viz: "datagrid", text: "The same experts and checks in five conditions. Only default physics has been used for training." },
        { t: "Aero and wind", big: "≤ 23 N · +x", viz: "windviz", text: "Aero: each rotor gives 0 to 23 N, with ground, wall and drag effects. Wind adds a steady push toward the work surface." },
        { t: "What the IK misses", big: "dynamics", viz: "lag", text: "The IK places the base as if it could go anywhere. In 20 % wind the rotors are near their limits and the base lags, e.g. 5 to 8 cm behind a grasp target." },
        { t: "Into FlightFlow", big: "+ 4 conditions", viz: ["trainto", "FlightFlow"], text: "It would learn where the base really goes, not only where the IK sends it: the dynamics that step 2 of the method says the IK is blind to." },
        { t: "Into π0.5", big: "+ 4 conditions", viz: ["trainto", "π0.5"], text: "With the forecast as its message. The experts also change how they approach under wind, e.g. stop 0.30 m back, then go in at half speed." },
        { t: "Why", big: "82.1 → 50.6 %", viz: ["cbars", [["default", 82.1, "grey"], ["aero", 50.6, "amb"], ["wind 5 %", 44.8, "amb"], ["wind 10 %", 33.9, "amb"], ["wind 20 %", 3.3, "amb"]]],
          text: "π0.5 alone, trained on default physics only; 330 rollouts per bar." },
      ],
      tips: {
        c_def: { text: "No thrust limit, no aerodynamics, no wind. Both models learned from these demonstrations.", rows: [["Recorded", "80 per task"]] },
        c_aero: { text: "Each rotor gives 0 to 23 N; ground effect, wall effect and drag are on.", rows: [["Recorded", "80 per task, not used for training yet"]] },
        c_w05: { text: "Aero, plus a steady push of 3.3 N toward the work surface: 5 % of FA-Hexa’s weight.", rows: [["Recorded", "80 per task, not used for training yet"]] },
        c_w10: { text: "Aero, plus a steady push of 6.5 N toward the work surface: 10 % of FA-Hexa’s weight.", rows: [["Recorded", "80 per task, not used for training yet"]] },
        c_w20: { text: "Aero, plus a steady push of 13.0 N toward the work surface: 20 % of FA-Hexa’s weight. Here two tasks have experts of their own (push slider, wipe window).",
          rows: [["Recorded", "80 per task, not used for training yet"]] },
        windfx: { text: "In the recordings the wind is steady and along +x, toward the work surface in every task: 5, 10 or 20 % of FA-Hexa’s 65 N weight." },
        rotors: { text: "Hovering takes 12.5 N per rotor. Holding 20 % wind puts the two forward-tilted rotors at 3.8 N and the other four at 16.9 N, so any extra push against the wind meets a limit (0 or 23 N)." },
        trainff: { text: "To try: FlightFlow trained on all five conditions. In these recordings the base’s motion includes the wind and the thrust limits." },
        trainpi: { text: "To try: π0.5 trained on all five conditions, with the forecast as its message." },
        ctl: { text: "The IK places the base as if it could go anywhere: it knows no thrust limit and no wind. The PID then meets them, and the base lags or overshoots." },
        ffbox: { text: "Trained on default physics only. To try: add the aero and wind demonstrations." },
        pibox: { text: "Fine-tuned on default physics only. To try: all five conditions." },
        veh: { text: "FA-Hexa, 6.6 kg: its weight is 65 N, so 20 % wind is a 13 N push." },
        tok: { name: "The message", text: "As in test 2: FlightFlow’s forecast as 11 tokens for π0.5." },
      },
    },
  ];

  /* small drawings for the cards; text in them is at least 12.5 units (system.css) */
  const VIZ = ({ sq, tx, arrow, svgOf, n1 }) => ({
    // the read test: how far π0.5's actions move with the message masked, against the 2 mm that count as read
    readtest() {
      const X = (mm) => 8 + 96 * mm;
      let b = "";
      [["11 tokens (test 2)", 1.59, "1.6 mm"], ["hidden states (test 3)", 1.84, "1.8 mm"]].forEach(([label, v, shown], k) => {
        const y = 16 + 34 * k;
        b += tx(8, y, label, "v-s", "start") + sq(8, y + 5, X(v) - 8, 11, "v-msg", 2) + tx(274, y + 15, shown, "v-b", "end");
      });
      b += `<line x1="${X(2)}" y1="4" x2="${X(2)}" y2="78" class="v-dash"/>` + tx(X(2), 94, "2 mm counts as read", "v-s");
      return svgOf(280, 100, b);
    },
    // A: the flow time and z, added, set a scale and a shift in every layer
    adarms() {
      let b = sq(4, 12, 80, 22, "v-dark", 4) + tx(44, 27.5, "flow time", "v-w");
      b += sq(4, 70, 80, 22, "v-fd", 4) + tx(44, 85.5, "z: new", "v-w");
      b += `<path d="M84 23 H104 V44 M84 81 H104 V60" class="v-line"/><circle cx="104" cy="52" r="8" class="v-box"/>` + tx(104, 56.5, "+", "v-b");
      b += arrow(112, 52, 128, 52) + `<line x1="132" y1="13" x2="132" y2="91" class="v-line"/>`;
      for (let k = 0; k < 6; k++) {
        const y = 7 + 15 * k;
        b += sq(152, y, 122, 11, "v-pisoft", 2) + arrow(132, y + 5.5, 149, y + 5.5);
      }
      b += tx(213, 112, "scale and shift in each", "v-s") + tx(213, 127, "of the 18 layers", "v-s");
      return svgOf(280, 132, b);
    },
    // B: the prompt as tokens, with the path after the state; Gemma-2B reads it all with the images
    prompt(trained) {
      const row = (x0, n, cls) => Array.from({ length: n }, (_, k) => sq(x0 + 9 * k, 24, 7, 18, cls, 2)).join("");
      let b = row(4, 7, "v-grey") + tx(33, 16, "task", "v-s") + row(72, 6, "v-grey") + tx(97, 16, "state", "v-s");
      b += row(130, 10, "v-fd") + tx(171, 16, "path", "v-b") + row(226, 5, "v-grey") + tx(246, 16, "Action:", "v-s");
      b += arrow(140, 46, 140, 60) + sq(4, 62, 272, 26, trained ? "v-pibox" : "v-box", 6);
      b += tx(140, 79.5, trained ? "Gemma-2B, trained, learns to read it" : "Gemma-2B reads it with the images", "v-s");
      return svgOf(280, 92, b);
    },
    // C: π0.5's action, padded to 32 values; the base would take some of the spare ones
    baseplan() {
      let b = "";
      for (let k = 0; k < 32; k++) b += sq(4 + 8.4 * k, 8, 6.4, 18, k < 3 ? "v-pi" : k < 7 ? "v-pisoft" : k < 8 ? "v-grey" : k < 11 ? "v-fd" : "v-none", 1.5);
      b += tx(36, 42, "hand: 8", "v-s") + tx(83, 42, "base", "v-b") + tx(186, 42, "spare (padding to 32)", "v-s");
      b += sq(4, 54, 116, 24, "v-fdbox", 5) + tx(62, 70.5, "FlightFlow’s path", "v-s") + arrow(122, 66, 150, 66);
      b += sq(152, 54, 124, 24, "v-pibox", 5) + tx(214, 70.5, "π0.5: + correction", "v-s");
      return svgOf(280, 84, b);
    },
    // which of π0.5's parameters train: tests 2 and 3, or every weight
    paramsbar(all) {
      const W = 272 / 3353, segs = [[415, "SigLIP"], [2510, "Gemma-2B 2.51 B"], [428, "action expert"]];
      let x = 4, b = "";
      segs.forEach(([v, name], k) => {
        const hot = all || k === 2;
        b += sq(x, 24, v * W - 2, 22, hot ? "v-pi" : "v-grey", 2);
        if (k === 1) b += tx(x + (v * W) / 2, 39.5, name, hot ? "v-w" : "v-b");
        x += v * W;
      });
      b += all ? tx(140, 16, "all trained", "v-s") : tx(276, 16, "trained in tests 2, 3", "v-s", "end");
      b += tx(4, 62, "SigLIP 415 M", "v-s", "start") + tx(276, 62, "action expert 428 M", "v-s", "end");
      return svgOf(280, 68, b);
    },
    // attention runs one way: prefix → message → actions; the way back is closed
    oneway() {
      let b = sq(4, 22, 80, 28, "v-box", 5) + tx(44, 40.5, "prefix", "v-b");
      b += sq(104, 22, 72, 28, "v-fdbox", 5) + tx(140, 40.5, "message", "v-b");
      b += sq(196, 22, 80, 28, "v-pibox", 5) + tx(236, 40.5, "actions", "v-b");
      b += arrow(85, 36, 102, 36) + arrow(177, 36, 194, 36);
      b += tx(4, 14, "images, prompt", "v-s", "start");
      b += `<path d="M140 52 C 140 76, 44 76, 44 54" class="v-dash" marker-end="url(#VHEAD)"/><path d="M86 64 l 10 10 m 0 -10 l -10 10" class="v-x"/>`;
      b += tx(140, 96, "Gemma-2B never sees the message", "v-s");
      return svgOf(280, 102, b);
    },
    // LoRA: a frozen weight, and beside it two thin trainable matrices
    lora() {
      let b = sq(10, 8, 64, 64, "v-grey", 3) + tx(42, 44.5, "W", "v-w") + tx(42, 90, "frozen", "v-s");
      b += tx(96, 45, "+", "v-b") + sq(116, 8, 9, 64, "v-pi", 2) + sq(132, 8, 64, 9, "v-pi", 2);
      b += tx(160, 90, "rank 16: trained", "v-s");
      return svgOf(280, 96, b);
    },
    // the recorded demonstrations: 11 tasks × 5 conditions, 80 in each cell; only the default column is used
    datagrid() {
      const C = ["default", "aero", "5 %", "10 %", "20 %"];
      let b = tx(212, 16, "wind", "v-s") + `<line x1="152" y1="20" x2="272" y2="20" class="v-line"/>`;
      C.forEach((name, j) => {
        const x = 64 + 43 * j;
        b += tx(x + 19.5, 34, name, j ? "v-s" : "v-b");
        for (let i = 0; i < 11; i++) b += sq(x, 40 + 8.4 * i, 39, 6.4, j ? "v-ambsoft" : "v-grey", 1.5);
      });
      b += tx(56, 90, "11 tasks", "v-s", "end") + tx(140, 150, "each cell: 80 demonstrations", "v-s");
      return svgOf(280, 156, b);
    },
    // success rates per condition, one bar each (as the method figure's bars, with room for the larger text)
    cbars(rows) {
      let b = "";
      rows.forEach(([label, v, cls], k) => {
        const y = 4 + 30 * k;
        b += tx(2, y + 12, label, "v-s", "start") + sq(2, y + 16, (170 * v) / 100, 9, `v-${cls}`, 2) + tx(178, y + 25, `${v} %`, "v-b", "start");
      });
      return svgOf(230, 8 + 30 * rows.length, b);
    },
    // a sketch, not data: in 20 % wind the base stays short of the grasp target
    lag() {
      let b = "";
      for (const y of [38, 50, 62]) b += `<line x1="14" y1="${y}" x2="50" y2="${y}" class="v-ambline"/><path d="M50 ${y - 5} l 8 5 l -8 5 z" class="v-amb"/>`;
      b += tx(36, 84, "20 % wind", "v-s") + `<line x1="72" y1="50" x2="266" y2="50" class="v-line"/>`;
      b += sq(124, 42, 30, 16, "v-dark", 4) + tx(139, 76, "the base", "v-s");
      b += `<path d="M232 42 l 16 16 m 0 -16 l -16 16" class="v-x"/>` + tx(240, 76, "grasp target", "v-s");
      b += `<path d="M154 32 V26 H240 V32" class="v-line"/>` + tx(197, 18, "5 to 8 cm short", "v-b");
      return svgOf(280, 90, b);
    },
    // the five conditions' demonstrations into one model
    trainto(model) {
      let b = "";
      for (let k = 0; k < 5; k++) b += sq(4 + 26 * k, 14, 22, 22, k ? "v-amb" : "v-grey", 3);
      b += tx(74, 56, "default, aero, 3 winds", "v-s") + arrow(138, 25, 168, 25);
      b += sq(172, 8, 104, 34, model === "π0.5" ? "v-pibox" : "v-fdbox", 6) + tx(224, 30, model, "v-b");
      b += tx(278, 58, model === "π0.5" ? "with the forecast" : "where the base goes", "v-s", "end");
      return svgOf(280, 64, b);
    },
    // the wind to scale (10 units per newton), toward the work surface
    windviz() {
      let b = sq(250, 4, 24, 76, "v-wall", 2) + tx(276, 96, "work surface", "v-s", "end");
      [["5 %", 3.25], ["10 %", 6.51], ["20 %", 13.02]].forEach(([name, f], k) => {
        const y = 18 + 24 * k, x2 = 48 + 10 * f;
        b += tx(4, y + 4.5, name, "v-s", "start") + `<line x1="48" y1="${y}" x2="${n1(x2)}" y2="${y}" class="v-ambline"/>`;
        b += `<path d="M${n1(x2)} ${y - 5} l 8 5 l -8 5 z" class="v-amb"/>` + tx(x2 + 14, y + 4.5, `${f.toFixed(1)} N`, "v-b", "start");
      });
      return svgOf(280, 100, b);
    },
  });

  return { PARTS, SCENES, VIZ, extras: ["tried", "channels", "train", "data"], words: { unit: "Layer", unused: "Not used in this layer. " } };
})();
