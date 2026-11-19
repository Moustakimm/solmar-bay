// The Solmar Bay police: wanted stars, patrol cars that chase and ram, and
// foot officers who run the player down and try to bust him. Cops spawn at
// the nearest road when the heat rises and give up when it falls. Police cars
// drive around buildings like everything else — they never cut through them.

import { CAR, COP, COP_CAR_HP, EVENT_BUSTED, PALETTE } from './config.js';
import { makeCar } from './driver.js';
import { nearestRoad, pushOutOfBuildings } from './streets.js';

export function wantedStars(n) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

function spawnCopCar(state, rng) {
  const p = state.player;
  const road = nearestRoad(p.x + (rng() < 0.5 ? -600 : 600), p.y);
  const x = road.vertical ? road.at : p.x + (rng() < 0.5 ? -500 : 500);
  const y = road.vertical ? p.y + (rng() < 0.5 ? -500 : 500) : road.at;
  const car = makeCar(x, y, 0, { color: PALETTE.copCar, police: true, kind: 'police', hp: COP_CAR_HP });
  car.speed = 0;
  car.siren = rng() * 2;
  // Named units, so the HUD can call them out by name and distance.
  car.unit = `UNIT ${state.nextUnit}`;
  state.nextUnit += 1;
  state.copCars.push(car);
  return car;
}

function spawnFootCop(state, rng) {
  const p = state.player;
  const angle = rng() * Math.PI * 2;
  const cop = {
    x: p.x + Math.cos(angle) * 420,
    y: p.y + Math.sin(angle) * 420,
    angle: 0, speed: COP.runSpeed,
    health: COP.health, dead: false,
    punchTimer: 0, shirt: PALETTE.cop,
  };
  state.cops.push(cop);
  return cop;
}

function chaseCar(state, car, dt) {
  if (car.disabled) return;
  const p = state.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const targetSpeed = Math.min(CAR.maxSpeed, 380 + state.wanted * 40);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Police cars drive around buildings like everything else: they used to
  // cut straight through them, which the chase camera showed plainly.
  const front = { x: nx + Math.cos(car.angle) * 20, y: ny + Math.sin(car.angle) * 20 };
  const back = { x: nx - Math.cos(car.angle) * 20, y: ny - Math.sin(car.angle) * 20 };
  const cf = pushOutOfBuildings(state, front.x, front.y, 14);
  const cb = pushOutOfBuildings(state, back.x, back.y, 14);
  if (cf.hit || cb.hit) car.speed *= 0.6; // scrub speed off the wall, slide along it
  car.x = (cf.x + cb.x) / 2;
  car.y = (cf.y + cb.y) / 2;
  car.x = Math.max(20, Math.min(3180, car.x));
  car.y = Math.max(20, Math.min(2270, car.y));
  car.siren = (car.siren || 0) + dt;
  // Ram the player's car: a solid hit shakes the screen and slows them both.
  const pc = p.inCar;
  if (pc && Math.hypot(car.x - pc.x, car.y - pc.y) < 48) {
    pc.speed *= 0.82;
    car.speed *= 0.7;
    state.shake = Math.max(state.shake, 5);
  }
  // A cop car that touches the player on foot hurts him.
  if (!pc && dist < 40) {
    p.health -= 12 * dt * 2;
    p.hurtTimer = 0.4;
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
    }
  }
}

export function stepCops(state, dt, rng, helpers) {
  let events = 0;
  const wanted = state.wanted;
  // The heat is only "on" while the crime is fresh or a cop is still close:
  // once the player has been out of sight for a while, no fresh units spawn
  // and the wanted level can decay (see city.step). Otherwise the player
  // could never lose the cops — a new unit would always know where he is.
  const nearCopCar = state.copCars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
  const nearCop = state.cops.some((c) => !c.dead && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
  const heatOn = state.crimeTimer < 10 || nearCopCar || nearCop;
  // How many units the heat calls for: more stars, more cars and more boots.
  const wantCars = wanted === 0 || !heatOn ? 0 : Math.min(4, 1 + Math.floor(wanted / 2));
  const wantCops = wanted === 0 || !heatOn ? 0 : Math.min(4, wanted);
  while (state.copCars.length < wantCars) spawnCopCar(state, rng);
  while (state.cops.filter((c) => !c.dead).length < wantCops) spawnFootCop(state, rng);
  // Stand down when the heat is gone.
  if (wanted === 0 || !heatOn) {
    state.copCars = [];
    state.cops = state.cops.filter((c) => !c.dead);
    for (const cop of state.cops) cop.leaving = true;
  }
  const p = state.player;
  for (const car of state.copCars) chaseCar(state, car, dt);
  for (const cop of state.cops) {
    if (cop.dead) continue;
    if (cop.leaving) {
      // Walk away from the player and fade out of the scene.
      cop.angle = Math.atan2(cop.y - p.y, cop.x - p.x);
      const c = pushOutOfBuildings(state, cop.x + Math.cos(cop.angle) * 120 * dt, cop.y + Math.sin(cop.angle) * 120 * dt, COP.radius);
      cop.x = c.x;
      cop.y = c.y;
      continue;
    }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 26) {
      const c = pushOutOfBuildings(state, cop.x + Math.cos(cop.angle) * COP.runSpeed * dt, cop.y + Math.sin(cop.angle) * COP.runSpeed * dt, COP.radius);
      cop.x = c.x;
      cop.y = c.y;
    } else if (!p.inCar) {
      // Close enough to grab: the bust meter fills while the player dawdles.
      p.bustMeter += dt;
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.9;
        p.health -= COP.punchDamage;
        p.hurtTimer = 0.4;
        helpers.burst(p.x, p.y, '#ffd94d', 5, 100);
        if (p.health <= 0) {
          p.health = 0;
          p.dead = true;
        }
      }
      if (p.bustMeter >= COP.bustTime) {
        p.bustMeter = 0;
        events |= EVENT_BUSTED;
        return events;
      }
    }
    if (cop.punchTimer > 0) cop.punchTimer -= dt;
    if (dist > 60) p.bustMeter = Math.max(0, p.bustMeter - dt);
  }
  if (p.dead) return events;
  // Clean up the dead and the ones who wandered far away.
  state.cops = state.cops.filter((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 1600);
  state.copCars = state.copCars.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1800);
  return events;
}
