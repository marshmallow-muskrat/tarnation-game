import type { HudSnapshot } from '../game/GameRuntime';

type Props = {
  hud: HudSnapshot | null;
  onDismissWin: () => void;
};

const TIER = ['Lean-To', 'Shack', 'Cabin'];

export function Hud({ hud, onDismissWin }: Props) {
  if (!hud) return null;

  const phasePct = Math.round(hud.phaseT * 100);
  const fuelPct = Math.round(hud.lanternFuel * 100);
  const fuelLow = hud.lanternFuel < 0.33;

  return (
    <div className="hud">
      <div className="panel hud-top-left">
        <h1 className="panel-title">Tarnation</h1>
        <p className="label">Day</p>
        <p className="value teal">Day {hud.day}</p>
        <p className="label">{hud.phase === 'day' ? 'Daylight' : 'Night'}</p>
        <div className={`phase-bar ${hud.phase === 'night' ? 'night' : ''}`}>
          <i style={{ width: `${phasePct}%` }} />
        </div>
        <p className="label" style={{ marginTop: 8 }}>
          Homestead
        </p>
        <p className="value">{TIER[hud.homesteadTier] ?? 'Lean-To'}</p>
      </div>

      <div className="panel hud-bottom-left">
        <p className="label">Resources</p>
        <p className="value amber">
          Wood · {hud.wood}
          {hud.darkwood > 0 ? ` · Darkwood · ${hud.darkwood}` : ''}
        </p>
        <p className="value">
          Weapon · {hud.weapon} · Seed · {hud.seedName}
        </p>
        {hud.zone === 'woods' && (
          <>
            <p className="value">
              Bag · {hud.bagWood} / {hud.bagSize}
            </p>
            <p className="label">Lantern · {hud.woodsDepth}</p>
            <div className={`fuel-bar ${fuelLow ? 'low' : ''}`}>
              <i style={{ width: `${fuelPct}%` }} />
            </div>
            <p className="label">Attention</p>
            <div className="phase-bar night">
              <i style={{ width: `${Math.min(100, hud.attention)}%` }} />
            </div>
            {hud.stalkerActive && (
              <p className="value danger" style={{ marginTop: 8 }}>
                Q — drop bag (Woodsman faster when full)
              </p>
            )}
          </>
        )}
        {hud.zone === 'farm' && (
          <>
            <p className="label">Bucket · irrig t{hud.irrigationTier}</p>
            <p className={`value ${hud.bucketFull ? 'teal' : ''}`}>
              {hud.bucketFill}/{2}
              {hud.nearWater && !hud.bucketFull ? ' — E fill' : ''}
            </p>
            <p className="label">Inventory</p>
            <p className="value" style={{ fontSize: 12, color: 'var(--muted)' }}>
              {hud.inventorySummary}
            </p>
            <p className="label">Codex · {hud.codexCount} · Trophies · {hud.trophies.length}</p>
          </>
        )}
      </div>

      <div className="panel hud-bottom-center">
        <p className="hint">{hud.hint}</p>
      </div>

      <div className="panel hud-right">
        <p className="label">Log</p>
        <ul className="feed-list">
          {hud.feed.length === 0 && (
            <li>Till anywhere. Breed hybrids. Risk the woods.</li>
          )}
          {hud.feed.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
        {hud.trophies.length > 0 && (
          <>
            <p className="label" style={{ marginTop: 10 }}>
              Recent trophies
            </p>
            <ul className="feed-list">
              {hud.trophies.map((t, i) => (
                <li key={`${t}-${i}`}>{t}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {hud.win && (
        <div className="win-overlay">
          <div className="panel win-card">
            <h1>Draft Complete</h1>
            <p>Days survived · {hud.win.daysSurvived}</p>
            <p>Crops harvested · {hud.win.cropsHarvested}</p>
            <p>Wood gathered · {hud.win.woodGathered}</p>
            <p>Woodsman got you · {hud.win.stalkerCaught}</p>
            <button type="button" onClick={onDismissWin}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
