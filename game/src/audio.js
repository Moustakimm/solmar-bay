// Sound, synthesized live with WebAudio — no audio files, nothing fetched.
// Engine hum follows the car's speed, the siren wails while the heat is on,
// and shots, punches, crashes, pickups and mission jingles are short blips
// and noise bursts. Everything starts on the first user gesture; M mutes.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const osc = context.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol || 0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = context.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    /** Call on any user gesture so the browser lets audio start. */
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    /** Called every frame with the driving state: hum and siren follow it. */
    update(state) {
      if (!context || muted) return;
      const car = state.player.inCar;
      const speed = car ? Math.abs(car.speed) : 0;
      // The hum scales to the car being driven, so the gold Comet's faster
      // top speed sounds faster too instead of pegging at the sedan's cap.
      const top = car && car.topSpeed ? car.topSpeed : 560;
      if (engineGain) {
        engineGain.gain.value = car ? 0.05 + (speed / top) * 0.06 : 0;
        engineOsc.frequency.value = 55 + (speed / top) * 140;
      }
      if (sirenGain && sirenOsc) {
        sirenGain.gain.value = state.wanted > 0 ? 0.045 : 0;
        sirenOsc.frequency.value = 650 + Math.sin(state.elapsed * 2.4) * 180;
      }
    },
    shot() { noise(0.12, 0.35, 3000); },
    punch() { noise(0.08, 0.25, 500); },
    crash() { noise(0.25, 0.4, 800); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.12, 'sine', 0.2); },
    mission() { blip(523, 0.12, 'triangle', 0.25); setTimeout(() => blip(659, 0.12, 'triangle', 0.25), 110); setTimeout(() => blip(784, 0.2, 'triangle', 0.25), 220); },
    busted() { blip(220, 0.4, 'sawtooth', 0.25, 110); },
  };
}
