import * as THREE from 'three';
import {
  feedbackProfile,
  shouldRenderFeedback,
  type FeedbackKind,
  type FeedbackProfile,
} from '../sim/feedback';

export const MAX_FEEDBACK_EFFECTS = 24;
export const MAX_FEEDBACK_PARTICLES = 8;

type FeedbackRandom = () => number;
type FeedbackHeightAt = (x: number, z: number) => number;

type FeedbackParticle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  size: number;
};

type FeedbackSlot = {
  root: THREE.Group;
  material: THREE.MeshBasicMaterial;
  particles: FeedbackParticle[];
  active: boolean;
  age: number;
  lifetime: number;
  sequence: number;
  profile: FeedbackProfile | null;
};

/** Renderer-only fixed storage for short-lived action feedback. */
export class FeedbackEffectPool {
  private readonly geometry = new THREE.OctahedronGeometry(0.07, 0);
  private readonly slots: FeedbackSlot[] = [];
  private spawnSequence = 0;
  private disposed = false;

  constructor() {
    for (let slotIndex = 0; slotIndex < MAX_FEEDBACK_EFFECTS; slotIndex++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const root = new THREE.Group();
      root.name = 'action_feedback_burst';
      root.visible = false;
      const particles: FeedbackParticle[] = [];
      for (let particleIndex = 0; particleIndex < MAX_FEEDBACK_PARTICLES; particleIndex++) {
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.name = 'action_feedback_particle';
        mesh.visible = false;
        mesh.renderOrder = 6;
        root.add(mesh);
        particles.push({
          mesh,
          velocity: new THREE.Vector3(),
          spin: new THREE.Vector3(),
          size: 0,
        });
      }
      this.slots.push({
        root,
        material,
        particles,
        active: false,
        age: 0,
        lifetime: 0,
        sequence: 0,
        profile: null,
      });
    }
  }

  get poolSize(): number {
    return this.slots.length;
  }

  get activeCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  spawn(
    parent: THREE.Object3D,
    heightAt: FeedbackHeightAt,
    x: number,
    z: number,
    kind: FeedbackKind,
    random: FeedbackRandom,
    reducedMotion: boolean,
  ): void {
    if (this.disposed || !shouldRenderFeedback(reducedMotion)) return;

    const profile = feedbackProfile(kind);
    const slot = this.acquireSlot();
    if (slot.active) this.deactivate(slot);

    const safeX = Number.isFinite(x) ? x : 0;
    const safeZ = Number.isFinite(z) ? z : 0;
    const terrainHeight = heightAt(safeX, safeZ);
    const safeHeight = Number.isFinite(terrainHeight) ? terrainHeight : 0;
    slot.root.position.set(safeX, safeHeight + 0.22, safeZ);
    slot.material.color.setHex(profile.color);
    slot.material.opacity = 0.95;
    slot.age = 0;
    slot.lifetime = profile.lifetime;
    slot.sequence = ++this.spawnSequence;
    slot.profile = profile;
    slot.active = true;

    for (let particleIndex = 0; particleIndex < MAX_FEEDBACK_PARTICLES; particleIndex++) {
      const particle = slot.particles[particleIndex]!;
      if (particleIndex >= profile.particleCount) {
        particle.mesh.visible = false;
        continue;
      }
      particle.mesh.visible = true;
      particle.mesh.position.set(
        (random() - 0.5) * profile.spread,
        random() * 0.12,
        (random() - 0.5) * profile.spread,
      );
      particle.mesh.rotation.set(0, 0, 0);
      particle.size = profile.scale * (0.65 + random() * 0.65);
      particle.mesh.scale.setScalar(particle.size);
      particle.velocity.set(
        (random() - 0.5) * 1.45,
        profile.rise + random() * 1.15,
        (random() - 0.5) * 1.45,
      );
      particle.spin.set(
        (random() - 0.5) * 8,
        (random() - 0.5) * 8,
        (random() - 0.5) * 8,
      );
    }

    parent.add(slot.root);
    slot.root.visible = true;
  }

  update(dt: number): void {
    if (this.disposed) return;
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += step;
      if (slot.age >= slot.lifetime) {
        this.deactivate(slot);
        continue;
      }
      const profile = slot.profile;
      if (!profile) continue;
      const progress = slot.age / slot.lifetime;
      slot.material.opacity = 0.95 * (1 - progress);
      for (let particleIndex = 0; particleIndex < profile.particleCount; particleIndex++) {
        const particle = slot.particles[particleIndex]!;
        particle.velocity.y -= profile.gravity * step;
        particle.mesh.position.addScaledVector(particle.velocity, step);
        particle.mesh.rotation.x += particle.spin.x * step;
        particle.mesh.rotation.y += particle.spin.y * step;
        particle.mesh.rotation.z += particle.spin.z * step;
        particle.mesh.scale.setScalar(particle.size * (1 - progress * 0.55));
      }
    }
  }

  clear(): void {
    if (this.disposed) return;
    for (const slot of this.slots) this.deactivate(slot);
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    for (const slot of this.slots) slot.material.dispose();
    this.geometry.dispose();
    this.disposed = true;
  }

  private acquireSlot(): FeedbackSlot {
    let oldest = this.slots[0]!;
    for (const slot of this.slots) {
      if (!slot.active) return slot;
      if (slot.sequence < oldest.sequence) oldest = slot;
    }
    return oldest;
  }

  private deactivate(slot: FeedbackSlot): void {
    slot.active = false;
    slot.age = 0;
    slot.lifetime = 0;
    slot.profile = null;
    slot.material.opacity = 0;
    slot.root.visible = false;
    slot.root.removeFromParent();
    for (const particle of slot.particles) particle.mesh.visible = false;
  }
}
