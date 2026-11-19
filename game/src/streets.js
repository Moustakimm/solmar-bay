// The city's geometry: the road grid, the districts, and the buildings.
// Pure functions over the world state — no drawing and no browser here, so
// every system (player, traffic, police) can share the same collision rules.

import { BEACH_Y, DISTRICTS, PALETTE, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';

const HALF_ROAD = ROAD_W / 2;

/** True when (x, y) is on asphalt, not on a block. */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar Bay';
}

/**
 * Push a circle out of every building it overlaps and return the corrected
 * position plus whether it hit anything. Buildings are rectangles, so the
 * push is along the shortest way out of the nearest edge.
 */
export function pushOutOfBuildings(state, x, y, radius) {
  let hit = false;
  for (const b of state.buildings) {
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
  return { x, y, hit };
}

/** The nearest road centre (x or y) and whether it runs vertically, for spawning. */
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

/**
 * Lay out the city once, from the seeded random: blocks between the roads,
 * each holding one to three buildings or a park with trees, plus palms along
 * the beachfront. The same seed always builds the same city.
 */
export function buildCity(rng) {
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
      if (rng() < 0.16) {
        // A park: grass, trees, a path — no buildings.
        parks.push({ x: x0, y: y0, w, h });
        const count = 5 + Math.floor(rng() * 6);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 20 + rng() * (w - 40), y: y0 + 20 + rng() * (h - 40), r: 12 + rng() * 10 });
        }
        continue;
      }
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        const bw = 70 + rng() * Math.min(150, w - 90);
        const bh = 60 + rng() * Math.min(130, h - 80);
        const bx0 = x0 + 10 + rng() * Math.max(1, w - bw - 20);
        const by0 = y0 + 10 + rng() * Math.max(1, h - bh - 20);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: PALETTE.building[Math.floor(rng() * PALETTE.building.length)],
          roof: PALETTE.roof[Math.floor(rng() * PALETTE.roof.length)],
          tall: rng() < 0.25,
        });
      }
      if (rng() < 0.5) {
        trees.push({ x: x0 + 16 + rng() * (w - 32), y: y0 + 16 + rng() * (h - 32), r: 12 + rng() * 8 });
      }
    }
  }
  // Palms along the beachfront.
  for (let x = 60; x < WORLD.width; x += 130) {
    trees.push({ x: x + rng() * 40, y: BEACH_Y + 30 + rng() * 50, r: 14, palm: true });
  }
  return { buildings, trees, parks };
}
