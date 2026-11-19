// Solmar Bay itself: the city layout and the whole game state, with no drawing
// and no browser in it. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sounds, toasts, screens) without the
// world knowing about them. Sub-systems (player, traffic, police, missions)
// each own one job and are called from step() in a fixed order.
import { BEACH_Y, CAR, DISTRICTS, MISSIONS, PALETTE, PLAYER, ROADS_X, ROADS_Y, ROAD_W, SEA_Y, STEP, WORLD } from './config.js';
import { createPlayer, stepPlayer } from './player.js';
import { spawnTraffic, stepTraffic, nearestStealableCar } from './vehicles.js';
import { spawnPedestrians, stepPedestrians } from './pedestrians.js';
import { stepPolice, wantedStars } from './police.js';
import { createMissionRun, stepMissions } from './missions.js';

export const EVENT_CRASH = 1;
export const EVENT_SHOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WASTED = 8;
export const EVENT_BUSTED = 16;
export const EVENT_MISSION = 32;
export const EVENT_CRIME = 64;
export const EVENT_WIN = 128;

const HALF_ROAD = ROAD_W / 2;

/** True when (x, y) is on a road (asphalt), not on a block. */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solmar Bay';
}

/** Push a circle out of every building (and dock container) it overlaps; returns true when it hit one. */
export function collideBuildings(state, x, y, radius) {
  let hit = false;
  const solids = state.containers ? [state.buildings, state.containers] : [state.buildings];
  for (const list of solids) {
    for (const b of list) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          x += (dx / d) * push;
          y += (dy / d) * push;
        } else {
          y -= radius;
        }
      }
    }
  }
  return { x, y, hit };
}

/** The nearest road centre (x or y) and whether it is vertical, for spawning. */
export function nearestRoad(x, y) {
  let best = null;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { d, vertical: true, at: rx };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { d, vertical: false, at: ry };
  }
  return best;
}

function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const blockXs = [48, 348, 748, 1148, 1548, 1948, 2348, 2748];
  const blockWs = [204, 304, 304, 304, 304, 304, 304, 352];
  const blockYs = [48, 348, 748, 1148, 1548, 1948];
  const blockHs = [204, 304, 304, 304, 304, 152];
  for (let by = 0; by < blockYs.length; by += 1) {
    for (let bx = 0; bx < blockXs.length; bx += 1) {
      const x0 = blockXs[bx];
      const y0 = blockYs[by];
      const w = blockWs[bx];
      const h = blockHs[by];
      const roll = random();
      if (roll < 0.16) {
        // A park: grass, trees, a path — no buildings.
        parks.push({ x: x0, y: y0, w, h });
        const count = 5 + Math.floor(random() * 6);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 20 + random() * (w - 40), y: y0 + 20 + random() * (h - 40), r: 12 + random() * 10 });
        }
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const bw = 70 + random() * Math.min(150, w - 90);
        const bh = 60 + random() * Math.min(130, h - 80);
        const bx0 = x0 + 10 + random() * Math.max(1, w - bw - 20);
        const by0 = y0 + 10 + random() * Math.max(1, h - bh - 20);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: PALETTE.building[Math.floor(random() * PALETTE.building.length)],
          roof: PALETTE.roof[Math.floor(random() * PALETTE.roof.length)],
          tall: random() < 0.25,
        });
      }
      if (random() < 0.5) {
        trees.push({ x: x0 + 16 + random() * (w - 32), y: y0 + 16 + random() * (h - 32), r: 12 + random() * 8 });
      }
    }
  }
  // Palms along the beachfront.
  for (let x = 60; x < WORLD.width; x += 130) {
    trees.push({ x: x + random() * 40, y: BEACH_Y + 30 + random() * 50, r: 14, palm: true });
  }
  // The Docks work for a living: two container yards. Any building that
  // would stand inside a yard is cleared first, so no container ever sits
  // inside a warehouse.
  const yards = [
    { x: 2360, y: 1200, w: 280, h: 220 },
    { x: 2800, y: 1620, w: 280, h: 220 },
  ];
  const containers = [];
  const yardColors = ['#c9563c', '#3c7ac9', '#4fae5a', '#e8c33a', '#7a4fd9'];
  for (const yard of yards) {
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (b.x < yard.x + yard.w && b.x + b.w > yard.x && b.y < yard.y + yard.h && b.y + b.h > yard.y) {
        buildings.splice(i, 1);
      }
    }
    for (let gy = 0; gy < 3; gy += 1) {
      for (let gx = 0; gx < 4; gx += 1) {
        if (random() < 0.2) continue;
        containers.push({
          x: yard.x + 12 + gx * 70, y: yard.y + 12 + gy * 66,
          w: 60, h: 54,
          color: yardColors[Math.floor(random() * yardColors.length)],
          stacked: random() < 0.4,
        });
      }
    }
  }
  // Boats at anchor off the Marina and out in the bay.
  const boats = [];
  const sailColors = ['#e8e8e8', '#ffd94d', '#c94f8a', '#3dc9c9'];
  for (let i = 0; i < 9; i += 1) {
    const inMarina = i < 5;
    boats.push({
      x: inMarina ? 120 + random() * 700 : 150 + random() * 2800,
      y: inMarina ? 2320 + random() * 60 : 2330 + random() * 50,
      angle: (random() - 0.5) * 0.9,
      len: 44 + random() * 30,
      sail: sailColors[Math.floor(random() * sailColors.length)],
    });
  }
  // Beach umbrellas along the sand.
  const umbrellas = [];
  const umbrellaColors = ['#e84a4a', '#ffd94d', '#3d7ad9', '#c94f8a', '#4fae5a'];
  for (let x = 140; x < WORLD.width - 100; x += 190) {
    if (random() < 0.25) continue;
    umbrellas.push({ x: x + random() * 60, y: 2190 + random() * 70, r: 15 + random() * 6, color: umbrellaColors[Math.floor(random() * umbrellaColors.length)] });
  }
  return { buildings, trees, parks, containers, boats, umbrellas };
}

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    buildings: city.buildings,
    trees: city.trees,
    parks: city.parks,
    containers: city.containers,
    boats: city.boats,
    umbrellas: city.umbrellas,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    copCars: [],
    particles: [],
    skids: [], // tyre marks, fading over a few seconds
    tracers: [], // gunshot lines, gone in a blink
    pickups: [],
    time: 14 * 60, // game clock in minutes: 14:00, golden afternoon
    elapsed: 0,
    cash: PLAYER.startCash,
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    shake: 0,
    dusk: false,
    won: false,
    message: '',
    messageTimer: 0,
    mission: null,
    debtor: null,
    goldCar: null,
    random,
  };
  state.player = createPlayer();
  state.mission = createMissionRun(MISSIONS);

  function reset() {
    state.player = createPlayer();
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.copCars = [];
    state.particles = [];
    state.skids = [];
    state.tracers = [];
    state.pickups = [];
    state.time = 14 * 60;
    state.elapsed = 0;
    state.cash = PLAYER.startCash;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeTimer = 0;
    state.shake = 0;
    state.dusk = false;
    state.won = false;
    state.message = '';
    state.messageTimer = 0;
    state.mission = createMissionRun(MISSIONS);
    state.debtor = null;
    state.goldCar = null;
    spawnTraffic(state, random);
    spawnPedestrians(state, random);
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
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.6);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + random() * 0.4, color, 3 + random() * 3);
    }
  }

  /** Raise the wanted level by n stars (capped) and note the crime time. */
  function commitCrime(n) {
    state.wanted = Math.min(5, state.wanted + n);
    state.crimeTimer = 0;
    return EVENT_CRIME;
  }

  /**
   * One fixed step. `input` is {axis, actions, clicked, mouseWorld} from main.js.
   * The order matters: player, then traffic, peds, police, missions, particles.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.time += dt * 0.5; // one game minute every two real seconds
    if (state.time >= 18 * 60) state.dusk = true;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.crimeTimer < 9999) state.crimeTimer += dt;

    const playerEvents = stepPlayer(state, dt, input, { commitCrime, burst, addParticle });
    events |= playerEvents;
    if (events & EVENT_WASTED) return events;
    events |= stepTraffic(state, dt, random);
    events |= stepPedestrians(state, dt, random);
    events |= stepPolice(state, dt, random, { commitCrime, burst });
    if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
    const missionEvents = stepMissions(state, dt, { commitCrime, burst });
    events |= missionEvents;
    if (missionEvents & EVENT_WIN) state.won = true;

    // Wanted decays only while no cop can see the player and no recent crime.
    if (state.wanted > 0 && state.crimeTimer > 4) {
      const seen = state.copCars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 520)
        || state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 320);
      if (!seen) {
        state.wantedTimer += dt;
        const need = 15 + state.wanted * 10;
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

    // Particles age out; skid marks fade and tracers vanish fast.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      state.tracers[i].life -= dt;
      if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
    }
    return events;
  }

  reset();
  return { state, reset, step, commitCrime, burst, addParticle, nearestStealableCar: () => nearestStealableCar(state) };
}
