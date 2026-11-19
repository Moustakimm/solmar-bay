// Pedestrians: the people of Solmar Bay. They stroll the pavements, turn at
// intersections, and flee from speeding cars and gunfire. A few stand around
// the districts as local colour; the debtor for the Debt Collection mission
// is a pedestrian with a job to do.
import { PED, ROADS_X, ROADS_Y, ROAD_W, SEA_Y, WORLD } from './config.js';
import { collideBuildings } from './world.js';

const SHIRTS = ['#e84a4a', '#4fae5a', '#3d7ad9', '#e8c33a', '#c94f8a', '#7a4fd9', '#e8e8e8', '#3dc9c9', '#d97a3d'];
const PED_COUNT = 34;

function sidewalkPoint(random) {
  // A point on a pavement beside a road: offset just outside the asphalt.
  const vertical = random() < 0.5;
  const roads = vertical ? ROADS_X : ROADS_Y;
  const at = roads[Math.floor(random() * roads.length)];
  const side = random() < 0.5 ? -1 : 1;
  const along = 60 + random() * (vertical ? WORLD.height - 400 : WORLD.width - 120);
  const off = side * (ROAD_W / 2 + 14);
  return vertical ? { x: at + off, y: along } : { x: along, y: at + off };
}

export function spawnPedestrians(state, random) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const p = sidewalkPoint(random);
    state.peds.push({
      x: p.x, y: p.y,
      angle: random() * Math.PI * 2,
      speed: PED.walkSpeed * (0.8 + random() * 0.4),
      health: PED.health,
      shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
      flee: false, fleeTimer: 0, dead: false, runOver: false,
      turnTimer: 2 + random() * 4,
      debtor: false,
    });
  }
  // The debtor waits at the Docks for the Debt Collection mission.
  const debtor = {
    x: 2300, y: 1900, angle: 0, speed: 0,
    health: 150, shirt: '#2a2a2a', flee: false, fleeTimer: 0,
    dead: false, runOver: false, turnTimer: 999, debtor: true, hits: 0,
  };
  state.peds.push(debtor);
  state.debtor = debtor;
}

function nearestRoadDirection(state, ped) {
  // Keep to the pavements: walk parallel to the nearest road.
  let best = null;
  for (const rx of ROADS_X) {
    const d = Math.abs(ped.x - rx);
    if (!best || d < best.d) best = { d, vertical: true, at: rx };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(ped.y - ry);
    if (!best || d < best.d) best = { d, vertical: false, at: ry };
  }
  if (!best) return ped.angle;
  if (best.vertical) return ped.y > WORLD.height / 2 ? -Math.PI / 2 : Math.PI / 2;
  return ped.x > WORLD.width / 2 ? Math.PI : 0;
}

export function stepPedestrians(state, dt, random) {
  const player = state.player;
  const playerCar = player.inCar;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.flee = false;
    // Flee from a fast car or a nearby gunshot.
    if (playerCar && Math.abs(playerCar.speed) > 200 && Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y) < 180) {
      ped.flee = true;
      ped.fleeTimer = 2;
    }
    // Panic spreads: a fleeing pedestrian sets off the people right next to them.
    if (ped.flee) {
      for (const other of state.peds) {
        if (other !== ped && !other.dead && Math.hypot(other.x - ped.x, other.y - ped.y) < 120) {
          other.flee = true;
          other.fleeTimer = Math.max(other.fleeTimer, 1.5);
        }
      }
    }
    if (ped.debtor) {
      // The debtor stands his ground until punched; then he runs.
      if (ped.flee) {
        ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
        const nx = ped.x + Math.cos(ped.angle) * PED.fleeSpeed * dt;
        const ny = ped.y + Math.sin(ped.angle) * PED.fleeSpeed * dt;
        const c = collideBuildings(state, nx, ny, PED.radius);
        ped.x = c.x;
        ped.y = c.y;
      }
      continue;
    }
    let speed = ped.speed;
    let angle = ped.angle;
    if (ped.flee) {
      speed = PED.fleeSpeed;
      angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    } else {
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = 3 + random() * 5;
        angle = nearestRoadDirection(state, ped);
        if (random() < 0.5) angle += Math.PI;
      }
    }
    ped.angle = angle;
    const nx = ped.x + Math.cos(angle) * speed * dt;
    const ny = ped.y + Math.sin(angle) * speed * dt;
    const c = collideBuildings(state, nx, ny, PED.radius);
    ped.x = Math.max(16, Math.min(WORLD.width - 16, c.x));
    ped.y = Math.max(16, Math.min(SEA_Y - 24, c.y));
  }
  // Remove the dead (they stay down for a while as a reminder, then go).
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.dead && !ped.debtor) {
      ped.deadTimer = (ped.deadTimer || 0) + dt;
      if (ped.deadTimer > 8) state.peds.splice(i, 1);
    }
  }
  return 0;
}
