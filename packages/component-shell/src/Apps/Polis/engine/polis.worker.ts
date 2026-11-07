import {
  MONTH_DAYS,
  YEAR_DAYS,
  advanceTo,
  answersToEventPayload,
  continueFrom,
  createKeyframe,
  createWorld,
  describePerson,
  dispatch,
  follow,
  forkWorld,
  largestBuckets,
  lawLines,
  randomCitizen,
  recentMoments,
  releaseDecisionRequests,
  snapshotWorld,
  stepDay,
  takeDecisionBuckets,
  timelineMarks,
  type World,
} from "@ngriffin_uk/polychat-library-polis";
import {
  POLIS_RECORDING_VERSION,
  type PolisBucket,
  type PolisRecording,
} from "@ngriffin_uk/polychat-schemas";

import { emptyDecisionStats, requestSize, strongestLeanings } from "./decision-budget.js";
import {
  advancePosition,
  catchUp,
  createPlayback,
  dayFractionOf,
  nearestKeyframe,
  nudgedPosition,
  playbackState,
  positionFor,
  shouldJump,
  type Playback,
} from "./playback.js";
import {
  POLIS_SPEEDS,
  type PolisCommand,
  type PolisEvent,
  type PolisModelSettings,
  type PolisSeries,
} from "./protocol.js";
import { forgetRecording, listRecordings, loadRecording, saveRecording } from "./recordings.js";
import { TownRenderer } from "./town-renderer.js";

const STEP_BUDGET_MS = 11;
const STATUS_INTERVAL_MS = 220;
const FLUSH_INTERVAL_MS = 2500;
const MAX_INFLIGHT = 1;
const COOLDOWN_BASE_MS = 8000;
const COOLDOWN_MAX_MS = 120_000;
const MAX_SERIES_POINTS = 300;
const FAST_DAYS_PER_SECOND = 2;
const FRAME_FALLBACK_MS = 33;
const POLL_BUCKETS = 24;
const KEYFRAME_MEMORY_BYTES = 160_000_000;
const KEYFRAME_BYTES_PER_PERSON = 130;
const KEYFRAME_YEARS = 2;
const MAX_MOMENTS = 14;
const LAST_HOUR = 23;
const LAST_POSITION_IN_DAY = 23 / 24;
const MORNING = 8;

interface Branch {
  label: string;
  world: World;
  keyframes: World[];
}

interface PendingDecision {
  branch: World;
  epoch: number;
  buckets: PolisBucket[];
}

interface Restoring {
  branch: Branch;
  log: PolisRecording["log"];
  endDay: number;
  watch: boolean;
}

let renderer: TownRenderer | null = null;
let branches: Branch[] = [];
let activeBranch = 0;
let running = false;
let speedIndex = 1;
let dayCarry = 0;
let dayFraction = 0.5;
let lastFrame = 0;
let lastStatus = 0;
let lastFlush = 0;
let lastSavedYear = 0;
let measuredDays = 0;
let measuredSince = 0;
let daysPerSecond = 0;
let nextRequestId = 1;
let settings: PolisModelSettings = { callsPerYear: 1000, holdForAnswers: false };
let stats = emptyDecisionStats();
let failedRounds = 0;
let cooldownUntil = 0;
let playback: Playback | null = null;
let seeking = false;
let restoring: Restoring | null = null;
const pending = new Map<number, PendingDecision>();

function post(event: PolisEvent): void {
  postMessage(event);
}

function liveBranch(): Branch | null {
  return branches[activeBranch] ?? null;
}

function viewedWorld(): World | null {
  return playback?.world ?? liveBranch()?.world ?? null;
}

function downsample(world: World): PolisSeries["points"] {
  const { history } = world;
  const stride = Math.max(1, Math.ceil(history.length / MAX_SERIES_POINTS));

  return history.filter((_, index) => index % stride === 0 || index === history.length - 1);
}

function sendStatus(): void {
  const live = liveBranch()?.world;
  const world = viewedWorld();

  if (!live || !world) {
    return;
  }

  const state = playback ? playbackState(playback, live.day, seeking) : null;

  post({
    type: "status",
    status: {
      snapshot: snapshotWorld(world),
      running,
      speedIndex,
      branch: activeBranch,
      branches: branches.map((branch) => branch.label),
      series: branches.map((branch) => ({ label: branch.label, points: downsample(branch.world) })),
      decisions: stats,
      citizen: world.followed === -1 ? null : describePerson(world, world.followed, live.journal),
      daysPerSecond,
      playback: state,
      hour: Math.floor(dayFraction * 24),
      marks: timelineMarks(live.log),
      moments: recentMoments(
        live.journal,
        state?.day ?? live.day,
        state?.hour ?? LAST_HOUR,
        MAX_MOMENTS,
      ),
    },
  });
}

function keyframeLimit(world: World): number {
  return Math.max(
    6,
    Math.floor(KEYFRAME_MEMORY_BYTES / (world.capacity * KEYFRAME_BYTES_PER_PERSON)),
  );
}

function captureKeyframe(branch: Branch): void {
  const { world, keyframes } = branch;

  if (world.day % (YEAR_DAYS * KEYFRAME_YEARS) !== 0) {
    return;
  }

  if (keyframes.some((keyframe) => keyframe.day === world.day)) {
    return;
  }

  keyframes.push(createKeyframe(world));

  if (keyframes.length > keyframeLimit(world)) {
    branch.keyframes = keyframes.filter((_, index) => index % 2 === 0);
  }
}

function recordingOf(world: World): PolisRecording {
  return {
    version: POLIS_RECORDING_VERSION,
    id: world.config.id ?? crypto.randomUUID(),
    name: world.name,
    population: world.config.population,
    seed: world.config.seed,
    day: world.day,
    savedAt: Date.now(),
    log: world.log,
  };
}

async function publishRecordings(): Promise<void> {
  post({ type: "recordings", recordings: await listRecordings() });
}

function saveLive(): void {
  const world = liveBranch()?.world;

  if (world) {
    void saveRecording(recordingOf(world)).then(publishRecordings);
  }
}

function requestDecisions(branch: World): void {
  const size = requestSize(settings, stats);

  if (size === 0 || pending.size >= MAX_INFLIGHT) {
    return;
  }

  const buckets = takeDecisionBuckets(branch, size);

  if (buckets.length === 0) {
    return;
  }

  const requestId = nextRequestId;

  nextRequestId += 1;
  stats = { ...stats, callsThisYear: stats.callsThisYear + buckets.length };
  pending.set(requestId, { branch, epoch: branch.decisions.epoch, buckets });
  post({ type: "decide", requestId, buckets, laws: lawLines(branch), model: settings.model });
}

function flushDecisions(now: number): void {
  if (now - lastFlush < FLUSH_INTERVAL_MS || now < cooldownUntil || settings.callsPerYear === 0) {
    return;
  }

  lastFlush = now;

  for (const { world } of branches) {
    requestDecisions(world);
  }
}

function holding(world: World): boolean {
  return (
    settings.holdForAnswers &&
    settings.callsPerYear > stats.callsThisYear &&
    (pending.size > 0 || world.decisions.demand.size > 0)
  );
}

function advance(world: World): void {
  const yearBefore = Math.floor(world.day / YEAR_DAYS);

  for (const branch of branches) {
    stepDay(branch.world);
    captureKeyframe(branch);
  }

  measuredDays += 1;

  if (Math.floor(world.day / YEAR_DAYS) !== yearBefore) {
    stats = { ...stats, callsThisYear: 0 };
  }
}

function stepWorlds(world: World, elapsed: number, now: number): void {
  const { daysPerSecond: speed } = POLIS_SPEEDS[speedIndex];

  dayCarry += (elapsed / 1000) * speed;

  const deadline = now + STEP_BUDGET_MS;

  while (dayCarry >= 1 && performance.now() < deadline) {
    if (holding(world) && world.day % MONTH_DAYS === 0) {
      dayCarry = 0;
      break;
    }

    advance(world);
    dayCarry -= 1;
  }

  dayCarry = Math.min(dayCarry, Math.max(speed, 1));
  dayFraction = dayCarry % 1;
}

function autosave(world: World): void {
  const year = Math.floor(world.day / YEAR_DAYS);

  if (year > lastSavedYear) {
    lastSavedYear = year;
    saveLive();
  }
}

function measureSpeed(now: number): void {
  if (now - measuredSince >= 1000) {
    daysPerSecond = (measuredDays * 1000) / (now - measuredSince);
    measuredDays = 0;
    measuredSince = now;
  }
}

function enterPlayback(position: number): void {
  const branch = liveBranch();

  if (!branch) {
    return;
  }

  running = false;
  playback = createPlayback(createKeyframe(branch.world), branch.world.day);
  seekTo(position);
}

function seekTo(position: number): void {
  const branch = liveBranch();

  if (!branch || !playback) {
    return;
  }

  const clamped = Math.min(branch.world.day + LAST_POSITION_IN_DAY, Math.max(0, position));
  const day = Math.floor(clamped);
  const keyframe = nearestKeyframe(branch.keyframes, day);

  playback.position = clamped;

  if (shouldJump(playback, keyframe, day)) {
    const followed = playback.world.followed;

    playback.world = structuredClone(keyframe);
    playback.world.followed = followed;
    renderer?.attach(playback.world);
  }

  seeking = playback.world.day !== day;
}

function leavePlayback(): void {
  const branch = liveBranch();

  playback = null;
  seeking = false;

  if (branch) {
    renderer?.attach(branch.world);
  }
}

function carryOn(): void {
  const branch = liveBranch();

  if (!branch || !playback || seeking) {
    return;
  }

  const world = continueFrom(playback.world, branch.world, crypto.randomUUID());

  branches = [
    {
      label: "This town",
      world,
      keyframes: branch.keyframes.filter((keyframe) => keyframe.day <= world.day),
    },
  ];
  activeBranch = 0;
  playback = null;
  lastSavedYear = Math.floor(world.day / YEAR_DAYS);
  pending.clear();
  renderer?.attach(world);
  saveLive();
}

function stepPlayback(active: Playback, elapsed: number, now: number): void {
  const branch = liveBranch();

  if (!branch) {
    return;
  }

  advancePosition(active, elapsed, branch.world.day);
  seeking = !catchUp(active, branch.world, now);
}

function stepRestore(active: Restoring, now: number): void {
  const { branch, log, endDay } = active;
  const deadline = now + STEP_BUDGET_MS;

  while (performance.now() < deadline) {
    const boundary =
      (Math.floor(branch.world.day / (YEAR_DAYS * KEYFRAME_YEARS)) + 1) *
      YEAR_DAYS *
      KEYFRAME_YEARS;
    const finished = advanceTo(branch.world, log, Math.min(boundary, endDay), deadline);

    if (finished) {
      captureKeyframe(branch);
    }

    if (finished && branch.world.day >= endDay) {
      finishRestore(active);

      return;
    }
  }

  post({ type: "restoring", name: branch.world.name, day: branch.world.day, endDay });
}

function finishRestore({ branch, watch }: Restoring): void {
  restoring = null;
  branches = [branch];
  activeBranch = 0;
  lastSavedYear = Math.floor(branch.world.day / YEAR_DAYS);
  renderer?.attach(branch.world);

  if (watch) {
    enterPlayback(positionFor(0, MORNING));
  }

  sendStatus();
}

function frame(now: number): void {
  const elapsed = Math.min(now - lastFrame, 250);

  lastFrame = now;

  if (restoring) {
    stepRestore(restoring, now);
  } else {
    runFrame(elapsed, now);
  }

  scheduleFrame();
}

function runFrame(elapsed: number, now: number): void {
  const live = liveBranch()?.world;

  if (!live) {
    return;
  }

  if (playback) {
    stepPlayback(playback, elapsed, now);
  } else if (running) {
    stepWorlds(live, elapsed, now);
    autosave(live);
  }

  if (!playback) {
    flushDecisions(now);
  }

  measureSpeed(now);

  if (playback) {
    const fast = playback.playing && (playback.unit === "months" || playback.unit === "years");

    renderer?.render(playback.world, dayFractionOf(playback), now, fast);
  } else {
    renderer?.render(
      live,
      dayFraction,
      now,
      running && POLIS_SPEEDS[speedIndex].daysPerSecond >= FAST_DAYS_PER_SECOND,
    );
  }

  if (now - lastStatus >= STATUS_INTERVAL_MS) {
    lastStatus = now;
    sendStatus();
  }
}

function scheduleFrame(): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(frame);
  } else {
    setTimeout(() => frame(performance.now()), FRAME_FALLBACK_MS);
  }
}

function startWorld(world: World): void {
  branches = [{ label: "This town", world, keyframes: [createKeyframe(world)] }];
  activeBranch = 0;
  dayCarry = 0;
  playback = null;
  lastSavedYear = 0;
  stats = emptyDecisionStats();
  pending.clear();
  renderer?.attach(world);
  sendStatus();
}

function restore(recording: PolisRecording, watch: boolean): void {
  const world = createWorld({
    id: recording.id,
    name: recording.name,
    population: recording.population,
    seed: recording.seed,
  });

  stats = emptyDecisionStats();
  pending.clear();
  playback = null;
  running = false;
  restoring = {
    branch: { label: "This town", world, keyframes: [createKeyframe(world)] },
    log: recording.log,
    endDay: recording.day,
    watch,
  };
}

function applyToViewed(apply: (world: World) => void): void {
  const world = viewedWorld();

  if (world) {
    apply(world);
    sendStatus();
  }
}

function applyToLive(apply: (world: World) => void): void {
  const world = liveBranch()?.world;

  if (world && !playback) {
    apply(world);
    sendStatus();
  }
}

function storeAnswers(command: Extract<PolisCommand, { type: "answers" }>): void {
  const request = pending.get(command.requestId);

  pending.delete(command.requestId);

  if (!request) {
    return;
  }

  const { branch, epoch, buckets } = request;

  dispatch(branch, {
    type: "answers",
    day: branch.day,
    epoch,
    answers: answersToEventPayload(command.answers),
  });
  releaseDecisionRequests(branch, command.failedKeys);

  const recent = strongestLeanings(buckets, command.answers);

  failedRounds = command.answers.length === 0 ? failedRounds + 1 : 0;

  if (failedRounds > 0) {
    cooldownUntil =
      performance.now() + Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** (failedRounds - 1));
  }

  stats = {
    ...stats,
    callsThisYear: Math.max(0, stats.callsThisYear - command.failedKeys.length),
    calls: stats.calls + command.answers.length,
    tokens: stats.tokens + command.tokens,
    model: command.model ?? stats.model,
    error: failedRounds > 0 ? (command.error ?? "The model did not answer") : null,
    recent: recent.length > 0 ? recent : stats.recent,
  };
}

function fork(): void {
  const branch = liveBranch();

  if (branch && branches.length === 1) {
    const world = forkWorld(branch.world);

    world.config = { ...world.config, id: crypto.randomUUID() };
    branches = [
      { ...branch, label: "With your changes" },
      { label: "As it was", world, keyframes: [...branch.keyframes] },
    ];
    activeBranch = 0;
  }
}

function keepActiveBranch(): void {
  const branch = liveBranch();

  if (branch) {
    branches = [{ ...branch, label: "This town" }];
    activeBranch = 0;
  }
}

function switchBranch(index: number): void {
  const branch = branches[index];

  if (branch) {
    activeBranch = index;
    renderer?.attach(branch.world);
  }
}

function attachCanvas(command: Extract<PolisCommand, { type: "canvas" }>): void {
  const world = viewedWorld();

  renderer = new TownRenderer(command.canvas);
  renderer.resize(command.width, command.height, command.pixelRatio);

  if (world) {
    renderer.attach(world);
  }
}

function followAt(world: World, x: number, y: number): void {
  const person = renderer?.personAt(x, y) ?? -1;

  if (person !== -1) {
    follow(world, person);
    renderer?.track();
  }
}

function followRandom(world: World): void {
  const person = randomCitizen(world, Math.floor(performance.now() * 7919));

  follow(world, person);
  renderer?.track();
}

function handlePlaybackCommand(command: PolisCommand): boolean {
  switch (command.type) {
    case "watch":
      enterPlayback(positionFor(liveBranch()?.world.day ?? 0, MORNING));
      break;
    case "backToNow":
      leavePlayback();
      break;
    case "carryOn":
      carryOn();
      break;
    case "seek":
      if (playback) {
        playback.playing = false;
        seekTo(positionFor(command.day, command.hour ?? MORNING));
      }

      break;
    case "nudge":
      if (playback) {
        playback.playing = false;
        playback.unit = command.unit;
        seekTo(nudgedPosition(playback, command.unit, command.direction));
      }

      break;
    case "playback":
      if (playback) {
        playback.playing = command.playing;
        playback.unit = command.unit;
      }

      break;
    default:
      return false;
  }

  sendStatus();

  return true;
}

function handleRecordingCommand(command: PolisCommand): boolean {
  switch (command.type) {
    case "open":
      void loadRecording(command.id).then((recording) => {
        if (recording) {
          restore(recording, command.watch);
        }
      });
      break;
    case "import":
      restore(command.recording, command.watch);
      break;
    case "forget":
      void forgetRecording(command.id).then(publishRecordings);
      break;
    case "save":
      saveLive();
      break;
    case "export": {
      const world = liveBranch()?.world;

      if (world) {
        post({ type: "recording", recording: recordingOf(world), purpose: command.purpose });
      }

      break;
    }

    default:
      return false;
  }

  return true;
}

function handleTownCommand(command: PolisCommand): void {
  switch (command.type) {
    case "running":
      running = command.running;

      if (!running) {
        saveLive();
      }

      sendStatus();
      break;
    case "speed":
      speedIndex = command.index;
      running = true;
      sendStatus();
      break;
    case "step":
      applyToLive((world) => {
        for (let day = 0; day < command.days; day += 1) {
          advance(world);
        }
      });
      break;
    case "parameters":
      applyToLive((world) =>
        dispatch(world, { type: "parameters", day: world.day, values: command.values }),
      );
      break;
    case "law":
      applyToLive((world) => dispatch(world, { type: "law", day: world.day, law: command.law }));
      break;
    case "repeal":
      applyToLive((world) => dispatch(world, { type: "repeal", day: world.day, id: command.id }));
      break;
    case "scenario":
      applyToLive((world) =>
        dispatch(world, { type: "scenario", day: world.day, scenario: command.scenario }),
      );
      break;
    case "fork":
      fork();
      sendStatus();
      break;
    case "branch":
      switchBranch(command.index);
      sendStatus();
      break;
    case "keepBranch":
      keepActiveBranch();
      sendStatus();
      break;
    case "model":
      settings = command.settings;
      break;
    case "answers":
      storeAnswers(command);
      break;
    case "poll":
      applyToLive((world) =>
        post({
          type: "pollBuckets",
          requestId: command.requestId,
          buckets: largestBuckets(world, POLL_BUCKETS),
          laws: lawLines(world),
          model: settings.model,
        }),
      );
      break;
    default:
      break;
  }
}

function handleViewCommand(command: PolisCommand): boolean {
  switch (command.type) {
    case "canvas":
      attachCanvas(command);
      break;
    case "resize":
      renderer?.resize(command.width, command.height, command.pixelRatio);
      break;
    case "pan":
      renderer?.pan(command.dx, command.dy);
      break;
    case "zoom":
      renderer?.zoom(command.factor, command.x, command.y);
      break;
    case "mapMode":
      if (renderer) {
        renderer.mode = command.mode;
      }

      break;
    case "click":
      applyToViewed((world) => followAt(world, command.x, command.y));
      break;
    case "follow":
      applyToViewed((world) => follow(world, command.person));
      break;
    case "followRandom":
      applyToViewed(followRandom);
      break;
    case "focusFollowed":
      applyToViewed((world) => {
        if (world.followed !== -1) {
          renderer?.track();
        }
      });
      break;
    default:
      return false;
  }

  return true;
}

function handle(command: PolisCommand): void {
  if (command.type === "create") {
    startWorld(createWorld({ ...command, id: crypto.randomUUID() }));

    return;
  }

  if (
    !handleViewCommand(command) &&
    !handlePlaybackCommand(command) &&
    !handleRecordingCommand(command)
  ) {
    handleTownCommand(command);
  }
}

self.onmessage = (event: MessageEvent<PolisCommand>) => handle(event.data);

void listRecordings()
  .then((recordings) => post({ type: "ready", recordings }))
  .catch(() => post({ type: "ready", recordings: [] }));

lastFrame = performance.now();
measuredSince = lastFrame;
scheduleFrame();
