// The player: Jax, new in Solmar Bay. On foot he walks and runs, punches and
// shoots toward the mouse; in a car he drives it. Entering and leaving a car,
// crashing, picking things up and taking damage all live here.

import { CAR, CAR_HP, COP, EVENT_CRASH, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED, PED, PLAYER, SEA_Y, WANTED, WORLD } from './config.js';
import { pushOutOfBuildings } from './streets.js';
import { ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { noteDebtorHit } from './jobs.js';

/** A car, whether parked, in traffic, driven by the player or a cop car. */
export function makeCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle,
    speed: 0,
    color: o.color || '#d94f3d',
    kind: o.kind || 'sedan',
    parked: !!(o.parked),
    traffic: !!(o.traffic),
    police: !!(o.police),
    gold: !!(o.gold),
    driver: null,
    // Per-car tuning and damage: the gold Comet is faster, police cars are
    // tougher, and every car can be shot into a smoking wreck.
    topSpeed: o.topSpeed || 0,
    accel: o.accel || 0,
    hp: o.hp || CAR_HP,
    wrecked: false,
    disabled: false,
    cruise: 0,
    vertical: false,
    at: 0,
    along: 0,
    dir: 1,
    lane: 0,
    siren: 0,
  };
}

export function createPlayer() {
  return {
    x: 1500, y: 760, angle: -Math.PI / 2,
    health: PLAYER.health,
    ammo: PLAYER.startAmmo,
    inCar: null,
    shootTimer: 0,
    punchTimer: 0,
    hurtTimer: 0,
    bustMeter: 0,
    dead: false,
  };
}

function clampToTown(state, x, y, radius) {
  const fixed = pushOutOfBuildings(state, x, y, radius);
  fixed.x = Math.max(radius, Math.min(WORLD.width - radius, fixed.x));
  fixed.y = Math.max(radius, Math.min(SEA_Y - radius, fixed.y));
  return fixed;
}

function tryEnterCar(state, helpers) {
  const p = state.player;
  if (p.inCar) return 0;
  const best = helpers.nearestStealableCar();
  if (!best) return 0;
  best.parked = false;
  best.traffic = false;
  p.inCar = best;
  p.angle = best.angle;
  // Stealing a car is a crime in Solmar Bay, parked or driven.
  return helpers.commitCrime(WANTED.stealCar);
}

function leaveCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  car.parked = true;
  car.speed = 0;
  p.inCar = null;
  // Step out beside the car, not inside it.
  const side = { x: p.x - Math.sin(p.angle) * 30, y: p.y + Math.cos(p.angle) * 30 };
  const fixed = clampToTown(state, side.x, side.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
}

function punch(state, helpers) {
  const p = state.player;
  if (p.inCar || p.punchTimer > 0) return 0;
  p.punchTimer = 0.35;
  let events = 0;
  const range = PLAYER.punchRange;
  const targets = [];
  for (const ped of state.peds) if (ped.health > 0) targets.push({ x: ped.x, y: ped.y, r: PED.radius, kind: 'ped', ref: ped });
  for (const cop of state.cops) if (cop.health > 0) targets.push({ x: cop.x, y: cop.y, r: COP.radius, kind: 'cop', ref: cop });
  let best = null;
  let bestD = range;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (!best) return 0;
  helpers.burst(best.x, best.y, '#ffd94d', 6, 120);
  best.ref.health -= PLAYER.punchDamage;
  if (best.kind === 'ped') {
    if (best.ref.debtor) {
      noteDebtorHit(state);
      if (best.ref.health <= 0) {
        best.ref.health = 0;
        best.ref.dead = true;
        events |= helpers.commitCrime(WANTED.killPed);
      }
    } else if (best.ref.health <= 0) {
      best.ref.health = 0;
      best.ref.dead = true;
      events |= helpers.commitCrime(WANTED.killPed);
    } else {
      events |= helpers.commitCrime(WANTED.hitPed);
    }
  } else if (best.kind === 'cop') {
    if (best.ref.health <= 0) {
      best.ref.health = 0;
      best.ref.dead = true;
      events |= helpers.commitCrime(WANTED.killCop);
    } else {
      events |= helpers.commitCrime(WANTED.hitCop);
    }
  }
  return events;
}

function shoot(state, helpers) {
  const p = state.player;
  if (p.ammo <= 0 || p.shootTimer > 0) return 0;
  // Drive-by: shooting from a car is slower and fires from the car's nose.
  const inCar = !!p.inCar;
  p.shootTimer = inCar ? 0.35 : 0.28;
  p.ammo -= 1;
  const ox = inCar ? p.inCar.x : p.x;
  const oy = inCar ? p.inCar.y : p.y;
  const aim = Math.atan2(state.aimY - oy, state.aimX - ox);
  p.angle = aim;
  const mx = ox + Math.cos(aim) * 26;
  const my = oy + Math.sin(aim) * 26;
  helpers.burst(mx, my, '#ffd94d', 5, 160);
  state.shake = Math.max(state.shake, 3);
  let events = EVENT_SHOT;
  events |= helpers.commitCrime(WANTED.shoot);
  // Raycast: the nearest living thing along the aim line, within gun range.
  const targets = [];
  for (const ped of state.peds) if (ped.health > 0) targets.push({ x: ped.x, y: ped.y, r: PED.radius, kind: 'ped', ref: ped });
  for (const cop of state.cops) if (cop.health > 0) targets.push({ x: cop.x, y: cop.y, r: COP.radius, kind: 'cop', ref: cop });
  for (const car of state.cars) {
    if (car === p.inCar || car.wrecked) continue;
    targets.push({ x: car.x, y: car.y, r: CAR.radius, kind: 'car', ref: car });
  }
  for (const car of state.copCars) {
    if (car.wrecked || car.disabled) continue;
    targets.push({ x: car.x, y: car.y, r: CAR.radius, kind: 'copcar', ref: car });
  }
  let best = null;
  let bestD = PLAYER.gunRange;
  for (const t of targets) {
    const dx = t.x - ox;
    const dy = t.y - oy;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along < 0 || along > bestD) continue;
    const across = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (across < t.r + 6 && along < bestD) { bestD = along; best = t; }
  }
  const endX = ox + Math.cos(aim) * bestD;
  const endY = oy + Math.sin(aim) * bestD;
  if (state.tracers.length < 8) state.tracers.push({ x1: mx, y1: my, x2: endX, y2: endY, life: 0.09, maxLife: 0.09 });
  if (best) {
    helpers.burst(best.x, best.y, '#e84a4a', 8, 130);
    if (best.kind === 'ped') {
      best.ref.health -= PLAYER.gunDamage;
      if (best.ref.health <= 0) {
        best.ref.health = 0;
        best.ref.dead = true;
        events |= helpers.commitCrime(WANTED.killPed);
      }
    } else if (best.kind === 'cop') {
      best.ref.health -= PLAYER.gunDamage;
      if (best.ref.health <= 0) {
        best.ref.health = 0;
        best.ref.dead = true;
        events |= helpers.commitCrime(WANTED.killCop);
      } else {
        events |= helpers.commitCrime(WANTED.hitCop);
      }
    } else {
      // Cars take damage: enough hits and the car is a smoking wreck.
      best.ref.hp -= 1;
      helpers.burst(best.x, best.y, '#8a8a8a', 6, 90);
      if (best.ref.hp <= 0) {
        best.ref.wrecked = true;
        best.ref.speed = 0;
        if (best.kind === 'copcar') {
          best.ref.disabled = true;
          helpers.burst(best.x, best.y, '#5a7dff', 12, 150);
        } else {
          best.ref.traffic = false;
          best.ref.parked = true;
        }
      }
    }
  }
  return events;
}

function stepOnFoot(state, dt, input, helpers) {
  const p = state.player;
  const axis = input.axis;
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = axis.x;
  let my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
    const fixed = clampToTown(state, p.x + mx * speed * dt, p.y + my * speed * dt, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
  }
  return 0;
}

function stepDriving(state, dt, input, helpers) {
  const p = state.player;
  const car = p.inCar;
  const axis = input.axis;
  const forward = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0; // W is up on screen: forward
  const steer = axis.x;
  // A car's own tuning wins: the gold Comet outruns everything else.
  const topSpeed = car.topSpeed || CAR.maxSpeed;
  const accel = car.accel || CAR.accel;
  if (forward > 0) car.speed = Math.min(topSpeed, car.speed + accel * dt);
  else if (forward < 0) {
    car.speed = car.speed > 20 ? Math.max(0, car.speed - CAR.brake * dt) : Math.max(-CAR.reverseMax, car.speed - accel * 0.6 * dt);
  } else {
    car.speed *= Math.max(0, 1 - 0.9 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const steerAmount = CAR.steer * (car.speed / CAR.maxSpeed) * steer * dt;
  car.angle += car.speed >= 0 ? steerAmount : -steerAmount;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Collide with buildings at the nose and the tail, so the car slides along
  // a wall instead of stopping dead or sinking into it.
  const front = { x: nx + Math.cos(car.angle) * 20, y: ny + Math.sin(car.angle) * 20 };
  const back = { x: nx - Math.cos(car.angle) * 20, y: ny - Math.sin(car.angle) * 20 };
  const cf = pushOutOfBuildings(state, front.x, front.y, 14);
  const cb = pushOutOfBuildings(state, back.x, back.y, 14);
  const hitWall = cf.hit || cb.hit;
  car.x = (cf.x + cb.x) / 2;
  car.y = (cf.y + cb.y) / 2;
  car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
  car.y = Math.max(24, Math.min(SEA_Y - 24, car.y));
  if (hitWall && Math.abs(car.speed) > 120) {
    car.speed *= 0.6;
    state.shake = Math.max(state.shake, 4);
    helpers.burst(car.x, car.y, '#c9c2ae', 6, 110);
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Skid dust when turning hard at speed, and a mark on the road behind.
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 300) {
    if (state.rng() < 0.3) {
      helpers.addParticle(car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, 0, 0, 0.5, '#c9c2ae', 4);
    }
    if (Math.abs(steer) > 0.6 && state.skids.length < 160) {
      const backPt = { x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24 };
      state.skids.push({ x: backPt.x, y: backPt.y, angle: car.angle, life: 6, maxLife: 6 });
    }
  }
  // Running over a pedestrian at speed is a crime and hurts the car a little.
  let events = 0;
  for (const ped of state.peds) {
    if (ped.health <= 0 || ped.runOver) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 150) {
      ped.health = 0;
      ped.dead = true;
      ped.runOver = true;
      helpers.burst(ped.x, ped.y, '#e84a4a', 10, 150);
      car.speed *= 0.92;
      events |= helpers.commitCrime(WANTED.killPed);
      events |= EVENT_CRASH;
    }
  }
  return events;
}

function stepPickups(state) {
  const p = state.player;
  let events = 0;
  for (const pick of state.pickups) {
    if (pick.taken) continue;
    if (Math.hypot(pick.x - p.x, pick.y - p.y) < 34) {
      pick.taken = true;
      if (pick.kind === 'health') p.health = Math.min(PLAYER.health, p.health + pick.amount);
      else if (pick.kind === 'ammo') p.ammo += pick.amount;
      else if (pick.kind === 'cash') state.cash += pick.amount;
      events |= EVENT_PICKUP;
    }
  }
  return events;
}

/** One fixed step of the player. Returns event flags. */
export function stepPlayer(state, dt, input, helpers) {
  const p = state.player;
  if (p.dead) return EVENT_WASTED;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  let events = 0;
  if (input.actions & ACTION_ENTER_CAR) {
    if (p.inCar) leaveCar(state);
    else events |= tryEnterCar(state, helpers);
  }
  if (p.inCar) events |= stepDriving(state, dt, input, helpers);
  else events |= stepOnFoot(state, dt, input, helpers);
  if (input.actions & ACTION_PUNCH) events |= punch(state, helpers);
  if (input.clicked) events |= shoot(state, helpers);
  events |= stepPickups(state);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    return events | EVENT_WASTED;
  }
  return events;
}
