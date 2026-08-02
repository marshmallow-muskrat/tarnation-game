import type { Phase } from './clock';

/** Camera limits shared by the renderer and deterministic characterization tests. */
export const CAMERA_ZOOM_MIN = 0.78;
export const CAMERA_ZOOM_MAX = 1.3;
export const CAMERA_DEFAULT_ZOOM = 1;
export const CAMERA_VERTICAL_HALF_FRUSTUM = 5;
/**
 * The orthographic view projects a diagonal ground move into screen height.
 * This four-unit margin keeps a player at a world corner inside the frame even
 * at the maximum zoom, while avoiding a hard camera stop in normal play.
 */
export const CAMERA_WORLD_EDGE_MARGIN = 4;
export const SHADOW_ANCHOR_STEP = 0.25;

export interface CameraFrustum {
  aspect: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Clamp an interactive zoom request without allowing a non-finite target. */
export function clampCameraZoom(value: number): number {
  if (!Number.isFinite(value)) return CAMERA_DEFAULT_ZOOM;
  return Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, value));
}

/** Keep a viewport resize from producing an invalid projection matrix. */
export function cameraFrustum(width: number, height: number): CameraFrustum {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const aspect = safeWidth / safeHeight;
  return {
    aspect,
    left: -CAMERA_VERTICAL_HALF_FRUSTUM * aspect,
    right: CAMERA_VERTICAL_HALF_FRUSTUM * aspect,
    top: CAMERA_VERTICAL_HALF_FRUSTUM,
    bottom: -CAMERA_VERTICAL_HALF_FRUSTUM,
  };
}

/** Keep a camera target inside a world interval with a stable edge margin. */
export function clampCameraCoordinate(
  value: number,
  min: number,
  max: number,
  margin = CAMERA_WORLD_EDGE_MARGIN,
): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const safeMargin = Number.isFinite(margin) && margin > 0 ? margin : 0;
  const span = upper - lower;
  if (span <= safeMargin * 2) return (lower + upper) / 2;
  const safeValue = Number.isFinite(value) ? value : (lower + upper) / 2;
  return Math.min(upper - safeMargin, Math.max(lower + safeMargin, safeValue));
}

/** Quantize the moving shadow camera so sub-pixel player motion is stable. */
export function quantizeShadowAnchor(value: number, step = SHADOW_ANCHOR_STEP): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeStep = Number.isFinite(step) && step > 0 ? step : SHADOW_ANCHOR_STEP;
  return Math.round(safeValue / safeStep) * safeStep;
}

/** The renderer's existing dawn/dusk curve, expressed without Three.js. */
export function dayNightBlend(phase: Phase, t: number): number {
  const normalized = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  if (phase === 'night') {
    if (normalized < 0.1) return normalized / 0.1;
    if (normalized > 0.9) return (1 - normalized) / 0.1;
    return 1;
  }
  if (normalized > 0.88) return ((normalized - 0.88) / 0.12) * 0.45;
  return 0;
}

export interface LightingProfile {
  nightBlend: number;
  keyIntensity: number;
  hemisphereIntensity: number;
  heroIntensity: number;
  fogDensity: number;
}

/**
 * Readability-first light levels. These are the current renderer values made
 * pure so their floors and transitions cannot drift without a test failure.
 */
export function lightingProfile(
  phase: Phase,
  t: number,
  portableLightActive = false,
): LightingProfile {
  const nightBlend = dayNightBlend(phase, t);
  return {
    nightBlend,
    keyIntensity: 2.2 + (0.55 - 2.2) * nightBlend,
    hemisphereIntensity: 1.1 + (0.45 - 1.1) * nightBlend,
    heroIntensity:
      3 + (5.5 - 3) * nightBlend +
      (portableLightActive ? 0.6 + (2.5 - 0.6) * nightBlend : 0),
    fogDensity: 0.012 + (0.028 - 0.012) * nightBlend,
  };
}
