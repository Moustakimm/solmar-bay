// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the painter draws what is there. The game moves between
// title, play, paused, busted, wasted and win screens, and saves progress
// (cash, mission, health) to localStorage when a mission completes.
// ?seed=N fixes the city's random layout. ?shot=cover|street|chase|city
// (with &seed=N) stages that scene instead of running the loop, paints it
// three times and sets window.__shotReady for a screenshot.
import { EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_STORM, EVENT_WASTED, EVENT_WIN, SAVE_KEY, STEP } from './config.js';
import { createRng } from './rng.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createPainter, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORM, SCREEN_TITLE, SCREEN_WASTED, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createSound } from './sound.js';
import { currentJob, sayJob } from './jobs.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRng(seed));
window.__solmar = world; // debug handle: lets a test page read the live state
const painter = createPainter(canvas);
const sound = createSound();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.mission.index,
      health: state.player.health,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    painter.draw(world.state, scene.screen, 0, scene.zoom);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let best = save ? save.cash : 0;
  let accumulator = 0;
  let last = performance.now();
  let zoom = 1;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    world.reset();
    if (!fresh && save) {
      world.state.cash = save.cash;
      world.state.mission.index = Math.min(save.missionIndex, world.state.mission.list.length - 1);
      world.state.player.health = save.health || 100;
      announce(`Welcome back to Solmar Bay. Mission ${world.state.mission.index + 1}: ${currentJob(world.state.mission).title}.`);
    } else {
      announce("Solmar Bay. Rosa's first job: steal a car and bring it to her garage.");
    }
    sayJob(world.state); // Rosa briefs the first job in the dialogue box.
    screen = SCREEN_PLAY;
    sound.unlock();
  }

  function bustPlayer() {
    const lost = Math.min(100, world.state.cash);
    world.state.cash -= lost;
    world.state.wanted = 0;
    world.state.copCars = [];
    world.state.cops = [];
    world.state.player.bustMeter = 0;
    const p = world.state.player;
    if (p.inCar) {
      p.inCar.parked = true;
      p.inCar.speed = 0;
      p.inCar = null;
    }
    p.x = 1500;
    p.y = 760;
    p.health = Math.max(40, p.health);
    screen = SCREEN_BUSTED;
    sound.busted();
    announce(`Busted. You lost $${lost}.`);
  }

  function wastePlayer() {
    const p = world.state.player;
    p.dead = false;
    p.health = 60;
    world.state.wanted = 0;
    world.state.copCars = [];
    world.state.cops = [];
    if (p.inCar) {
      p.inCar.parked = true;
      p.inCar.speed = 0;
      p.inCar = null;
    }
    p.x = 1500;
    p.y = 760;
    screen = SCREEN_WASTED;
    sound.busted();
    announce('Wasted. The hospital patched you up.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) sound.shot();
    if (events & EVENT_CRASH) sound.crash();
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_MISSION) {
      sound.mission();
      writeSave(world.state);
      best = Math.max(best, world.state.cash);
    }
    if (events & EVENT_WIN) {
      screen = SCREEN_WIN;
      writeSave(world.state);
      announce('King of Solmar! Every job done.');
    } else if (events & EVENT_STORM) {
      screen = SCREEN_STORM;
      sound.busted();
      announce('Hurricane Vera made landfall. The storm took Solmar Bay.');
    } else if (events & EVENT_BUSTED) bustPlayer();
    else if (events & EVENT_WASTED) wastePlayer();
  }

  function step() {
    const { actions, clicked } = input.takeActions();
    if (input.mutedToggled()) sound.setMuted(!sound.isMuted());
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) { startGame(false); return; }
      if (screen === SCREEN_STORM) { startGame(true); return; }
      if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_WIN) {
        screen = SCREEN_PLAY;
        announce('Back on the streets of Solmar Bay.');
        return;
      }
      if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; return; }
    }
    if (screen !== SCREEN_PLAY) return;
    // Mouse aim in world coordinates, for shooting.
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const aim = painter.screenToWorld(input.mouse.x * scaleX, input.mouse.y * scaleY, zoom);
    world.state.aimX = aim.x;
    world.state.aimY = aim.y;
    const axis = input.axis();
    const inputForWorld = {
      axis,
      actions: actions & (ACTION_ENTER_CAR | ACTION_PUNCH),
      clicked,
      run: input.run(),
    };
    const events = world.step(STEP, inputForWorld);
    handleEvents(events);
    sound.update(world.state);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
      if (screen === SCREEN_TITLE) {
        // The title screen's backdrop: the city idles behind the panel.
        world.step(STEP, { axis: { x: 0, y: 0 }, actions: 0, clicked: false });
      }
    }
    painter.draw(world.state, screen, best, zoom);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
