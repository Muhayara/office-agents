import * as THREE from 'three';
import type { AgentFrame } from '@office/world';
import { CLOTH_PALETTE } from './config';
import { AGENT_UNIFORM } from './config';
import type { AgentAvatar, AvatarStepCtx } from './agentAvatar';
import type { EyeSource } from '../camera/eyeCam';

/**
 * Avatar v1 (chibi 0,69 m, sebelum F1) — hanya lewat flag `?rig=v1` untuk membandingkan versi lama
 * dan baru (rencana §3.2). Kode pose dipindah apa adanya dari `IsometricOfficeStage.tsx`.
 */
const SEATED_LEG = Math.PI / 2.2;

export interface V1Shared {
  bodyGeo: THREE.BufferGeometry; headGeo: THREE.BufferGeometry; hairGeo: THREE.BufferGeometry;
  armGeo: THREE.BufferGeometry; handGeo: THREE.BufferGeometry; docGeo: THREE.BufferGeometry;
  cupGeo: THREE.BufferGeometry; legGeo: THREE.BufferGeometry; beaconGeo: THREE.BufferGeometry;
  skinMat: THREE.MeshStandardMaterial; hairMat: THREE.MeshStandardMaterial; docMat: THREE.MeshStandardMaterial;
  cupMat: THREE.MeshStandardMaterial; legMat: THREE.MeshStandardMaterial; shirtMat: THREE.MeshStandardMaterial;
  dispose(): void;
}

export function createV1Shared(): V1Shared {
  const s: Omit<V1Shared, 'dispose'> = {
    bodyGeo: new THREE.CylinderGeometry(0.13, 0.15, 0.35, 12),
    headGeo: new THREE.SphereGeometry(0.12, 16, 16),
    hairGeo: new THREE.SphereGeometry(0.124, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    armGeo: new THREE.CylinderGeometry(0.028, 0.022, 0.18, 8),
    handGeo: new THREE.SphereGeometry(0.03, 8, 8),
    docGeo: new THREE.BoxGeometry(0.17, 0.006, 0.22),
    cupGeo: new THREE.CylinderGeometry(0.04, 0.032, 0.08, 8),
    legGeo: new THREE.CylinderGeometry(0.035, 0.028, 0.22, 8),
    beaconGeo: new THREE.OctahedronGeometry(0.14, 0),
    skinMat: new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 }),
    hairMat: new THREE.MeshStandardMaterial({ color: 0x172227, roughness: 0.9 }),
    docMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 }),
    cupMat: new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.25, metalness: 0.1 }),
    legMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
    // K7: seragam agen Navy Tech (identitas warna agen tetap di beacon, cincin, pendar monitor, bubble).
    shirtMat: new THREE.MeshStandardMaterial({ color: CLOTH_PALETTE[AGENT_UNIFORM.topColor], roughness: 0.62, metalness: 0.05 }),
  };
  return { ...s, dispose: () => Object.values(s).forEach((v) => v.dispose()) };
}

export class V1Avatar implements AgentAvatar {
  readonly version = 1 as const;
  readonly group = new THREE.Group();
  readonly beacon: THREE.Mesh;
  private lap: THREE.Group; private rap: THREE.Group;
  private llp: THREE.Group; private rlp: THREE.Group;
  private cup: THREE.Mesh; private doc: THREE.Mesh;
  private off: number;

  constructor(agentId: string, color: THREE.Color, idx: number, S: V1Shared) {
    this.off = idx * 0.7;
    const g = this.group;
    g.name = `Avatar_${agentId}`;
    g.userData = { agentId };
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, shadow = true) => {
      const o = new THREE.Mesh(geo, m);
      o.position.y = y;
      o.castShadow = shadow;
      return o;
    };
    g.add(mesh(S.bodyGeo, S.shirtMat, 0.28));
    g.add(mesh(S.headGeo, S.skinMat, 0.57));
    g.add(mesh(S.hairGeo, S.hairMat, 0.58, false));
    const arm = (x: number) => {
      const p = new THREE.Group();
      p.position.set(x, 0.40, 0);
      p.add(mesh(S.armGeo, S.shirtMat, -0.09, false));
      p.add(mesh(S.handGeo, S.skinMat, -0.18, false));
      g.add(p);
      return p;
    };
    this.lap = arm(-0.17);
    this.rap = arm(0.17);
    this.doc = mesh(S.docGeo, S.docMat, 0, false);
    this.doc.position.set(0, -0.2, 0.06);
    this.doc.rotation.x = -0.35;
    this.doc.visible = false;
    this.lap.add(this.doc);
    this.cup = mesh(S.cupGeo, S.cupMat, 0, false);
    this.cup.position.set(0, -0.20, 0.04);
    this.cup.visible = false;
    this.rap.add(this.cup);
    const leg = (x: number) => {
      const p = new THREE.Group();
      p.position.set(x, 0.12, 0);
      p.add(mesh(S.legGeo, S.legMat, -0.11));
      g.add(p);
      return p;
    };
    this.llp = leg(-0.07);
    this.rlp = leg(0.07);
    const beaconMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.85 });
    beaconMat.userData.baseColor = color.clone();
    this.beacon = new THREE.Mesh(S.beaconGeo, beaconMat);
    this.beacon.position.y = 0.92;
    g.add(this.beacon);
  }

  private legs(a: number) {
    this.llp.rotation.set(a, 0, 0);
    this.rlp.rotation.set(a, 0, 0);
  }

  apply(f: AgentFrame, ctx: AvatarStepCtx) {
    const g = this.group, t = ctx.t, off = this.off;
    g.visible = f.vis;
    this.k = ctx.seat ? f.k : 0;
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = f.rotY;
    this.cup.visible = f.cup;
    this.doc.visible = f.doc;
    this.beacon.position.y = 0.92 + Math.sin(t * 2 + off) * 0.04;
    this.beacon.rotation.y += 0.025;
    const status = f.status;
    const talking = f.bubbleT > 0;
    const L = this.lap.rotation, R = this.rap.rotation;
    switch (f.state) {
      case 'working': {
        this.legs(SEATED_LEG);
        const phase = t * 16 + off;
        if (status === 'waiting_approval') { R.set(-2.85, 0, -0.15 + Math.sin(t * 6) * 0.18); L.set(-0.95, 0, 0.18); }
        else if (status === 'error') { R.set(-2.45 + Math.sin(t * 7) * 0.08, 0, 0.55); L.set(-0.6, 0, 0.12); }
        else if (status === 'idle' || status === 'meeting' || status === 'offline') { L.set(-0.5 + Math.sin(t * 1.2 + off) * 0.04, 0, 0.12); R.set(-0.5 + Math.cos(t * 1.2 + off) * 0.04, 0, -0.12); }
        else { const sp = status === 'thinking' ? 0.55 : 1; L.set(-0.95 + Math.sin(phase * sp) * 0.12, 0, 0.18); R.set(-0.95 + Math.cos(phase * 1.2 * sp) * 0.12, 0, -0.18); }
        g.position.y = f.y + Math.sin(t * 2.5 + off) * 0.005;
        break;
      }
      case 'meeting_called': this.legs(SEATED_LEG); L.set(-0.5, 0, 0.12); R.set(-0.5, 0, -0.12); break;
      case 'meeting_sitting':
      case 'meeting_standing': this.legs(SEATED_LEG * f.k); L.set(-0.2, 0, 0.1); R.set(-0.2, 0, -0.1); break;
      case 'in_meeting':
        this.legs(SEATED_LEG);
        g.position.y += Math.sin(t * 2.5 + off) * 0.005;
        L.set(talking ? -0.6 + Math.sin(t * 4) * 0.2 : -0.45, 0, 0.1);
        R.set(talking ? -0.7 + Math.cos(t * 3.5) * 0.2 : -0.45, 0, -0.1);
        break;
      case 'visiting': this.legs(0); L.set(f.hasDoc ? -1.1 : -0.3, 0, 0.1); R.set(-0.5 + Math.sin(t * 5) * 0.25, 0, -0.15); break;
      case 'waiting_in_queue': this.legs(0); L.set(-0.2 + Math.sin(t * 1.5) * 0.05, 0, 0.08); R.set(-0.2 + Math.cos(t * 1.5) * 0.05, 0, -0.08); break;
      case 'brewing': this.legs(0); L.set(-0.8 + Math.sin(t * 3) * 0.18, 0, 0.25); R.set(-0.6 + Math.cos(t * 2.5) * 0.15, 0, -0.25); break;
      case 'away': break;
      case 'errand_stay': {
        const k = f.k;
        this.legs(SEATED_LEG * k);
        const ph = t + off;
        if (f.pose === 'inspect') { R.set(-2.1 + Math.sin(ph * 2.2) * 0.25, 0, -0.15); L.set(-0.7 + Math.cos(ph * 1.6) * 0.15, 0, 0.12); }
        else if (f.pose === 'type' && k >= 1) { L.set(-0.95 + Math.sin(ph * 16) * 0.12, 0, 0.18); R.set(-0.95 + Math.cos(ph * 19) * 0.12, 0, -0.18); }
        else if (f.pose === 'present') { R.set(talking ? -1.2 + Math.sin(ph * 3.6) * 0.35 : -0.3, 0, talking ? -0.3 : -0.1); L.set(talking ? -0.55 + Math.cos(ph * 2.4) * 0.2 : -0.25, 0, 0.12); }
        else if (f.pose === 'discuss' && k >= 1) { L.set(-0.85 + (talking ? Math.sin(ph * 2.6) * 0.08 : 0), 0, 0.2); R.set(talking ? -1.35 + Math.sin(ph * 4.2) * 0.35 : -0.85, 0, talking ? -0.35 : -0.2); }
        else { const tk = talking && k >= 1; L.set(tk ? -0.7 + Math.sin(ph * 4) * 0.25 : -0.4, 0, 0.14); R.set(tk ? -0.6 + Math.cos(ph * 3.5) * 0.25 : -0.4, 0, -0.14); }
        if (k >= 1) g.position.y += Math.sin(ph * 2.5) * 0.004;
        break;
      }
      case 'sipping_at_bar':
        this.legs(SEATED_LEG * f.k);
        if (f.k >= 1) {
          const sipCycle = (t * 0.8 + off) % (Math.PI * 2);
          R.set(Math.sin(sipCycle) > 0.55 ? -1.45 : -0.75, 0, -0.16);
          L.set(-0.85 + Math.sin(t * 1.3 + off) * 0.05, 0, 0.15);
          g.position.y += Math.sin(t * 2.5 + off) * 0.004;
        } else { R.set(-0.65, 0, -0.1); L.set(-0.2, 0, 0.1); }
        break;
      case 'drinking': {
        this.legs(SEATED_LEG);
        const sipCycle = (t * 0.8 + off) % (Math.PI * 2);
        if (Math.sin(sipCycle) > 0.6) { R.set(-1.45, 0, -0.15); L.set(-0.5, 0, 0.1); }
        else { R.set(-0.7, 0, -0.2); L.set(-0.95 + Math.sin(t * 14) * 0.12, 0, 0.18); }
        break;
      }
      case 'disposing': this.legs(0); R.set(-0.8 + Math.sin(f.t * 5) * 0.2, 0, -0.2); break;
      default: {
        if (f.gateWait) { this.legs(0); L.set(-0.15, 0, 0.08); R.set(-0.15, 0, -0.08); break; }
        const legSwing = Math.sin(f.t * 10) * 0.55;
        this.llp.rotation.set(legSwing, 0, 0);
        this.rlp.rotation.set(-legSwing, 0, 0);
        g.position.y = Math.abs(Math.sin(f.t * 10)) * 0.04;
        if (f.doc) { L.set(-1.0, 0, 0.1); R.set(-legSwing * 0.7, 0, -0.08); }
        else if (f.cup) { R.set(-0.65, 0, -0.1); L.set(legSwing * 0.7, 0, 0.08); }
        else { L.set(legSwing * 0.7, 0, 0.08); R.set(-legSwing * 0.7, 0, -0.08); }
        break;
      }
    }
  }

  /** v1 (chibi 0,69 m): mata diperkirakan di depan kepala; kepala disembunyikan di FPV. */
  eyeSource(): EyeSource {
    const head = this.group.children[1]!, hair = this.group.children[2]!;
    return {
      eye: (p, q) => {
        this.group.updateWorldMatrix(true, false);
        p.set(0, 0.6, 0.11).applyMatrix4(this.group.matrixWorld);
        this.group.getWorldQuaternion(q);
      },
      gait: () => null,
      setFirstPerson: (on) => { head.visible = !on; hair.visible = !on; this.beacon.visible = !on; },
      seated: () => this.k > 0.5,
      anchor: (out) => out.copy(this.group.position).setY(0),
    };
  }
  private k = 0;

  bubbleAnchor(out: THREE.Vector3) {
    out.setFromMatrixPosition(this.group.matrixWorld);
    out.y += 1.05;
    return out;
  }

  headWorld(out: THREE.Vector3) {
    if (!this.group.visible) return null;
    out.setFromMatrixPosition(this.group.matrixWorld);
    out.y += 0.57;
    return out;
  }

  dispose() {
    (this.beacon.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
