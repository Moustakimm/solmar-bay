// The HUD: cash, health, ammo, wanted stars, the mission objective, the clock
// and the district name — plus the live minimap, a small canvas view of the
// whole city with the player, cars, police and the mission marker on it.
import { DISTRICTS, FONT, PALETTE, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { districtAt } from './world.js';
import { currentMission, currentStep, missionMarker } from './missions.js';
import { wantedStars } from './police.js';

const MAP_W = 220;
const MAP_H = 165;

function text(ctx, value, x, y, size, color, align) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(244, 241, 230, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function drawMinimap(ctx, state, viewW, viewH) {
  const x0 = viewW - MAP_W - 16;
  const y0 = viewH - MAP_H - 16;
  panel(ctx, x0, y0, MAP_W, MAP_H);
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_W, MAP_H);
  ctx.clip();
  ctx.fillStyle = '#5d8f43';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0, y0 + 2150 * sy, MAP_W, MAP_H - 2150 * sy);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0, y0 + 2300 * sy, MAP_W, MAP_H - 2300 * sy);
  ctx.fillStyle = '#4a4a52';
  for (const rx of ROADS_X) ctx.fillRect(x0 + rx * sx - 2, y0, 4, MAP_H);
  for (const ry of ROADS_Y) ctx.fillRect(x0, y0 + ry * sy - 2, MAP_W, 4);
  const marker = missionMarker(state.mission);
  if (marker) {
    const pulse = 5 + Math.sin(state.elapsed * 5) * 2;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.stroke();
  }
  for (const car of state.cars) {
    if (car.police) continue;
    ctx.fillStyle = car.gold ? '#ffd94d' : '#e8e8e8';
    ctx.fillRect(x0 + car.x * sx - 1.5, y0 + car.y * sy - 1.5, 3, 3);
  }
  for (const car of state.copCars) {
    ctx.fillStyle = '#5a7dff';
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(x0 + ped.x * sx - 1, y0 + ped.y * sy - 1, 2, 2);
  }
  const p = state.player;
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  text(ctx, districtAt(p.x, p.y), x0 + 8, y0 + 16, 13, PALETTE.muted, 'left');
}

/** Draw the HUD over a playing frame. `viewW`/`viewH` are the logical view size. */
export function drawHud(ctx, state, viewW, viewH) {
  const p = state.player;
  // Top-left: cash, health, ammo.
  panel(ctx, 12, 12, 250, 84);
  text(ctx, `$${state.cash}`, 24, 40, 26, PALETTE.text, 'left');
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 50, 180, 12);
  ctx.fillStyle = p.health > 30 ? '#7ae08a' : '#e84a4a';
  ctx.fillRect(24, 50, 180 * Math.max(0, p.health / 100), 12);
  text(ctx, `${Math.ceil(p.health)} HP`, 210, 61, 13, PALETTE.muted, 'left');
  text(ctx, p.inCar ? `DRIVING · AMMO ${p.ammo}` : `AMMO ${p.ammo}`, 24, 86, 14, PALETTE.muted, 'left');
  // Top-right: wanted stars.
  panel(ctx, viewW - 262, 12, 250, 84);
  text(ctx, 'WANTED', viewW - 250, 40, 15, PALETTE.muted, 'left');
  text(ctx, wantedStars(state.wanted), viewW - 250, 72, 30, PALETTE.star, 'left');
  if (p.bustMeter > 0) {
    ctx.fillStyle = '#e84a4a';
    ctx.fillRect(viewW - 250, 82, 226 * Math.min(1, p.bustMeter / 1.2), 6);
  }
  // Mission objective, top centre.
  const mission = currentMission(state.mission);
  if (mission) {
    const step = currentStep(state.mission);
    const label = step ? step.label : '';
    const w = 460;
    panel(ctx, (viewW - w) / 2, 12, w, 64);
    text(ctx, `${state.mission.index + 1}/${state.mission.list.length}  ${mission.title}`, viewW / 2, 36, 16, PALETTE.marker, 'center');
    text(ctx, label, viewW / 2, 60, 15, PALETTE.text, 'center');
    if (state.mission.timer > 0) {
      text(ctx, `${Math.ceil(state.mission.timer)}s`, viewW / 2 + w / 2 - 14, 60, 15, '#ff9a7a', 'right');
    }
  }
  // Clock.
  const hours = Math.floor(state.time / 60) % 24;
  const minutes = Math.floor(state.time % 60);
  text(ctx, `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}  ${districtAt(p.x, p.y)}`, viewW - 16, viewH - MAP_H - 32, 15, PALETTE.text, 'right');
  // Speed when driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
    text(ctx, `${kmh} km/h`, 24, viewH - 24, 26, PALETTE.text, 'left');
  }
  // Toast message.
  if (state.messageTimer > 0 && state.message) {
    const alpha = Math.min(1, state.messageTimer);
    ctx.globalAlpha = alpha;
    panel(ctx, (viewW - 560) / 2, viewH - 120, 560, 44);
    text(ctx, state.message, viewW / 2, viewH - 91, 16, PALETTE.text, 'center');
    ctx.globalAlpha = 1;
  }
  // Hurt flash.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = `rgba(232, 74, 74, ${p.hurtTimer * 0.35})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  drawMinimap(ctx, state, viewW, viewH);
  // Controls hint, bottom centre.
  text(ctx, 'WASD move/drive · E enter car · Space punch · Click shoot · Shift run · P pause · M mute', viewW / 2, viewH - 8, 13, 'rgba(244, 241, 230, 0.75)', 'center');
}
