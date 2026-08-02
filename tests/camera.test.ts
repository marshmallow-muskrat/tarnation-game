import { describe, expect, it } from 'vitest';
import {
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  CAMERA_WORLD_EDGE_MARGIN,
  cameraShakeAmplitude,
  clampCameraCoordinate,
  clampCameraZoom,
  cameraFrustum,
  dayNightBlend,
  lightingProfile,
  quantizeShadowAnchor,
} from '../src/sim/camera';

describe('camera composition and readable lighting', () => {
  it('keeps player-facing zoom requests within the bounded readable range', () => {
    expect(clampCameraZoom(CAMERA_ZOOM_MIN - 1)).toBe(CAMERA_ZOOM_MIN);
    expect(clampCameraZoom(CAMERA_ZOOM_MAX + 1)).toBe(CAMERA_ZOOM_MAX);
    expect(clampCameraZoom(1.1)).toBe(1.1);
    expect(clampCameraZoom(Number.NaN)).toBe(1);
  });

  it('preserves the vertical composition and viewport aspect during resize', () => {
    expect(cameraFrustum(1280, 720)).toEqual({
      aspect: 1280 / 720,
      left: -(5 * 1280) / 720,
      right: (5 * 1280) / 720,
      top: 5,
      bottom: -5,
    });
  });

  it('uses a finite one-pixel fallback instead of a broken projection for a minimized viewport', () => {
    expect(cameraFrustum(0, 0)).toEqual({ aspect: 1, left: -5, right: 5, top: 5, bottom: -5 });
    expect(cameraFrustum(Number.NaN, 720).aspect).toBe(1 / 720);
  });

  it('keeps the camera target inside the world margin while the player reaches an edge', () => {
    expect(clampCameraCoordinate(-40, 2, 238)).toBe(2 + CAMERA_WORLD_EDGE_MARGIN);
    expect(clampCameraCoordinate(500, 2, 238)).toBe(238 - CAMERA_WORLD_EDGE_MARGIN);
    expect(clampCameraCoordinate(120, 2, 238)).toBe(120);
  });

  it('centers a world that is too small to contain the full camera margin', () => {
    expect(clampCameraCoordinate(-10, 0, 6, 4)).toBe(3);
    expect(clampCameraCoordinate(6, 12, 0, 2)).toBe(6);
  });

  it('quantizes shadow anchors so sub-quarter-tile motion does not churn shadows', () => {
    expect(quantizeShadowAnchor(10.11)).toBe(10);
    expect(quantizeShadowAnchor(10.14)).toBe(10.25);
    expect(quantizeShadowAnchor(-2.38)).toBe(-2.5);
  });

  it('eases camera shake out instead of holding a constant amplitude until a hard stop', () => {
    expect(cameraShakeAmplitude(0.4, 0.4, 0.2)).toBeCloseTo(0.2);
    expect(cameraShakeAmplitude(0.2, 0.4, 0.2)).toBeCloseTo(0.05);
    expect(cameraShakeAmplitude(0, 0.4, 0.2)).toBe(0);
    expect(cameraShakeAmplitude(0.2, 0, 0.2)).toBe(0);
  });

  it('keeps daylight fully lit until the existing authored dusk ramp begins', () => {
    expect(dayNightBlend('day', 0)).toBe(0);
    expect(dayNightBlend('day', 0.88)).toBe(0);
    expect(dayNightBlend('day', 0.96)).toBeCloseTo(0.3);
    expect(lightingProfile('day', 0)).toMatchObject({
      keyIntensity: 2.2,
      hemisphereIntensity: 1.1,
      heroIntensity: 3,
      fogDensity: 0.012,
    });
  });

  it('ramps dawn and dusk without dropping the targetable light floor', () => {
    expect(dayNightBlend('night', 0.05)).toBeCloseTo(0.5);
    expect(dayNightBlend('night', 0.5)).toBe(1);
    expect(dayNightBlend('night', 0.95)).toBeCloseTo(0.5);
    const darkest = lightingProfile('night', 0.5);
    expect(darkest.keyIntensity).toBeGreaterThanOrEqual(0.55);
    expect(darkest.hemisphereIntensity).toBeCloseTo(0.45);
    expect(darkest.fogDensity).toBeCloseTo(0.028);
  });

  it('makes a portable light local and stronger at night without changing the world clock', () => {
    const night = lightingProfile('night', 0.5);
    const portableNight = lightingProfile('night', 0.5, true);
    expect(portableNight.nightBlend).toBe(night.nightBlend);
    expect(portableNight.heroIntensity - night.heroIntensity).toBeCloseTo(2.5);
  });
});
