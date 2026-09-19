# VERTIGO

**Gun Wraith** — a gravity-tumble FPS prototype.

There is no fixed down. Walk the interior of a cube; 45° bevels slide you onto the next face. The camera stays first-person: the world point under the reticle is held through the tumble, then yaw/pitch are rebuilt in the new gravity.

## Play

```bash
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Click to capture the mouse.

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look |
| Space | Jump |
| Bevels | Gravity shift |

## Stack

Three.js inside a TanStack Start app. Core gravity / look math lives in `src/game/mount.ts` and `src/game/orient.ts`.
