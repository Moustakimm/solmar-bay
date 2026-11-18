// Keyboard and mouse input: held keys, edge-triggered actions, and the mouse
// position in screen pixels (main.js turns it into a world aim point).
// Keys: WASD/arrows move or drive, E enter/exit a car, Space punch,
// mouse click shoot, Shift run, P/Esc pause, M mute, Enter confirm.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let mutedToggle = false;

  function keyOf(event) {
    const k = event.key.toLowerCase();
    return k === ' ' ? 'space' : k;
  }

  window.addEventListener('keydown', (event) => {
    const k = keyOf(event);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(k)) event.preventDefault();
    if (!event.repeat) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    mouse,
    /** -1/0/1 drive or walk axis from keys held now. */
    axis() {
      const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      return { x, y };
    },
    run() { return keys.has('shift'); },
    /** Edge-triggered actions since the last call; also consumes the mouse click. */
    takeActions() {
      let actions = 0;
      if (pressed.has('enter')) actions |= ACTION_CONFIRM;
      if (pressed.has('p') || pressed.has('escape')) actions |= ACTION_PAUSE;
      if (pressed.has('e')) actions |= ACTION_ENTER_CAR;
      if (pressed.has('space')) actions |= ACTION_PUNCH;
      if (pressed.has('m')) mutedToggle = !mutedToggle;
      pressed.clear();
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions, clicked };
    },
    mutedToggled() {
      const value = mutedToggle;
      mutedToggle = false;
      return value;
    },
  };
}
