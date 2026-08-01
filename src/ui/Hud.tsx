import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { cloneModel, type ModelKey } from '../game/Assets';
import type { HudSlot, HudSnapshot } from '../game/GameRuntime';
import type { ItemId } from '../sim/items';
import type { AssetCategory, AssetId } from '../content/purchasables';

type Props = {
  hud: HudSnapshot | null;
  onDismissWin: () => void;
  onSelectSlot: (index: number) => void;
  onSelectToolSlot: () => void;
  onToggleBuild: () => void;
  onSelectBuild: (index: number) => void;
  onToggleHelp: () => void;
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

type IconView = {
  rotationY: number;
  camera: [number, number, number];
  targetY: number;
  zoom?: number;
};

// Tool silhouettes are much easier to read from their broad profile. The
// default three-quarter view makes the axe and shovel nearly edge-on because
// their heads are wide on X but very thin on Z.
const ICON_VIEWS: Partial<Record<ModelKey, IconView>> = {
  axe: { rotationY: 0, camera: [0, 1.05, 2.65], targetY: 0.48, zoom: 1.28 },
  shovel: { rotationY: 0, camera: [0, 1.05, 2.65], targetY: 0.48, zoom: 1.12 },
  shotgun_2: { rotationY: 0, camera: [0, 0.95, 2.85], targetY: 0.48, zoom: 0.68 },
  bow_wooden: { rotationY: 0, camera: [0, 1.05, 2.8], targetY: 0.5 },
};

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

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xf3f0df, 0x26382f, 2.2));
    const key = new THREE.DirectionalLight(0xffe0b0, 3.2);
    key.position.set(2, 4, 3);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 50);
    const { root } = cloneModel(model);
    const view = ICON_VIEWS[model];
    root.rotation.y = view?.rotationY ?? -0.55;
    scene.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const boundsSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(boundsSize);
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    const extent = Math.max(boundsSize.x, boundsSize.y, boundsSize.z, 0.2);
    const cameraPosition = view?.camera ?? [2.15, 1.35, 2.15];
    const iconZoom = view?.zoom ?? 1;
    camera.position.set(
      (extent * cameraPosition[0]) / iconZoom,
      (extent * cameraPosition[1]) / iconZoom,
      (extent * cameraPosition[2]) / iconZoom,
    );
    camera.lookAt(0, boundsSize.y * (view?.targetY ?? 0.42), 0);
    renderer.render(scene, camera);

    return () => {
      renderer.dispose();
      scene.remove(root);
    };
  }, [model, size]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export function Hud({
  hud,
  onDismissWin,
  onSelectSlot,
  onSelectToolSlot,
  onToggleBuild,
  onSelectBuild,
  onToggleHelp,
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
        <button type="button" className="help-toggle" onClick={onToggleHelp}>
          Help <span>H</span>
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
        title="Toggle inventory (I)"
      >
        <ModelIcon model="backpack" className="inv-toggle-model-icon" />
        <span className="inv-toggle-key">I</span>
      </button>

      {hud.inventoryOpen && !hud.build.active && !hud.vendor.open && (
        <div className="panel hud-inventory">
          <p className="label">
            Inventory · {filled}/{hud.inventory.length}
          </p>
          <div className="inv-grid">
            {hud.inventory.map((slot, i) => (
              <div
                key={`slot-${i}`}
                className={`inv-slot ${slot.id ? 'filled' : ''}`}
                onDoubleClick={() => slot.id && onUseInventory(slot.id)}
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
                    {slot.model ? <ModelIcon model={slot.model} className="inv-model-icon" /> : <span className="inv-glyph">{slot.glyph}</span>}
                    <span className="inv-count">{slot.count}</span>
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
          <p className="vendor-intro">The merchant stays at this encampment. Buy a deed, then double-click it in your inventory to use it.</p>
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
                <ModelIcon model={item.model} className="vendor-model-icon" size={46} />
                <div className="vendor-copy">
                  <p className="vendor-name">{item.name}</p>
                  <p className="vendor-description">{item.description}</p>
                  <p className="vendor-meta">Footprint {item.footprint} · {item.gate ? 'Gate' : item.useType}</p>
                  <span className="vendor-cost-placeholder" aria-hidden="true" />
                </div>
                <button type="button" className="vendor-buy" onClick={() => onVendorBuy(item.id)}>
                  Buy
                </button>
              </div>
            ))}
          </div>
          {hud.vendor.message && <p className="vendor-message">{hud.vendor.message}</p>}
          <p className="vendor-footer">Free purchases are testing scaffolding. Price, material, and inventory checks remain wired for paid mode.</p>
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
                    {hud.build.placement.valid ? 'Ready · click a tile to place' : hud.build.placement.reason}
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
          <p className="build-panel-help">P / Esc close · N next · click ground to place</p>
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
            Choose a tool, point at the ground, and use the left mouse button. Right click is for
            combat. Every action works from the fixed isometric camera.
          </p>
          <div className="help-grid">
            <div>
              <p className="label">Move & work</p>
              <p><kbd>W A S D</kbd> Move</p>
              <p><kbd>1</kbd> Shotgun · <kbd>2</kbd> Shovel · <kbd>3</kbd> Axe</p>
              <p><kbd>6</kbd> Bucket · <kbd>[ ]</kbd> Choose seed</p>
              <p><kbd>Left click</kbd> Use selected tool</p>
            </div>
            <div>
              <p className="label">Defend & grow</p>
              <p><kbd>Right click</kbd> Attack</p>
              <p><kbd>Q</kbd> Boulder · <kbd>B</kbd> Bear trap</p>
              <p><kbd>R</kbd> Cycle unlocked weapon</p>
              <p><kbd>U</kbd> Upgrade near the homestead</p>
            </div>
            <div>
              <p className="label">Settlement</p>
              <p><kbd>P</kbd> Open the building panel</p>
              <p><kbd>N</kbd> Next building while placing</p>
              <p><kbd>I</kbd> Inventory · <kbd>H</kbd> This guide</p>
              <p><kbd>+ −</kbd> Camera zoom · <kbd>M</kbd> Reduced motion</p>
              <p><kbd>V</kbd> Toggle synthesized sound feedback</p>
              <p><kbd>Esc</kbd> Close the active panel</p>
            </div>
          </div>
          <p className="help-footer">Tip: crops take two days. Water them, protect them from foxes, then sell the harvest at the market stall.</p>
        </div>
      )}

      <div className="hud-bottom-center">
        {hud.demolishMode && <div className="demolish-badge">Demolish mode · click placed assets · Esc exits</div>}
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
            title={`${hud.ultimate.name} (Q)`}
          >
            <span className="tool-key">Q</span>
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
            title={`${hud.bearTrap.name} (B)`}
          >
            <span className="tool-key">B</span>
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
              <span className="tool-key">{slot.index + 1}</span>
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
            <span className="tool-key">6</span>
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
