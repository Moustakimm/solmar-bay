// Cars: traffic that drives the road grid, parked cars waiting to be stolen,
// and the gold Comet the Hot Wheels mission needs. Traffic cars pick a road,
// a lane and a direction, turn at intersections, and slow for the car ahead.
import { CAR, ROADS_X, ROADS_Y, ROAD_W, SEA_Y, WORLD } from './config.js';
import { makeCar } from './player.js';
import { collideBuildings } from './world.js';
import { EVENT_CRASH } from './world.js';

const TRAFFIC_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#4fae5a', '#e8e8e8', '#7a4fd9', '#d97a3d', '#3dc9c9', '#c94f8a', '#8a8a8a'];
const TRAFFIC_COUNT = 26;
const PARKED_COUNT = 16;

function roadPoint(vertical, at, along) {
  return vertical ? { x: at, y: along } : { x: along, y: at };
}

function spawnTrafficCar(state, random, anywhere) {
  const vertical = random() < 0.5;
  const roads = vertical ? ROADS_X : ROADS_Y;
  const at = roads[Math.floor(random() * roads.length)];
  const along = anywhere ? random() * (vertical ? WORLD.height : WORLD.width) : random() * 2000 + 100;
  const dir = random() < 0.5 ? 1 : -1;
  const lane = (random() < 0.5 ? -1 : 1) * (ROAD_W / 4);
  const p = roadPoint(vertical, at + lane, along);
  const car = makeCar(p.x, p.y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
    color: TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
    traffic: true,
  });
  car.vertical = vertical;
  car.at = at;
  car.along = along;
  car.dir = dir;
  car.lane = lane;
  car.speed = CAR.trafficSpeed * (0.85 + random() * 0.3);
  car.wait = 0;
  return car;
}

export function spawnTraffic(state, random) {
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    state.cars.push(spawnTrafficCar(state, random, true));
  }
  // Parked cars along the roads, ready to steal.
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const vertical = random() < 0.5;
    const roads = vertical ? ROADS_X : ROADS_Y;
    const at = roads[Math.floor(random() * roads.length)];
    const along = 120 + random() * (vertical ? WORLD.height - 500 : WORLD.width - 240);
    const side = random() < 0.5 ? -1 : 1;
    const p = roadPoint(vertical, at + side * (ROAD_W / 2 + 16), along);
    const car = makeCar(p.x, p.y, vertical ? (Math.PI / 2) : 0, {
      color: TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
      parked: true,
    });
    state.cars.push(car);
  }
  // The gold Comet for the Hot Wheels mission, parked at the Marina.
  const gold = makeCar(300, 1820, Math.PI / 2, { color: '#ffd94d', gold: true, parked: true, kind: 'comet' });
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

function maybeTurn(car, random) {
  // At an intersection, sometimes turn onto the crossing road.
  const roads = car.vertical ? ROADS_Y : ROADS_X;
  for (const cross of roads) {
    const along = car.vertical ? car.y : car.x;
    if (Math.abs(along - cross) < 14 && random() < 0.35) {
      const wasVertical = car.vertical;
      car.vertical = !wasVertical;
      car.at = cross;
      car.along = wasVertical ? car.x : car.y;
      car.dir = random() < 0.5 ? 1 : -1;
      car.lane = (random() < 0.5 ? -1 : 1) * (ROAD_W / 4);
      car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      return;
    }
  }
}

function stepOneTraffic(state, car, dt, random) {
  if (car.parked || car.police) return 0;
  if (!car.traffic) return 0;
  const ahead = carAhead(state, car);
  const target = ahead < 90 ? 0 : car.speed;
  car.speed += (target - car.speed) * Math.min(1, dt * 2);
  if (car.speed < 1) car.speed = 0;
  car.along += car.dir * car.speed * dt;
  const limit = car.vertical ? WORLD.height : WORLD.width;
  if (car.along < 40 || car.along > limit - 40) {
    // Reached the edge of town: turn around on the same road.
    car.dir *= -1;
    car.along = Math.max(40, Math.min(limit - 40, car.along));
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  }
  maybeTurn(car, random);
  const p = roadPoint(car.vertical, car.at + car.lane, car.along);
  car.x = p.x;
  car.y = p.y;
  car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  return 0;
}

export function stepTraffic(state, dt, random) {
  let events = 0;
  for (const car of state.cars) {
    events |= stepOneTraffic(state, car, dt, random);
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
