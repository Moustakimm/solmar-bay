// Sound, all synthesized with WebAudio — no audio files, no network.
// An engine hum that follows the car's speed, a siren while the heat is on,
// and short blips for shots, crashes, pickups and missions.

export function createSound() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      // The engine: a low sawtooth whose pitch follows the car's speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      // The siren: a sine that swings between two notes.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(context.destination);
      sirenOsc.start();
    } catch {
      context = null;
    }
    return context;
  }

  /** Start audio after a user gesture (browsers block sound before one). */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol || 0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    shot() { blip(220, 0.12, 'square', 0.14, 60); },
    crash() { blip(90, 0.25, 'sawtooth', 0.18, 40); },
    pickup() { blip(660, 0.1, 'sine', 0.14); setTimeout(() => blip(880, 0.12, 'sine', 0.14), 70); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sine', 0.14), i * 90));
    },
    busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.12), i * 120)); },
    setMuted(value) { muted = value; },
    isMuted() { return muted; },
    /** Called every frame: engine pitch and the siren follow the world. */
    update(state) {
      if (!context) return;
      const car = state.player.inCar;
      if (engineGain) {
        const target = car && !muted ? 0.05 + Math.abs(car.speed) / 560 * 0.05 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
        if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + Math.abs(car ? car.speed : 0) * 0.12, context.currentTime, 0.1);
      }
      if (sirenGain && sirenOsc) {
        const wanted = state.wanted > 0 && !muted;
        sirenGain.gain.setTargetAtTime(wanted ? 0.03 : 0, context.currentTime, 0.2);
        if (wanted) {
          sirenTimer += 1 / 60;
          if (sirenTimer > 0.45) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, context.currentTime, 0.05);
          }
        }
      }
    },
  };
}
