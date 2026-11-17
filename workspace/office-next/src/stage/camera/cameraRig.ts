import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Sistem Dual Kamera (plan §3):
 * - Mode 1 `iso`: OrthographicCamera + OrbitControls (bawaan, memandang dari Tenggara).
 *   Posisi "home" dibingkai otomatis dari kotak gedung lewat `setHomeBox()`.
 * - Mode 2 `free`: PerspectiveCamera FOV 50°, seret mouse untuk melihat,
 *   W/A/S/D maju-kiri-mundur-kanan, Q naik, E turun, Shift = cepat, roda mouse = maju/mundur.
 *   Free Cam mulai melayang di atas dinding (tampilan rumah boneka); turun di bawah tinggi
 *   dinding di dalam gedung = mode jalan kaki dengan semua dinding utuh (lihat WallFader).
 */
export type CameraMode = 'iso' | 'free';

const ISO_VIEW_HEIGHT = 15;
const ISO_OFFSET = new THREE.Vector3(18, 12.95, 20);
const ISO_DEFAULT_TARGET = new THREE.Vector3(0, 1.05, 0);
/** Auto-pan tidak menimpa kamera bila CEO menggesernya dalam rentang ini. */
const MANUAL_GRACE_MS = 8000;
const FREE_SPEED = 3.5;
/** Mencakup seluruh Jalan Utama 38 m (dunia X -7..31) dengan ruang gerak di sekelilingnya. */
const FREE_BOUNDS = { minX: -12, maxX: 36, minY: 0.3, maxY: 16, minZ: -10, maxZ: 20 };
/** Ketinggian awal Free Cam: di atas dinding 3,2 m supaya isi ruangan langsung terlihat. */
const FREE_START_HEIGHT = 6.0;
const FREE_START_DISTANCE = 11;
/** Ruang kosong di tepi layar saat membingkai gedung (1.06 = 6%). */
const HOME_MARGIN = 1.06;

interface Tween {
  t: number;
  dur: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromYaw?: number;
  toYaw?: number;
  fromPitch?: number;
  toPitch?: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export class CameraRig {
  readonly iso: THREE.OrthographicCamera;
  readonly persp: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  mode: CameraMode = 'iso';
  onModeChange?: (mode: CameraMode) => void;

  private dom: HTMLElement;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastManualAt = -Infinity;
  /** true sampai CEO atau sistem menggerakkan kamera: bingkai home masih boleh disesuaikan. */
  private pristine = true;
  private aspect: number;
  private homeTarget = ISO_DEFAULT_TARGET.clone();
  /** Setengah lebar & tinggi gedung di layar (satuan dunia) untuk menghitung zoom home. */
  private homeHalf: { w: number; h: number } | null = null;
  private tween: Tween | null = null;
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();

  constructor(dom: HTMLElement, aspect: number) {
    this.dom = dom;
    this.aspect = aspect;
    const vh = ISO_VIEW_HEIGHT;
    this.iso = new THREE.OrthographicCamera((-vh * aspect) / 2, (vh * aspect) / 2, vh / 2, -vh / 2, 0.1, 1000);
    this.iso.position.copy(ISO_DEFAULT_TARGET).add(ISO_OFFSET);
    this.iso.lookAt(ISO_DEFAULT_TARGET);

    this.persp = new THREE.PerspectiveCamera(50, aspect, 0.05, 250);
    this.persp.rotation.order = 'YXZ';

    this.controls = new OrbitControls(this.iso, dom);
    this.controls.target.copy(ISO_DEFAULT_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 3.0;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.update();
    this.controls.addEventListener('start', this.onControlsStart);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  active(): THREE.Camera {
    return this.mode === 'iso' ? this.iso : this.persp;
  }

  setMode(mode: CameraMode) {
    if (mode === this.mode) return;
    this.tween = null;
    if (mode === 'free') {
      // Mulai dari sudut pandang isometrik saat ini, turun ke ketinggian manusia.
      const target = this.controls.target.clone();
      const dir = this.iso.position.clone().sub(target).setY(0).normalize();
      this.persp.position.copy(target).addScaledVector(dir, FREE_START_DISTANCE).setY(FREE_START_HEIGHT);
      this.clampFree();
      this.lookAt(target.clone().setY(1.0));
    }
    this.pristine = false;
    this.mode = mode;
    this.controls.enabled = mode === 'iso';
    this.keys.clear();
    this.onModeChange?.(mode);
  }

  toggle() {
    this.setMode(this.mode === 'iso' ? 'free' : 'iso');
  }

  /** Geser fokus ke titik dunia. `auto` = dipicu sistem (dibatalkan bila CEO baru menggeser kamera). */
  focus(point: THREE.Vector3, opts: { auto?: boolean; dur?: number } = {}) {
    if (opts.auto && (this.mode !== 'iso' || performance.now() - this.lastManualAt < MANUAL_GRACE_MS)) return;
    this.pristine = false;
    const dur = opts.dur ?? 1.1;
    if (this.mode === 'iso') {
      const toTarget = point.clone();
      const offset = this.iso.position.clone().sub(this.controls.target);
      this.tween = {
        t: 0, dur,
        fromTarget: this.controls.target.clone(), toTarget,
        fromPos: this.iso.position.clone(), toPos: toTarget.clone().add(offset),
      };
    } else {
      const look = point.clone().setY(Math.max(0.8, point.y));
      const toPos = look.clone().add(new THREE.Vector3(4.2, 2.4, 5.6));
      const d = look.clone().sub(toPos);
      this.tween = {
        t: 0, dur,
        fromTarget: look, toTarget: look,
        fromPos: this.persp.position.clone(), toPos,
        fromYaw: this.yaw, toYaw: this.yaw + wrapAngle(Math.atan2(-d.x, -d.z) - this.yaw),
        fromPitch: this.pitch, toPitch: Math.atan2(d.y, Math.hypot(d.x, d.z)),
      };
    }
  }

  reset() {
    this.setMode('iso');
    this.applyHome();
    this.pristine = true;
  }

  /**
   * Tentukan bingkai "home" kamera isometrik dari kotak dunia yang harus terlihat utuh
   * (klaster ruangan yang sudah dibangun). Target dan zoom dihitung dari proyeksi kotak itu
   * ke bidang layar, jadi tahap berikutnya cukup memperbesar kotaknya.
   */
  setHomeBox(box: THREE.Box3) {
    const fwd = ISO_OFFSET.clone().normalize().negate();
    const right = new THREE.Vector3().crossVectors(fwd, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    const p = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      p.set(x, y, z);
      const u = p.dot(right);
      const v = p.dot(up);
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
    }
    const uC = (uMin + uMax) / 2;
    const vC = (vMin + vMax) / 2;
    // Titik pada sumbu pandang yang berada di ketinggian fokus (agar orbit berputar di lantai).
    const depth = (ISO_DEFAULT_TARGET.y - vC * up.y) / fwd.y;
    this.homeTarget.copy(right).multiplyScalar(uC).addScaledVector(up, vC).addScaledVector(fwd, depth);
    this.homeHalf = { w: (uMax - uMin) / 2, h: (vMax - vMin) / 2 };
    if (this.pristine && this.mode === 'iso') this.applyHome();
  }

  /** Letakkan Free Cam di sebuah posisi sambil menatap sebuah titik (dibatasi FREE_BOUNDS). */
  placeFree(position: THREE.Vector3, lookAt: THREE.Vector3) {
    this.tween = null;
    this.persp.position.copy(position);
    this.clampFree();
    this.lookAt(lookAt);
  }

  /** Titik fokus home (pusat klaster ruangan) untuk auto-pan kembali setelah rapat. */
  home() {
    return this.homeTarget.clone();
  }

  private homeZoom() {
    if (!this.homeHalf) return 1;
    const fitW = (ISO_VIEW_HEIGHT * this.aspect) / 2 / (this.homeHalf.w * HOME_MARGIN);
    const fitH = ISO_VIEW_HEIGHT / 2 / (this.homeHalf.h * HOME_MARGIN);
    return Math.max(this.controls.minZoom, Math.min(1, fitW, fitH));
  }

  private applyHome() {
    this.tween = null;
    this.controls.target.copy(this.homeTarget);
    this.iso.position.copy(this.homeTarget).add(ISO_OFFSET);
    this.iso.zoom = this.homeZoom();
    this.iso.updateProjectionMatrix();
    this.controls.update();
  }

  resize(w: number, h: number) {
    const a = w / h;
    this.aspect = a;
    const vh = ISO_VIEW_HEIGHT;
    this.iso.left = (-vh * a) / 2;
    this.iso.right = (vh * a) / 2;
    this.iso.top = vh / 2;
    this.iso.bottom = -vh / 2;
    this.iso.updateProjectionMatrix();
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
    // Kamera belum disentuh: bingkai ulang supaya gedung tetap utuh di ukuran layar baru.
    if (this.pristine && this.mode === 'iso') this.applyHome();
  }

  update(dt: number) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const s = smooth(tw.t);
      if (this.mode === 'iso') {
        this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, s);
        this.iso.position.lerpVectors(tw.fromPos, tw.toPos, s);
      } else {
        this.persp.position.lerpVectors(tw.fromPos, tw.toPos, s);
        if (tw.fromYaw !== undefined && tw.toYaw !== undefined) this.yaw = tw.fromYaw + (tw.toYaw - tw.fromYaw) * s;
        if (tw.fromPitch !== undefined && tw.toPitch !== undefined) this.pitch = tw.fromPitch + (tw.toPitch - tw.fromPitch) * s;
      }
      if (tw.t >= 1) this.tween = null;
    }

    if (this.mode === 'iso') {
      this.controls.update();
      return;
    }

    // ---- Free Cam: gerak terbang bebas ----
    const k = this.keys;
    const speed = FREE_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 2.5 : 1) * dt;
    const cp = Math.cos(this.pitch);
    this.fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const p = this.persp.position;
    if (k.has('KeyW')) p.addScaledVector(this.fwd, speed);
    if (k.has('KeyS')) p.addScaledVector(this.fwd, -speed);
    if (k.has('KeyD')) p.addScaledVector(this.right, speed);
    if (k.has('KeyA')) p.addScaledVector(this.right, -speed);
    if (k.has('KeyQ')) p.y += speed;
    if (k.has('KeyE')) p.y -= speed;
    if (k.size > 0) { this.tween = null; this.markManual(); }
    this.clampFree();
    this.persp.rotation.set(this.pitch, this.yaw, 0);
  }

  dispose() {
    this.controls.removeEventListener('start', this.onControlsStart);
    this.controls.dispose();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
  }

  private lookAt(target: THREE.Vector3) {
    const d = target.clone().sub(this.persp.position);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.persp.rotation.set(this.pitch, this.yaw, 0);
  }

  private clampFree() {
    const p = this.persp.position;
    const b = FREE_BOUNDS;
    p.set(
      Math.min(b.maxX, Math.max(b.minX, p.x)),
      Math.min(b.maxY, Math.max(b.minY, p.y)),
      Math.min(b.maxZ, Math.max(b.minZ, p.z)),
    );
  }

  private markManual() {
    this.lastManualAt = performance.now();
    this.pristine = false;
  }

  private onControlsStart = () => {
    this.tween = null;
    this.markManual();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'free' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    const handled = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'];
    if (!handled.includes(e.code)) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.dragging = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'free') return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.mode !== 'free' || !this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (dx === 0 && dy === 0) return;
    this.tween = null;
    this.markManual();
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.004));
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'free') return;
    e.preventDefault();
    this.tween = null;
    this.markManual();
    const cp = Math.cos(this.pitch);
    this.fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.persp.position.addScaledVector(this.fwd, Math.max(-2, Math.min(2, -e.deltaY * 0.006)));
    this.clampFree();
  };
}

export const ISO_FOCUS_HEIGHT = ISO_DEFAULT_TARGET.y;
