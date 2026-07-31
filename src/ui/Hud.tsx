import type { HudSnapshot } from '../game/GameRuntime';
import type { ItemId } from '../sim/items';

type Props = {
  hud: HudSnapshot | null;
  onDismissWin: () => void;
  onSelectSlot: (index: number) => void;
  onSelectToolSlot: () => void;
  onSellOne: (id: ItemId) => void;
  onSellStack: (id: ItemId) => void;
  onSellAll: () => void;
};

const TIER = ['Lean-To', 'Market Stall', 'Cabin'];

export function Hud({
  hud,
  onDismissWin,
  onSelectSlot,
  onSelectToolSlot,
  onSellOne,
  onSellStack,
  onSellAll,
}: Props) {
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
        <p className="label">Ducketts</p>
        <p className="value amber">₫ {hud.ducketts}</p>
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
              {hud.toolSlot.fill}/{hud.toolSlot.capacity}
              {hud.nearWater && !hud.bucketFull ? ' — E fill' : ''}
            </p>
            <p className="label">Codex · {hud.codexCount}</p>
          </>
        )}
      </div>

      <div className="panel hud-inventory">
        <p className="label">
          Inventory · {hud.inventory.filter((s) => s.id).length}/{hud.inventory.length}
        </p>
        <div className="inv-grid">
          {hud.inventory.map((slot, i) => (
            <div
              key={`slot-${i}`}
              className={`inv-slot ${slot.id ? 'filled' : ''}`}
              title={slot.id ? `${slot.name} ×${slot.count} · ${slot.price}₫ each` : 'Empty'}
            >
              {slot.id && (
                <>
                  <span className="inv-glyph">{slot.glyph}</span>
                  <span className="inv-count">{slot.count}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {hud.market.open && (
        <div className="panel hud-market">
          <p className="label">Market stall</p>
          {hud.market.items.length === 0 ? (
            <p className="hint">Nothing to sell. Bring crops, wood or trophies.</p>
          ) : (
            <>
              <ul className="market-list">
                {hud.market.items.map((item) => (
                  <li key={item.id}>
                    <span className="market-name">
                      {item.glyph} {item.name} ×{item.count}
                    </span>
                    <span className="market-price">{item.price}₫</span>
                    <button type="button" onClick={() => onSellOne(item.id)}>
                      Sell 1
                    </button>
                    <button type="button" onClick={() => onSellStack(item.id)}>
                      All
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="market-all" onClick={onSellAll}>
                Sell everything · {hud.market.total}₫
              </button>
            </>
          )}
        </div>
      )}

      <div className="hud-bottom-center">
        <p className="hint">{hud.hint}</p>
        <div className="toolbar">
          {hud.toolbar.map((slot) => (
            <button
              type="button"
              key={`tool-${slot.index}`}
              className={`tool-slot ${slot.selected ? 'selected' : ''} ${
                slot.empty ? 'empty' : ''
              }`}
              onClick={() => onSelectSlot(slot.index)}
              title={slot.empty ? 'Empty' : slot.name}
            >
              <span className="tool-key">{slot.index + 1}</span>
              <span className="tool-glyph">{slot.glyph}</span>
              <span className="tool-name">{slot.empty ? '' : slot.name}</span>
            </button>
          ))}
          <span className="toolbar-divider" />
          <button
            type="button"
            className={`tool-slot water ${hud.toolSlot.selected ? 'selected' : ''}`}
            onClick={onSelectToolSlot}
            title={`${hud.toolSlot.name} · ${hud.toolSlot.fill}/${hud.toolSlot.capacity} water`}
          >
            <span className="tool-key">6</span>
            <span className="tool-glyph">{hud.toolSlot.glyph}</span>
            <span className="tool-name">
              {hud.toolSlot.fill}/{hud.toolSlot.capacity}
            </span>
          </button>
        </div>
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
