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

- **You ride a fish.** Your equipped fish swims under you; better fish add more Speed per step (`+1/Speed` up to `+25K/Speed`).
- **Lobby (Atlantis plaza)**:
  - North: the Stage 1 gate "ESCAPE THE OCEAN" with the Top Speed and Top Wins boards.
  - West: the **FISH** shop. The front row is cheap fish (Clownfish, Pufferfish, Red Snapper, Lionfish); the raised back row is big fish (Swordfish up to Megalodon). Fish unlock with Wins.
  - Pass fish stand on their own pedestals: Piranha ("Cheap Fish", 9 Bux), Sea Serpent and Kraken.
  - East: eight auto-train treadmills (x25 and x9 are passes, x3 needs 5 Wins).
  - South: stage portals that skip ahead once you have enough Wins, and the golden Megalodon SPEED BOOST pad.
- **Course**, six stages:
  1. ESCAPE THE OCEAN: a water lane between lava, ice-crystal spikes and rolling sea mines.
  2. Crushing Rocks: stone slabs that slam down.
  3. Golden Maze: rows of gold walls, each with one gap.
  4. Coral Obby: coral platforms over lava.
  5. SHARK ATTACK: sharks swim across the lane. Touching one is a KO; the top of a jump clears them.
  6. MEGALODON!: a giant Megalodon chases you down the hall.
- Pink sneakers on the course give Speed. Return pads at the end of each stage give Wins (+1 / +3 / +8 / +20 / +50 / +100).
- Dying shows a **Revive** popup (Bux) or sends you back to the lobby.
- XP is earned 1:1 with Speed. Max swim speed is `12 + 2 × Level + 20 × Rebirths`, and the level cap is 25.
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
- Sea mines, sharks and crushing rocks run on the server clock, so all players see the same timing. Each player's Megalodon is local.
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
