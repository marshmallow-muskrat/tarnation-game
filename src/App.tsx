import { useEffect, useRef, useState } from 'react';
import { GameRuntime, type HudSnapshot } from './game/GameRuntime';
import { Hud } from './ui/Hud';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const runtime = new GameRuntime();
    runtimeRef.current = runtime;
    // Console handle for debugging: window.tarn.teleport(x, z), .state, .world
    (window as unknown as { tarn?: unknown }).tarn = runtime;
    let cancelled = false;

    runtime
      .mount(canvas, (snap) => {
        if (!cancelled) setHud(snap);
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      runtime.dispose();
      runtimeRef.current = null;
      const handles = window as unknown as { tarn?: unknown };
      if (handles.tarn === runtime) delete handles.tarn;
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="game-mount">
        <canvas ref={canvasRef} />
      </div>
      {loading && <div className="loading">Tarnation</div>}
      {error && (
        <div className="loading" style={{ color: 'var(--red)' }}>
          {error}
        </div>
      )}
      <Hud
        hud={hud}
        onDismissWin={() => runtimeRef.current?.dismissWin()}
        onSelectSlot={(i) => runtimeRef.current?.selectSlot(i)}
        onSelectToolSlot={() => runtimeRef.current?.selectToolSlot()}
        onToggleBuild={() => runtimeRef.current?.toggleBuildMode()}
        onSelectBuild={(i) => runtimeRef.current?.selectBuild(i)}
        onToggleHelp={() => runtimeRef.current?.toggleHelp()}
        onUltimate={() => runtimeRef.current?.useUltimate()}
        onBearTrap={() => runtimeRef.current?.useBearTrap()}
        onToggleInventory={() => runtimeRef.current?.toggleInventory()}
        onSellOne={(id) => runtimeRef.current?.sellOne(id)}
        onSellStack={(id) => runtimeRef.current?.sellStack(id)}
        onSellAll={() => runtimeRef.current?.sellAll()}
      />
    </div>
  );
}
