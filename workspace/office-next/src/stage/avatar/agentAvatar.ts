import * as THREE from 'three';
import { isWalking, type AgentFrame } from '@office/world';
import type { EyeSource } from '../camera/eyeCam';
import { agentAvatarConfig } from './agentLooks';
import { AGENT_UNIFORM, BODY } from './config';
import { LookController, type LookTarget } from './lookAt';
import { approachAngle, poseHead, poseSit, poseStand, poseWalk, POLE, rootPos, solveArm, STAND_HIP, wrapAngle, wrist, type Side } from './poses';
import { AvatarRig, type AvatarShared } from './rig';
import type { SeatCalib } from './seats';

/** Data per frame dari panggung (dunia → pose). */
export interface AvatarStepCtx {
  t: number;
  dt: number;
  /** Kalibrasi dudukan yang sedang dipakai (null = tidak duduk). */
  seat: SeatCalib | null;
  look: LookTarget;
}

/** Kontrak avatar yang dipakai panggung (v2 default, v1 lewat `?rig=v1`). */
export interface AgentAvatar {
  readonly version: 1 | 2;
  /** Titik asal di lantai (v2) / di titik duduk (v1); `userData.agentId` untuk klik. */
  readonly group: THREE.Group;
  readonly beacon: THREE.Mesh;
  apply(f: AgentFrame, ctx: AvatarStepCtx): void;
  /** Titik dunia untuk speech bubble (di atas kepala). */
  bubbleAnchor(out: THREE.Vector3): THREE.Vector3;
  /** Posisi kepala (setinggi mata) di dunia, null bila tidak terlihat. */
  headWorld(out: THREE.Vector3): THREE.Vector3 | null;
  /** F3: sumber kamera Mata Agen. */
  eyeSource(): EyeSource;
  dispose(): void;
}

/** Laju putar badan maksimum (rencana §3.2). */
export const TURN_RATE = 7;
const WALK_RATE = 10; // rad/dtk, sama dengan v1 (langkah ±0,69 m pada WALK_SPEED 2,2 m/dtk)

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _n = new THREE.Vector3();
const _tL = new THREE.Vector3();
const _tR = new THREE.Vector3();
const _aL = new THREE.Vector3();
const _aR = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.55);

export interface SeatMetrics {
  gap: number;
  handErr: number;
  soleL: THREE.Vector3; soleR: THREE.Vector3;
  kneeL: THREE.Vector3; kneeR: THREE.Vector3;
  /** Sendi pinggul & pergelangan kaki (dunia) — sumbu paha/betis untuk cek tembus perabot. */
  hipL: THREE.Vector3; hipR: THREE.Vector3;
  ankleL: THREE.Vector3; ankleR: THREE.Vector3;
  pelvisBottom: number;
  eye: THREE.Vector3;
}

export class V2Avatar implements AgentAvatar {
  readonly version = 2 as const;
  readonly rig: AvatarRig;
  readonly group: THREE.Group;
  readonly beacon: THREE.Mesh;
  readonly cup: THREE.Mesh;
  readonly doc: THREE.Mesh;
  readonly look = new LookController();
  private yaw = NaN;
  private kDisp = 0;
  private lastSeat: SeatCalib | null = null;
  private wasVis = false;
  private lastX = 0;
  private lastZ = 0;
  private walkPhase = 0;
  private walking = false;
  private readonly off: number;
  /** Galat jangkauan tangan terakhir (m) — dipakai matriks dudukan. */
  handErr = 0;
  footGap = 0;

  constructor(agentId: string, name: string, color: THREE.Color, idx: number, shared: AvatarShared) {
    this.off = idx * 0.7;
    this.rig = new AvatarRig(agentAvatarConfig(agentId, name), { trim: AGENT_UNIFORM.trim, idColor: color.getHex() }, shared);
    this.group = this.rig.group;
    this.group.name = `Avatar_${agentId}`;
    this.group.userData = { agentId };
    const bm = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.85 });
    bm.userData.baseColor = color.clone();
    this.beacon = new THREE.Mesh(shared.beaconGeo, bm);
    this.beacon.name = 'Beacon';
    this.beacon.position.y = 1.98;
    this.group.add(this.beacon);
    this.cup = new THREE.Mesh(shared.cupGeo, shared.cupMat);
    this.cup.position.set(0, 0.02, 0);
    this.cup.visible = false;
    this.rig.socketR.add(this.cup);
    this.doc = new THREE.Mesh(shared.docGeo, shared.docMat);
    this.doc.position.set(0, 0, 0.05);
    this.doc.visible = false;
    this.rig.socketL.add(this.doc);
  }

  // -------------------------------------------------------------------------
  apply(f: AgentFrame, ctx: AvatarStepCtx) {
    const g = this.group;
    g.visible = f.vis;
    this.cup.visible = f.cup;
    this.doc.visible = f.doc;
    if (!f.vis) { this.wasVis = false; this.walking = false; return; }
    const jump = !this.wasVis || Math.hypot(f.x - this.lastX, f.z - this.lastZ) > 0.9;
    this.wasVis = true;
    this.lastX = f.x; this.lastZ = f.z;
    g.position.set(f.x, 0, f.z);
    this.yaw = jump || Number.isNaN(this.yaw) ? f.rotY : approachAngle(this.yaw, f.rotY, TURN_RATE * ctx.dt);
    g.rotation.y = this.yaw;
    g.updateWorldMatrix(true, false);

    // Bobot duduk: halus walau dunia melompat (duduk di meja langsung k = 1).
    if (ctx.seat) this.lastSeat = ctx.seat;
    const kTarget = ctx.seat ? f.k : 0;
    if (jump) this.kDisp = kTarget;
    else {
      const rate = (kTarget > this.kDisp ? 2.8 : 4) * ctx.dt;
      this.kDisp = Math.abs(kTarget - this.kDisp) <= rate ? kTarget : this.kDisp + Math.sign(kTarget - this.kDisp) * rate;
    }
    const k = this.kDisp;
    const seat = this.lastSeat;
    const r = this.rig;
    const t = ctx.t, off = this.off;
    const walking = isWalking(f.state) && !f.gateWait;
    this.walking = walking && this.kDisp <= 0.001;
    r.resetPose();

    // ---- Badan & kaki ----
    this.footGap = 0;
    if (k > 0.001 && seat) {
      this.footGap = poseSit(r, this.sitParams(seat), k);
    } else if (walking) {
      this.walkPhase += ctx.dt * WALK_RATE;
      poseWalk(r, this.walkPhase, 1);
    } else {
      poseStand(r, Math.sin(t * 1.6 + off) * 0.004);
    }

    // ---- Kepala ----
    this.applyLook(f, ctx);

    // ---- Lengan ----
    this.handErr = this.applyArms(f, seat, k, t, walking);

    // ---- Beacon, soket cangkir/dokumen ----
    rootPos(r, 'head', _v);
    this.beacon.position.y = _v.y + 0.47 + Math.sin(t * 2 + off) * 0.04;
    this.beacon.rotation.y += 0.025;
    if (f.cup || f.doc) {
      g.updateMatrixWorld(true);
      g.getWorldQuaternion(_q2);
      if (f.cup) {
        r.bones.handR.getWorldQuaternion(_q);
        r.socketR.quaternion.copy(_q.invert().multiply(_q2));
      }
      if (f.doc) {
        r.bones.handL.getWorldQuaternion(_q);
        r.socketL.quaternion.copy(_q.invert().multiply(_q2).multiply(_tilt));
      }
    }
  }

  private sitParams(seat: SeatCalib) {
    const s = this.rig.scale;
    return {
      top: seat.top / s,
      hipFwd: seat.hipFwd,
      lean: seat.lean,
      footL: { ...seat.footL, y: seat.footL.y / s },
      footR: { ...seat.footR, y: seat.footR.y / s },
    };
  }

  private applyLook(f: AgentFrame, ctx: AvatarStepCtx) {
    const r = this.rig;
    const lean = r.bones.spine.rotation.x + r.bones.chest.rotation.x;
    let yaw: number, pitch: number;
    if (ctx.look.kind === 'point') {
      _w.copy(ctx.look.p);
      this.group.worldToLocal(_w);
      rootPos(r, 'neck', _n);
      _n.y += 0.16;
      yaw = Math.atan2(_w.x - _n.x, _w.z - _n.z);
      pitch = Math.atan2(_n.y - _w.y, Math.hypot(_w.x - _n.x, _w.z - _n.z));
      if (Math.abs(yaw) > 2.2) { yaw = 0; pitch = 0.05; } // di belakang punggung: jangan memutar leher
    } else {
      yaw = Number.isNaN(ctx.look.yaw) ? wrapAngle(f.rotY - this.yaw) : ctx.look.yaw;
      pitch = ctx.look.pitch;
    }
    this.look.update(yaw, pitch - lean, ctx.dt);
    poseHead(r, this.look.yaw, this.look.pitch);
  }

  /** Target pergelangan per keadaan (ruang akar). Mengembalikan galat jangkauan terbesar. */
  private applyArms(f: AgentFrame, seat: SeatCalib | null, k: number, t: number, walking: boolean): number {
    const r = this.rig;
    const off = this.off;
    const talking = f.bubbleT > 0;
    const restL = this.rest('L', _tL), restR = this.rest('R', _tR);
    const L = _aL.copy(restL), R = _aR.copy(restR);
    let poleL: THREE.Vector3 = POLE.L, poleR: THREE.Vector3 = POLE.R;
    let ik = true;
    const work = (side: Side, dFwd = 0, dY = 0, out: THREE.Vector3) => {
      const w = seat?.work;
      const s = side === 'L' ? 1 : -1;
      if (!w) return out.set(s * 0.13, (seat?.top ?? 0.45) / r.scale + 0.21, (seat?.hipFwd ?? 0) + 0.24);
      return out.set(s * 0.13, w.y / r.scale + dY, w.fwd + dFwd);
    };
    const lap = (side: Side, out: THREE.Vector3) => out.set((side === 'L' ? 1 : -1) * 0.12, (seat?.top ?? 0.45) / r.scale + 0.2, (seat?.hipFwd ?? 0) + 0.25);
    const gesture = (side: Side, y: number, fwd: number, amp = 1, out: THREE.Vector3) => {
      const s = side === 'L' ? 1 : -1;
      return out.set(s * (0.14 + Math.sin(t * 2.3 + off) * 0.04 * amp), y + Math.sin(t * 4.1 + off + s) * 0.06 * amp, fwd + Math.cos(t * 3.2 + off) * 0.05 * amp);
    };
    // target = rest + (target − rest)·k (tanpa alias sumber/tujuan).
    const seatedBlend = (side: Side, target: THREE.Vector3) => target.sub(side === 'L' ? restL : restR).multiplyScalar(k).add(side === 'L' ? restL : restR);
    const typing = (speed: number) => {
      const ph = t * 16 * speed + off;
      work('L', Math.sin(ph) * 0.012, Math.max(0, Math.sin(ph)) * 0.014, L);
      work('R', Math.cos(ph * 1.2) * 0.012, Math.max(0, Math.cos(ph * 1.2)) * 0.014, R);
      wrist(r, 'L', 0.25); wrist(r, 'R', 0.25);
    };
    const sitTop = (seat?.top ?? 0.45) / r.scale;

    switch (f.state) {
      case 'working': {
        const st = f.status;
        if (st === 'waiting_approval') {
          // Angkat tangan memanggil CEO, tangan kiri tetap di keyboard.
          rootPos(r, 'shoulderR', R);
          R.add(_v.set(-0.05 - Math.sin(t * 6) * 0.06, 0.5, 0.1));
          poleR = POLE.upR;
          work('L', 0, 0, L);
        } else if (st === 'error') {
          // Bingung: garuk kepala.
          rootPos(r, 'head', R);
          R.add(_v.set(-0.11, 0.07 + Math.sin(t * 7) * 0.015, -0.02));
          poleR = POLE.upR;
          work('L', -0.08, 0, L);
        } else if (st === 'idle' || st === 'meeting' || st === 'offline') {
          work('L', -0.07 + Math.sin(t * 1.2 + off) * 0.01, -0.01, L);
          work('R', -0.07 + Math.cos(t * 1.2 + off) * 0.01, -0.01, R);
        } else {
          typing(st === 'thinking' ? 0.55 : 1);
        }
        seatedBlend('L', L); seatedBlend('R', R);
        break;
      }
      case 'meeting_called':
        work('L', -0.08, 0, L); work('R', -0.08, 0, R);
        seatedBlend('L', L); seatedBlend('R', R);
        break;
      case 'meeting_sitting':
      case 'meeting_standing':
        lap('L', L); lap('R', R);
        seatedBlend('L', L); seatedBlend('R', R);
        break;
      case 'in_meeting':
        lap('L', L);
        if (talking) gesture('R', sitTop + 0.5, 0.36, 1, R); else lap('R', R);
        break;
      case 'visiting':
        if (f.hasDoc || f.doc) L.set(0.11, 1.1, 0.3);
        if (talking) gesture('R', 1.12, 0.3, 1, R);
        break;
      case 'waiting_in_queue':
        L.x += Math.sin(t * 1.5) * 0.01; R.x -= Math.cos(t * 1.5) * 0.01;
        break;
      case 'brewing':
        L.set(0.14, 1.03 + Math.sin(t * 3) * 0.03, 0.37 + Math.cos(t * 2.1) * 0.02);
        R.set(-0.15, 1.05 + Math.cos(t * 2.5) * 0.04, 0.38);
        break;
      case 'disposing':
        R.set(-0.14, 0.92 + Math.sin(f.t * 5) * 0.05, 0.42);
        break;
      case 'away':
        break;
      case 'errand_stay': {
        switch (f.pose) {
          case 'inspect':
            R.set(-0.17, 1.52 + Math.sin((t + off) * 2.2) * 0.08, 0.46);
            L.set(0.1, 1.02 + Math.cos((t + off) * 1.6) * 0.03, 0.22);
            break;
          case 'type':
            if (k >= 0.999) typing(1); else { work('L', -0.06, 0, L); work('R', -0.06, 0, R); }
            break;
          case 'present':
            if (talking) { gesture('L', 1.12, 0.33, 0.8, L); gesture('R', 1.18, 0.35, 1.2, R); }
            break;
          case 'discuss':
            work('L', -0.04, 0, L);
            if (talking && k >= 1) gesture('R', sitTop + 0.52, 0.38, 1, R); else work('R', -0.04, 0, R);
            break;
          default:
            lap('L', L);
            if (talking && k >= 1) gesture('R', sitTop + 0.45, 0.33, 0.8, R); else lap('R', R);
        }
        if (f.pose !== 'inspect' && f.pose !== 'present') { seatedBlend('L', L); seatedBlend('R', R); }
        break;
      }
      case 'sipping_at_bar': {
        work('L', 0, 0, L);
        const sip = Math.sin((t * 0.8 + off) % (Math.PI * 2)) > 0.55;
        if (sip && k >= 1) { rootPos(r, 'head', R); R.add(_v.set(-0.03, -0.02, 0.14)); poleR = POLE.upR; }
        else work('R', -0.02, 0.06, R);
        seatedBlend('L', L); seatedBlend('R', R);
        break;
      }
      case 'drinking': {
        const sip = Math.sin((t * 0.8 + off) % (Math.PI * 2)) > 0.6;
        if (sip) { rootPos(r, 'head', R); R.add(_v.set(-0.03, -0.02, 0.14)); poleR = POLE.upR; work('L', -0.05, 0, L); }
        else { typing(0.5); work('R', -0.08, 0.04, R); }
        seatedBlend('L', L); seatedBlend('R', R);
        break;
      }
      default:
        // Semua walk_*: lengan berayun (FK dari poseWalk), kecuali membawa dokumen / cangkir.
        if (walking && k <= 0.001) {
          ik = false;
          if (f.doc) { solveArm(r, 'L', L.set(0.1, 1.07 + Math.sin(this.walkPhase * 2) * 0.01, 0.3), POLE.L); }
          if (f.cup) { solveArm(r, 'R', R.set(-0.15, 1.02 + Math.sin(this.walkPhase * 2) * 0.01, 0.3), POLE.R); }
        }
        break;
    }
    if (!ik) return 0;
    return Math.max(solveArm(r, 'L', L, poleL), solveArm(r, 'R', R, poleR));
  }

  /** Lengan tergantung santai di sisi badan (target pergelangan). */
  private rest(side: Side, out: THREE.Vector3) {
    rootPos(this.rig, side === 'L' ? 'shoulderL' : 'shoulderR', out);
    return out.add(_v.set(side === 'L' ? 0.035 : -0.035, -0.515, 0.05));
  }

  /**
   * F3: soket mata (1,58 m, ikut tolehan kepala). Saat berjalan, ayunan naik-turun pinggul (pijakan kaki) dikurangi
   * supaya kamera tidak berguncang; head-bob yang lembut ditambahkan kamera sendiri (bisa dimatikan).
   */
  eyeSource(): EyeSource {
    return {
      eye: (p, q) => {
        this.rig.eye.getWorldPosition(p);
        this.rig.eye.getWorldQuaternion(q);
        if (this.walking) p.y -= (this.rig.bones.hips.position.y - (STAND_HIP + BODY.pelvisAbove)) * this.rig.scale;
      },
      gait: () => this.gait(),
      setFirstPerson: (on) => {
        this.rig.setFirstPerson(on);
        this.beacon.visible = !on;
      },
      seated: () => this.kDisp > 0.5,
      anchor: (out) => out.copy(this.group.position),
    };
  }

  /** Fase langkah 0..1 saat berjalan, null saat diam (dasar head-bob F3, `EyeSource.gait`). */
  gait(): number | null {
    return this.walking ? (this.walkPhase / (Math.PI * 2)) % 1 : null;
  }

  bubbleAnchor(out: THREE.Vector3) {
    this.rig.bones.head.getWorldPosition(out);
    out.y += 0.46 * this.rig.scale;
    return out;
  }

  headWorld(out: THREE.Vector3) {
    if (!this.group.visible) return null;
    this.rig.bones.head.getWorldPosition(out);
    out.y += 0.07 * this.rig.scale;
    return out;
  }

  /**
   * Matriks dudukan (dev): pose duduk penuh mengetik di (x, z, rotY), lalu ukur telapak, lutut, panggul,
   * dan galat jangkauan tangan di dunia. Tidak mengubah keadaan tolehan/badan berikutnya (lompat = true).
   */
  measureSeat(seat: SeatCalib, x: number, z: number, rotY: number, f: AgentFrame): SeatMetrics {
    this.wasVis = false;
    this.apply({ ...f, x, z, rotY, vis: true, k: 1, state: seat.kind === 'board' ? 'in_meeting' : seat.kind === 'stool' ? 'sipping_at_bar' : seat.work ? 'working' : 'errand_stay', pose: seat.work ? 'type' : 'lounge', status: 'working', bubbleT: 0, cup: false, doc: false },
      { t: 0, dt: 0, seat, look: { kind: 'dir', yaw: 0, pitch: seat.screenPitch } });
    const r = this.rig;
    this.group.updateMatrixWorld(true);
    const sole = (b: 'ankleL' | 'ankleR') => r.bones[b].localToWorld(new THREE.Vector3(0, -0.07, 0.05));
    const knee = (b: 'kneeL' | 'kneeR') => r.bones[b].localToWorld(new THREE.Vector3(0, 0, 0));
    const pelvis = r.bones.hips.localToWorld(new THREE.Vector3(0, -0.13, 0));
    return {
      gap: this.footGap, handErr: this.handErr,
      soleL: sole('ankleL'), soleR: sole('ankleR'), kneeL: knee('kneeL'), kneeR: knee('kneeR'),
      hipL: r.bones.hipL.getWorldPosition(new THREE.Vector3()), hipR: r.bones.hipR.getWorldPosition(new THREE.Vector3()),
      ankleL: r.bones.ankleL.getWorldPosition(new THREE.Vector3()), ankleR: r.bones.ankleR.getWorldPosition(new THREE.Vector3()),
      pelvisBottom: pelvis.y,
      eye: r.eye.getWorldPosition(new THREE.Vector3()),
    };
  }

  dispose() {
    (this.beacon.material as THREE.Material).dispose();
    this.rig.dispose();
  }
}
