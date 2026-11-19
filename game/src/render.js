// Drawing only: the world state and the current screen in, pixels out. A camera
// follows the player across the city; the view is the 1280x720 logical area
// scaled to the window. Buildings cast soft shadows, the sea shimmers, cars
// and people are drawn top-down, and the menus are panels over the world.
import { BEACH_Y, FONT, PALETTE, SEA_Y, VIEW_H, VIEW_W, WORLD } from './config.js';
import { drawHud } from './hud.js';
import { currentMission, missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

function text(ctx, value, x, y, size, color, align) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function drawCarBody(ctx, car) {
  const { x, y, angle, color, kind, gold } = car;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-26, -12, 52, 26);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-24, -15, 10, 6);
  ctx.fillRect(-24, 9, 10, 6);
  ctx.fillRect(14, -15, 10, 6);
  ctx.fillRect(14, 9, 10, 6);
  // A wreck is a charred shell: dark body, no shine, a dented-looking roof.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : color;
  ctx.beginPath();
  ctx.roundRect(-27, -13, 54, 26, 7);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? 'rgba(0, 0, 0, 0.7)' : 'rgba(20, 30, 50, 0.85)';
  ctx.beginPath();
  ctx.roundRect(2, -10, 14, 20, 4);
  ctx.fill();
  if (!car.wrecked) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(24, -9, 3, 6);
    ctx.fillRect(24, 3, 3, 6);
  }
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-27, -8, 3, 5);
  ctx.fillRect(-27, 3, 3, 5);
  if (kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -13, 16, 26);
    ctx.fillStyle = '#2f4fb8';
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (gold) {
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-27, -13, 54, 26, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, radius, isPlayer, isCop) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, radius, radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? '#ffcf3f' : '#e8c9a8';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(radius * 0.4, -3, 8, 6);
  }
  if (isCop) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = `bold 8px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 3);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, zoom: 1 };
  let camX = 1500;
  let camY = 760;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function drawWorld(state, zoom, snap) {
    const p = state.player;
    // The camera leads the car a little at speed, so a chase reads as fast —
    // but never in a staged shot, where the scene is composed around the car.
    const lead = p.inCar && !snap ? Math.min(90, Math.abs(p.inCar.speed) * 0.18) : 0;
    const targetX = p.x + Math.cos(p.angle) * lead;
    const targetY = p.y + Math.sin(p.angle) * lead;
    if (snap) {
      camX = targetX;
      camY = targetY;
    }
    camX += (targetX - camX) * 0.12;
    camY += (targetY - camY) * 0.12;
    const vw = VIEW_W / zoom;
    const vh = VIEW_H / zoom;
    const ox = Math.max(0, Math.min(WORLD.width - vw, camX - vw / 2));
    const oy = Math.max(0, Math.min(WORLD.height - vh, camY - vh / 2));
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-ox + shakeX, -oy + shakeY);
    // Ground: grass, then beach sand, then the sea.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, SEA_Y, WORLD.width, WORLD.height - SEA_Y);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      ctx.fillRect(x + ((state.elapsed * 20 + x) % 90), SEA_Y + 18, 46, 3);
    }
    // Boats at anchor off the Marina and out in the bay.
    for (const boat of state.boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(2, 3, boat.len / 2, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.ellipse(0, 0, boat.len / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = boat.sail;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, -26);
      ctx.lineTo(12, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(-1, -26, 2, 26);
      ctx.restore();
    }
    // Parks.
    for (const park of state.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Roads: asphalt, edge lines, centre dashes.
    ctx.fillStyle = PALETTE.road;
    for (const rx of [300, 700, 1100, 1500, 1900, 2300, 2700]) ctx.fillRect(rx - 48, 0, 96, WORLD.height);
    for (const ry of [300, 700, 1100, 1500, 1900]) ctx.fillRect(0, ry - 48, WORLD.width, 96);
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of [300, 700, 1100, 1500, 1900, 2300, 2700]) {
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, WORLD.height);
      ctx.stroke();
    }
    for (const ry of [300, 700, 1100, 1500, 1900]) {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(WORLD.width, ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of [300, 700, 1100, 1500, 1900, 2300, 2700]) {
      ctx.fillRect(rx - 60, 0, 12, WORLD.height);
      ctx.fillRect(rx + 48, 0, 12, WORLD.height);
    }
    for (const ry of [300, 700, 1100, 1500, 1900]) {
      ctx.fillRect(0, ry - 60, WORLD.width, 12);
      ctx.fillRect(0, ry + 48, WORLD.width, 12);
    }
    // Tyre marks, fading where hard turns left them.
    for (const skid of state.skids) {
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.globalAlpha = 0.35 * (skid.life / skid.maxLife);
      ctx.fillStyle = '#22222a';
      ctx.fillRect(-14, -4, 28, 8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Buildings with soft shadows and roof lines.
    for (const b of state.buildings) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 6.5, b.y + 6.5, b.w - 13, b.h - 13);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 4, 8, 8);
      }
    }
    // Trees and palms.
    for (const t of state.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? PALETTE.palm : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beach umbrellas on the sand.
    for (const u of state.umbrellas) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(u.x + 3, u.y + 4, u.r, u.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.arc(u.x, u.y, u.r, -Math.PI / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.arc(u.x, u.y, u.r, Math.PI / 2, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    // Dock containers, stacked where the yard stacked them.
    for (const c of state.containers) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(c.x + 5, c.y + 6, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(c.x + (c.w / 4) * i, c.y + 3);
        ctx.lineTo(c.x + (c.w / 4) * i, c.y + c.h - 3);
        ctx.stroke();
      }
      if (c.stacked) {
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(c.x + 6, c.y - 16, c.w - 12, 16);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(c.x + 7, c.y - 15, c.w - 14, 14);
      }
    }
    // Mission marker: a pulsing beacon and a ring on the ground.
    const marker = missionMarker(state.mission);
    if (marker) {
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.15;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 44 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 207, 63, 0.18)';
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 70);
      ctx.lineTo(marker.x - 10, marker.y - 44);
      ctx.lineTo(marker.x + 10, marker.y - 44);
      ctx.closePath();
      ctx.fill();
    }
    // Pickups.
    for (const pick of state.pickups) {
      if (pick.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + pick.x) * 3;
      ctx.fillStyle = pick.kind === 'health' ? '#ff5a5a' : pick.kind === 'ammo' ? '#ffd94d' : '#7ae08a';
      ctx.beginPath();
      ctx.arc(pick.x, pick.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(pick.kind === 'health' ? '+' : pick.kind === 'ammo' ? 'A' : '$', pick.x, pick.y + bob + 5);
    }
    // Pedestrians (the dead lie down).
    for (const ped of state.peds) {
      if (ped.dead) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(1.2);
        ctx.fillStyle = ped.shirt;
        ctx.fillRect(-14, -6, 28, 12);
        ctx.restore();
        continue;
      }
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, 12, false, false);
    }
    // Cars: traffic, parked, police, the player's.
    for (const car of state.cars) {
      if (car === p.inCar) continue;
      drawCarBody(ctx, car);
    }
    for (const car of state.copCars) {
      drawCarBody(ctx, car);
      // Flashing light bar — dark on a disabled car.
      if (!car.disabled) {
        const on = Math.floor(car.siren * 3) % 2 === 0;
        ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
        ctx.beginPath();
        ctx.arc(car.x, car.y - 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Foot cops.
    for (const cop of state.cops) {
      if (cop.dead) continue;
      drawPerson(ctx, cop.x, cop.y, cop.angle, cop.shirt, 13, false, true);
    }
    // The player.
    if (!p.dead) {
      if (p.inCar) {
        drawCarBody(ctx, p.inCar);
      } else if (p.invulnerable === 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
        drawPerson(ctx, p.x, p.y, p.angle, PALETTE.playerJacket, 14, true, false);
      }
    }
    // Particles.
    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.maxLife);
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    ctx.globalAlpha = 1;
    // Gunshot tracers: a bright line from the muzzle, gone in a blink.
    for (const t of state.tracers) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Dusk tint after 18:00.
    if (state.dusk) {
      ctx.fillStyle = 'rgba(40, 30, 90, 0.18)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    return { ox, oy, zoom };
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const lineH = 30;
    const h = 150 + lines.length * lineH + 70;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || 'rgba(244, 241, 230, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    text(ctx, title, VIEW_W / 2, y + 66, 44, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(ctx, lines[i], VIEW_W / 2, y + 120 + i * lineH, 19, PALETTE.muted, 'center');
    }
    text(ctx, prompt, VIEW_W / 2, y + h - 34, 20, PALETTE.marker, 'center');
  }

  const TITLE_LINES = [
    'Jax just arrived in Solmar Bay with $50 and a borrowed jacket.',
    'Rosa, a fixer with a garage in Downtown, has work for him.',
    'Steal cars. Run jobs. Stay ahead of the police.',
    '',
    'WASD move / drive · E enter or leave a car · Space punch',
    'Click shoot (aim with the mouse) · Shift run · P pause · M mute',
  ];

  function draw(state, screen, best, zoom, snap) {
    const z = zoom || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const cam = drawWorld(state, z, snap);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10, 12, 24, 0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text(ctx, 'SOLMAR BAY', VIEW_W / 2, 108, 64, '#ffd94d', 'center');
      text(ctx, 'an open-world crime story', VIEW_W / 2, 140, 20, PALETTE.text, 'center');
      drawPanel('Welcome to Solmar Bay', TITLE_LINES, best > 0 ? `Best cash: $${best} — Press Enter or click to play` : 'Press Enter or click to play');
      return { cam };
    }
    drawHud(ctx, state, VIEW_W, VIEW_H);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', `Cash $${state.cash} · Mission ${state.mission.index + 1} of ${state.mission.list.length}`], 'Press P to resume · Enter to restart the mission');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar Bay police caught up with you.', `You lost $${Math.min(100, state.cash)} and the heat is off — for now.`], 'Press Enter to walk free');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Jax went down in the streets of Solmar Bay.', 'The hospital patched him up. The city is still waiting.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_WIN) {
      const mission = currentMission(state.mission);
      drawPanel('KING OF SOLMAR', ['Every job done. Rosa smiles: the city is yours now.', `Final cash: $${state.cash} — thanks for playing Solmar Bay.`], 'Press Enter to keep roaming free');
    }
    return { cam };
  }

  function screenToWorld(sx, sy, zoom) {
    const z = zoom || 1;
    const vw = VIEW_W / z;
    const vh = VIEW_H / z;
    const ox = Math.max(0, Math.min(WORLD.width - vw, camX - vw / 2));
    const oy = Math.max(0, Math.min(WORLD.height - vh, camY - vh / 2));
    const lx = (sx - view.x) / view.scale;
    const ly = (sy - view.y) / view.scale;
    return { x: ox + lx / z, y: oy + ly / z };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld, get view() { return view; } };
}
