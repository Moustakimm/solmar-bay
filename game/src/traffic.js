// Cars: traffic that drives the road grid, parked cars waiting to be stolen,
// and the gold Comet the Hot Wheels mission needs. Traffic cars pick a road,
// a lane and a direction, turn at intersections, and slow for the car ahead —
// then pull away again at their own cruise speed, so the city never grinds
// to a halt behind one slow car.

import { CAR, COMET, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { makeCar } from './driver.js';
import { EVENT_CRASH } from './config.js';

const TRAFFIC_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#4fae5a', '#e8e8e8', '#7a4fd9', '#d97a3d', '#3dc9c9', '#c94f8a', '#8a8a8a'];
const TRAFFIC_COUNT = 26;
const PARKED_COUNT = 16;

function roadPoint(vertical, at, along) {
  return vertical ? { x: at, y: along } : { x: along, y: at };
}

function spawnTrafficCar(state, rng, anywhere) {
  const vertical = rng() < 0.5;
  const roads = vertical ? ROADS_X : ROADS_Y;
  const at = roads[Math.floor(rng() * roads.length)];
  const along = anywhere ? rng() * (vertical ? WORLD.height : WORLD.width) : rng() * 2000 + 100;
  const dir = rng() < 0.5 ? 1 : -1;
  // Right-hand traffic: the lane follows the direction, so two cars never
  // meet head-on in the same lane and wait for each other forever.
  const lane = dir * (ROAD_W / 4);
  const p = roadPoint(vertical, at + lane, along);
  const car = makeCar(p.x, p.y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
    color: TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)],
    traffic: true,
  });
  car.vertical = vertical;
  car.at = at;
  car.along = along;
  car.dir = dir;
  car.lane = lane;
  // Each car remembers its own cruise speed: braking for the car ahead must
  // not become its speed forever, or the whole city grinds to a halt.
  car.cruise = CAR.trafficSpeed * (0.85 + rng() * 0.3);
  car.speed = car.cruise;
  return car;
}

export function spawnTraffic(state, rng) {
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    state.cars.push(spawnTrafficCar(state, rng, true));
  }
  // Parked cars along the roads, ready to steal.
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const vertical = rng() < 0.5;
    const roads = vertical ? ROADS_X : ROADS_Y;
    const at = roads[Math.floor(rng() * roads.length)];
    const along = 120 + rng() * (vertical ? WORLD.height - 500 : WORLD.width - 240);
    const side = rng() < 0.5 ? -1 : 1;
    const p = roadPoint(vertical, at + side * (ROAD_W / 2 + 16), along);
    const car = makeCar(p.x, p.y, vertical ? (Math.PI / 2) : 0, {
      color: TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)],
      parked: true,
    });
    state.cars.push(car);
  }
  // The gold Comet for the Hot Wheels mission, parked at the Marina.
  const gold = makeCar(300, 1820, Math.PI / 2, { color: '#ffd94d', gold: true, parked: true, kind: 'comet', topSpeed: COMET.topSpeed, accel: COMET.accel, hp: COMET.hp });
  state.cars.push(gold);
  state.goldCar = gold;
}

/** The nearest car the player could steal (not a police car, not the player's). */
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 70;
  for (const car of state.cars) {
    if (car.police || car === p.inCar) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function carAhead(state, car) {
  let best = Infinity;
  for (const other of state.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = car.vertical ? dy * car.dir : dx * car.dir;
    const across = car.vertical ? Math.abs(dx) : Math.abs(dy);
    if (along > 0 && along < 90 && across < 30 && along < best) best = along;
  }
  return best;
}

function maybeTurn(car, rng) {
  // At an intersection, sometimes turn onto the crossing road.
  const roads = car.vertical ? ROADS_Y : ROADS_X;
  for (const cross of roads) {
    const along = car.vertical ? car.y : car.x;
    if (Math.abs(along - cross) < 14 && rng() < 0.35) {
      const wasVertical = car.vertical;
      car.vertical = !wasVertical;
      car.at = cross;
      car.along = wasVertical ? car.x : car.y;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.lane = car.dir * (ROAD_W / 4); // right-hand traffic: lane follows direction
      car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      return;
    }
  }
}

function stepOneTraffic(state, car, dt, rng) {
  if (car.parked || car.police || car.wrecked) return 0;
  if (!car.traffic) return 0;
  const ahead = carAhead(state, car);
  // Stop for the car ahead, then pull away again at cruise speed.
  const target = ahead < 90 ? 0 : car.cruise;
  car.speed += (target - car.speed) * Math.min(1, dt * 2);
  if (car.speed < 1) car.speed = 0;
  car.along += car.dir * car.speed * dt;
  const limit = car.vertical ? WORLD.height : WORLD.width;
  if (car.along < 40 || car.along > limit - 40) {
    // Reached the edge of town: turn around on the same road, switching to
    // the lane for the new direction so the way back is not head-on.
    car.dir *= -1;
    car.lane = car.dir * (ROAD_W / 4);
    car.along = Math.max(40, Math.min(limit - 40, car.along));
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  }
  maybeTurn(car, rng);
  const p = roadPoint(car.vertical, car.at + car.lane, car.along);
  car.x = p.x;
  car.y = p.y;
  car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  return 0;
}

export function stepTraffic(state, dt, rng) {
  let events = 0;
  for (const car of state.cars) {
    events |= stepOneTraffic(state, car, dt, rng);
  }
  // Wrecked cars smoulder where they stopped.
  for (const car of state.cars) {
    if (car.wrecked && rng() < dt * 2.5 && state.particles.length < 240) {
      state.particles.push({ x: car.x + (rng() - 0.5) * 20, y: car.y - 10, vx: 0, vy: -26, life: 1.2, maxLife: 1.2, color: '#8a8a8a', size: 6 });
    }
  }
  // Traffic cars nudge each other apart when they overlap.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 44) {
        const push = (44 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (!a.parked) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.parked) { b.x += nx * push; b.y += ny * push; }
      }
    }
  }
  // The player's car can shove a traffic car: it slows and gets out of the way.
  const pc = state.player.inCar;
  if (pc) {
    for (const car of state.cars) {
      if (car === pc || car.parked || !car.traffic) continue;
      if (Math.hypot(car.x - pc.x, car.y - pc.y) < 46 && Math.abs(pc.speed) > 200) {
        car.speed = Math.max(60, car.speed - 60);
        events |= EVENT_CRASH;
      }
    }
  }
  return events;
}
