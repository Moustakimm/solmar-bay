# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Moustakimm/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Moustakimm/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay: an original open-world crime game in the browser. Jax, new in a sun-soaked coastal city, works jobs for Rosa, a fixer with a garage in Downtown — steal cars, run missions across six districts, and stay ahead of the Solmar Bay police, on foot and behind the wheel. Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

- WASD / arrows — move on foot, drive in a car
- E — enter / leave a car
- Space — punch
- Click — shoot (aim with the mouse), including drive-by shooting from a car
- Shift — run
- P / Esc — pause
- M — mute

Cars take damage: shoot one enough and it is a smoking wreck, and a wrecked
police car stops chasing. The gold Comet is the fastest car in Solmar Bay.
Traffic keeps moving — cars that brake for the car ahead pull away again —
and the police drive around buildings instead of through them. The Docks
have container yards, the Marina has boats at anchor, and the beach has
umbrellas; hard turns leave tyre marks on the road.

## Run it (the entry program)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qtgjd4js&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
