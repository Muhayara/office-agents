import * as THREE from 'three';

/**
 * F3 — Mata Agen (rencana-fpv-dan-kustomisasi-karakter.md §3.1, §4 F3).
 *
 * Kamera perspektif menempel di soket mata agen (sudah termasuk tolehan kepala dari `lookAt.ts`):
 * - Masuk: layar meredup 0,2 dtk, lalu kamera meluncur 0,8 dtk dari ±2,5 m di belakang-atas kepala ke mata.
 *   Keluar = kebalikannya. Ganti agen (←/→) = redup → luncur ke agen baru.
 * - Peredaman posisi eksponensial τ 0,08 dtk (duduk) / 0,12 dtk (berjalan) pada OFFSET mata terhadap titik akar
 *   avatar (bukan posisi dunia): peredaman posisi dunia membuat kamera tertinggal v·τ ≈ 26 cm di belakang mata
 *   saat agen berjalan 2,2 m/dtk — kamera masuk ke belakang kepala dan melihat lehernya sendiri. Rotasi τ 0,15 dtk dengan laju
 *   putar maksimum 12 rad/dtk (≤ 23° per frame pada 30 FPS) dan TANPA roll (anti mabuk gerak).
 * - Seret = lirik (yaw ±60°, pitch ±35°), kembali ke arah agen 1,5 dtk setelah dilepas.
 * - Head-bob ±2 cm naik-turun pada 2× frekuensi langkah + ±1 cm ke samping; mati bila `bob` false
 *   (toggle HUD "Goyang kepala" atau `prefers-reduced-motion`).
 * Tanpa DOM & tanpa WebGL: diuji di Vitest (`eyeCam.test.ts`).
 */

/** Sumber mata — kamera tidak bergantung pada detail rig (Rig v2 / v1). */
export interface EyeSource {
  /** Posisi & orientasi mata di dunia (+Z kepala = arah pandang), sudah termasuk tolehan kepala. */
  eye(outPos: THREE.Vector3, outQuat: THREE.Quaternion): void;
  /** Fase langkah 0..1 saat berjalan, null saat diam (dasar head-bob). */
  gait(): number | null;
  /** Sembunyikan kepala & aksesori agar tidak menembus near plane. */
  setFirstPerson(on: boolean): void;
  /** Sedang duduk (peredaman posisi lebih ketat). */
  seated(): boolean;
  /** Titik akar avatar di dunia (lantai di bawah badan) — bergerak mulus di lajur, acuan peredaman. */
  anchor(out: THREE.Vector3): THREE.Vector3;
}

export const EYE_FOV = 70;
export const EYE_NEAR = 0.05;
export const EYE_FAR = 60;
export const GLANCE_YAW_MAX = (60 * Math.PI) / 180;
export const GLANCE_PITCH_MAX = (35 * Math.PI) / 180;
export const GLANCE_RETURN_DELAY = 1.5;
export const DIM_S = 0.2;
export const GLIDE_S = 0.8;
export const POS_TAU_SEATED = 0.08;
export const POS_TAU_WALK = 0.12;
export const ROT_TAU = 0.15;
/** Laju putar kamera maksimum (rad/dtk): 12 → 22,9° per frame pada 30 FPS (kriteria F3 ≤ 25°). */
export const MAX_TURN_RATE = 12;
export const BOB_Y = 0.02;
export const BOB_X = 0.01;
const GLANCE_PER_PX = 0.0045;
/** Jarak mata → kamera di bawah ini: kepala agen disembunyikan (near plane 5 cm). */
const HIDE_HEAD_DIST = 0.35;
const START_BACK = 2.2;
const START_UP = 1.15;

export type EyePhase = 'off' | 'dimIn' | 'glideIn' | 'on' | 'glideOut' | 'dimOut' | 'undim';

export interface EyeHooks {
  /** Layar penuh redup: panggung mengganti kamera ke perspektif mata (FOV 70°, far 60 m). */
  onViewEnter(): void;
  /** Layar penuh redup saat keluar: panggung kembali ke kamera sebelumnya. */
  onViewLeave(agentId: string): void;
  /** Titik awal luncur (belakang-atas kepala) dipendekkan bila terhalang dinding buram. */
  clampStart?(eye: THREE.Vector3, start: THREE.Vector3): void;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const Y_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _right = new THREE.Vector3();

export class EyeCam {
  phase: EyePhase = 'off';
  agentId: string | null = null;
  /** Opasitas lapisan redup 0..1 (ditulis panggung ke DOM). */
  dim = 0;
  glanceYaw = 0;
  glancePitch = 0;
  /** Kecepatan kamera (dihaluskan) untuk kebijakan FPS. */
  linSpeed = 0;
  angSpeed = 0;
  /** Lompatan yaw terbesar per frame sejak masuk (derajat) — kriteria F3 (≤ 25°). */
  maxYawStepDeg = 0;
  frames = 0;

  private source: EyeSource | null = null;
  private next: { id: string; source: EyeSource } | null = null;
  private t = 0;
  private time = 0;
  private dragging = false;
  private releasedAt = -Infinity;
  private firstPerson = false;
  private bobAmp = 0;
  private readonly fromPos = new THREE.Vector3();
  private readonly fromQuat = new THREE.Quaternion();
  private readonly eyePos = new THREE.Vector3();
  private readonly eyeQuat = new THREE.Quaternion();
  private readonly tgtPos = new THREE.Vector3();
  /** Posisi mata teredam (tanpa bob); kamera = basePos + bobOff. */
  private readonly basePos = new THREE.Vector3();
  private readonly bobOff = new THREE.Vector3();
  /** Offset mata − akar yang diredam (tanpa lag translasi). */
  private readonly offset = new THREE.Vector3();
  private readonly anchorPos = new THREE.Vector3();
  private readonly tgtQuat = new THREE.Quaternion();
  private readonly prevPos = new THREE.Vector3();
  private readonly prevQuat = new THREE.Quaternion();
  private prevYaw = NaN;

  constructor(readonly camera: THREE.PerspectiveCamera, private hooks: EyeHooks) {}

  /** true antara `onViewEnter` dan `onViewLeave`: kamera perspektif mata yang dirender. */
  viewing = false;

  get active() { return this.phase !== 'off'; }

  /** Masuk ke mata agen `id`, atau pindah agen bila sudah di mode mata. */
  enter(id: string, source: EyeSource) {
    if (!this.viewing && (this.phase === 'off' || this.phase === 'undim' || this.phase === 'dimIn')) {
      this.next = { id, source };
      this.agentId = id;
      this.setPhase('dimIn');
      return;
    }
    if (id === this.agentId && this.phase !== 'glideOut' && this.phase !== 'dimOut') return;
    // Ganti agen dari dalam mode mata: redup → luncur ke agen baru (kamera tetap perspektif).
    this.next = { id, source };
    this.setPhase('dimIn');
  }

  /** Keluar ke kamera sebelumnya (luncur ke belakang-atas kepala → redup). */
  exit() {
    if (this.phase === 'off' || this.phase === 'glideOut' || this.phase === 'dimOut' || this.phase === 'undim') return;
    if (this.phase === 'dimIn' && !this.viewing) {
      // Belum sempat masuk: cukup batalkan redupnya.
      this.next = null;
      this.agentId = null;
      this.setPhase('undim');
      return;
    }
    this.next = null;
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.setPhase('glideOut');
  }

  /** Batalkan tanpa animasi (mis. Reset Kamera). Panggung sendiri yang mengganti kamera. */
  cancel() {
    this.source?.setFirstPerson(false);
    this.firstPerson = false;
    this.source = null;
    this.next = null;
    this.agentId = null;
    this.dim = 0;
    this.dragging = false;
    this.viewing = false;
    this.setPhase('off');
  }

  // ---- Lirik (seret) ----
  glanceStart() { if (this.phase === 'on') this.dragging = true; }
  glanceBy(dxPx: number, dyPx: number) {
    if (!this.dragging) return;
    this.glanceYaw = THREE.MathUtils.clamp(this.glanceYaw - dxPx * GLANCE_PER_PX, -GLANCE_YAW_MAX, GLANCE_YAW_MAX);
    this.glancePitch = THREE.MathUtils.clamp(this.glancePitch - dyPx * GLANCE_PER_PX, -GLANCE_PITCH_MAX, GLANCE_PITCH_MAX);
  }
  glanceEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    this.releasedAt = this.time;
  }
  get glancing() { return this.dragging; }

  /** Kamera dianggap aktif (Adaptive FPS 60) saat transisi, lirik, atau bergerak / berputar cukup cepat. */
  isMoving() {
    if (this.phase !== 'on') return this.phase !== 'off';
    if (this.dragging || this.glanceYaw !== 0 || this.glancePitch !== 0) return true;
    return this.linSpeed > 0.12 || this.angSpeed > 0.3;
  }

  update(dt: number, opts: { bob: boolean }) {
    this.time += dt;
    this.t += dt;
    const cam = this.camera;
    switch (this.phase) {
      case 'off':
        return;
      case 'dimIn': {
        this.dim = Math.min(1, this.t / DIM_S);
        if (this.viewing && this.source) this.follow(dt, opts.bob); // ganti agen: tetap ikut agen lama sambil meredup
        if (this.t < DIM_S) return;
        const nx = this.next;
        if (!nx) { this.setPhase('undim'); return; }
        this.next = null;
        if (!this.viewing) { this.viewing = true; this.hooks.onViewEnter(); }
        this.source?.setFirstPerson(false);
        this.firstPerson = false;
        this.source = nx.source;
        this.agentId = nx.id;
        // Titik awal: ±2,5 m di belakang-atas kepala, menatap kepala.
        this.readEye();
        this.startPose(this.fromPos, this.fromQuat);
        cam.position.copy(this.fromPos);
        cam.quaternion.copy(this.fromQuat);
        this.resetMotion();
        this.glanceYaw = 0; this.glancePitch = 0;
        this.setPhase('glideIn');
        return;
      }
      case 'glideIn': {
        this.dim = Math.max(0, 1 - this.t / DIM_S);
        this.readEye();
        this.targetPose(opts.bob, dt);
        const s = smooth(Math.min(1, this.t / GLIDE_S));
        this.basePos.lerpVectors(this.fromPos, this.tgtPos, s);
        cam.position.copy(this.basePos).addScaledVector(this.bobOff, s);
        cam.quaternion.slerpQuaternions(this.fromQuat, this.tgtQuat, s);
        this.updateHead();
        this.measure(dt);
        if (this.t >= GLIDE_S) {
          this.source?.anchor(this.anchorPos);
          this.offset.subVectors(this.tgtPos, this.anchorPos);
          this.setPhase('on');
        }
        return;
      }
      case 'on':
        this.dim = 0;
        this.follow(dt, opts.bob);
        return;
      case 'glideOut': {
        this.readEye();
        const end = _v;
        this.startPose(end, _q);
        const s = smooth(Math.min(1, this.t / GLIDE_S));
        cam.position.lerpVectors(this.fromPos, end, s);
        cam.quaternion.slerpQuaternions(this.fromQuat, _q, s);
        this.basePos.copy(cam.position);
        this.updateHead();
        this.measure(dt);
        if (this.t >= GLIDE_S) this.setPhase('dimOut');
        return;
      }
      case 'dimOut': {
        this.dim = Math.min(1, this.t / DIM_S);
        if (this.t < DIM_S) return;
        const id = this.agentId ?? '';
        this.source?.setFirstPerson(false);
        this.firstPerson = false;
        this.source = null;
        this.agentId = null;
        this.viewing = false;
        this.hooks.onViewLeave(id);
        this.setPhase('undim');
        return;
      }
      case 'undim':
        this.dim = Math.max(0, 1 - this.t / DIM_S);
        if (this.t >= DIM_S) { this.dim = 0; this.setPhase('off'); }
        return;
    }
  }

  // -------------------------------------------------------------------------
  private setPhase(p: EyePhase) {
    this.phase = p;
    this.t = 0;
  }

  private readEye() {
    this.source?.eye(this.eyePos, this.eyeQuat);
  }

  /** Pose belakang-atas kepala (dari arah hadap kepala di bidang datar), menatap kepala. */
  private startPose(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    _right.set(0, 0, 1).applyQuaternion(this.eyeQuat).setY(0);
    if (_right.lengthSq() < 1e-6) _right.set(0, 0, 1);
    _right.normalize();
    outPos.copy(this.eyePos).addScaledVector(_right, -START_BACK);
    outPos.y += START_UP;
    this.hooks.clampStart?.(this.eyePos, outPos);
    _m.lookAt(outPos, this.eyePos, THREE.Object3D.DEFAULT_UP);
    outQuat.setFromRotationMatrix(_m);
  }

  /** Target kamera = mata (tgtPos) + bob terpisah (bobOff), orientasi mata tanpa roll + lirik. */
  private targetPose(bob: boolean, dt: number) {
    this.tgtQuat.copy(this.eyeQuat).multiply(Y_FLIP);
    _e.setFromQuaternion(this.tgtQuat, 'YXZ');
    _e.z = 0;
    // Lirik kembali ke arah agen 1,5 dtk setelah dilepas.
    if (!this.dragging && this.time - this.releasedAt > GLANCE_RETURN_DELAY) {
      const k = 1 - Math.exp(-dt / 0.25);
      this.glanceYaw += (0 - this.glanceYaw) * k;
      this.glancePitch += (0 - this.glancePitch) * k;
      if (Math.abs(this.glanceYaw) < 1e-3) this.glanceYaw = 0;
      if (Math.abs(this.glancePitch) < 1e-3) this.glancePitch = 0;
    }
    _e.y += this.glanceYaw;
    _e.x = THREE.MathUtils.clamp(_e.x + this.glancePitch, -1.4, 1.4);
    this.tgtQuat.setFromEuler(_e);
    this.tgtPos.copy(this.eyePos);
    const g = this.source?.gait() ?? null;
    const want = bob && g !== null ? 1 : 0;
    this.bobAmp += (want - this.bobAmp) * Math.min(1, dt * 4);
    if (this.bobAmp < 1e-3) this.bobAmp = 0;
    this.bobOff.set(0, 0, 0);
    if (this.bobAmp > 0 && g !== null) {
      // Naik-turun sekali per langkah (2× frekuensi siklus), ayun samping sekali per siklus.
      // Ditambahkan SETELAH peredaman posisi (kalau tidak, τ 0,12 dtk memangkas amplitudonya ±60%).
      this.bobOff.y = BOB_Y * Math.cos(g * Math.PI * 4) * this.bobAmp;
      _right.set(1, 0, 0).applyQuaternion(this.tgtQuat).setY(0).normalize();
      this.bobOff.addScaledVector(_right, BOB_X * Math.sin(g * Math.PI * 2) * this.bobAmp);
    }
  }

  private follow(dt: number, bob: boolean) {
    this.readEye();
    this.targetPose(bob, dt);
    const cam = this.camera;
    const tau = this.source?.seated() ? POS_TAU_SEATED : POS_TAU_WALK;
    this.source?.anchor(this.anchorPos);
    _v.subVectors(this.tgtPos, this.anchorPos);
    this.offset.lerp(_v, 1 - Math.exp(-dt / tau));
    this.basePos.copy(this.anchorPos).add(this.offset);
    cam.position.copy(this.basePos).add(this.bobOff);
    const ang = cam.quaternion.angleTo(this.tgtQuat);
    if (ang > 1e-5) {
      const step = Math.min(ang * (1 - Math.exp(-dt / ROT_TAU)), MAX_TURN_RATE * dt);
      cam.quaternion.rotateTowards(this.tgtQuat, step);
    }
    // Tanpa roll walau ada sisa numerik.
    _e.setFromQuaternion(cam.quaternion, 'YXZ');
    if (Math.abs(_e.z) > 1e-6) { _e.z = 0; cam.quaternion.setFromEuler(_e); }
    this.updateHead();
    this.measure(dt);
  }

  private updateHead() {
    if (!this.source) return;
    const near = this.basePos.distanceTo(this.eyePos) < HIDE_HEAD_DIST;
    if (near !== this.firstPerson) {
      this.firstPerson = near;
      this.source.setFirstPerson(near);
    }
  }

  private resetMotion() {
    this.basePos.copy(this.camera.position);
    this.source?.anchor(this.anchorPos);
    this.offset.subVectors(this.camera.position, this.anchorPos);
    this.bobOff.set(0, 0, 0);
    this.prevPos.copy(this.camera.position);
    this.prevQuat.copy(this.camera.quaternion);
    this.prevYaw = NaN;
    this.linSpeed = 0;
    this.angSpeed = 0;
    this.maxYawStepDeg = 0;
    this.frames = 0;
  }

  private measure(dt: number) {
    if (dt <= 0) return;
    const cam = this.camera;
    const lin = cam.position.distanceTo(this.prevPos) / dt;
    const ang = cam.quaternion.angleTo(this.prevQuat) / dt;
    const k = 1 - Math.exp(-dt / 0.2);
    this.linSpeed += (lin - this.linSpeed) * k;
    this.angSpeed += (ang - this.angSpeed) * k;
    this.prevPos.copy(cam.position);
    this.prevQuat.copy(cam.quaternion);
    _e.setFromQuaternion(cam.quaternion, 'YXZ');
    if (!Number.isNaN(this.prevYaw) && this.phase === 'on') {
      let d = _e.y - this.prevYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.maxYawStepDeg = Math.max(this.maxYawStepDeg, Math.abs((d * 180) / Math.PI));
      this.frames++;
    }
    this.prevYaw = _e.y;
  }
}
