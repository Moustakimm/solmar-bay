# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Moustakimm/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Moustakimm/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an original open-world crime game that runs in the browser. You play Jax, new in a sun-soaked coastal city, doing jobs for Rosa, a fixer who runs a garage in Downtown: steal cars, run missions across six districts, and stay ahead of the Solmar Bay police, on foot and behind the wheel. Built from scratch by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## The hook — Hurricane Vera

A Category 4 hurricane makes landfall on Solmar Bay at 02:00. The bridges close at midnight, the city evacuates at dawn, and Rosa's crew has one night to pull six jobs and get out before the storm takes the city. The HUD counts down to landfall, the rain starts at 22:00, and if the clock runs out before the last job, the run ends with the storm.

## What's in the game

- A 3200×2400 city in six districts — Hills, Old Town, Downtown, Marina, Docks and Beachfront — with a road grid, parks, a beach and the sea, graded in warm sunset light
- Driving and car theft: 26 traffic cars that keep moving, 16 parked cars to steal, and a gold Comet that outruns everything
- A 0–5 star wanted system: named police units (UNIT 7, UNIT 8…) that chase and ram — and drive around buildings, never through them — and foot officers who try to bust you
- Six story jobs for Rosa, from a first car theft to the King of Solmar, with a timed Courier Run; each job opens with Rosa's briefing in a dialogue box
- Combat on foot and from the car: punching, shooting, drive-by fire, and car damage — shoot a car enough and it becomes a smoking wreck
- A dense HUD: cash, health, ammo and weapon slots, a rank and job-progress bar, wanted stars, the clock, the storm countdown and the district, a mission card with job and stage numbers, named police units with distances, a big speed readout with car condition, a circular minimap and a district meter
- A start screen with the crew cards (Jax, Rosa, Miko), pause, busted and wasted screens, a win screen, a storm ending, and a save in localStorage
- Synthesized sound: an engine hum, a two-tone siren, shots, crashes and mission jingles — no audio files

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

- WASD / arrows — move on foot, drive in a car
- E — enter / leave a car
- Space — punch
- Click — shoot (aim with the mouse)
- Shift — run
- P / Esc — pause
- M — mute

## Run it (the entry program)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qtgjd4js&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
