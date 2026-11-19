// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the player and scales to the window; the HUD (cash, health,
// wanted stars, mission, minimap) is drawn in screen space on top. Flat
// shapes and canvas text, no images — the whole city is drawn, not loaded.

import { BEACH_Y, CAR, CREW, DISTRICTS, FONT, PALETTE, RANKS, ROADS_X, ROADS_Y, ROAD_W, SEA_Y, STORM, VIEW_H, VIEW_W, WORLD } from './config.js';
import { districtAt } from './streets.js';
import { currentJob, currentStep, jobMarker } from './jobs.js';
import { wantedStars } from './cops.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';
export const SCREEN_STORM = 'storm';

const MINIMAP = { radius: 100, cx: VIEW_W - 118, cy: VIEW_H - 118 };

export function createPainter(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0, zoom: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = 'rgba(244, 241, 230, 0.25)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawGround(state) {
    // Grass, with a checker of two greens so the ground reads at a glance.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.grassDark;
    const tile = 200;
    for (let y = 0; y < WORLD.height; y += tile) {
      for (let x = 0; x < WORLD.width; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) context.fillRect(x, y, tile, tile);
      }
    }
    // Sand, then the sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, SEA_Y - BEACH_Y);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, SEA_Y, WORLD.width, WORLD.height - SEA_Y);
    context.fillStyle = PALETTE.seaDeep;
    for (let y = SEA_Y + 24; y < WORLD.height; y += 48) {
      context.fillRect(0, y, WORLD.width, 6);
    }
    // Parks.
    for (const park of state.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
  }

  function drawRoads() {
    for (const rx of ROADS_X) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_W / 2 - 10, 0, ROAD_W + 20, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    }
    for (const ry of ROADS_Y) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - ROAD_W / 2 - 10, WORLD.width, ROAD_W + 20);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    }
    // Lane dashes down the middle of every road.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 64) context.fillRect(rx - 3, y, 6, 32);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 64) context.fillRect(x, ry - 3, 32, 6);
    }
  }

  function drawBuildings(state) {
    for (const b of state.buildings) {
      // A soft shadow, then the body, then the roof inset.
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      if (b.tall) {
        context.fillStyle = 'rgba(255, 255, 255, 0.18)';
        context.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      }
    }
  }

  function drawTrees(state) {
    for (const t of state.trees) {
      context.fillStyle = t.palm ? PALETTE.palm : PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.15)';
      context.beginPath();
      context.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPickups(state) {
    for (const pick of state.pickups) {
      if (pick.taken) continue;
      const colors = { health: '#e84a4a', ammo: '#e8c33a', cash: '#7ae08a' };
      const labels = { health: '+', ammo: 'A', cash: '$' };
      context.fillStyle = colors[pick.kind];
      context.beginPath();
      context.arc(pick.x, pick.y, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      text(labels[pick.kind], pick.x, pick.y + 6, 16, '#11141b', 'center');
    }
  }

  function drawCar(car, dusk) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    // Shadow and body.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(-halfL + 3, -halfW + 4, CAR.length, CAR.width);
    context.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-halfL, -halfW, CAR.length, CAR.width, 7);
    context.fill();
    // Windshield and roof.
    context.fillStyle = 'rgba(20, 30, 50, 0.85)';
    context.fillRect(halfL - 18, -halfW + 4, 10, CAR.width - 8);
    context.fillStyle = car.wrecked ? '#555' : 'rgba(255, 255, 255, 0.25)';
    context.fillRect(-8, -halfW + 4, 16, CAR.width - 8);
    // Wheels.
    context.fillStyle = '#1a1a1a';
    context.fillRect(-halfL + 4, -halfW - 3, 12, 6);
    context.fillRect(-halfL + 4, halfW - 3, 12, 6);
    context.fillRect(halfL - 16, -halfW - 3, 12, 6);
    context.fillRect(halfL - 16, halfW - 3, 12, 6);
    // Headlights after dusk, and the police light bar.
    if (dusk) {
      context.fillStyle = '#ffe9a8';
      context.fillRect(halfL - 2, -halfW + 3, 4, 6);
      context.fillRect(halfL - 2, halfW - 9, 4, 6);
    }
    if (car.police) {
      const flash = Math.floor(car.siren * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      context.fillRect(-4, -halfW + 2, 8, 8);
      context.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      context.fillRect(-4, halfW - 10, 8, 8);
    }
    if (car.gold) {
      context.fillStyle = '#fff3b0';
      context.fillRect(-halfL + 6, -halfW + 6, 6, 6);
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, radius, dead) {
    context.save();
    context.translate(x, y);
    if (dead) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(0, 0, radius + 2, radius - 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    // Shadow, body, head.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath();
    context.arc(2, 3, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c9a0';
    context.beginPath();
    context.arc(4, 0, radius * 0.55, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(state, zoom) {
    drawGround(state);
    drawRoads();
    drawBuildings(state);
    drawTrees(state);
    // Skid marks fade with their life.
    for (const s of state.skids) {
      context.save();
      context.globalAlpha = Math.max(0, s.life / s.maxLife) * 0.5;
      context.translate(s.x, s.y);
      context.rotate(s.angle);
      context.fillStyle = '#1a1a1a';
      context.fillRect(-14, -4, 28, 3);
      context.fillRect(-14, 1, 28, 3);
      context.restore();
    }
    drawPickups(state);
    for (const car of state.cars) drawCar(car, state.dusk);
    for (const car of state.copCars) drawCar(car, state.dusk);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, 12, ped.dead);
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, cop.shirt, 13, cop.dead);
    // The player: yellow jacket, red shirt, drawn last so he is never hidden.
    const p = state.player;
    if (!p.inCar) {
      if (!(p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0)) {
        drawPerson(p.x, p.y, p.angle, PALETTE.playerJacket, 14, false);
        context.fillStyle = PALETTE.player;
        context.beginPath();
        context.arc(p.x, p.y, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Particles and bullet tracers.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const t of state.tracers) {
      context.globalAlpha = Math.max(0, t.life / t.maxLife);
      context.strokeStyle = '#ffe9a8';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(t.x1, t.y1);
      context.lineTo(t.x2, t.y2);
      context.stroke();
    }
    context.globalAlpha = 1;
    // Mission marker: a pulsing diamond over the objective, and a line from the player.
    const marker = jobMarker(state.mission);
    if (marker) {
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 4);
      context.save();
      context.translate(marker.x, marker.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.marker;
      context.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
      context.restore();
      context.strokeStyle = 'rgba(255, 207, 63, 0.5)';
      context.lineWidth = 2;
      context.setLineDash([8, 8]);
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(marker.x, marker.y);
      context.stroke();
      context.setLineDash([]);
    }
    // Dusk: the city goes amber, then dark; when the rain starts, storm purple.
    if (state.time >= STORM.rainAt) {
      context.fillStyle = 'rgba(30, 16, 60, 0.34)';
      context.fillRect(0, 0, WORLD.width, WORLD.height);
    } else if (state.dusk) {
      context.fillStyle = 'rgba(60, 20, 70, 0.22)';
      context.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  /** A circular minimap: the city in a round dial, like a car dashboard. */
  function drawMinimap(state) {
    const { radius, cx, cy } = MINIMAP;
    const scale = (radius * 2) / WORLD.width;
    const mx = cx - radius;
    const my = cy - radius;
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    context.fillStyle = PALETTE.hudPanel;
    context.fill();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#2a3a24';
    context.fillRect(mx, my, radius * 2, radius * 2);
    context.fillStyle = '#51464e';
    for (const rx of ROADS_X) context.fillRect(mx + rx * scale - 2, my, 4, radius * 2);
    for (const ry of ROADS_Y) context.fillRect(mx, my + ry * scale - 2, radius * 2, 4);
    context.fillStyle = '#2a90a8';
    context.fillRect(mx, my + SEA_Y * scale, radius * 2, radius * 2 - SEA_Y * scale);
    const marker = jobMarker(state.mission);
    if (marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + marker.x * scale, my + marker.y * scale, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.copCars) {
      context.fillStyle = '#5a7dff';
      context.beginPath();
      context.arc(mx + car.x * scale, my + car.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.save();
    context.translate(mx + p.x * scale, my + p.y * scale);
    context.rotate(p.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    // The dial ring and the north tick.
    context.strokeStyle = 'rgba(255, 243, 220, 0.6)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.text;
    text('N', cx, cy - radius + 14, 12, PALETTE.text, 'center');
  }

  /** A small portrait: a coloured backdrop, hair, and a face. */
  function drawPortrait(x, y, r, member) {
    context.save();
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = member.color;
    context.fillRect(x - r, y - r, r * 2, r * 2);
    // Hair.
    context.fillStyle = member.hair;
    context.beginPath();
    context.arc(x, y - r * 0.25, r * 0.72, Math.PI, 0);
    context.fill();
    // Face.
    context.fillStyle = '#e8c9a0';
    context.beginPath();
    context.arc(x, y + r * 0.1, r * 0.52, 0, Math.PI * 2);
    context.fill();
    // Eyes.
    context.fillStyle = '#1a1a1a';
    context.beginPath();
    context.arc(x - r * 0.2, y, r * 0.07, 0, Math.PI * 2);
    context.arc(x + r * 0.2, y, r * 0.07, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.strokeStyle = 'rgba(255, 243, 220, 0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
  }

  function drawDialogue(state) {
    const d = state.dialogue;
    if (!d || d.timer <= 0) return;
    const member = CREW.find((c) => c.name === d.speaker) || CREW[0];
    const w = 600;
    const h = 76;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - 200;
    panel(x, y, w, h);
    drawPortrait(x + 40, y + h / 2, 26, member);
    text(d.speaker.toUpperCase(), x + 76, y + 28, 15, PALETTE.star);
    const lines = wrapText(d.text, 62);
    lines.slice(0, 2).forEach((line, i) => text(line, x + 76, y + 52 + i * 20, 16, PALETTE.text));
  }

  function drawDistrictMeter(state) {
    const current = districtAt(state.player.x, state.player.y);
    const w = 400;
    const h = 36;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - 52;
    panel(x, y, w, h);
    const cell = w / DISTRICTS.length;
    DISTRICTS.forEach((d, i) => {
      const cx = x + cell * i + cell / 2;
      const active = d.name === current;
      const label = d.name === 'Beachfront' ? 'BEACH' : d.name.toUpperCase();
      text(label, cx, y + 23, active ? 12 : 10, active ? PALETTE.star : PALETTE.muted, 'center');
      if (active) {
        context.fillStyle = PALETTE.star;
        context.fillRect(x + cell * i + 6, y + h - 5, cell - 12, 3);
      }
    });
  }

  function drawPolicePanel(state) {
    if (state.wanted === 0) return;
    const units = state.copCars.slice(0, 3);
    const h = 30 + units.length * 22 + (state.cops.length > 0 ? 22 : 0);
    panel(16, 146, 230, h);
    text('POLICE ON YOU', 30, 170, 14, '#ff9a8a');
    units.forEach((car, i) => {
      const dist = Math.round(Math.hypot(car.x - state.player.x, car.y - state.player.y));
      text(`${car.unit || 'UNIT ?'} · ${dist}m`, 30, 192 + i * 22, 15, PALETTE.text);
    });
    if (state.cops.length > 0) {
      text(`${state.cops.length} officer${state.cops.length > 1 ? 's' : ''} on foot`, 30, 192 + units.length * 22, 15, PALETTE.muted);
    }
  }

  function drawRankBar(state) {
    const done = state.mission.done ? 6 : state.mission.index;
    const rank = RANKS[Math.min(state.mission.index, RANKS.length - 1)];
    panel(VIEW_W / 2 - 180, 16, 360, 52);
    text(`RANK: ${rank}`, VIEW_W / 2 - 166, 38, 15, PALETTE.star);
    text(`JOB ${Math.min(done + 1, 6)}/6`, VIEW_W / 2 + 166, 38, 15, PALETTE.text, 'right');
    context.fillStyle = '#3a3a42';
    context.fillRect(VIEW_W / 2 - 166, 48, 332, 8);
    context.fillStyle = PALETTE.star;
    context.fillRect(VIEW_W / 2 - 166, 48, 332 * (done / 6), 8);
  }

  function drawHud(state, best) {
    const p = state.player;
    // Top-left: cash, health, ammo, weapon slots.
    panel(16, 16, 230, 118);
    text(`$${state.cash}`, 30, 46, 26, PALETTE.text);
    context.fillStyle = '#3a3a42';
    context.fillRect(30, 58, 140, 12);
    context.fillStyle = p.health > 30 ? '#7ae08a' : '#e84a4a';
    context.fillRect(30, 58, 140 * Math.max(0, p.health / 100), 12);
    text('HEALTH', 178, 70, 12, PALETTE.muted);
    // Weapon slots: fists always, pistol while it has bullets.
    const slotY = 82;
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    context.fillRect(30, slotY, 96, 26);
    context.strokeStyle = 'rgba(244, 241, 230, 0.35)';
    context.strokeRect(30.5, slotY + 0.5, 96, 26);
    text('FIST', 78, slotY + 18, 13, PALETTE.text, 'center');
    context.fillStyle = p.ammo > 0 ? 'rgba(255, 207, 63, 0.25)' : 'rgba(255, 255, 255, 0.08)';
    context.fillRect(136, slotY, 80, 26);
    context.strokeStyle = 'rgba(244, 241, 230, 0.35)';
    context.strokeRect(136.5, slotY + 0.5, 80, 26);
    text(`PISTOL ${p.ammo}`, 176, slotY + 18, 13, PALETTE.text, 'center');
    // Top-centre: rank and job progress.
    drawRankBar(state);
    // Top-right: wanted stars, clock, storm countdown, district.
    const stars = wantedStars(state.wanted);
    panel(VIEW_W - 250, 16, 234, 118);
    text(stars, VIEW_W - 30, 46, 26, PALETTE.star, 'right');
    const hours = Math.floor(state.time / 60) % 24;
    const minutes = Math.floor(state.time % 60);
    text(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, VIEW_W - 30, 74, 18, PALETTE.text, 'right');
    const remain = Math.max(0, STORM.landfall - state.time);
    const rh = Math.floor(remain / 60);
    const rm = Math.floor(remain % 60);
    const stormColor = remain <= 60 ? '#ff6a4a' : remain <= 180 ? '#ff9a3d' : PALETTE.muted;
    text(`VERA ${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`, VIEW_W - 30, 98, 16, stormColor, 'right');
    text(districtAt(p.x, p.y), VIEW_W - 30, 120, 14, PALETTE.muted, 'right');
    // Named police units and their distances, while the heat is on.
    drawPolicePanel(state);
    // Bottom-left: the mission card — job number, stage, step, timer, reward.
    const mission = currentJob(state.mission);
    if (mission) {
      const step = currentStep(state.mission);
      const totalSteps = mission.steps.length;
      const stage = state.mission.step + 1;
      panel(16, VIEW_H - 118, 410, 102);
      text(`JOB ${state.mission.index + 1}/6 — ${mission.title.toUpperCase()}`, 30, VIEW_H - 88, 19, PALETTE.text);
      text(`STAGE ${stage}/${totalSteps}`, 410, VIEW_H - 88, 15, PALETTE.star, 'right');
      if (step) text(step.label, 30, VIEW_H - 62, 16, PALETTE.muted);
      if (state.mission.timer > 0) {
        text(`${Math.ceil(state.mission.timer)}s`, 410, VIEW_H - 62, 18, '#ff9a3d', 'right');
      }
      text(`Reward $${mission.reward}`, 30, VIEW_H - 38, 14, PALETTE.star);
    }
    // Big speed readout and car condition, while driving.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.12);
      text(String(mph), VIEW_W - 30, VIEW_H - 250, 48, PALETTE.text, 'right');
      text('mph', VIEW_W - 30, VIEW_H - 224, 16, PALETTE.muted, 'right');
      const hp = Math.max(0, p.inCar.hp);
      const maxHp = p.inCar.gold ? 3 : 3;
      panel(VIEW_W - 460, VIEW_H - 262, 200, 26);
      text('CAR', VIEW_W - 448, VIEW_H - 244, 13, PALETTE.muted);
      context.fillStyle = '#3a3a42';
      context.fillRect(VIEW_W - 398, VIEW_H - 254, 120, 10);
      context.fillStyle = hp > 1 ? '#7ae08a' : '#e84a4a';
      context.fillRect(VIEW_W - 398, VIEW_H - 254, 120 * (hp / maxHp), 10);
      text(`${hp}/${maxHp}`, VIEW_W - 270, VIEW_H - 244, 13, PALETTE.text, 'right');
    }
    // The district meter, the dialogue box, and the circular minimap.
    drawDistrictMeter(state);
    drawDialogue(state);
    // Bust meter.
    if (p.bustMeter > 0) {
      panel(VIEW_W / 2 - 110, 130, 220, 30);
      context.fillStyle = '#e84a4a';
      context.fillRect(VIEW_W / 2 - 100, 140, 200 * Math.min(1, p.bustMeter / 1.2), 10);
      text('BUSTED?', VIEW_W / 2, 126, 14, PALETTE.text, 'center');
    }
    // The message toast.
    if (state.messageTimer > 0 && state.message) {
      const lines = wrapText(state.message, 90);
      const h = lines.length * 24 + 20;
      panel(VIEW_W / 2 - 320, 84, 640, h);
      lines.forEach((line, i) => text(line, VIEW_W / 2, 112 + i * 24, 17, PALETTE.text, 'center'));
    }
    drawMinimap(state);
  }

  function wrapText(message, width) {
    const words = message.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > width && line) {
        lines.push(line.trim());
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawOverlay(title, lines, prompt) {
    context.fillStyle = 'rgba(8, 10, 18, 0.62)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 680;
    const h = 130 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    panel(x, y, w, h);
    text(title, VIEW_W / 2, y + 62, 44, PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 108 + i * 30, 19, PALETTE.muted, 'center'));
    text(prompt, VIEW_W / 2, y + h - 26, 20, PALETTE.star, 'center');
  }

  /** The sunset grade: a warm glow from the low sun, over the whole frame. */
  function drawSunsetGrade() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    const w = canvas.width;
    const h = canvas.height;
    const glow = context.createRadialGradient(w * 0.15, h * 0.08, 0, w * 0.15, h * 0.08, w * 0.7);
    glow.addColorStop(0, 'rgba(255, 160, 70, 0.16)');
    glow.addColorStop(1, 'rgba(255, 160, 70, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, w, h);
    context.fillStyle = 'rgba(255, 120, 40, 0.05)';
    context.fillRect(0, 0, w, h);
  }

  /** Rain, once the storm front arrives: diagonal streaks across the frame. */
  function drawRain(state) {
    if (state.time < STORM.rainAt) return;
    context.strokeStyle = 'rgba(200, 220, 255, 0.35)';
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i < 70; i += 1) {
      const seed = i * 7919;
      const x = ((seed * 13 + state.elapsed * 500) % (VIEW_W + 40)) - 20;
      const y = ((seed * 7 + state.elapsed * 900) % (VIEW_H + 40)) - 20;
      context.moveTo(x, y);
      context.lineTo(x - 6, y + 18);
    }
    context.stroke();
  }

  /** The title screen: the hook, the controls, and the crew cards. */
  function drawTitle(state, best) {
    drawHud(state, best);
    drawOverlay('SOLMAR BAY', [
      'Hurricane Vera makes landfall at 02:00. Six jobs, one night,',
      'and a city that will not wait. Steal cars, run missions,',
      'and stay ahead of the Solmar Bay police, on foot and behind the wheel.',
      'WASD drive and walk · E enter a car · Space punch · Click shoot',
      `Best cash so far: $${best}`,
    ], 'Press Enter or click to play');
    const cardW = 200;
    const cardH = 110;
    const gap = 24;
    const total = CREW.length * cardW + (CREW.length - 1) * gap;
    const x0 = (VIEW_W - total) / 2;
    const y0 = VIEW_H - 190;
    CREW.forEach((member, i) => {
      const x = x0 + i * (cardW + gap);
      panel(x, y0, cardW, cardH);
      drawPortrait(x + cardW / 2, y0 + 30, 20, member);
      text(member.name.toUpperCase(), x + cardW / 2, y0 + 70, 16, PALETTE.text, 'center');
      text(member.role, x + cardW / 2, y0 + 92, 12, PALETTE.muted, 'center');
    });
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, zoom) {
    const z = zoom || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    // Camera: follow the player, or the whole city for the wide shot — and
    // never show the void outside the world: clamp to the city edges.
    let camX;
    let camY;
    if (z < 1) {
      camX = WORLD.width / 2;
      camY = WORLD.height / 2;
    } else {
      camX = p.x;
      camY = p.y;
    }
    const halfW = VIEW_W / 2 / z;
    const halfH = VIEW_H / 2 / z;
    camX = Math.max(halfW, Math.min(WORLD.width - halfW, camX));
    camY = Math.max(halfH, Math.min(WORLD.height - halfH, camY));
    if (state.shake > 0) {
      camX += (Math.random() - 0.5) * state.shake;
      camY += (Math.random() - 0.5) * state.shake;
    }
    view.camX = camX;
    view.camY = camY;
    view.zoom = z;
    const scale = view.scale * z;
    context.setTransform(scale, 0, 0, scale, view.x + VIEW_W * view.scale / 2 - camX * scale, view.y + VIEW_H * view.scale / 2 - camY * scale);
    drawWorld(state, z);
    // Sunset grade over the world, then back to screen space for rain and HUD.
    drawSunsetGrade();
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawRain(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawOverlay('Paused', ['The city will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawOverlay('BUSTED', ['The Solmar Bay police caught you.', 'You lost your cash.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_WASTED) {
      drawOverlay('WASTED', ['The hospital patched you up.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_WIN) {
      drawOverlay('KING OF SOLMAR', ['Every job done. The city is yours.', `Final cash: $${state.cash}`], 'Press Enter to keep playing');
    } else if (screen === SCREEN_STORM) {
      drawOverlay('HURRICANE VERA', ['The storm made landfall and took the city.', 'The jobs are still out there — if you are faster.'], 'Press Enter to try again');
    }
  }

  /** Turn a screen point (in canvas pixels) into world coordinates. */
  function screenToWorld(sx, sy, zoom) {
    const z = zoom || 1;
    const scale = view.scale * z;
    const ox = view.x + VIEW_W * view.scale / 2 - view.camX * scale;
    const oy = view.y + VIEW_H * view.scale / 2 - view.camY * scale;
    return { x: (sx - ox) / scale, y: (sy - oy) / scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
