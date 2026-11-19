// Solmar Bay — every tuning number, colour and place name in one place.
// The world is 3200 by 2400 units; the camera scales to the window, so no
// number here depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];
export const BEACH_Y = 2150; // south of this line: sand, then the sea
export const SEA_Y = 2300;

// Step outcomes, as bit flags, so the caller can react (sounds, toasts,
// screens) without the world knowing about them.
export const EVENT_CRASH = 1;
export const EVENT_SHOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WASTED = 8;
export const EVENT_BUSTED = 16;
export const EVENT_MISSION = 32;
export const EVENT_CRIME = 64;
export const EVENT_WIN = 128;
export const EVENT_STORM = 256;

// THE HOOK — Hurricane Vera: a Category 4 storm makes landfall on Solmar Bay
// at 02:00. The bridges close at midnight, the city evacuates at dawn, and
// Rosa's crew has one night to pull six jobs and get out before the storm
// takes the city. The game clock runs 14:00 to 02:00; rain starts at 22:00.
export const STORM = {
  name: 'Hurricane Vera',
  landfall: 26 * 60, // 02:00, in game-clock minutes past midnight
  rainAt: 22 * 60, // 22:00: the rain starts
  start: 14 * 60, // 14:00: the game opens
};

// Street rank: what the city calls Jax as the jobs get done.
export const RANKS = ['ROOKIE', 'WHEELMAN', 'HUSTLER', 'ENFORCER', 'KINGPIN', 'KING OF SOLMAR'];

// The crew, for the title screen cards and the mission dialogue.
export const CREW = [
  { name: 'Jax', role: 'Driver — that is you', color: '#ffcf3f', hair: '#3a2a1a' },
  { name: 'Rosa', role: 'Fixer — runs the jobs', color: '#c98bb0', hair: '#5a2a4a' },
  { name: 'Miko', role: 'Lookout — eyes on the cops', color: '#3dc9c9', hair: '#1a3a3a' },
];

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

// The gold Comet Rosa wants stolen: quicker than anything else on the road,
// so the Hot Wheels getaway actually feels like an escape.
export const COMET = { topSpeed: 680, accel: 520, hp: 3 };
export const COP_CAR_HP = 5;
export const CAR_HP = 3;

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
    brief: "Rosa: 'Vera hits at 02:00 and the bridges close at midnight. First, the crew needs wheels. Take any car and bring it to my garage.'",
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', x: 1500, y: 700, label: "Drive to Rosa's Garage", radius: 90 },
    ],
  },
  {
    id: 'courier', title: 'Courier Run', reward: 250,
    brief: "Rosa: 'Three parcels across town before the roads flood. 150 seconds, Jax. Do not dawdle.'",
    timer: 150, // the whole run, not just the last leg
    steps: [
      { type: 'goto', x: 700, y: 300, label: 'Parcel 1: Hills', radius: 80 },
      { type: 'goto', x: 2700, y: 1500, label: 'Parcel 2: Docks', radius: 80 },
      { type: 'goto', x: 300, y: 1900, label: 'Parcel 3: Marina', radius: 80 },
    ],
  },
  {
    id: 'debt', title: 'Debt Collection', reward: 300,
    brief: "Rosa: 'A dockworker owes me $300 and he is catching the last ferry out. On foot. Persuade him — three good hits.'",
    steps: [
      { type: 'goto', x: 2300, y: 1900, label: 'Find the debtor at the Docks', radius: 100 },
      { type: 'beat', label: 'Persuade the debtor (Space to punch, 3 hits)' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 400,
    brief: "Rosa: 'A gold Comet is parked at the Marina. The owner already evacuated. Take it — the cops are jumpy with the storm coming. Lose them, then bring it here.'",
    steps: [
      { type: 'steal-gold', x: 300, y: 1900, label: 'Steal the gold Comet at the Marina' },
      { type: 'lose', label: 'Lose the cops (get wanted to 0 stars)' },
      { type: 'goto', x: 1500, y: 700, label: "Deliver the Comet to Rosa's Garage", radius: 90 },
    ],
  },
  {
    id: 'dock-heist', title: 'Dock Heist', reward: 600,
    brief: "Rosa: 'A package at the Docks, harbour police all over it. Grab it and bring it to me — before the storm surge takes the pier.'",
    steps: [
      { type: 'goto', x: 2700, y: 1900, label: 'Grab the package at the Docks', radius: 80 },
      { type: 'goto', x: 1500, y: 700, label: "Deliver the package to Rosa's Garage", radius: 90, wanted: 3 },
    ],
  },
  {
    id: 'king', title: 'King of Solmar', reward: 1000,
    brief: "Rosa: 'Last job before Vera makes landfall. Four drops across the city, then the penthouse at the Marina. Do this and Solmar Bay is yours — storm or no storm.'",
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
  // Sunset grade: everything warm and saturated, the way the city looks in
  // the last golden hour before Hurricane Vera arrives.
  grass: '#93b04e',
  grassDark: '#7f9c40',
  sand: '#f0d294',
  sea: '#2a90a8',
  seaDeep: '#1f7a92',
  road: '#51464e',
  roadEdge: '#3e3540',
  lane: '#ffd94d',
  sidewalk: '#c8b598',
  building: ['#f09a5a', '#e0705a', '#f0c45a', '#7fc0a0', '#d07aa0', '#8aa8e0', '#e8a060'],
  roof: ['#c05a3a', '#8a6a3a', '#4a6a9a', '#5a8a4a', '#9a5a8a'],
  park: '#6a9c46',
  tree: '#4a8a3a',
  palm: '#3a9a52',
  player: '#ffcf3f',
  playerJacket: '#e84a4a',
  cop: '#2f4fb8',
  copCar: '#2f4fb8',
  hudPanel: 'rgba(16, 12, 24, 0.74)',
  text: '#fff3dc',
  muted: '#d8c8a8',
  star: '#ffd94d',
  marker: '#ffcf3f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save';
export const VIEW_W = 1280;
export const VIEW_H = 720;
