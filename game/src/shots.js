// The screenshot scenes behind ?shot=cover|street|chase|city (with &seed=N).
// Each one builds a real world with the game's own rules, then stages a moment
// in it — a chase, a street scene, a mission — so the frame is what playing
// really looks like, and the same seed always gives the same frame.
import { STEP } from './config.js';
import { makeCar } from './player.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Put a traffic car on a road near (x, y) so the street reads as alive. */
function addTraffic(world, x, y, angle, color) {
  const car = makeCar(x, y, angle, { color, traffic: true });
  car.speed = 150;
  car.vertical = Math.abs(Math.cos(angle)) < 0.5;
  world.state.cars.push(car);
  return car;
}

function addPed(world, x, y, angle, shirt) {
  world.state.peds.push({
    x, y, angle, speed: 70, health: 50, shirt,
    flee: false, fleeTimer: 0, dead: false, runOver: false, turnTimer: 99, debtor: false,
  });
}

function addCopCar(world, x, y, angle) {
  const car = makeCar(x, y, angle, { color: '#2f4fb8', police: true, kind: 'police' });
  car.speed = 420;
  car.siren = 0.4;
  world.state.copCars.push(car);
  return car;
}

/** A short burst of play so traffic and peds settle into natural positions. */
function settle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, { axis: { x: 0, y: 0 }, actions: 0, clicked: false });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw and the zoom.
 * cover: the player driving the gold Comet through Downtown at 3 stars, two
 *   cop cars on his tail, the mission marker ahead, traffic all around.
 * street: on foot by Rosa's Garage, peds and traffic, a mission marker near.
 * chase: dusk, the player fleeing down the Marina road, cops closing in.
 * city: a wide view of the whole city from above, minimap and HUD visible.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'city') {
    state.player.x = 1500;
    state.player.y = 1100;
    state.dusk = false;
    settle(world, 2);
    return { screen: SCREEN_PLAY, zoom: 0.42 };
  }
  if (name === 'street') {
    state.player.x = 1420;
    state.player.y = 760;
    state.player.angle = -Math.PI / 2;
    addTraffic(world, 1500, 620, 0, '#d94f3d');
    addTraffic(world, 1500, 900, Math.PI, '#3d7ad9');
    addPed(world, 1380, 700, 0, '#e8c33a');
    addPed(world, 1560, 820, Math.PI, '#4fae5a');
    addPed(world, 1460, 640, Math.PI / 2, '#c94f8a');
    settle(world, 1.5);
    return { screen: SCREEN_PLAY, zoom: 1 };
  }
  if (name === 'chase') {
    state.dusk = true;
    state.time = 18 * 60 + 20;
    const gold = state.goldCar;
    gold.x = 300;
    gold.y = 1500;
    gold.angle = Math.PI / 2;
    gold.parked = false;
    state.player.inCar = gold;
    state.player.x = gold.x;
    state.player.y = gold.y;
    state.player.angle = gold.angle;
    state.wanted = 3;
    addCopCar(world, 300, 1240, Math.PI / 2);
    addCopCar(world, 260, 1160, Math.PI / 2);
    addTraffic(world, 700, 1500, 0, '#e8e8e8');
    addTraffic(world, 300, 1750, -Math.PI / 2, '#3dc9c9');
    addPed(world, 380, 1620, 0, '#e8c33a');
    state.mission.index = 3;
    state.mission.step = 1;
    settle(world, 0.6);
    gold.speed = 380; // the readout should show a chase in progress, not a stop
    return { screen: SCREEN_PLAY, zoom: 1 };
  }
  // cover (and any unknown name): Downtown chase at 3 stars.
  const gold = state.goldCar;
  gold.x = 1500;
  gold.y = 1000;
  gold.angle = Math.PI / 2;
  gold.parked = false;
  gold.speed = 420;
  state.player.inCar = gold;
  state.player.x = gold.x;
  state.player.y = gold.y;
  state.player.angle = gold.angle;
  state.player.health = 86;
  state.cash = 640;
  state.wanted = 3;
  state.mission.index = 3;
  state.mission.step = 1;
  addCopCar(world, 1500, 760, Math.PI / 2);
  addCopCar(world, 1452, 690, Math.PI / 2);
  addTraffic(world, 1100, 1100, 0, '#d94f3d');
  addTraffic(world, 1900, 1000, Math.PI, '#3d7ad9');
  addTraffic(world, 1500, 1350, -Math.PI / 2, '#4fae5a');
  addPed(world, 1420, 1080, 0, '#e8c33a');
  addPed(world, 1580, 920, Math.PI, '#c94f8a');
  addPed(world, 1620, 1240, -Math.PI / 2, '#7a4fd9');
  state.shake = 0;
  settle(world, 0.8);
  return { screen: SCREEN_PLAY, zoom: 1 };
}
