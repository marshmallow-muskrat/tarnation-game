/**
 * The keyboard/mouse contract is intentionally data-driven so the runtime and
 * the field guide cannot drift apart. Mouse buttons remain fixed device inputs;
 * these bindings describe the keyboard actions that supplement them.
 */
export const INPUT_ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'primary',
  'secondary',
  'context',
  'interact',
  'inventory',
  'help',
  'codex',
  'objective',
  'marketGuide',
  'build',
  'demolish',
  'pause',
  'rotateOrCycle',
  'ultimate',
  'bearTrap',
  'slot1',
  'slot2',
  'slot3',
  'toolSlot',
  'nextBuild',
  'seedPrevious',
  'seedNext',
  'trench',
  'breed',
  'zoomIn',
  'zoomOut',
  'reducedMotion',
  'mute',
] as const;

export type InputAction = typeof INPUT_ACTIONS[number];
export type InputBindings = { [Action in InputAction]: string };
export type InputBindingGroup = 'Movement' | 'World actions' | 'Menus' | 'Tools' | 'Camera & options';
export const INPUT_BINDINGS_STORAGE_KEY = 'tarnation.inputBindings';

export const DEFAULT_INPUT_BINDINGS: Readonly<InputBindings> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  primary: 'Enter',
  secondary: 'Space',
  context: 'KeyO',
  interact: 'KeyE',
  inventory: 'KeyI',
  help: 'KeyH',
  codex: 'KeyK',
  objective: 'KeyJ',
  marketGuide: 'KeyG',
  build: 'KeyP',
  demolish: 'KeyX',
  pause: 'Escape',
  rotateOrCycle: 'KeyR',
  ultimate: 'KeyQ',
  bearTrap: 'KeyB',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  toolSlot: 'Digit6',
  nextBuild: 'KeyN',
  seedPrevious: 'BracketLeft',
  seedNext: 'BracketRight',
  trench: 'KeyZ',
  breed: 'KeyC',
  zoomIn: 'Equal',
  zoomOut: 'Minus',
  reducedMotion: 'KeyM',
  mute: 'KeyV',
};

/** Existing alternate keys remain available when a primary binding changes. */
export const INPUT_ALIASES: Readonly<Partial<Record<InputAction, readonly string[]>>> = {
  moveUp: ['ArrowUp'],
  moveDown: ['ArrowDown'],
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  toolSlot: ['KeyT'],
  seedPrevious: ['Comma'],
  seedNext: ['Period'],
  zoomIn: ['NumpadAdd'],
  zoomOut: ['NumpadSubtract'],
  pause: ['Escape'],
};

export type InputBindingDefinition = {
  action: InputAction;
  label: string;
  group: InputBindingGroup;
};

export const INPUT_BINDING_DEFINITIONS: readonly InputBindingDefinition[] = [
  { action: 'moveUp', label: 'Move up', group: 'Movement' },
  { action: 'moveDown', label: 'Move down', group: 'Movement' },
  { action: 'moveLeft', label: 'Move left', group: 'Movement' },
  { action: 'moveRight', label: 'Move right', group: 'Movement' },
  { action: 'primary', label: 'Primary action · work, place, or demolish', group: 'World actions' },
  { action: 'secondary', label: 'Secondary action · combat or rotate placement', group: 'World actions' },
  { action: 'context', label: 'Open placed-asset context', group: 'World actions' },
  { action: 'interact', label: 'Interact · merchant or water source', group: 'World actions' },
  { action: 'inventory', label: 'Inventory', group: 'Menus' },
  { action: 'help', label: 'Field guide', group: 'Menus' },
  { action: 'codex', label: 'Seed Codex', group: 'Menus' },
  { action: 'objective', label: 'Settlement objective', group: 'Menus' },
  { action: 'marketGuide', label: 'Market guide', group: 'Menus' },
  { action: 'build', label: 'Build catalog', group: 'Menus' },
  { action: 'demolish', label: 'Demolish mode', group: 'Menus' },
  { action: 'pause', label: 'Cancel, close, or pause', group: 'Menus' },
  { action: 'rotateOrCycle', label: 'Rotate placement or cycle weapon', group: 'World actions' },
  { action: 'ultimate', label: 'Boulder', group: 'Tools' },
  { action: 'bearTrap', label: 'Bear trap', group: 'Tools' },
  { action: 'slot1', label: 'Select shotgun or bow', group: 'Tools' },
  { action: 'slot2', label: 'Select shovel', group: 'Tools' },
  { action: 'slot3', label: 'Select axe', group: 'Tools' },
  { action: 'toolSlot', label: 'Select bucket', group: 'Tools' },
  { action: 'nextBuild', label: 'Next building', group: 'Tools' },
  { action: 'seedPrevious', label: 'Previous seed', group: 'Tools' },
  { action: 'seedNext', label: 'Next seed', group: 'Tools' },
  { action: 'trench', label: 'Irrigation trench mode', group: 'Tools' },
  { action: 'breed', label: 'Breeding bed mode', group: 'Tools' },
  { action: 'zoomIn', label: 'Zoom in', group: 'Camera & options' },
  { action: 'zoomOut', label: 'Zoom out', group: 'Camera & options' },
  { action: 'reducedMotion', label: 'Reduced motion', group: 'Camera & options' },
  { action: 'mute', label: 'Sound feedback', group: 'Camera & options' },
];

export function cloneInputBindings(bindings: Readonly<InputBindings> = DEFAULT_INPUT_BINDINGS): InputBindings {
  return { ...bindings };
}

export function isInputAction(value: string): value is InputAction {
  return (INPUT_ACTIONS as readonly string[]).includes(value);
}

export function bindingCodes(bindings: Readonly<InputBindings>, action: InputAction): readonly string[] {
  const codes = [bindings[action], ...(INPUT_ALIASES[action] ?? [])];
  return [...new Set(codes)];
}

export function actionIsDown(
  heldCodes: ReadonlySet<string>,
  bindings: Readonly<InputBindings>,
  action: InputAction,
): boolean {
  return bindingCodes(bindings, action).some((code) => heldCodes.has(code));
}

export type RebindResult =
  | { ok: true; bindings: InputBindings; swappedWith: InputAction | null }
  | { ok: false; bindings: InputBindings; reason: string };

/**
 * Assign a primary key without leaving two actions on the same remappable key.
 * A conflict swaps the displaced action onto the key that the edited action
 * used before the change, so every action keeps a route and no silent unbind
 * occurs. Built-in alternate keys remain reserved for their original action.
 */
export function rebindInput(
  bindings: Readonly<InputBindings>,
  action: InputAction,
  code: string,
): RebindResult {
  const trimmed = code.trim();
  if (!trimmed || trimmed === 'Unidentified') {
    return { ok: false, bindings: cloneInputBindings(bindings), reason: 'Choose a named keyboard key.' };
  }
  if (trimmed === 'F12') {
    return { ok: false, bindings: cloneInputBindings(bindings), reason: 'F12 is reserved by the browser.' };
  }

  const current = bindings[action];
  if (current === trimmed) return { ok: true, bindings: cloneInputBindings(bindings), swappedWith: null };

  const aliasOwner = INPUT_ACTIONS.find((candidate) =>
    candidate !== action && (INPUT_ALIASES[candidate] ?? []).includes(trimmed),
  );
  if (aliasOwner) {
    const label = INPUT_BINDING_DEFINITIONS.find((definition) => definition.action === aliasOwner)?.label ?? aliasOwner;
    return {
      ok: false,
      bindings: cloneInputBindings(bindings),
      reason: `${formatKeyCode(trimmed)} is reserved as an alternate for ${label}.`,
    };
  }

  const next = cloneInputBindings(bindings);
  const conflict = INPUT_ACTIONS.find((candidate) => candidate !== action && bindings[candidate] === trimmed) ?? null;
  if (conflict) next[conflict] = current;
  next[action] = trimmed;
  return { ok: true, bindings: next, swappedWith: conflict };
}

export function resetInputBindings(): InputBindings {
  return cloneInputBindings();
}

export function serializeInputBindings(bindings: Readonly<InputBindings>): string {
  return JSON.stringify(bindings);
}

/** Invalid, missing, and duplicate persisted entries fall back safely. */
export function parseInputBindings(raw: string | null | undefined): InputBindings {
  if (!raw) return resetInputBindings();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return resetInputBindings();
    const candidate = parsed as Record<string, unknown>;
    let next = resetInputBindings();
    for (const action of INPUT_ACTIONS) {
      const code = candidate[action];
      if (typeof code !== 'string') continue;
      const result = rebindInput(next, action, code);
      if (result.ok) next = result.bindings;
    }
    return next;
  } catch {
    return resetInputBindings();
  }
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Equal: '+',
  Minus: '−',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num −',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
};

export function formatKeyCode(code: string): string {
  return KEY_LABELS[code]
    ?? (code.startsWith('Key') ? code.slice(3) : undefined)
    ?? (code.startsWith('Digit') ? code.slice(5) : undefined)
    ?? code;
}

export function formatBinding(bindings: Readonly<InputBindings>, action: InputAction): string {
  return bindingCodes(bindings, action).map(formatKeyCode).join(' / ');
}
