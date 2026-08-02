import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { GameRuntime } from './game/GameRuntime';
import type { HudSnapshot } from './game/HudPresenter';
import { disposeAssetCache, resetFailedAssets, type AssetLoadProgress } from './game/Assets';
import { browserSaveStorage, SaveService, type SaveReadResult } from './game/SaveService';
import { Hud } from './ui/Hud';
import { disposeModelIconRenderer } from './ui/ModelIconRenderer';

const ASSET_GROUP_LABELS: Record<AssetLoadProgress['group'], string> = {
  boot: 'boot assets',
  first_play: 'first-play assets',
  nearby: 'nearby assets',
  catalog: 'catalog assets',
  optional: 'optional assets',
};

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
  const [assetProgress, setAssetProgress] = useState<AssetLoadProgress | null>(null);
  const [mountAttempt, setMountAttempt] = useState(0);
  const [retryChoice, setRetryChoice] = useState<null | 'continue' | 'new'>(null);
  const [saveRead, setSaveRead] = useState<SaveReadResult>(() => saveService.read());
  const hasSave = saveRead.status === 'ok' && saveRead.hasSave;

  useEffect(() => () => {
    disposeModelIconRenderer();
    disposeAssetCache();
  }, []);

  useEffect(() => {
    setSaveRead(saveService.read());
  }, [saveService]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !launchChoice) return;

    const runtime = new GameRuntime(saveService);
    runtimeRef.current = runtime;
    let cancelled = false;

    runtime
      .mount(canvas, (snap) => {
        if (!cancelled) setHud(snap);
      }, {
        newAdventure: launchChoice === 'new',
        onAssetProgress: (progress) => {
          if (!cancelled) setAssetProgress(progress);
        },
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start');
          setLoading(false);
          setRetryChoice(launchChoice);
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
  }, [launchChoice, mountAttempt]);

  const beginAdventure = (choice: 'continue' | 'new') => {
    if (choice === 'continue' && !hasSave) return;
    if (choice === 'new' && hasSave && !window.confirm('Start a new adventure? This will replace the current active save.')) return;
    setError(null);
    setAssetProgress(null);
    setRetryChoice(null);
    setLoading(true);
    setLaunchChoice(choice);
  };

  const retryMount = () => {
    const choice = retryChoice;
    if (!choice) return;
    resetFailedAssets();
    setError(null);
    setAssetProgress(null);
    setRetryChoice(null);
    setLoading(true);
    setLaunchChoice(choice);
  };

  const retryActiveAssets = () => {
    if (!launchChoice) return;
    resetFailedAssets();
    setAssetProgress(null);
    setLoading(true);
    setMountAttempt((attempt) => attempt + 1);
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
        <canvas ref={canvasRef} tabIndex={0} aria-label="Tarnation game canvas" />
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
      {loading && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-card">
            <p className="loading-title">Tarnation</p>
            <p className="loading-label">
              {assetProgress
                ? `Loading ${ASSET_GROUP_LABELS[assetProgress.group]} · ${assetProgress.loaded}/${assetProgress.total}`
                : 'Preparing the homestead…'}
            </p>
            {assetProgress && (
              <progress
                className="loading-progress"
                value={assetProgress.loaded}
                max={Math.max(assetProgress.total, 1)}
                aria-label={`Loading ${ASSET_GROUP_LABELS[assetProgress.group]}`}
              />
            )}
            {assetProgress && assetProgress.fallbackKeys.length > 0 && (
              <>
                <p className="loading-error" role="alert">
                  {assetProgress.fallbackKeys.length} model{assetProgress.fallbackKeys.length === 1 ? '' : 's'} using primitive fallback.
                </p>
                <button type="button" className="loading-retry" onClick={retryActiveAssets}>
                  Retry failed assets
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {error && (
        <div className="loading" role="alert">
          <div className="loading-card loading-card-error">
            <p className="loading-title">Unable to start</p>
            <p className="loading-error">{error}</p>
            {retryChoice && (
              <button type="button" className="loading-retry" onClick={retryMount}>
                Retry
              </button>
            )}
          </div>
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
        onRebindInput={(action, code) => runtimeRef.current?.rebindInput(action, code)}
        onResetInputBindings={() => runtimeRef.current?.resetInputBindings()}
        onToggleCodex={() => runtimeRef.current?.toggleCodex()}
        onSelectCodex={(key) => runtimeRef.current?.selectCodexEntry(key)}
        onToggleCodexCompare={(key) => runtimeRef.current?.toggleCodexCompare(key)}
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
