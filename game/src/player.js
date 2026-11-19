// The player: Jax, new in Solmar Bay. On foot he walks and runs, punches and
// shoots toward the mouse; in a car he drives it. Entering and leaving a car,
// crashing, picking things up and taking damage all live here.
import { CAR, CAR_HP, COP, PED, PLAYER, SEA_Y, WANTED, WORLD } from './config.js';
import { collideBuildings, onRoad } from './world.js';
import { ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { EVENT_BUSTED, EVENT_CRASH, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED } from './world.js';

const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#4fae5a', '#e8e8e8', '#7a4fd9', '#d97a3d', '#3dc9c9'];

export function createPlayer() {
  return {
    x: 1500, y: 760, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.health, ammo: PLAYER.startAmmo,
    inCar: null, // the car object when driving, else null
    punchTimer: 0, shootTimer: 0, hurtTimer: 0, invulnerable: 0,
    bustMeter: 0, dead: false,
  };
}

export function makeCar(x, y, angle, opts) {
  return {
    x, y, angle, speed: 0,
    color: (opts && opts.color) || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: (opts && opts.kind) || 'sedan',
    parked: !!(opts && opts.parked),
    gold: !!(opts && opts.gold),
    police: !!(opts && opts.police),
    traffic: !!(opts && opts.traffic),
    driver: null,
    // A car's own tuning and damage: the Comet is quicker, a police cruiser
    // is tougher, and any car can be shot until it is a smoking wreck.
    topSpeed: (opts && opts.topSpeed) || 0,
    accel: (opts && opts.accel) || 0,
    hp: (opts && opts.hp) || CAR_HP,
    wrecked: false,
    disabled: false,
  };
}

function damagePlayer(state, amount, helpers) {
  const p = state.player;
  if (p.invulnerable > 0 || p.dead) return 0;
  p.health -= amount;
  p.hurtTimer = 0.5;
  p.invulnerable = 0.4;
  helpers.burst(p.x, p.y, '#e84a4a', 8, 120);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    return EVENT_WASTED;
  }
  return 0;
}

/** The player's car, if driving, else null. */
export function playerCar(state) {
  return state.player.inCar;
}

function tryEnterCar(state, helpers) {
  const p = state.player;
  if (p.inCar) {
    // Step out beside the car, leaving it parked where it stopped.
    const car = p.inCar;
    car.speed = 0;
    car.parked = true;
    car.traffic = false;
    p.inCar = null;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    p.angle = car.angle;
    return 0;
  }
  let best = null;
  let bestD = 70;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return 0;
  best.parked = false;
  best.traffic = false;
  p.inCar = best;
  p.angle = best.angle;
  // Taking a car is a crime in Solmar Bay, whether it was parked or driven.
  return helpers.commitCrime(WANTED.stealCar);
}

function punch(state, helpers) {
  const p = state.player;
  if (p.punchTimer > 0 || p.inCar) return 0;
  p.punchTimer = 0.35;
  let events = 0;
  const reach = PLAYER.punchRange + 14;
  const fx = p.x + Math.cos(p.angle) * reach;
  const fy = p.y + Math.sin(p.angle) * reach;
  // Peds and cops in front of the player take the hit.
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < reach + PED.radius && Math.abs(angleDiff(Math.atan2(ped.y - p.y, ped.x - p.x), p.angle)) < 1.1) {
      ped.health -= PLAYER.punchDamage;
      ped.flee = true;
      ped.fleeTimer = 3;
      if (ped.debtor) ped.hits = (ped.hits || 0) + 1;
      helpers.burst(ped.x, ped.y, '#ffd94d', 6, 100);
      events |= hitPed(state, ped, helpers);
    }
  }
  for (const cop of state.cops) {
    if (cop.health <= 0) continue;
    if (Math.hypot(cop.x - p.x, cop.y - p.y) < reach + COP.radius && Math.abs(angleDiff(Math.atan2(cop.y - p.y, cop.x - p.x), p.angle)) < 1.1) {
      cop.health -= PLAYER.punchDamage;
      helpers.burst(cop.x, cop.y, '#ffd94d', 6, 100);
      if (cop.health <= 0) {
        cop.dead = true;
        events |= helpers.commitCrime(WANTED.killCop);
        state.cash += 20;
      } else {
        events |= helpers.commitCrime(WANTED.hitCop);
      }
    }
  }
  return events;
}

function hitPed(state, ped, helpers) {
  if (ped.health <= 0) {
    ped.dead = true;
    state.cash += 15;
    return helpers.commitCrime(WANTED.killPed);
  }
  return helpers.commitCrime(WANTED.hitPed);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function shoot(state, helpers) {
  const p = state.player;
  if (p.ammo <= 0 || p.shootTimer > 0) return 0;
  // Shooting from the driver's seat is a drive-by: slower, and the shot
  // starts at the car's nose instead of at Jax.
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
  // The first ped, cop or car the shot crosses takes it.
  let best = null;
  let bestD = PLAYER.gunRange;
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
      best.ref.flee = true;
      best.ref.fleeTimer = 4;
      events |= hitPed(state, best.ref, helpers);
    } else if (best.kind === 'cop') {
      best.ref.health -= PLAYER.gunDamage;
      if (best.ref.health <= 0) {
        best.ref.dead = true;
        events |= helpers.commitCrime(WANTED.killCop);
      } else {
        events |= helpers.commitCrime(WANTED.hitCop);
      }
    } else {
      // A car takes damage: enough hits and it is a smoking wreck. A wrecked
      // police car stops chasing; a wrecked traffic car stops dead.
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

function driveCar(state, dt, input, helpers) {
  const p = state.player;
  const car = p.inCar;
  const axis = input.axis;
  const forward = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0; // W is up on screen: forward
  const steer = axis.x;
  // The car's own tuning wins over the defaults: the gold Comet outruns
  // everything else on the road.
  const topSpeed = car.topSpeed || CAR.maxSpeed;
  const accel = car.accel || CAR.accel;
  if (forward > 0) car.speed = Math.min(topSpeed, car.speed + accel * dt);
  else if (forward < 0) {
    car.speed = car.speed > 20 ? Math.max(0, car.speed - CAR.brake * dt) : Math.max(-CAR.reverseMax, car.speed - accel * 0.6 * dt);
  } else {
    car.speed *= Math.max(0, 1 - 0.9 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.steer * dt * dir * Math.min(1, Math.abs(car.speed) / 160 + 0.25);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const front = { x: nx + Math.cos(car.angle) * 20, y: ny + Math.sin(car.angle) * 20 };
  const back = { x: nx - Math.cos(car.angle) * 20, y: ny - Math.sin(car.angle) * 20 };
  const cf = collideBuildings(state, front.x, front.y, 14);
  const cb = collideBuildings(state, back.x, back.y, 14);
  let events = 0;
  if (cf.hit || cb.hit) {
    // A crash: stop, shake, dust, and a bump of wanted if a cop saw it.
    if (Math.abs(car.speed) > 240) {
      state.shake = Math.max(state.shake, 6);
      helpers.burst(car.x, car.y, '#c9c2ae', 10, 140);
      events |= EVENT_CRASH;
      if (state.wanted > 0) events |= helpers.commitCrime(0);
    }
    car.speed *= -0.25;
  }
  car.x = (cf.x + cb.x) / 2;
  car.y = (cf.y + cb.y) / 2;
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(Math.min(WORLD.height - 20, SEA_Y - 30), car.y));
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Skid dust when turning hard at speed, and a dark mark left on the road.
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 300) {
    if (Math.random() < 0.3) {
      helpers.addParticle(car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, 0, 0, 0.5, '#c9c2ae', 4);
    }
    if (Math.abs(steer) > 0.6 && state.skids.length < 160) {
      const back = { x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24 };
      state.skids.push({ x: back.x, y: back.y, angle: car.angle, life: 6, maxLife: 6 });
    }
  }
  // Running over a pedestrian at speed is a crime and hurts the car a little.
  for (const ped of state.peds) {
    if (ped.health <= 0 || ped.runOver) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < CAR.radius + PED.radius && Math.abs(car.speed) > 120) {
      ped.health = 0;
      ped.runOver = true;
      helpers.burst(ped.x, ped.y, '#e84a4a', 10, 150);
      state.shake = Math.max(state.shake, 4);
      events |= helpers.commitCrime(WANTED.killPed);
    }
  }
  return events;
}

function walkPlayer(state, dt, input, helpers) {
  const p = state.player;
  const axis = input.axis;
  const len = Math.hypot(axis.x, axis.y);
  if (len > 0) {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + (axis.x / len) * speed * dt;
    const ny = p.y + (axis.y / len) * speed * dt;
    p.angle = Math.atan2(axis.y, axis.x);
    const c = collideBuildings(state, nx, ny, PLAYER.radius);
    p.x = Math.max(16, Math.min(WORLD.width - 16, c.x));
    p.y = Math.max(16, Math.min(SEA_Y - 24, c.y));
    // Walking into the sea is not allowed: the beach stops at the water.
    if (p.y > SEA_Y - 24) p.y = SEA_Y - 24;
  }
  // Aim follows the mouse even when standing still.
  if (state.aimX !== undefined) {
    p.angle = Math.atan2(state.aimY - p.y, state.aimX - p.x);
  }
  return 0;
}

export function stepPlayer(state, dt, input, helpers) {
  const p = state.player;
  if (p.dead) return 0;
  let events = 0;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  const { actions, clicked } = input;
  if (actions & ACTION_ENTER_CAR) events |= tryEnterCar(state, helpers);
  if (actions & ACTION_PUNCH) events |= punch(state, helpers);
  if (clicked) events |= shoot(state, helpers);
  if (p.inCar) events |= driveCar(state, dt, input, helpers);
  else events |= walkPlayer(state, dt, input, helpers);
  // Pickups: walk or drive over them to collect.
  for (const pick of state.pickups) {
    if (pick.taken) continue;
    if (Math.hypot(pick.x - p.x, pick.y - p.y) < 40) {
      pick.taken = true;
      if (pick.kind === 'health') p.health = Math.min(PLAYER.health, p.health + pick.amount);
      else if (pick.kind === 'ammo') p.ammo += pick.amount;
      else if (pick.kind === 'cash') state.cash += pick.amount;
      helpers.burst(pick.x, pick.y, '#7ae08a', 10, 120);
      events |= EVENT_PICKUP;
    }
  }
  return events;
}

export { damagePlayer, angleDiff };
