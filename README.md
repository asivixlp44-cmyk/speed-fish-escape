# Speed Fish Escape

A multiplayer "speed escape" game for the browser, built with **Three.js** and **Colyseus** for Bloxity. You ride a fish, train Speed on treadmills and escape the ocean through six stages. It clones the Roblox game *+1 Fish Speed Escape* (see `reference/Gameplay.mp4`).

It shares its engine with Speed Football Scape: the same server, Bloxity integration, HUD and effects, with an ocean theme and fish in place of football.

## Project layout

| Folder | What it is |
|---|---|
| `client/` | Vite + Three.js game client (`src/main.js`, `world.js`, `fish.js`, `engine.js`, `ui.js`) |
| `server/` | Colyseus 0.18 server: the `speed` room, player profiles, leaderboards |
| `shared/` | Game data and formulas used by both sides (`config.js`) |

## Run it locally

Needs Node 20 or newer.

```sh
npm install          # installs client and server too
npm run build        # builds the client into client/dist
npm start            # server + game on http://localhost:2567
```

For development, run `npm run dev:server` and `npm run dev:client` in two terminals, then open the Vite URL (http://localhost:5173). In dev the client connects to the server on port 2567; set `VITE_SERVER_URL` to point it somewhere else.

## Gameplay

- **You ride a fish.** Your equipped fish swims under you; better fish add more Speed per step (`+1/Speed` up to `+5K/Speed`).
- **Lobby**, built from `reference/lobby.mp4`: an open Atlantis plaza under a night-blue sky, ringed by stepped stone terraces with yellow trim and gold towers with pink domes.
  - Middle: a blue studded pool with coral, crystals and kelp, and the sand spawn pad with a black sun emblem.
  - Ahead: the Stage 1 "ESCAPE THE OCEAN" tunnel, with +10K / +100K / +1M Speed pads beside it.
  - Left: the **FISH** shop. The low front row has Clownfish, Pufferfish, Red Snapper, Lionfish, Piranha ("Cheap Fish", 9 Bux) and OP Serpent (Bux). Stairs lead up to the raised back row: Blue Marlin, Orca, Whale Shark, Great White, Leviathan, Abyss King and Blood Jaws. Walk onto a fish's yellow pad to unlock or ride it.
  - Right: **AUTO-TRAIN** treadmills (X25 and X9 are passes, X3, four x1), the "Keep playing" hut (a free x2 Speed Boost after 15 minutes), the Group Chest (free Speed and Wins once a day), the +150/Speed Sea Turtle (free after 20 minutes), +500 / +5K Wins pads, and the Most Speed / Most Wins stone boards.
- **Course**, six stages. Stages 1-4 follow `reference/game satges.mp4`; 5 and 6 are our own in the same style. Each stage starts behind a big "Stage N" wall:
  1. ESCAPE THE OCEAN: narrow water slabs stepping up and down over a lava pit, with jumps between some of them and ice spikes on others. Lava columns and hanging rocks.
  2. An open bridge over a lava sea between Atlantis terraces. Grey cracked stone walls hang over the red strips and slam down every few seconds; standing under one is a KO.
  3. A maze of tall gold walls on a water floor, with dead ends and ice spike traps, under a dark ceiling with lights.
  4. A brick hall with sea grass and crystals; sharks keep crossing just ahead of each player. Touching one is a KO.
  5. Coral Obby: coral platforms over lava.
  6. MEGALODON!: a giant Megalodon chases you down the hall at 90% of your walk speed; stop and it catches you, sprint to pull away.
- Pink sneakers on the course give +1 Speed. Each stage ends on a landing with a "+N Wins / Return!" pad (+1 / +3 / +8 / +20 / +50 / +100) and a "x2 Wins!" pad.
- Dying shows a **Revive** popup: revive where you fell (Bux) with a few seconds of shield, or No! / wait 10 s to go back to the lobby.
- XP is earned 1:1 with Speed. Max swim speed is `12 + 2 × Level + 20 × Rebirths`, and the level cap is 25.
- Soundtrack: an original, code-generated 80 BPM chill lo-fi ocean track (electric piano, kalimba, soft swung drums, waves, bubbles and a distant whale). No audio files.
- **Daily** login streak: one claim per UTC day for seven escalating rewards; missing a day resets the streak.
- Rebirth, Auras, FREE playtime rewards, Store, Friends and Avatar work as in Speed Football Scape.

## Controls

| Action | Keyboard / mouse | Controller |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Camera | Drag, wheel to zoom | Right stick, D-pad up/down to zoom |
| Jump | Space | A |
| Sprint | Hold Shift | Hold RT, LT or L3 |
| Interact (ride fish, buy) | E | X |

Phones get an on-screen joystick.

## How multiplayer works

- Everyone joins one shared `speed` room (up to 24 players), which covers the lobby and all six stages.
- **Client-side:** movement and physics. Other players are drawn with interpolation, riding their own fish.
- **Server-side:** everything that changes progress: Speed from swimming (including treadmills and the fish bonus), pickups, Wins pads, fish unlocks, auras, rebirths, FREE and Daily rewards, and purchases.
- Sharks and the falling stone walls run on the server clock, so all players see the same timing. Each player's Megalodon is local.
- Progress is saved per browser (a random id in localStorage) or per Bloxity account, in `server/data/profiles.json`. Set `DATA_DIR` to change the folder.

## Bloxity

- `GAME_SLUG` in `client/src/bloxity.js` is a placeholder (`speed-fish-escape`); set it to the real slug from bloxity.io.
- Every price is in **Bux**. Store items map to SKUs (`SKUS` in `shared/config.js`); create them in the game's IAP catalog. Without a catalog the game runs in demo mode, where purchases are free.
- Set `LEGION_WEBHOOK_SECRET` on the server to switch to Bux mode; `POST /api/legion-webhook` then grants purchases.
- The top-left of the screen is left empty for the Bloxity overlay, and there is no start menu.

## Deploy

The server also serves the built client, so one Node host runs the whole game (Render, Railway, Colyseus Cloud or any VPS):

- Build command: `npm install && npm run build`
- Start command: `npm start` (it listens on `PORT`)

WebSockets must be allowed. On hosts with a temporary disk, point `DATA_DIR` at a persistent volume, or player progress resets on redeploy.
