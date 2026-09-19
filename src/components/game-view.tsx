import { useEffect, useRef, useState } from "react";
import type { HudState } from "@/game/types";
import type { MountHandle } from "@/game/mount";

const IDLE: HudState = { face: "−Y  FLOOR", hold: "IDLE", playing: false, captured: false };

export function GameView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<MountHandle | null>(null);
  const [hud, setHud] = useState<HudState>(IDLE);
  const lookDrag = useRef(false);
  const stickId = useRef<number | null>(null);
  const playingRef = useRef(false);
  playingRef.current = hud.playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mounted = import("@/game/mount").then(({ mountGunWraith }) => {
      const inst = mountGunWraith(canvas, setHud);
      handle.current = inst;
      return inst;
    });
    return () => {
      mounted.then((inst) => inst.dispose());
      handle.current = null;
    };
  }, []);

  function beginPlay() {
    handle.current?.start();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (stickId.current === e.pointerId) return;
    if (document.pointerLockElement) return;
    if (lookDrag.current) handle.current?.setLookDelta(e.movementX, e.movementY);
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    if (!playingRef.current) {
      beginPlay();
      return;
    }
    if (document.pointerLockElement) return;
    handle.current?.requestLock();
    lookDrag.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (stickId.current === e.pointerId) {
      stickId.current = null;
      handle.current?.setMoveStick(0, 0);
    }
    lookDrag.current = false;
  }

  function stickMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (e.clientX - cx) / (rect.width * 0.42);
    let y = (e.clientY - cy) / (rect.height * 0.42);
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    handle.current?.setMoveStick(x, y);
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-dvh w-full overflow-hidden bg-bg touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      <div className="pointer-events-none absolute inset-0 font-mono text-fg">
        <div className="absolute left-5 top-5 z-10 sm:left-6 sm:top-6">
          <p className="font-display text-[11px] font-semibold tracking-[0.32em] text-accent">
            GUN <span className="text-hazard">WRAITH</span>
            <span className="ml-3 tracking-[0.22em] text-muted">GRAVITY 01</span>
          </p>
        </div>
        <div className="absolute right-5 top-5 text-right text-[11px] tracking-[0.14em] text-muted sm:right-6 sm:top-6">
          <p className="tabular-nums text-fg">{hud.face}</p>
          <p className="mt-1 text-accent">{hud.hold}</p>
          <p className="mt-1">{hud.playing ? (hud.captured ? "LOOK LOCKED" : "DRAG LOOK") : ""}</p>
        </div>
        <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border border-accent/80" />
        <p className="absolute bottom-6 left-5 max-w-sm text-[11px] leading-relaxed tracking-wide text-muted sm:bottom-7 sm:left-6">
          Walk onto a 45° bevel. It slides you onto the next face.
          {hud.playing && !hud.captured ? " Click to recapture the mouse." : ""}
        </p>
      </div>

      {hud.playing ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5 sm:hidden">
          <div
            data-ui
            className="pointer-events-auto relative size-28 rounded-full border border-border bg-surface/80"
            onPointerDown={(e) => {
              e.stopPropagation();
              stickId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              stickMove(e);
            }}
            onPointerMove={(e) => {
              if (stickId.current === e.pointerId) stickMove(e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              stickId.current = null;
              handle.current?.setMoveStick(0, 0);
            }}
          />
          <button
            data-ui
            type="button"
            className="pointer-events-auto size-16 rounded-full border border-accent bg-elevated font-mono text-[10px] tracking-[0.2em] text-accent"
            onPointerDown={(e) => {
              e.stopPropagation();
              handle.current?.setJump(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              handle.current?.setJump(false);
            }}
          >
            JUMP
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-ui
          onClick={beginPlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70"
        >
          <span className="border border-accent px-7 py-3.5 font-mono text-xs tracking-[0.28em] text-accent transition-transform duration-[var(--motion-quick,150ms)] hover:scale-[0.98]">
            ENTER THE CUBE
          </span>
        </button>
      )}
    </div>
  );
}