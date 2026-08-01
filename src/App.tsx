import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { GameRuntime, type HudSnapshot } from './game/GameRuntime';
import { browserSaveStorage, SaveService, type SaveReadResult } from './game/SaveService';
import { Hud } from './ui/Hud';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const saveServiceRef = useRef<SaveService | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  if (saveServiceRef.current === null) saveServiceRef.current = new SaveService(browserSaveStorage());
  const saveService = saveServiceRef.current;
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [launchChoice, setLaunchChoice] = useState<null | 'continue' | 'new'>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveRead, setSaveRead] = useState<SaveReadResult>(() => saveService.read());
  const hasSave = saveRead.status === 'ok' && saveRead.hasSave;

  useEffect(() => {
    setSaveRead(saveService.read());
  }, [saveService]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !launchChoice) return;

    const runtime = new GameRuntime(saveService);
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
          setLaunchChoice(null);
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

  const recoverSave = () => {
    const result = saveService.recover();
    setSaveRead(result);
    setError(result.status === 'ok' ? null : result.message ?? 'Save recovery failed.');
  };

  const exportSave = () => {
    const result = saveService.exportJson();
    if (result.status !== 'ok' || !result.json) {
      setError(result.message ?? 'No validated save is available to export.');
      return;
    }
    const url = URL.createObjectURL(new Blob([result.json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tarnation-save.json';
    link.click();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const importSave = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const result = saveService.importJson(await file.text());
    if (result.status !== 'ok') {
      setError(result.message ?? 'The selected save could not be imported.');
      return;
    }
    setSaveRead(saveService.read());
    setError(null);
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
            <div className="launch-actions launch-save-actions">
              {saveRead.status === 'ok' && saveRead.recovered && (
                <button type="button" onClick={recoverSave}>
                  Recover Save
                </button>
              )}
              <button type="button" onClick={exportSave} disabled={!hasSave}>
                Export JSON
              </button>
              <button type="button" onClick={() => importInputRef.current?.click()}>
                Import JSON
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Import save JSON"
                hidden
                onChange={(event) => void importSave(event)}
              />
            </div>
            <p className="launch-note">
              {saveRead.status !== 'ok'
                ? saveRead.message ?? 'Save storage is unavailable.'
                : hasSave
                  ? saveRead.recovered
                    ? 'A backup save is available; recover it before continuing.'
                    : 'A saved adventure is available.'
                  : 'No save yet — start a new adventure.'}
            </p>
            {error && <p className="launch-error">{error}</p>}
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
        onResume={() => runtimeRef.current?.resumeGame()}
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
