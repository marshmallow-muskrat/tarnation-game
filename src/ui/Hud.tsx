import { useEffect, useRef, useState } from 'react';
import type { ModelKey } from '../game/Assets';
import { getModelIconThumbnail, paintModelIcon } from './ModelIconRenderer';
import type { HudSlot, HudSnapshot } from '../game/HudPresenter';
import type { ItemId } from '../sim/items';
import type { AssetCategory, AssetId } from '../content/purchasables';
import type { InputAction } from '../game/InputBindings';

type Props = {
  hud: HudSnapshot | null;
  onDismissWin: () => void;
  onResume: () => void;
  onSelectSlot: (index: number) => void;
  onSelectToolSlot: () => void;
  onToggleBuild: () => void;
  onSelectBuild: (index: number) => void;
  onToggleHelp: () => void;
  onRebindInput: (action: InputAction, code: string) => void;
  onResetInputBindings: () => void;
  onToggleCodex: () => void;
  onSelectCodex: (key: string) => void;
  onToggleCodexCompare: (key: string) => void;
  onUltimate: () => void;
  onBearTrap: () => void;
  onToggleInventory: () => void;
  onSellOne: (id: ItemId) => void;
  onSellStack: (id: ItemId) => void;
  onSellAll: () => void;
  onVendorTab: (tab: AssetCategory) => void;
  onVendorBuy: (id: AssetId) => void;
  onVendorClose: () => void;
  onUseInventory: (id: ItemId) => void;
  onDeleteInventory: (id: ItemId) => void;
  onContextRotate: () => void;
  onContextToggleGate: () => void;
  onContextDestroy: () => void;
  onContextClose: () => void;
};

type Tip = { slot: HudSlot; x: number; y: number } | null;

function ModelIcon({
  model,
  className = 'tool-model-icon',
  size = 48,
}: {
  model: ModelKey;
  className?: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, size, size);
    void getModelIconThumbnail(model).then((thumbnail) => {
      if (active && thumbnail) paintModelIcon(canvas, thumbnail, size);
    });
    return () => {
      active = false;
    };
  }, [model, size]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export function Hud({
  hud,
  onDismissWin,
  onResume,
  onSelectSlot,
  onSelectToolSlot,
  onToggleBuild,
  onSelectBuild,
  onToggleHelp,
  onRebindInput,
  onResetInputBindings,
  onToggleCodex,
  onSelectCodex,
  onToggleCodexCompare,
  onUltimate,
  onBearTrap,
  onToggleInventory,
  onSellOne,
  onSellStack,
  onSellAll,
  onVendorTab,
  onVendorBuy,
  onVendorClose,
  onUseInventory,
  onDeleteInventory,
  onContextRotate,
  onContextToggleGate,
  onContextDestroy,
  onContextClose,
}: Props) {
  const [tip, setTip] = useState<Tip>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ItemId | null>(null);
  const [bindingCapture, setBindingCapture] = useState<InputAction | null>(null);

  useEffect(() => {
    if (!bindingCapture) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') {
        setBindingCapture(null);
        return;
      }
      onRebindInput(bindingCapture, event.code);
      setBindingCapture(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [bindingCapture, onRebindInput]);

  if (!hud) return null;

  const phasePct = Math.round(hud.phaseT * 100);
  const filled = hud.inventory.filter((s) => s.id).length;
  const bindingLabel = (action: InputAction): string =>
    hud.bindings.find((binding) => binding.action === action)?.display ?? '';
  const toolbarActions: readonly InputAction[] = ['slot1', 'slot2', 'slot3'];

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
        <section className="settlement-objective" aria-label="Settlement objective">
          <p className="label">Settlement objective</p>
          <p className="settlement-objective-title">{hud.objective.title}</p>
          <ul>
            {hud.objective.steps.map((step) => (
              <li className={step.complete ? 'complete' : ''} key={step.id}>
                <span aria-hidden>{step.complete ? '✓' : '○'}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        </section>
        <p
          className={`save-status ${hud.save.state === 'failed' ? 'failed' : ''}`}
          role={hud.save.state === 'failed' ? 'alert' : 'status'}
          aria-live={hud.save.state === 'failed' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {hud.save.message}
        </p>
        <button type="button" className="help-toggle" onClick={onToggleHelp}>
          Help <span>{bindingLabel('help')}</span>
        </button>
        <button
          type="button"
          className="help-toggle"
          onClick={onToggleCodex}
          aria-haspopup="dialog"
          aria-expanded={hud.codex.open}
        >
          Seed Codex <span>{bindingLabel('codex')}</span>
        </button>
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
        title={`Toggle inventory (${bindingLabel('inventory')})`}
      >
        <ModelIcon model="backpack" className="inv-toggle-model-icon" />
        <span className="inv-toggle-key">{bindingLabel('inventory')}</span>
      </button>

      {hud.inventoryOpen && !hud.build.active && !hud.vendor.open && (
        <div className="panel hud-inventory">
          <p className="label">
            Inventory · {filled}/{hud.inventory.length}
          </p>
          <p className="label">
            Seed packets · {hud.seedStorage.used}/{hud.seedStorage.capacity}
          </p>
          <div className="inv-grid">
            {hud.inventory.map((slot, i) => (
              <div
                key={`slot-${i}`}
                className={`inv-slot ${slot.id ? 'filled' : ''}`}
                onContextMenu={(e) => {
                  if (!slot.id) return;
                  e.preventDefault();
                  setTip(null);
                  setDeleteConfirm(deleteConfirm === slot.id ? null : slot.id);
                }}
                onMouseEnter={(e) =>
                  slot.id &&
                  setTip({ slot, x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top })
                }
                onMouseLeave={() => setTip(null)}
              >
                {slot.id && (
                  <>
                    <button
                      type="button"
                      className="inv-item"
                      onClick={() => onUseInventory(slot.id!)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Delete' && event.key !== 'Backspace') return;
                        event.preventDefault();
                        setDeleteConfirm(slot.id);
                      }}
                      title={`Use ${slot.name} · ${bindingLabel('primary')}`}
                      aria-label={`Use ${slot.name}, ${slot.count} held`}
                    >
                      {slot.model ? <ModelIcon model={slot.model} className="inv-model-icon" /> : <span className="inv-glyph">{slot.glyph}</span>}
                      <span className="inv-count">{slot.count}</span>
                    </button>
                    <button
                      type="button"
                      className="inv-delete-trigger"
                      onClick={() => setDeleteConfirm(deleteConfirm === slot.id ? null : slot.id)}
                      aria-label={`Delete one ${slot.name}`}
                      title="Delete one"
                    >
                      ×
                    </button>
                    {deleteConfirm === slot.id && (
                      <span className="delete-confirm" onClick={(e) => e.stopPropagation()}>
                        <span>Delete 1?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteInventory(slot.id!);
                            setDeleteConfirm(null);
                          }}
                        >
                          Delete
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </button>
                      </span>
                    )}
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
            {tip.slot.name}
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
                      {item.model ? <ModelIcon model={item.model} className="market-model-icon" /> : <span className="market-glyph">{item.glyph}</span>}
                      {item.name} ×{item.count}
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

      {hud.vendor.open && (
        <div className="panel vendor-panel">
          <div className="vendor-heading">
            <div>
              <p className="label">Stationary trading post</p>
              <h2>Traveling Merchant</h2>
            </div>
            <button type="button" className="build-close" onClick={onVendorClose}>
              Close
            </button>
          </div>
          <p className="vendor-intro">The merchant stays at this encampment. Buy a permit or deed, then select it in your inventory to use it.</p>
          <div className="vendor-tabs" role="tablist" aria-label="Merchant categories">
            {hud.vendor.tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === hud.vendor.tab}
                className={tab === hud.vendor.tab ? 'selected' : ''}
                key={tab}
                onClick={() => onVendorTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="vendor-list">
            {hud.vendor.items.map((item) => (
              <div className="vendor-row" key={item.id}>
                {item.model ? (
                  <ModelIcon model={item.model} className="vendor-model-icon" size={46} />
                ) : (
                  <span className="vendor-model-icon vendor-authored-visual" aria-hidden="true" />
                )}
                <div className="vendor-copy">
                  <p className="vendor-name">{item.name}</p>
                  <p className="vendor-description">{item.description}</p>
                  <p className="vendor-meta">Footprint {item.footprint} · {item.gate ? 'Gate' : item.useType === 'apply' ? 'Upgrade' : item.useType}</p>
                  <p className="vendor-cost">Cost: {item.price}₫{item.material === '—' ? '' : ` + ${item.material}`}</p>
                  <p className="vendor-owned">Owned: {item.owned}</p>
                  <p className={`vendor-lock ${item.canBuy ? 'available' : 'blocked'}`}>{item.lockReason}</p>
                </div>
                <button
                  type="button"
                  className="vendor-buy"
                  onClick={() => onVendorBuy(item.id)}
                  disabled={!item.canBuy}
                >
                  Buy
                </button>
              </div>
            ))}
          </div>
          {hud.vendor.message && <p className="vendor-message" role="status" aria-live="polite">{hud.vendor.message}</p>}
          <p className="vendor-footer">{hud.vendor.economyLabel}. Prices and materials are shown before purchase.</p>
        </div>
      )}

      {hud.contextMenu.open && (
        <div
          className="context-menu"
          style={{ left: `${Math.max(8, hud.contextMenu.x)}px`, top: `${Math.max(8, hud.contextMenu.y)}px` }}
        >
          <p>{hud.contextMenu.name}</p>
          <button type="button" onClick={onContextRotate}>Rotate</button>
          {hud.contextMenu.gate && (
            <button type="button" onClick={onContextToggleGate}>
              {hud.contextMenu.gateOpen ? 'Close gate' : 'Open gate'}
            </button>
          )}
          <button type="button" className="danger" onClick={onContextDestroy}>Destroy</button>
          <button type="button" className="context-cancel" onClick={onContextClose}>Esc · Close</button>
        </div>
      )}

      {hud.paused && (
        <div className="pause-overlay">
          <div className="panel pause-card">
            <p className="label">Adventure paused</p>
            <h2>Take a breath</h2>
            <p>Nothing advances while the pause menu is open.</p>
            <button type="button" onClick={onResume}>Resume</button>
            <p className="pause-help">Esc resumes</p>
          </div>
        </div>
      )}

      {hud.build.active && (
        <div className="panel build-panel">
          <div className="build-panel-heading">
            <div>
              <p className="label">Town building</p>
              <h2>Choose a structure</h2>
            </div>
            <button type="button" className="build-close" onClick={onToggleBuild}>
              Close
            </button>
          </div>

          {(() => {
            const selected = hud.build.options[hud.build.selectedIndex];
            if (!selected) return null;
            return (
              <div className="build-selected">
                <ModelIcon model={selected.model} className="build-preview-icon" size={72} />
                <div className="build-selected-copy">
                  <p className="build-selected-name">{selected.name}</p>
                  <p className={`build-cost ${selected.canAfford ? '' : 'short'}`}>
                    {selected.cost === 0 ? 'Free' : `${selected.cost} Wood`} · {hud.build.wood} carried
                  </p>
                  <p className={`build-selected-help ${hud.build.placement.valid ? 'ready' : 'blocked'}`}>
                    {hud.build.placement.valid ? `Ready · ${bindingLabel('primary')} or click a tile to place` : hud.build.placement.reason}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="build-options" role="list" aria-label="Placeable buildings">
            {hud.build.options.map((option) => (
              <button
                type="button"
                role="listitem"
                key={`build-${option.index}`}
                className={`build-option ${option.index === hud.build.selectedIndex ? 'selected' : ''} ${option.canAfford ? '' : 'unaffordable'}`}
                onClick={() => onSelectBuild(option.index)}
              >
                <span className="build-option-index">{option.index + 1}</span>
                <span className="build-option-name">{option.name}</span>
                <span className="build-option-cost">{option.cost}W</span>
              </button>
            ))}
          </div>
          <p className="build-panel-help">{bindingLabel('build')} / {bindingLabel('pause')} close · {bindingLabel('nextBuild')} next · {bindingLabel('rotateOrCycle')} rotate · {bindingLabel('primary')} or click ground to place</p>
        </div>
      )}

      {hud.helpOpen && (
        <div className="panel help-panel">
          <div className="help-heading">
            <div>
              <p className="label">Field guide</p>
              <h2>How to work the homestead</h2>
            </div>
            <button type="button" className="build-close" onClick={onToggleHelp}>
              Close
            </button>
          </div>
          <p className="help-intro">
            Choose a tool, point at the ground, and use the left mouse button or <kbd>{bindingLabel('primary')}</kbd>.
            <kbd>{bindingLabel('secondary')}</kbd> is the optional secondary action. Focused controls can be operated
            with <kbd>Enter</kbd> or <kbd>Space</kbd>; right-click and double-click are never required.
          </p>
          <div className="help-grid">
            <div>
              <p className="label">Move & work</p>
              <p><kbd>{bindingLabel('moveUp')}</kbd> <kbd>{bindingLabel('moveLeft')}</kbd> <kbd>{bindingLabel('moveDown')}</kbd> <kbd>{bindingLabel('moveRight')}</kbd> Move</p>
              <p><kbd>{bindingLabel('slot1')}</kbd> Shotgun · <kbd>{bindingLabel('slot2')}</kbd> Shovel · <kbd>{bindingLabel('slot3')}</kbd> Axe</p>
              <p><kbd>{bindingLabel('toolSlot')}</kbd> Bucket · <kbd>{bindingLabel('seedPrevious')}</kbd> <kbd>{bindingLabel('seedNext')}</kbd> Choose seed</p>
              <p><kbd>{bindingLabel('trench')}</kbd> Dig an irrigation trench</p>
              <p><kbd>{bindingLabel('primary')}</kbd> or <kbd>Left click</kbd> Use selected tool</p>
            </div>
            <div>
              <p className="label">Defend & grow</p>
              <p><kbd>{bindingLabel('secondary')}</kbd> or <kbd>Right click</kbd> Attack</p>
              <p><kbd>{bindingLabel('ultimate')}</kbd> Boulder · <kbd>{bindingLabel('bearTrap')}</kbd> Bear trap</p>
              <p><kbd>{bindingLabel('rotateOrCycle')}</kbd> Rotate placement or cycle weapon</p>
            </div>
            <div>
              <p className="label">Settlement</p>
              <p><kbd>{bindingLabel('interact')}</kbd> Open the merchant shop · permits advance the homestead</p>
              <p><kbd>{bindingLabel('context')}</kbd> Open a placed-asset context menu</p>
              <p><kbd>{bindingLabel('build')}</kbd> Build catalog · <kbd>{bindingLabel('nextBuild')}</kbd> Next building while placing</p>
              <p><kbd>{bindingLabel('demolish')}</kbd> Demolish mode · <kbd>{bindingLabel('primary')}</kbd> Destroy hovered asset</p>
              <p><kbd>{bindingLabel('inventory')}</kbd> Inventory · <kbd>{bindingLabel('codex')}</kbd> Seed Codex · <kbd>{bindingLabel('help')}</kbd> This guide</p>
              <p><kbd>{bindingLabel('zoomIn')}</kbd> <kbd>{bindingLabel('zoomOut')}</kbd> Camera zoom · <kbd>{bindingLabel('reducedMotion')}</kbd> Reduced motion</p>
              <p><kbd>{bindingLabel('mute')}</kbd> Toggle synthesized sound feedback</p>
              <p><kbd>{bindingLabel('pause')}</kbd> Cancel active mode · pause when idle</p>
            </div>
          </div>
          <details className="help-bindings">
            <summary>Remap keyboard controls</summary>
            <p className="help-bindings-copy">Choose a primary key. If it is already assigned, the two actions swap so neither action becomes unreachable. Arrow and numpad alternates remain available.</p>
            {(['Movement', 'World actions', 'Menus', 'Tools', 'Camera & options'] as const).map((group) => {
              const bindings = hud.bindings.filter((binding) => binding.group === group);
              return (
                <div className="binding-group" key={group}>
                  <p className="label">{group}</p>
                  <div className="binding-list">
                    {bindings.map((binding) => (
                      <div className="binding-row" key={binding.action}>
                        <span>{binding.label}</span>
                        <button
                          type="button"
                          className={bindingCapture === binding.action ? 'binding-key capturing' : 'binding-key'}
                          onClick={() => setBindingCapture(binding.action)}
                        >
                          {bindingCapture === binding.action ? 'Press a key · Esc cancels' : binding.display}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <button type="button" className="binding-reset" onClick={() => {
              setBindingCapture(null);
              onResetInputBindings();
            }}>
              Reset keyboard defaults
            </button>
          </details>
          <p className="help-footer">Tip: traits change how crops grow and defend themselves. Water them, protect them from foxes, then sell the harvest at the market stall.</p>
        </div>
      )}

      {hud.codex.open && (
        <div
          className="panel codex-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="codex-title"
        >
          <div className="codex-heading">
            <div>
              <p className="label">Breeding record</p>
              <h2 id="codex-title">Seed Codex</h2>
            </div>
            <button type="button" className="build-close" onClick={onToggleCodex}>
              Close
            </button>
          </div>
          <p className="codex-status" role="status" aria-live="polite" aria-atomic="true">
            {hud.codex.status}
          </p>
          <div className="codex-layout">
            <div className="codex-list" role="list" aria-label="Seed Codex entries">
              {hud.codex.entries.map((entry) => (
                <div className="codex-list-row" key={entry.key} role="listitem">
                  <button
                    type="button"
                    className={`codex-entry ${entry.key === hud.codex.selectedKey ? 'selected' : ''} ${entry.kind === 'undiscovered' ? 'unknown' : ''}`}
                    onClick={() => onSelectCodex(entry.key)}
                    aria-pressed={entry.key === hud.codex.selectedKey}
                    aria-label={entry.ariaLabel}
                  >
                    {entry.model ? (
                      <ModelIcon
                        model={entry.model}
                        className={`codex-model-icon ${entry.kind === 'undiscovered' ? 'codex-silhouette' : ''}`}
                        size={42}
                      />
                    ) : (
                      <span className="codex-unknown-mark" aria-hidden="true">?</span>
                    )}
                    <span className="codex-entry-copy">
                      <span className="codex-entry-name">{entry.name}</span>
                      <span className="codex-entry-meta">
                        {entry.kind === 'discovered' ? `Day ${entry.discoveredDay ?? 1}` : 'Not discovered'}
                      </span>
                    </span>
                  </button>
                  {entry.kind === 'discovered' && (
                    <button
                      type="button"
                      className={`codex-compare ${entry.compareSelected ? 'selected' : ''}`}
                      onClick={() => onToggleCodexCompare(entry.key)}
                      aria-pressed={entry.compareSelected}
                      aria-label={`${entry.compareSelected ? 'Remove' : 'Add'} ${entry.name} ${entry.compareSelected ? 'from' : 'to'} comparison`}
                    >
                      {entry.compareSelected ? 'Comparing' : 'Compare'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="codex-detail" aria-label="Selected seed details">
              {(() => {
                const selected = hud.codex.entries.find((entry) => entry.key === hud.codex.selectedKey);
                if (!selected) return <p className="hint">No seed entry selected.</p>;
                return (
                  <>
                    <div className="codex-detail-heading">
                      {selected.model ? (
                        <ModelIcon
                          model={selected.model}
                          className={`codex-detail-icon ${selected.kind === 'undiscovered' ? 'codex-silhouette' : ''}`}
                          size={64}
                        />
                      ) : <span className="codex-detail-unknown">?</span>}
                      <div>
                        <p className="label">{selected.kind === 'discovered' ? 'Discovered seed' : 'Undiscovered'}</p>
                        <h3>{selected.name}</h3>
                      </div>
                    </div>
                    {selected.kind === 'discovered' ? (
                      <>
                        <dl className="codex-facts">
                          <div><dt>Species</dt><dd>{selected.species}</dd></div>
                          <div><dt>Parentage</dt><dd>{selected.lineage}</dd></div>
                          <div><dt>Effect</dt><dd>{selected.effect}</dd></div>
                        </dl>
                        <div className="codex-traits" aria-label={`${selected.name} traits`}>
                          {selected.traits.map((trait) => (
                            <div key={trait.label} className="codex-trait">
                              <span>{trait.label}</span>
                              <strong>{trait.value}</strong>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="codex-detail-compare"
                          onClick={() => onToggleCodexCompare(selected.key)}
                          aria-pressed={selected.compareSelected}
                        >
                          {selected.compareSelected ? 'Remove from comparison' : 'Compare this seed'}
                        </button>
                      </>
                    ) : (
                      <p className="codex-locked-copy">
                        This silhouette is still a mystery. Breed or recover the seed to reveal its
                        parentage, traits, and field effect.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          {hud.codex.compareKeys.length > 0 && (
            <section className="codex-comparison" aria-label="Seed comparison">
              <div className="codex-comparison-heading">
                <p className="label">Compare</p>
                <span>{hud.codex.compareKeys.length}/2 selected</span>
              </div>
              <div className="codex-comparison-grid">
                {hud.codex.compareKeys.map((key) => {
                  const entry = hud.codex.entries.find((candidate) => candidate.key === key);
                  if (!entry) return null;
                  return (
                    <div className="codex-comparison-card" key={entry.key}>
                      <strong>{entry.name}</strong>
                      {entry.traits.map((trait) => (
                        <span key={trait.label}>{trait.label}: {trait.value}</span>
                      ))}
                      <span>Effect: {entry.effect}</span>
                    </div>
                  );
                })}
              </div>
              <p className="codex-compare-help">Choose two discovered seeds to compare their loadout traits.</p>
            </section>
          )}
        </div>
      )}

      <div className="hud-bottom-center">
        {hud.demolishMode && <div className="demolish-badge">Demolish mode · {bindingLabel('primary')} or click placed assets · {bindingLabel('pause')} exits</div>}
        {hud.toast && (
          <div className="toast">
            <span>{hud.toast}</span>
          </div>
        )}
        {!hud.toast && <p className="hint">{hud.hint}</p>}
        <div className="toolbar">
          <button
            type="button"
            className={`tool-slot ultimate ${hud.ultimate.ready ? '' : 'cooling'}`}
            onClick={onUltimate}
            title={`${hud.ultimate.name} (${bindingLabel('ultimate')})`}
          >
            <span className="tool-key">{bindingLabel('ultimate')}</span>
            <span className="tool-glyph">
              <ModelIcon model={hud.ultimate.model} />
            </span>
            <span className="tool-name">
              {hud.ultimate.ready ? hud.ultimate.name : `${hud.ultimate.cooldown}s`}
            </span>
          </button>
          <button
            type="button"
            className={`tool-slot ultimate trap ${hud.bearTrap.ready ? '' : 'cooling'}`}
            onClick={onBearTrap}
            title={`${hud.bearTrap.name} (${bindingLabel('bearTrap')})`}
          >
            <span className="tool-key">{bindingLabel('bearTrap')}</span>
            <span className="tool-glyph">
              <ModelIcon model={hud.bearTrap.model} />
            </span>
            <span className="tool-name">
              {hud.bearTrap.ready ? hud.bearTrap.name : `${hud.bearTrap.cooldown}s`}
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
              <span className="tool-key">{bindingLabel(toolbarActions[slot.index] ?? 'slot1')}</span>
              <span className="tool-glyph">
                {slot.model ? (
                  <ModelIcon
                    model={slot.model}
                    className={slot.model === 'shotgun_2' ? 'tool-model-icon shotgun-tool-icon' : undefined}
                    size={slot.model === 'shotgun_2' ? 52 : 48}
                  />
                ) : (
                  slot.glyph
                )}
              </span>
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
            <span className="tool-key">{bindingLabel('toolSlot')}</span>
            <span className="tool-glyph">
              {hud.toolSlot.model ? <ModelIcon model={hud.toolSlot.model} /> : hud.toolSlot.glyph}
            </span>
            <span className="tool-name">
              {hud.toolSlot.fill}/{hud.toolSlot.capacity}
            </span>
          </button>
        </div>
      </div>

      {hud.win && (
        <div
          className="win-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settlement-title"
        >
          <div className="panel win-card settlement-card">
            <p className="label">The homestead stands</p>
            <h1 id="settlement-title">Homestead Established</h1>
            <p>Grow, experiment, defend, and develop now have a place here.</p>
            <ul className="settlement-completion-list">
              {hud.objective.steps.map((step) => (
                <li key={step.id}>
                  <span aria-hidden>✓</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
            <p className="win-stats">Days survived · {hud.win.daysSurvived}</p>
            <p className="win-stats">Crops harvested · {hud.win.cropsHarvested}</p>
            <p className="win-stats">Wood gathered · {hud.win.woodGathered}</p>
            <p className="win-stats">Trophies · {hud.win.trophies}</p>
            <button type="button" onClick={onDismissWin}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
