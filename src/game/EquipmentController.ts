import * as THREE from 'three';
import {
  EQUIPMENT_PROFILES,
  type EquipmentActionKind,
  type EquipmentActionTiming,
  type EquipmentKey,
} from '../content/equipment';
import { cloneModel } from './Assets';
import { disposeModelClone } from './ResourceDisposal';
import { buildAuthoredVisual } from './PresentationProps';
import type {
  CarryAnimationProfile,
  PlayerActionController,
} from './PlayerActionController';
import { SLOT_AXE, SLOT_SHOTGUN, SLOT_SHOVEL } from './InteractionSystem';

export type EquippedToolKey = Extract<EquipmentKey, 'axe' | 'bow_wooden' | 'shotgun_2' | 'shovel' | 'bucket'>;

export type EquipmentSelection = {
  toolbarSlot: number;
  toolSlotActive: boolean;
  weapon: 'shotgun' | 'bow' | 'axe';
};

export function equipmentProfileKeyFor(selection: EquipmentSelection): EquipmentKey | null {
  if (selection.toolSlotActive) return 'bucket';
  return equippedToolKeyFor(selection);
}

export function equippedToolKeyFor(selection: EquipmentSelection): EquippedToolKey | null {
  if (selection.toolSlotActive) return 'bucket';
  if (selection.toolbarSlot === SLOT_AXE) return 'axe';
  if (selection.toolbarSlot === SLOT_SHOVEL) return 'shovel';
  if (selection.toolbarSlot === SLOT_SHOTGUN && selection.weapon === 'bow') return 'bow_wooden';
  if (selection.toolbarSlot === SLOT_SHOTGUN && selection.weapon === 'shotgun') return 'shotgun_2';
  return null;
}

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
  private activeProfileKey: EquipmentKey | null = null;
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
  private readonly toolTargetPosition = new THREE.Vector3();
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
    return this.equippedToolKey ? EQUIPMENT_PROFILES[this.equippedToolKey].locomotion : null;
  }

  actionTimingFor(action: EquipmentActionKind): EquipmentActionTiming | null {
    if (!this.activeProfileKey) return null;
    return EQUIPMENT_PROFILES[this.activeProfileKey].timings[action] ?? null;
  }

  refresh(selection: EquipmentSelection): void {
    if (this.disposed) return;
    const desired = equippedToolKeyFor(selection);
    const desiredProfileKey = equipmentProfileKeyFor(selection);
    const mounted = desired
      ? this.equippedToolSocket?.parent === this.handBone
      : this.equippedToolSocket === null;
    if (desired === this.equippedToolKey && desiredProfileKey === this.activeProfileKey && mounted) return;
    this.clearEquippedTool();
    this.activeProfileKey = desiredProfileKey;
    if (!desired || !this.handBone) return;

    const profile = EQUIPMENT_PROFILES[desired];
    const { root } = profile.modelKey
      ? cloneModel(profile.modelKey)
      : { root: buildAuthoredVisual('bucket') };
    root.name = `equipped_${desired}`;
    const sourceScale = root.scale.x;
    // Held props pivot around a measured model-space grip. Keeping the
    // conversion on a child prevents import offsets from changing hand poses.
    root.position.set(
      -profile.rightHandGrip[0] * sourceScale,
      -profile.rightHandGrip[1] * sourceScale,
      -profile.rightHandGrip[2] * sourceScale,
    );
    const socket = new THREE.Group();
    socket.name = `tool_socket_${desired}`;
    socket.position.set(...profile.sockets.carry.position);
    socket.rotation.set(...profile.sockets.carry.rotation);
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
    this.activeProfileKey = null;
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

    const profile = EQUIPMENT_PROFILES[this.equippedToolKey];
    const oneShotActive = this.playerActions.isOneShotRunning;
    // The one-handed shooting clip is authored around the right arm.
    if (oneShotActive && this.equippedToolKey === 'shotgun_2') return;
    const grip = oneShotActive
      ? profile.actionLeftHandSupportGrip ?? profile.leftHandSupportGrip
      : profile.leftHandSupportGrip;
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
    const profile = EQUIPMENT_PROFILES[this.equippedToolKey];
    const actionActive = this.playerActions.isOneShotRunning;
    const socket = actionActive ? profile.sockets.action : profile.sockets.carry;
    this.toolTargetPosition.set(...socket.position);
    this.equippedToolSocket.position.lerp(
      this.toolTargetPosition,
      1 - Math.exp(-dt * 20),
    );
    const rotation = socket.rotation;
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
