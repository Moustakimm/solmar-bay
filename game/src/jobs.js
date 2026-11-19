// Missions and the story: Jax, new in Solmar Bay, works jobs for Rosa, a fixer
// who runs a garage in Downtown. Each mission is a list of steps — go somewhere,
// steal something, persuade someone, lose the cops — and pays cash on completion.
// The runner tracks the current mission and step, its marker, its timer, and
// what the HUD should say.

import { EVENT_MISSION, EVENT_WIN } from './config.js';

export function createJobRun(missions) {
  return {
    list: missions,
    index: 0,
    step: 0,
    timer: 0,
    done: false,
    debtorHits: 0,
    marker: null,
  };
}

export function currentJob(run) {
  if (run.index >= run.list.length) return null;
  return run.list[run.index];
}

export function currentStep(run) {
  const mission = currentJob(run);
  if (!mission) return null;
  return mission.steps[run.step] || null;
}

/** Where the HUD marker should point, if the current step has a place. */
export function jobMarker(run) {
  const step = currentStep(run);
  if (!step) return null;
  if (step.x !== undefined) return { x: step.x, y: step.y, label: step.label };
  return null;
}

function advance(state, run, helpers) {
  const mission = currentJob(run);
  run.step += 1;
  if (run.step >= mission.steps.length) {
    state.cash += mission.reward;
    helpers.burst(state.player.x, state.player.y, '#7ae08a', 16, 180);
    run.index += 1;
    run.step = 0;
    run.timer = 0;
    if (run.index >= run.list.length) {
      run.done = true;
      state.message = `Mission complete: ${mission.title} — +$${mission.reward}. King of Solmar! Every job done.`;
      state.messageTimer = 6;
      state.dialogue = { speaker: 'Rosa', text: "That's all six, Jax. The storm can come now — Solmar Bay is ours.", timer: 6 };
      return EVENT_MISSION | EVENT_WIN;
    }
    const next = currentJob(run);
    // The completion line used to be overwritten at once by the next brief;
    // say both, so the reward is actually seen.
    state.message = `Mission complete: ${mission.title} — +$${mission.reward}. New mission: ${next.title} — ${next.brief}`;
    state.messageTimer = 6;
    state.dialogue = { speaker: 'Rosa', text: next.brief, timer: 6 };
    if (next.timer) run.timer = next.timer;
    return EVENT_MISSION;
  }
  const step = currentStep(run);
  if (step && step.timer) run.timer = step.timer;
  if (step && step.wanted) {
    state.wanted = Math.max(state.wanted, step.wanted);
    state.crimeTimer = 0;
  }
  return EVENT_MISSION;
}

export function stepJobs(state, dt, helpers) {
  const run = state.mission;
  if (!run || run.done) return 0;
  const mission = currentJob(run);
  if (!mission) return 0;
  const step = currentStep(run);
  if (!step) return 0;
  let events = 0;
  // A mission-level timer (the Courier Run's 150 seconds) starts with the
  // mission, not with its last step, and re-arms on a retry.
  if (mission.timer && run.timer <= 0 && run.step === 0) run.timer = mission.timer;
  if (run.timer > 0) {
    run.timer -= dt;
    if (run.timer <= 0) {
      // Out of time: the job fails, but Rosa gives it again.
      run.step = 0;
      run.timer = 0;
      state.message = `Too slow — ${mission.title} failed. Rosa gives you another shot.`;
      state.messageTimer = 4;
      return events;
    }
  }
  const p = state.player;
  switch (step.type) {
    case 'steal':
      if (p.inCar) events |= advance(state, run, helpers);
      break;
    case 'steal-gold': {
      if (p.inCar && p.inCar.gold) {
        state.wanted = Math.max(state.wanted, 2);
        state.crimeTimer = 0;
        state.message = 'The gold Comet is hot — lose the cops!';
        state.messageTimer = 4;
        events |= advance(state, run, helpers);
      }
      break;
    }
    case 'goto': {
      const d = Math.hypot(p.x - step.x, p.y - step.y);
      if (d < step.radius) events |= advance(state, run, helpers);
      break;
    }
    case 'beat': {
      const debtor = state.debtor;
      if (debtor && debtor.hits >= 3) {
        events |= advance(state, run, helpers);
      }
      break;
    }
    case 'lose':
      if (state.wanted === 0) events |= advance(state, run, helpers);
      break;
    default:
      break;
  }
  return events;
}

/** Called by combat when the debtor is punched: counts toward the mission. */
export function noteDebtorHit(state) {
  if (state.debtor) state.debtor.hits = (state.debtor.hits || 0) + 1;
}

/** Open the mission dialogue: Rosa briefs the current job in her own words. */
export function sayJob(state) {
  const mission = currentJob(state.mission);
  if (mission) state.dialogue = { speaker: 'Rosa', text: mission.brief, timer: 6 };
}
