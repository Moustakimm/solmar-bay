// Solmar Bay itself: the city layout and the whole game state, with no drawing
// and no browser in it. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sounds, toasts, screens) without the
// world knowing about them. Sub-systems (player, traffic, police, missions)
// each own one job and are called from step() in a fixed order.

import { EVENT_BUSTED, EVENT_CRIME, EVENT_MISSION, EVENT_STORM, EVENT_WASTED, EVENT_WIN, MISSIONS, PLAYER, STORM, WANTED } from './config.js';
import { buildCity } from './streets.js';
import { createPlayer, stepPlayer } from './driver.js';
import { nearestStealableCar, spawnTraffic, stepTraffic } from './traffic.js';
import { spawnWalkers, stepWalkers } from './walkers.js';
import { stepCops, wantedStars } from './cops.js';
import { createJobRun, stepJobs } from './jobs.js';

export function createWorld(rng) {
  const city = buildCity(rng);
  const state = {
    buildings: city.buildings,
    trees: city.trees,
    parks: city.parks,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    copCars: [],
    particles: [],
    tracers: [],
    skids: [],
    pickups: [],
    time: STORM.start, // game clock in minutes: 14:00, golden afternoon
    elapsed: 0,
    cash: PLAYER.startCash,
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    shake: 0,
    dusk: false,
    storm: false, // true once Hurricane Vera makes landfall
    nextUnit: 7, // police unit numbers start at 7
    won: false,
    message: '',
    messageTimer: 0,
    dialogue: null, // {speaker, text, timer} — the mission dialogue box
    mission: null,
    debtor: null,
    goldCar: null,
    aimX: 0,
    aimY: 0,
    rng,
  };
  state.player = createPlayer();
  state.mission = createJobRun(MISSIONS);

  function reset() {
    state.player = createPlayer();
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.copCars = [];
    state.particles = [];
    state.tracers = [];
    state.skids = [];
    state.pickups = [];
    state.time = STORM.start;
    state.elapsed = 0;
    state.cash = PLAYER.startCash;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeTimer = 0;
    state.shake = 0;
    state.dusk = false;
    state.storm = false;
    state.nextUnit = 7;
    state.won = false;
    state.message = '';
    state.messageTimer = 0;
    state.dialogue = null;
    state.mission = createJobRun(MISSIONS);
    state.debtor = null;
    state.goldCar = null;
    spawnTraffic(state, rng);
    spawnWalkers(state, rng);
    // A hospital health pickup and an ammo pickup, always in the same spots.
    state.pickups.push({ x: 1500, y: 348, kind: 'health', amount: 40, taken: false });
    state.pickups.push({ x: 1100, y: 1548, kind: 'ammo', amount: 12, taken: false });
    state.pickups.push({ x: 700, y: 348, kind: 'cash', amount: 100, taken: false });
  }

  function addParticle(x, y, vx, vy, life, color, size) {
    if (state.particles.length < 240) {
      state.particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = speed * (0.4 + rng() * 0.6);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + rng() * 0.4, color, 3 + rng() * 3);
    }
  }

  /** Raise the wanted level by n stars (capped) and note the crime time. */
  function commitCrime(n) {
    state.wanted = Math.min(5, state.wanted + n);
    state.crimeTimer = 0;
    return EVENT_CRIME;
  }

  const helpers = {
    commitCrime,
    burst,
    addParticle,
    nearestStealableCar: () => nearestStealableCar(state),
  };

  /**
   * One fixed step. `input` is {axis, actions, clicked, mouseWorld} from main.js.
   * The order matters: player, then traffic, walkers, police, missions, particles.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.time += dt * 0.5; // one game minute every two real seconds
    if (state.time >= 18 * 60) state.dusk = true;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.dialogue && state.dialogue.timer > 0) state.dialogue.timer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.crimeTimer < 9999) state.crimeTimer += dt;
    // Hurricane Vera makes landfall at 02:00: if the jobs are not done by
    // then, the storm takes the city and the run ends.
    if (!state.storm && state.time >= STORM.landfall) {
      state.storm = true;
      events |= EVENT_STORM;
      return events;
    }

    const playerEvents = stepPlayer(state, dt, input, helpers);
    events |= playerEvents;
    if (events & EVENT_WASTED) return events;
    events |= stepTraffic(state, dt, rng);
    events |= stepWalkers(state, dt, rng);
    events |= stepCops(state, dt, rng, helpers);
    if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
    const missionEvents = stepJobs(state, dt, helpers);
    events |= missionEvents;
    if (missionEvents & EVENT_WIN) state.won = true;

    // Wanted decays only while no cop can see the player and no recent crime.
    if (state.wanted > 0 && state.crimeTimer > 4) {
      const seen = state.copCars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 520)
        || state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 320);
      if (!seen) {
        state.wantedTimer += dt;
        const need = WANTED.decayBase + state.wanted * 10;
        if (state.wantedTimer >= need) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          state.message = state.wanted === 0 ? 'You lost the cops.' : `Wanted level fell to ${wantedStars(state.wanted)}.`;
          state.messageTimer = 3;
        }
      } else {
        state.wantedTimer = 0;
      }
    }

    // Particles, tracers and skid marks age out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      const t = state.tracers[i];
      t.life -= dt;
      if (t.life <= 0) state.tracers.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      const s = state.skids[i];
      s.life -= dt;
      if (s.life <= 0) state.skids.splice(i, 1);
    }
    return events;
  }

  reset();
  return { state, reset, step, commitCrime, burst, addParticle, nearestStealableCar: () => nearestStealableCar(state) };
}
