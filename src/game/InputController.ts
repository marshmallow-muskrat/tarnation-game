export type AimPoint = { x: number; z: number };

/**
 * Keyboard + mouse input. Camera-relative movement is applied by GameRuntime
 * using screen-forward / screen-right derived from the isometric camera.
 */
export class InputController {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private pointerNdc = { x: 0, y: 0 };
  private pointerClient = { x: 0, y: 0 };
  private lmb = false;
  private rmb = false;
  private lmbPressed = false;
  private rmbPressed = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
    }
  }

  /** Call once per frame after consuming JustPressed flags. */
  endFrame(): void {
    this.pressed.clear();
    this.lmbPressed = false;
    this.rmbPressed = false;
  }

  /** Screen-space stick: x right, y up-screen (W positive). */
  getMoveStick(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) y += 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 1e-6) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  isDown(code: string): boolean {
    return this.held.has(code);
  }

  consumeLmb(): boolean {
    const v = this.lmbPressed;
    this.lmbPressed = false;
    return v;
  }

  consumeRmb(): boolean {
    const v = this.rmbPressed || this.pressed.has('Space');
    this.rmbPressed = false;
    return v;
  }

  getPointerNdc(): { x: number; y: number } {
    return { ...this.pointerNdc };
  }

  getPointerClient(): { x: number; y: number } {
    return { ...this.pointerClient };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.held.has(e.code)) this.pressed.add(e.code);
    this.held.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.updatePointer(e);
    if (e.button === 0) {
      this.lmb = true;
      this.lmbPressed = true;
    }
    if (e.button === 2) {
      this.rmb = true;
      this.rmbPressed = true;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.lmb = false;
    if (e.button === 2) this.rmb = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointer(e);
  };

  private updatePointer(e: PointerEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerClient.x = e.clientX;
    this.pointerClient.y = e.clientY;
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  get lmbHeld(): boolean {
    return this.lmb;
  }

  get rmbHeld(): boolean {
    return this.rmb;
  }
}
