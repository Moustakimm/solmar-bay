// Solmar Bay — every tuning number, colour and place name in one place.
// The world is 3200x2400 world units; the renderer scales the view to the window,
// so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];
export const BEACH_Y = 2150; // south of this: sand, then the sea
export const SEA_Y = 2300;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  gunDamage: 34,
  gunRange: 430,
  startAmmo: 12,
  startCash: 50,
};

export const CAR = {
  length: 54,
  width: 26,
  radius: 22,
  maxSpeed: 560,
  accel: 420,
  brake: 700,
  reverseMax: 180,
  steer: 2.6,
  trafficSpeed: 175,
};

export const PED = { radius: 12, walkSpeed: 70, fleeSpeed: 210, health: 50 };
export const COP = { radius: 13, runSpeed: 265, health: 80, punchDamage: 8, bustTime: 1.2 };

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  killPed: 2,
  shoot: 1,
  hitCop: 2,
  killCop: 3,
  decayBase: 15, // seconds out of sight before one star drops, +10 per star
  maxStars: 5,
};

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 150,
    brief: "Rosa: 'New in Solmar Bay? You need wheels. Take any car and bring it to my garage.'",
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', x: 1500, y: 700, label: "Drive to Rosa's Garage", radius: 90 },
    ],
  },
  {
    id: 'courier', title: 'Courier Run', reward: 250,
    brief: "Rosa: 'A client needs three parcels across town. Fast. 150 seconds.'",
    steps: [
      { type: 'goto', x: 700, y: 300, label: 'Parcel 1: Hills', radius: 80 },
      { type: 'goto', x: 2700, y: 1500, label: 'Parcel 2: Docks', radius: 80 },
      { type: 'goto', x: 300, y: 1900, label: 'Parcel 3: Marina', radius: 80, timer: 150 },
    ],
  },
  {
    id: 'debt', title: 'Debt Collection', reward: 300,
    brief: "Rosa: 'A dockworker owes me $300. On foot. Persuade him — three good hits.'",
    steps: [
      { type: 'goto', x: 2300, y: 1900, label: 'Find the debtor at the Docks', radius: 100 },
      { type: 'beat', label: 'Persuade the debtor (Space to punch, 3 hits)' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 400,
    brief: "Rosa: 'A gold Comet is parked at the Marina. Take it. Cops will notice — lose them, then bring it here.'",
    steps: [
      { type: 'steal-gold', x: 300, y: 1900, label: 'Steal the gold Comet at the Marina' },
      { type: 'lose', label: 'Lose the cops (get wanted to 0 stars)' },
      { type: 'goto', x: 1500, y: 700, label: "Deliver the Comet to Rosa's Garage", radius: 90 },
    ],
  },
  {
    id: 'dock-heist', title: 'Dock Heist', reward: 600,
    brief: "Rosa: 'A package at the Docks. Grab it and the harbour police will be on you. Bring it to me.'",
    steps: [
      { type: 'goto', x: 2700, y: 1900, label: 'Grab the package at the Docks', radius: 80 },
      { type: 'goto', x: 1500, y: 700, label: "Deliver the package to Rosa's Garage", radius: 90, wanted: 3 },
    ],
  },
  {
    id: 'king', title: 'King of Solmar', reward: 1000,
    brief: "Rosa: 'Last job. Four drops across the city, then the penthouse at the Marina. Do this and Solmar Bay is yours.'",
    steps: [
      { type: 'goto', x: 1100, y: 300, label: 'Drop 1: Hills', radius: 80 },
      { type: 'goto', x: 2700, y: 700, label: 'Drop 2: Old Town', radius: 80 },
      { type: 'goto', x: 1900, y: 1900, label: 'Drop 3: Docks', radius: 80 },
      { type: 'goto', x: 700, y: 1100, label: 'Drop 4: Downtown', radius: 80 },
      { type: 'goto', x: 300, y: 1900, label: 'Finish: Marina Penthouse', radius: 100 },
    ],
  },
];

export const DISTRICTS = [
  { name: 'Hills', x0: 0, y0: 0, x1: 1500, y1: 700 },
  { name: 'Old Town', x0: 1500, y0: 0, x1: 3200, y1: 700 },
  { name: 'Downtown', x0: 900, y0: 700, x1: 2300, y1: 1500 },
  { name: 'Marina', x0: 0, y0: 1100, x1: 900, y1: 2150 },
  { name: 'Docks', x0: 2300, y0: 1100, x1: 3200, y1: 2150 },
  { name: 'Beachfront', x0: 0, y0: 1900, x1: 3200, y1: 2400 },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e8d29a',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  road: '#4a4a52',
  roadEdge: '#3a3a42',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  building: ['#e8a87c', '#d98c7a', '#e3c878', '#8fb8a8', '#c98bb0', '#a8b8d8', '#e0b090'],
  roof: ['#b8543e', '#7a5a3a', '#4a6a8a', '#5a7a4a', '#8a5a7a'],
  park: '#5d8f43',
  tree: '#3f7a34',
  palm: '#2f8a4a',
  player: '#ffcf3f',
  playerJacket: '#e84a4a',
  cop: '#2f4fb8',
  copCar: '#2f4fb8',
  hudPanel: 'rgba(12, 16, 28, 0.72)',
  text: '#f4f1e6',
  muted: '#c9c2ae',
  star: '#ffd94d',
  marker: '#ffcf3f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save';
export const VIEW_W = 1280;
export const VIEW_H = 720;
