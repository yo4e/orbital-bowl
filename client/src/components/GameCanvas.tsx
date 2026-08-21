/* ORBITAL BOWL / Orbital Reverie: canvas is a quiet observation window; HUD is sparse constellation hardware. */
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameHudState } from "@/game/types";

const initialHud: GameHudState = {
  angle: 0, velocity: 4.76, gravity: 1, phase: "aim", throwNumber: 1, pinsStanding: 10, pinsFelledThisThrow: 0,
  score: 0, bestScore: 0, soundEnabled: true, status: "観測窓を開いています", launchReady: false,
};

function Meter({ label, value, min, max, step, unit, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; disabled: boolean; onChange: (value: number) => void;
}) {
  return (
    <label className="meter">
      <span><b>{label}</b><output>{value.toFixed(step < 1 ? 2 : 0)}{unit}</output></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const [hud, setHud] = useState(initialHud);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let disposed = false;
    void createGameScene(engine, canvas, { onHudChange: (next) => { if (!disposed) setHud(next); } }).then((handle) => {
      if (disposed) { handle.dispose(); return; }
      handleRef.current = handle;
      engine.runRenderLoop(() => handle.scene.render());
    });
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  const locked = !hud.launchReady;
  const firstOrbit = hud.phase === "aim" && hud.throwNumber === 1 && hud.score === 0;
  const resultVisible = hud.phase === "result" || hud.phase === "complete";
  return (
    <main className="game-shell" aria-label="ORBITAL BOWL game">
      <canvas ref={canvasRef} className="game-canvas" style={{ touchAction: "none" }} aria-label="宇宙ボウリングの3Dゲーム画面" />
      <div className="grain" aria-hidden="true" />
      <header className="brand-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <div><p>GRAVITY BOWLING / 01</p><h1>ORBITAL BOWL</h1></div>
        </div>
        <div className="key-hints"><span><kbd>R</kbd> RESET</span><span><kbd>M</kbd> {hud.soundEnabled ? "SOUND ON" : "SOUND OFF"}</span><span><kbd>F</kbd> FULLSCREEN</span></div>
      </header>

      <section className="score-dial" aria-label="ゲーム状況">
        <div><span>THROW</span><strong>{hud.throwNumber}<i>/3</i></strong></div>
        <div><span>PINS</span><strong>{String(hud.pinsStanding).padStart(2, "0")}</strong></div>
        <div><span>BEST</span><strong>{String(hud.bestScore).padStart(3, "0")}</strong></div>
      </section>

      <section className="instrument" aria-label="投球設定">
        <div className="instrument-head"><span>ORBITAL SETTINGS</span><em>{hud.phase === "aim" ? "AIM" : hud.phase.toUpperCase()}</em></div>
        <Meter label="ANGLE" value={hud.angle} min={-28} max={28} step={1} unit="°" disabled={locked} onChange={(angle) => handleRef.current?.setSettings({ angle })} />
        <Meter label="VELOCITY" value={hud.velocity} min={4.35} max={6.8} step={0.01} unit="" disabled={locked} onChange={(velocity) => handleRef.current?.setSettings({ velocity })} />
        <Meter label="GRAVITY" value={hud.gravity} min={0.72} max={1.35} step={0.01} unit="G" disabled={locked} onChange={(gravity) => handleRef.current?.setSettings({ gravity })} />
        <button className="launch-button" onClick={() => handleRef.current?.launch()} disabled={!hud.launchReady}><span>SPACE</span>{hud.phase === "complete" ? "ROUND COMPLETE" : "LAUNCH"}</button>
        <button className="reset-button" onClick={() => handleRef.current?.resetRound()}>もう一度、軌道を描く</button>
      </section>

      {firstOrbit && <section className="tutorial-beacon" aria-label="最初の投球ガイド">
        <p>FIRST ORBIT / RECOMMENDED</p>
        <h2>予測線の先で、<em>ピンが待つ。</em></h2>
        <span>まずは標準軌道のまま <kbd>SPACE</kbd>。<br />微調整は DRAG と SCROLL から。</span>
        <button onClick={() => handleRef.current?.setSettings({ angle: 0, velocity: 4.76, gravity: 1 })}>標準軌道に戻す</button>
      </section>}

      {resultVisible && <section className={`throw-result ${hud.pinsFelledThisThrow > 0 ? "has-hit" : "no-hit"}`} aria-live="polite">
        <p>THROW {hud.throwNumber} / RESULT</p>
        <strong>{hud.pinsFelledThisThrow}<i> PINS</i></strong>
        <span>{hud.pinsFelledThisThrow > 0 ? "光の場所を覚えて、次の一投へ。" : "VELOCITY を少し上げて、軌道を外へ。"}</span>
      </section>}

      <div className="status-line" role="status"><span className={hud.phase === "flight" ? "pulse-dot" : "static-dot"} />{hud.status}</div>
      <aside className="gesture-tip"><span>DRAG</span> angle <b>·</b> <span>SCROLL</span> velocity</aside>
      <div className="portrait-warning"><span className="brand-mark" aria-hidden="true"><i /></span><p>画面を横にして、
        <br />軌道を描いてください。</p></div>
    </main>
  );
}
