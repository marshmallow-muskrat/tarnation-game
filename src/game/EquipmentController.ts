import * as THREE from 'three';
import { cloneModel } from './Assets';
import { disposeModelClone } from './ResourceDisposal';
import type {
  CarryAnimationProfile,
  PlayerActionController,
} from './PlayerActionController';

export type EquippedToolKey = 'axe' | 'bow_wooden' | 'shotgun_2' | 'shovel';

export const SLOT_SHOTGUN = 0;
export const SLOT_SHOVEL = 1;
export const SLOT_AXE = 2;

export type EquipmentSelection = {
  toolbarSlot: number;
  toolSlotActive: boolean;
  weapon: 'shotgun' | 'bow' | 'axe';
};

export function equippedToolKeyFor(selection: EquipmentSelection): EquippedToolKey | null {
  if (selection.toolSlotActive) return null;
  if (selection.toolbarSlot === SLOT_AXE) return 'axe';
  if (selection.toolbarSlot === SLOT_SHOVEL) return 'shovel';
  if (selection.toolbarSlot === SLOT_SHOTGUN && selection.weapon === 'bow') return 'bow_wooden';
  if (selection.toolbarSlot === SLOT_SHOTGUN && selection.weapon === 'shotgun') return 'shotgun_2';
  return null;
}

type ToolProfile = CarryAnimationProfile & {
  scale: number;
  /** Authored model-space point placed exactly in the animated right fist. */
  grip: readonly [number, number, number];
  /** Transform from the animated right-hand socket into the tool's grip pose. */
  carryPosition: readonly [number, number, number];
  carryRotation: readonly [number, number, number];
  /** Optional clip-space correction blended in only during a one-shot action. */
  actionRotation?: readonly [number, number, number];
  /** Optional second-hand contact point in the model's local coordinates. */
  supportGrip?: readonly [number, number, number];
  /** Override the carry grip for a one-shot action such as digging. */
  actionSupportGrip?: readonly [number, number, number];
  /** How strongly the left arm follows the support grip, 0..1. */
  supportBlend?: number;
};

const TOOL_PROFILES: Record<EquippedToolKey, ToolProfile> = {
  axe: {
    scale: 1.15,
    grip: [0, 0.05, 0],
    // The source axe head is +Y. The old pose left +Y pointing at the ground;
    // the half-turn makes the head sit above the hands and the handle hang down.
    carryPosition: [0.14, -0.02, 0.02],
    carryRotation: [Math.PI, 0, -0.5],
    actionRotation: [0, Math.PI / 2, -0.55],
    runClip: 'runCarry',
    idleTime: 0.36,
    supportGrip: [0, 0.7, 0],
    actionSupportGrip: [0, 0.48, 0],
    supportBlend: 0.56,
  },
  bow_wooden: {
    scale: 0.76,
    grip: [0, 0, 0],
    carryPosition: [0, -0.02, 0.03],
    carryRotation: [0, 0, -0.25],
    runClip: 'walkCarry',
    idleTime: 0.3,
  },
  shotgun_2: {
    scale: 0.42,
    // Trigger-hand grip. Model-space +X runs from the stock into the barrel.
    grip: [0, -0.28, 0],
    // The source is an X-axis prop: the negative end is the stock and the
    // positive end is the barrel. Put the stock in the right hand and use the
    // fore-end as a real left-hand target instead of letting the gun float from
    // the wrist or hang upside down.
    carryPosition: [0.1, 0, 0],
    carryRotation: [0, 0, 0.5],
    actionRotation: [0, 0, Math.PI / 2],
    runClip: 'runCarry',
    idleTime: 0.32,
    supportGrip: [1.35, 0.08, 0],
    supportBlend: 0.58,
  },
  shovel: {
    // The shovel's source is vertical. Rotate it across the body for carry so
    // the upper shaft sits in the right hand and the lower shaft meets the
    // left hand; the action pose then returns it toward the soil.
    scale: 1.1,
    grip: [0, 1.1, 0],
    carryPosition: [0.1, -0.02, 0.02],
    carryRotation: [Math.PI, 0, 1.05],
    runClip: 'runCarry',
    idleTime: 0.3,
    supportGrip: [0, 0.02, 0],
    actionSupportGrip: [0, -0.12, 0],
    supportBlend: 0.68,
  },
};

/** Owns the held tool scene graph and the renderer-only support-hand solve. */
export class EquipmentController {
  private readonly playerRoot: THREE.Object3D;
  private readonly playerActions: PlayerActionController;
  private readonly handBone: THREE.Object3D | null;
  private readonly leftHandBone: THREE.Object3D | null;
  private readonly leftUpperArmBone: THREE.Object3D | null;
  private readonly leftLowerArmBone: THREE.Object3D | null;
  private equippedToolSocket: THREE.Group | null = null;
  private equippedToolRoot: THREE.Object3D | null = null;
  private equippedToolKey: EquippedToolKey | null = null;
  private disposed = false;

  private readonly supportTarget = new THREE.Vector3();
  private readonly supportJoint = new THREE.Vector3();
  private readonly supportEffector = new THREE.Vector3();
  private readonly supportToTarget = new THREE.Vector3();
  private readonly supportToEffector = new THREE.Vector3();
  private readonly supportAxis = new THREE.Vector3();
  private readonly supportWorldQuaternion = new THREE.Quaternion();
  private readonly supportParentQuaternion = new THREE.Quaternion();
  private readonly supportLocalQuaternion = new THREE.Quaternion();
  private readonly toolTargetEuler = new THREE.Euler();
  private readonly toolTargetQuaternion = new THREE.Quaternion();

  constructor(playerRoot: THREE.Object3D, playerActions: PlayerActionController) {
    this.playerRoot = playerRoot;
    this.playerActions = playerActions;
    this.handBone = this.findRightHand(playerRoot);
    this.leftHandBone = this.findPlayerBone(playerRoot, /^(fist|hand)[._ -]?l$|left.?hand|hand.?left/i);
    this.leftUpperArmBone = this.findPlayerBone(playerRoot, /^(upper.?arm|arm)[._ -]?l$|left.?upper.?arm/i);
    this.leftLowerArmBone = this.findPlayerBone(playerRoot, /^(lower.?arm|forearm|arm)[._ -]?l$|left.?forearm/i);
  }

  get hasEquippedTool(): boolean {
    return this.equippedToolRoot !== null;
  }

  get animationProfile(): CarryAnimationProfile | null {
    return this.equippedToolKey ? TOOL_PROFILES[this.equippedToolKey] : null;
  }

  refresh(selection: EquipmentSelection): void {
    if (this.disposed) return;
    const desired = equippedToolKeyFor(selection);
    if (desired === this.equippedToolKey && this.equippedToolSocket?.parent === this.handBone) return;
    this.clearEquippedTool();
    if (!desired || !this.handBone) return;

    const { root } = cloneModel(desired);
    root.name = `equipped_${desired}`;
    const profile = TOOL_PROFILES[desired];
    const sourceScale = root.scale.x;
    // Held props pivot around a measured model-space grip. Keeping the
    // conversion on a child prevents import offsets from changing hand poses.
    root.position.set(
      -profile.grip[0] * sourceScale,
      -profile.grip[1] * sourceScale,
      -profile.grip[2] * sourceScale,
    );
    const socket = new THREE.Group();
    socket.name = `tool_socket_${desired}`;
    socket.position.set(...profile.carryPosition);
    socket.rotation.set(...profile.carryRotation);
    socket.scale.setScalar(profile.scale);
    if (desired === 'axe' || desired === 'shovel') {
      // Draw the narrow dark props after the body, while retaining depth testing.
      root.renderOrder = 3;
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.renderOrder = 3;
      });
    }
    socket.add(root);
    this.handBone.add(socket);
    this.equippedToolSocket = socket;
    this.equippedToolRoot = root;
    this.equippedToolKey = desired;
  }

  update(dt: number): void {
    if (this.disposed) return;
    this.updateToolSocket(dt);
    this.applySupportHandPose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearEquippedTool();
  }

  private clearEquippedTool(): void {
    this.equippedToolSocket?.removeFromParent();
    if (this.equippedToolRoot) disposeModelClone(this.equippedToolRoot);
    this.equippedToolSocket = null;
    this.equippedToolRoot = null;
    this.equippedToolKey = null;
  }

  private findRightHand(root: THREE.Object3D): THREE.Object3D | null {
    let hand: THREE.Object3D | null = null;
    root.traverse((object) => {
      if (hand || !object.name) return;
      if (/^(fist|hand)[._ -]?r$|right.?hand|hand.?right/i.test(object.name)) hand = object;
    });
    return hand;
  }

  private findPlayerBone(root: THREE.Object3D, pattern: RegExp): THREE.Object3D | null {
    let bone: THREE.Object3D | null = null;
    root.traverse((object) => {
      if (bone || !(object instanceof THREE.Bone) || !object.name) return;
      if (pattern.test(object.name)) bone = object;
    });
    return bone;
  }

  private applySupportHandPose(): void {
    if (
      !this.equippedToolRoot ||
      !this.equippedToolKey ||
      !this.leftHandBone ||
      !this.leftUpperArmBone ||
      !this.leftLowerArmBone
    ) return;

    const profile = TOOL_PROFILES[this.equippedToolKey];
    const oneShotActive = this.playerActions.isOneShotRunning;
    // The one-handed shooting clip is authored around the right arm.
    if (oneShotActive && this.equippedToolKey === 'shotgun_2') return;
    const grip = oneShotActive ? profile.actionSupportGrip : profile.supportGrip;
    if (!grip) return;

    this.playerRoot.updateMatrixWorld(true);
    this.equippedToolRoot.updateMatrixWorld(true);
    this.supportTarget.set(...grip);
    this.equippedToolRoot.localToWorld(this.supportTarget);

    const blend = (profile.supportBlend ?? 0.7) * (oneShotActive ? 0.58 : 1);
    for (let i = 0; i < 2; i++) {
      this.rotateArmJointToward(this.leftLowerArmBone, blend);
      this.rotateArmJointToward(this.leftUpperArmBone, blend * 0.9);
    }
  }

  private updateToolSocket(dt: number): void {
    if (!this.equippedToolSocket || !this.equippedToolKey) return;
    const profile = TOOL_PROFILES[this.equippedToolKey];
    const actionActive = this.playerActions.isOneShotRunning;
    const rotation = actionActive
      ? profile.actionRotation ?? profile.carryRotation
      : profile.carryRotation;
    this.toolTargetEuler.set(...rotation);
    this.toolTargetQuaternion.setFromEuler(this.toolTargetEuler);
    this.equippedToolSocket.quaternion.slerp(
      this.toolTargetQuaternion,
      1 - Math.exp(-dt * 20),
    );
  }

  private rotateArmJointToward(joint: THREE.Object3D, blend: number): void {
    if (!this.leftHandBone) return;
    joint.updateMatrixWorld(true);
    this.leftHandBone.updateMatrixWorld(true);
    joint.getWorldPosition(this.supportJoint);
    this.leftHandBone.getWorldPosition(this.supportEffector);
    this.supportToEffector.subVectors(this.supportEffector, this.supportJoint);
    this.supportToTarget.subVectors(this.supportTarget, this.supportJoint);
    const effectorLength = this.supportToEffector.length();
    const targetLength = this.supportToTarget.length();
    if (effectorLength < 0.0001 || targetLength < 0.0001) return;

    const cosine = THREE.MathUtils.clamp(
      this.supportToEffector.dot(this.supportToTarget) / (effectorLength * targetLength),
      -1,
      1,
    );
    const angle = Math.acos(cosine);
    this.supportAxis.crossVectors(this.supportToEffector, this.supportToTarget);
    if (this.supportAxis.lengthSq() < 0.000001 || angle < 0.002) return;
    this.supportAxis.normalize();

    this.supportWorldQuaternion.setFromAxisAngle(
      this.supportAxis,
      Math.min(angle, 0.85) * THREE.MathUtils.clamp(blend, 0, 1),
    );
    joint.getWorldQuaternion(this.supportLocalQuaternion);
    this.supportLocalQuaternion.premultiply(this.supportWorldQuaternion);
    if (joint.parent) {
      joint.parent.getWorldQuaternion(this.supportParentQuaternion);
      this.supportParentQuaternion.invert();
      this.supportLocalQuaternion.premultiply(this.supportParentQuaternion);
    }
    joint.quaternion.copy(this.supportLocalQuaternion);
    joint.updateMatrixWorld(true);
  }
}
