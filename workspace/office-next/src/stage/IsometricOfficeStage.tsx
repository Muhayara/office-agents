import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type AgentView, type Lang, roleLabel } from '@office/shared';
import { OFFICE_ZONES } from '../isometric/coords';

interface IsometricOfficeStageProps {
  agents: AgentView[];
  selectedAgentId: string;
  language: Lang;
  onSelectAgent: (agentId: string) => void;
}

// Koordinat pemetaan (X, Z) dan rotasi hadap dari room-spec.md ke ruang 3D Three.js
// rotationY: 0 = hadap Selatan (+Z), Math.PI = hadap Utara (-Z), Math.PI/2 = hadap Barat (-X), -Math.PI/2 = hadap Timur (+X)
const AGENT_3D_POSITIONS: Record<string, { x: number; z: number; rotY: number }> = {
  raka: { x: -4.0, z: -3.5, rotY: 0 },
  sari: { x: -5.5, z: -1.5, rotY: -Math.PI / 2 },
  dimas: { x: -2.5, z: -1.5, rotY: Math.PI / 2 },
  tari: { x: -5.5, z: 1.5, rotY: -Math.PI / 2 },
  wulan: { x: -2.5, z: 1.5, rotY: Math.PI / 2 },
  bima: { x: 1.5, z: -3.0, rotY: 0 },
  gita: { x: 4.5, z: -3.0, rotY: 0 },
  satria: { x: 1.5, z: 2.5, rotY: Math.PI },
  laras: { x: 4.5, z: 2.5, rotY: Math.PI },
  fajar: { x: 3.0, z: 1.0, rotY: 0 },
};

export function IsometricOfficeStage({
  agents,
  selectedAgentId,
  language,
  onSelectAgent,
}: IsometricOfficeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const aspect = width / height;

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1a1f);
    scene.fog = new THREE.FogExp2(0x0f1a1f, 0.015);

    // 2. Isometric Orthographic Camera
    const viewHeight = 15;
    const camera = new THREE.OrthographicCamera(
      (-viewHeight * aspect) / 2,
      (viewHeight * aspect) / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      1000,
    );
    camera.position.set(18, 14, 20);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls (dengan batas isometrik agar nyaman)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minZoom = 0.6;
    controls.maxZoom = 3.0;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    controlsRef.current = controls;

    // 5. Pencahayaan Kantor 3D
    const ambientLight = new THREE.AmbientLight(0x1b2c35, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xe9f4f6, 2.2);
    sunLight.position.set(15, 22, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x4da8da, 0.8);
    fillLight.position.set(-14, 12, -10);
    scene.add(fillLight);

    // 6. Memuat 3D Diorama Shell (office_room_shell.glb) & Modular Desk (desk.glb)
    const loader = new GLTFLoader();
    let deskTemplate: THREE.Group | null = null;

    loader.load(
      '/models/office_room_shell.glb',
      (gltf) => {
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(gltf.scene);
        setModelLoaded(true);
      },
      undefined,
      (err) => {
        console.error('Error loading office_room_shell.glb:', err);
        setLoadError(String(err));
      },
    );

    // Otomatis muat desk.glb jika file sudah ada (Plug-and-Play)
    loader.load(
      '/models/desk.glb',
      (gltf) => {
        deskTemplate = gltf.scene;
        deskTemplate.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        updateAgents();
      },
      undefined,
      () => {
        // desk.glb belum ada atau sedang dibuat di background; gunakan fallback sementara
      },
    );

    // 7. Raycasting untuk Klik Agen di 3D
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const agentMeshGroup = new THREE.Group();
    agentMeshGroup.name = 'AgentAvatars3D';
    scene.add(agentMeshGroup);

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(agentMeshGroup.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0]!.object;
        while (obj && !obj.userData?.agentId) {
          obj = obj.parent;
        }
        if (obj?.userData?.agentId) {
          onSelectAgent(obj.userData.agentId as string);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const asp = w / h;
      renderer.setSize(w, h);
      camera.left = (-viewHeight * asp) / 2;
      camera.right = (viewHeight * asp) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // 9. Loop Animasi 60 FPS
    let time = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.03;

      // Update avatar markers (efek bobbing halus)
      agentMeshGroup.children.forEach((child) => {
        if (child.userData?.isBeacon) {
          child.position.y = 1.1 + Math.sin(time + (child.userData.offset || 0)) * 0.05;
          child.rotation.y += 0.02;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 10. Update 3D Agent Markers saat props agen berubah
    const updateAgents = () => {
      // Hapus mesh lama
      while (agentMeshGroup.children.length > 0) {
        const item = agentMeshGroup.children[0]!;
        agentMeshGroup.remove(item);
      }

      agents.forEach((ag, idx) => {
        const posInfo = AGENT_3D_POSITIONS[ag.id] ?? { x: idx - 5, z: 0, rotY: 0 };
        const isSelected = ag.id === selectedAgentId;
        const color = new THREE.Color(ag.color);

        const group = new THREE.Group();
        group.position.set(posInfo.x, 0, posInfo.z);
        group.rotation.y = posInfo.rotY;
        group.userData = { agentId: ag.id };

        // Meja Kerja: Gunakan model modular desk.glb jika sudah diunduh, atau fallback balok jika belum
        if (deskTemplate) {
          const clonedDesk = deskTemplate.clone(true);
          group.add(clonedDesk);
        } else {
          const deskGeo = new THREE.BoxGeometry(1.4, 0.75, 0.7);
          const deskMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x223841 : 0x182a32,
            roughness: 0.6,
            metalness: 0.2,
          });
          const deskMesh = new THREE.Mesh(deskGeo, deskMat);
          deskMesh.position.y = 0.75 / 2;
          deskMesh.castShadow = true;
          deskMesh.receiveShadow = true;
          group.add(deskMesh);
        }

        // Monitor kerja
        const monGeo = new THREE.BoxGeometry(0.6, 0.35, 0.05);
        const monMat = new THREE.MeshStandardMaterial({
          color: 0x0f1a1f,
          emissive: ag.status === 'working' || ag.status === 'thinking' ? color : 0x14232a,
          emissiveIntensity: ag.status === 'working' ? 1.4 : 0.6,
          roughness: 0.3,
        });
        const monMesh = new THREE.Mesh(monGeo, monMat);
        monMesh.position.set(0, 0.75 + 0.2, -0.2);
        monMesh.castShadow = true;
        group.add(monMesh);

        // Kristal/Beacon indikator status melayang di atas meja
        const beaconGeo = new THREE.OctahedronGeometry(0.18, 0);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: isSelected ? 1.6 : 0.8,
          roughness: 0.2,
          metalness: 0.8,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 1.15;
        beacon.userData = { isBeacon: true, offset: idx * 0.7 };
        group.add(beacon);

        // Cincin seleksi di lantai jika terpilih
        if (isSelected) {
          const ringGeo = new THREE.RingGeometry(0.8, 0.9, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.01;
          group.add(ring);
        }

        agentMeshGroup.add(group);
      });
    };
    updateAgents();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, selectedAgentId, onSelectAgent]);

  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(18, 14, 20);
      controlsRef.current.target.set(0, 1.05, 0);
      controlsRef.current.update();
    }
  };

  const handleFocusAgent = (agentId: string) => {
    const pos = AGENT_3D_POSITIONS[agentId];
    if (pos && controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(pos.x, 0.8, pos.z);
      controlsRef.current.update();
    }
  };

  return (
    <section
      aria-label={
        language === 'id'
          ? 'Panggung Ruang Kantor 3D Three.js'
          : '3D Three.js Office Stage'
      }
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-paper)',
        borderRight: '1px solid var(--color-rule)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Top HUD Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-rule)',
          background: 'var(--color-paper-2)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14 }}>
            {language === 'id'
              ? 'Ruang Kantor 3D (Three.js WebGL Diorama)'
              : '3D Virtual Office (Three.js WebGL Diorama)'}
          </strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            14×10m · 10 Kursi Karyawan
          </span>
          {modelLoaded ? (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-ok)', borderColor: 'var(--color-ok)' }}
            >
              GLB Active
            </span>
          ) : loadError ? (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            >
              GLB Error
            </span>
          ) : (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}
            >
              Loading GLB...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleResetCamera}
            title={language === 'id' ? 'Reset sudut kamera' : 'Reset camera'}
            style={{ padding: '4px 10px', minHeight: 28, fontSize: 12 }}
          >
            {language === 'id' ? 'Reset Kamera' : 'Reset Camera'}
          </button>
          <button
            type="button"
            onClick={() => handleFocusAgent(selectedAgentId)}
            title={language === 'id' ? 'Fokus ke meja agen terpilih' : 'Focus selected agent'}
            style={{ padding: '4px 10px', minHeight: 28, fontSize: 12, borderColor: 'var(--color-focus)', color: 'var(--color-focus)' }}
          >
            {language === 'id' ? 'Fokus Meja' : 'Focus Desk'}
          </button>
        </div>
      </div>

      {/* Kontainer Kanvas 3D Three.js */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
          outline: 'none',
        }}
      />

      {/* Floating Zone Legend di Bawah */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 16,
          display: 'flex',
          gap: 12,
          padding: '8px 12px',
          background: 'rgba(15, 26, 31, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {OFFICE_ZONES.map((z) => (
          <span
            key={z.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--color-ink-2)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                backgroundColor: z.accentColor,
                display: 'inline-block',
                borderRadius: 2,
              }}
            />
            <span>{language === 'id' ? z.labelId : z.labelEn}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
