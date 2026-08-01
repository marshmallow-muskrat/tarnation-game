import { useEffect, useRef, useState } from 'react';
import { GameRuntime, type HudSnapshot } from './game/GameRuntime';
import { Hud } from './ui/Hud';
import { SAVE_KEY } from './content';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [launchChoice, setLaunchChoice] = useState<null | 'continue' | 'new'>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSave = typeof window !== 'undefined' && localStorage.getItem(SAVE_KEY) !== null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !launchChoice) return;

    const runtime = new GameRuntime();
    runtimeRef.current = runtime;
    // Console handle for debugging: window.tarn.teleport(x, z), .state, .world
    (window as unknown as { tarn?: unknown }).tarn = runtime;
    let cancelled = false;

    runtime
      .mount(canvas, (snap) => {
        if (!cancelled) setHud(snap);
      }, { newAdventure: launchChoice === 'new' })
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
  }, [launchChoice]);

  const beginAdventure = (choice: 'continue' | 'new') => {
    if (choice === 'continue' && !hasSave) return;
    if (choice === 'new' && hasSave && !window.confirm('Start a new adventure? This will replace the current active save.')) return;
    setError(null);
    setLoading(true);
    setLaunchChoice(choice);
  };

  return (
    <div className="app-shell">
      <div className="game-mount">
        <canvas ref={canvasRef} />
      </div>
      {!launchChoice && (
        <div className="launch-overlay">
          <div className="panel launch-card">
            <p className="label">A fixed-camera farming adventure</p>
            <h1>Tarnation</h1>
            <p className="launch-copy">
              Grow a homestead, protect the harvest, and build a town one deliberate piece at a time.
            </p>
            <div className="launch-actions">
              <button type="button" onClick={() => beginAdventure('continue')} disabled={!hasSave}>
                Continue
              </button>
              <button type="button" className="primary" onClick={() => beginAdventure('new')}>
                New Adventure
              </button>
            </div>
            <p className="launch-note">
              {hasSave ? 'A saved adventure is available.' : 'No save yet — start a new adventure.'}
            </p>
          </div>
        </div>
      )}
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
        onVendorTab={(tab) => runtimeRef.current?.selectVendorTab(tab)}
        onVendorBuy={(id) => runtimeRef.current?.buyAsset(id)}
        onVendorClose={() => runtimeRef.current?.closeVendor()}
        onUseInventory={(id) => runtimeRef.current?.useInventoryItem(id)}
        onDeleteInventory={(id) => runtimeRef.current?.deleteInventoryItem(id)}
        onContextRotate={() => runtimeRef.current?.contextRotate()}
        onContextToggleGate={() => runtimeRef.current?.contextToggleGate()}
        onContextDestroy={() => runtimeRef.current?.contextDestroy()}
        onContextClose={() => runtimeRef.current?.closeContextMenu()}
      />
    </div>
  );
}
