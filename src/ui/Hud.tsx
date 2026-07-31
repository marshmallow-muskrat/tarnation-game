import { useState } from 'react';
import type { HudSlot, HudSnapshot } from '../game/GameRuntime';
import type { ItemId } from '../sim/items';

type Props = {
  hud: HudSnapshot | null;
  onDismissWin: () => void;
  onSelectSlot: (index: number) => void;
  onSelectToolSlot: () => void;
  onUltimate: () => void;
  onToggleInventory: () => void;
  onSellOne: (id: ItemId) => void;
  onSellStack: (id: ItemId) => void;
  onSellAll: () => void;
};

type Tip = { slot: HudSlot; x: number; y: number } | null;

export function Hud({
  hud,
  onDismissWin,
  onSelectSlot,
  onSelectToolSlot,
  onUltimate,
  onToggleInventory,
  onSellOne,
  onSellStack,
  onSellAll,
}: Props) {
  const [tip, setTip] = useState<Tip>(null);

  if (!hud) return null;

  const phasePct = Math.round(hud.phaseT * 100);
  const filled = hud.inventory.filter((s) => s.id).length;

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
          Duckettes
        </p>
        <p className="value amber">₫ {hud.duckettes}</p>
      </div>

      {/* Compass to the market stall */}
      <div className="market-compass">
        <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
          <g style={{ transform: `rotate(${hud.marketAngle}rad)`, transformOrigin: '20px 20px' }}>
            <path d="M20 4 L30 26 L20 20 L10 26 Z" className="compass-arrow" />
          </g>
        </svg>
        <span className="compass-label">Market · {hud.marketDistance}m</span>
      </div>

      {/* Floating gather popups */}
      {hud.popups.map((p) => (
        <span
          key={p.id}
          className="gather-popup"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            opacity: Math.min(1, p.life * 1.6),
            transform: `translate(-50%, ${-(1 - p.life) * 34}px)`,
          }}
        >
          {p.text}
        </span>
      ))}

      <button
        type="button"
        className={`inv-toggle ${hud.inventoryOpen ? 'open' : ''}`}
        onClick={onToggleInventory}
        title="Toggle inventory (I)"
      >
        🎒 <span className="inv-toggle-key">I</span>
      </button>

      {hud.inventoryOpen && (
        <div className="panel hud-inventory">
          <p className="label">
            Inventory · {filled}/{hud.inventory.length}
          </p>
          <div className="inv-grid">
            {hud.inventory.map((slot, i) => (
              <div
                key={`slot-${i}`}
                className={`inv-slot ${slot.id ? 'filled' : ''}`}
                onMouseEnter={(e) =>
                  slot.id &&
                  setTip({ slot, x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top })
                }
                onMouseLeave={() => setTip(null)}
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
      )}

      {tip && (
        <div
          className="item-tooltip"
          style={{ right: 'auto', left: Math.max(8, tip.x - 210), top: Math.max(8, tip.y - 8) }}
        >
          <p className="tooltip-name">
            {tip.slot.glyph} {tip.slot.name}
          </p>
          <p className="tooltip-meta">
            ×{tip.slot.count} · {tip.slot.price}₫ each · {tip.slot.price * tip.slot.count}₫ total
          </p>
          {tip.slot.blurb && <p className="tooltip-blurb">{tip.slot.blurb}</p>}
        </div>
      )}

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

      {hud.toast && (
        <div className="toast">
          <span>{hud.toast}</span>
        </div>
      )}

      <div className="hud-bottom-center">
        <p className="hint">{hud.hint}</p>
        <div className="toolbar">
          <button
            type="button"
            className={`tool-slot ultimate ${hud.ultimate.ready ? '' : 'cooling'}`}
            onClick={onUltimate}
            title={`${hud.ultimate.name} (Q)`}
          >
            <span className="tool-key">Q</span>
            <span className="tool-glyph">{hud.ultimate.glyph}</span>
            <span className="tool-name">
              {hud.ultimate.ready ? 'Boulder' : `${hud.ultimate.cooldown}s`}
            </span>
          </button>
          <span className="toolbar-divider" />
          {hud.toolbar.map((slot) => (
            <button
              type="button"
              key={`tool-${slot.index}`}
              className={`tool-slot ${slot.selected ? 'selected' : ''} ${slot.empty ? 'empty' : ''}`}
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
            <p>Trophies · {hud.win.trophies}</p>
            <button type="button" onClick={onDismissWin}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
