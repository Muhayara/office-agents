import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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

    // 1. Scene & Environment (Tanpa fog gelap agar ruangan jernih & cerah)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b151b);

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

    // 3. WebGL Renderer & ACES Tonemapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35; // Pencahayaan lebih terang dan hidup
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Room Environment (PMREM) — Menghidupkan pantulan PBR logam, kaca, dan kayu
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = envTexture;
    roomEnvironment.dispose();
    pmremGenerator.dispose();

    // 5. Orbit Controls (dengan batas isometrik agar nyaman)
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

    // 6. Tata Cahaya Sinematik & Hidup (Lighting Architecture)
    // 6.1 Cahaya Langit & Pantulan Lantai (Hemisphere)
    const hemiLight = new THREE.HemisphereLight(0xdcf3ff, 0x1c2b33, 1.8);
    scene.add(hemiLight);

    // 6.2 Sinar Matahari Hangat (Key Sunlight) dari Arah Muka Terbuka
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 3.2);
    sunLight.position.set(12, 24, 16);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // 6.3 Sinar Pengisi Halus dari Sudut Belakang
    const fillLight = new THREE.DirectionalLight(0x7ec8e3, 1.4);
    fillLight.position.set(-14, 15, -10);
    scene.add(fillLight);

    // 6.4 Lampu Gantung Plafon 4 Zona Departemen (Interior Downlights)
    // Zona A: Strategi & Komando Raka (Warm Executive Amber)
    const lightZoneA = new THREE.PointLight(0xffdfb0, 32, 10, 1.6);
    lightZoneA.position.set(-3.5, 3.0, -2.0);
    scene.add(lightZoneA);

    // Zona B: Studio Kreatif Tari & Wulan (Warm Sunset Peach)
    const lightZoneB = new THREE.PointLight(0xffc89b, 28, 10, 1.6);
    lightZoneB.position.set(-3.5, 3.0, 2.2);
    scene.add(lightZoneB);

    // Zona C: Engineering Bima & Gita (Vibrant Tech Cyan)
    const lightZoneC = new THREE.PointLight(0x6ee7b7, 30, 10, 1.6);
    lightZoneC.position.set(3.5, 3.0, -2.0);
    scene.add(lightZoneC);

    // Zona D: Security Vault Satria & Laras (Clean Electric Blue)
    const lightZoneD = new THREE.PointLight(0x60a5fa, 28, 10, 1.6);
    lightZoneD.position.set(3.5, 3.0, 2.2);
    scene.add(lightZoneD);

    // 6. Memuat 3D Models Modular (Room Shell, Desk, Chair, Server Rack, Plants)
    const loader = new GLTFLoader();
    let deskTemplate: THREE.Group | null = null;
    let chairTemplate: THREE.Group | null = null;
    let serverRackTemplate: THREE.Group | null = null;
    let monsteraTemplate: THREE.Group | null = null;
    let snakePlantTemplate: THREE.Group | null = null;

    const decorGroup = new THREE.Group();
    decorGroup.name = 'OfficeDecor3D';
    scene.add(decorGroup);

    // 6.1 Memuat 3D Diorama Shell (office_room_shell.glb)
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

    // 6.2 Memuat Meja Kerja Modular (desk.glb)
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
      () => {},
    );

    // 6.3 Memuat Kursi Kantor Ergonomis Mesh (Office_Ergonomic_Chair.glb)
    loader.load(
      '/models/Office_Ergonomic_Chair.glb',
      (gltf) => {
        chairTemplate = gltf.scene;
        chairTemplate.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        updateAgents();
      },
      undefined,
      () => {},
    );

    // 6.4 Memuat Rak Server 42U Data Center (Server_Rack_42U.glb)
    loader.load(
      '/models/Server_Rack_42U.glb',
      (gltf) => {
        serverRackTemplate = gltf.scene;
        serverRackTemplate.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        updateDecor();
      },
      undefined,
      () => {},
    );

    // 6.5 Memuat Tanaman Hias Indoor Monstera (Office_Indoor_Plant.glb)
    loader.load(
      '/models/Office_Indoor_Plant.glb',
      (gltf) => {
        monsteraTemplate = gltf.scene;
        monsteraTemplate.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        updateDecor();
      },
      undefined,
      () => {},
    );

    // 6.6 Memuat Tanaman Hias Lidah Mertua (Office_Indoor_Plant_SnakePlant.glb)
    loader.load(
      '/models/Office_Indoor_Plant_SnakePlant.glb',
      (gltf) => {
        snakePlantTemplate = gltf.scene;
        snakePlantTemplate.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        updateDecor();
      },
      undefined,
      () => {},
    );

    // Fungsi Render Dekorasi Tetap (Rak Server & Tanaman)
    const updateDecor = () => {
      while (decorGroup.children.length > 0) {
        decorGroup.remove(decorGroup.children[0]!);
      }

      // 1. Rak Server 42U di Ruang Server / Vault Belakang (Dekat Satria & Bima)
      if (serverRackTemplate) {
        const rackPositions = [
          { x: 0.3, z: 3.8, rotY: 0 },
          { x: 5.6, z: 3.8, rotY: 0 },
        ];
        rackPositions.forEach((pos, idx) => {
          const rack = serverRackTemplate!.clone(true);
          rack.position.set(pos.x, 0, pos.z);
          rack.rotation.y = pos.rotY;
          rack.name = `ServerRack_42U_${idx + 1}`;
          decorGroup.add(rack);

          // Pendaran Lampu LED Server Aktif (Blinking Data Center Pulse)
          const ledLight = new THREE.PointLight(idx === 0 ? 0x5dbb8a : 0x4da8da, 4.5, 3.5, 2);
          ledLight.position.set(pos.x, 1.2, pos.z - 0.45);
          ledLight.userData = { isServerPulse: true, offset: idx * 2.5 };
          decorGroup.add(ledLight);
        });
      }

      // 2. Tanaman Hias Monstera di Sudut-Sudut Estetik
      if (monsteraTemplate) {
        const plantPositions = [
          { x: -6.0, z: 3.8, scale: 0.95 },  // Lobi / Rehat
          { x: -6.0, z: -4.0, scale: 0.90 }, // Sudut Manager Raka
          { x: -6.0, z: 0.0, scale: 0.85 },  // Studio Desain Tari & Wulan
        ];
        plantPositions.forEach((pos, idx) => {
          const plant = monsteraTemplate!.clone(true);
          plant.position.set(pos.x, 0, pos.z);
          plant.scale.setScalar(pos.scale);
          plant.name = `Monstera_Plant_${idx + 1}`;
          decorGroup.add(plant);
        });
      }

      // 3. Tanaman Hias Snake Plant (Lidah Mertua) di Partisi & Koridor
      if (snakePlantTemplate) {
        const snakePositions = [
          { x: 0.0, z: -4.0, scale: 0.90 }, // Pembatas Koridor Utama
          { x: 5.8, z: -4.0, scale: 0.90 }, // Sudut Game Lab Gita
          { x: 0.0, z: 1.8, scale: 0.85 },  // Pintu Masuk Vault Keamanan
        ];
        snakePositions.forEach((pos, idx) => {
          const plant = snakePlantTemplate!.clone(true);
          plant.position.set(pos.x, 0, pos.z);
          plant.scale.setScalar(pos.scale);
          plant.name = `Snake_Plant_${idx + 1}`;
          decorGroup.add(plant);
        });
      }
    };
    updateDecor();

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

      // Update avatar markers (efek bobbing halus) & breathing
      agentMeshGroup.children.forEach((agentGrp, agIdx) => {
        const avatar = agentGrp.getObjectByName(`Avatar_${agents[agIdx]?.id}`);
        if (avatar) {
          avatar.position.y = 0.45 + Math.sin(time * 2 + agIdx) * 0.006;
          avatar.rotation.y = Math.sin(time * 1.5 + agIdx) * 0.03;
        }
        agentGrp.children.forEach((child) => {
          if (child.userData?.isBeacon) {
            child.position.y =
              (child.userData.baseY || 1.28) +
              Math.sin(time + (child.userData.offset || 0)) * 0.04;
            child.rotation.y += 0.02;
          }
        });
      });

      // Update kedipan dinamis lampu LED server rack
      decorGroup.children.forEach((child) => {
        if (child.userData?.isServerPulse) {
          (child as THREE.PointLight).intensity =
            2.8 + Math.sin(time * 5 + child.userData.offset) * 1.8;
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

        // Kursi Kerja: Gunakan model modular Office_Ergonomic_Chair.glb jika sudah diunduh
        if (chairTemplate) {
          const clonedChair = chairTemplate.clone(true);
          clonedChair.position.set(0, 0, 0.55);
          clonedChair.rotation.y = Math.PI; // Menghadap ke arah meja (-Z)
          group.add(clonedChair);
        } else {
          const chairGeo = new THREE.BoxGeometry(0.5, 0.45, 0.5);
          const chairMat = new THREE.MeshStandardMaterial({
            color: 0x111c22,
            roughness: 0.8,
          });
          const chairMesh = new THREE.Mesh(chairGeo, chairMat);
          chairMesh.position.set(0, 0.45 / 2, 0.55);
          chairMesh.castShadow = true;
          chairMesh.receiveShadow = true;
          group.add(chairMesh);
        }

        // Karakter Mini Agen Duduk di Kursi
        const avatarGroup = new THREE.Group();
        avatarGroup.name = `Avatar_${ag.id}`;
        avatarGroup.position.set(0, 0.45, 0.50);

        // Badan / Kemeja sesuai warna khas agen
        const bodyGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.35, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.6,
          metalness: 0.1,
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.35 / 2;
        bodyMesh.castShadow = true;
        avatarGroup.add(bodyMesh);

        // Kepala
        const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({
          color: 0xffd9b3,
          roughness: 0.6,
        });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.y = 0.35 + 0.11;
        headMesh.castShadow = true;
        avatarGroup.add(headMesh);

        // Rambut Stylized
        const hairGeo = new THREE.SphereGeometry(0.124, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const hairMat = new THREE.MeshStandardMaterial({
          color: 0x172227,
          roughness: 0.9,
        });
        const hairMesh = new THREE.Mesh(hairGeo, hairMat);
        hairMesh.position.y = 0.35 + 0.12;
        avatarGroup.add(hairMesh);

        group.add(avatarGroup);

        // Monitor kerja dengan layar menyala hidup
        const monGeo = new THREE.BoxGeometry(0.6, 0.35, 0.05);
        const monMat = new THREE.MeshStandardMaterial({
          color: 0x0f1a1f,
          emissive: ag.status === 'working' ? color : isSelected ? 0x62e3ed : 0x38bdf8,
          emissiveIntensity: ag.status === 'working' ? 2.8 : isSelected ? 2.2 : 1.5,
          roughness: 0.2,
          metalness: 0.3,
        });
        const monMesh = new THREE.Mesh(monGeo, monMat);
        monMesh.position.set(0, 0.75 + 0.2, -0.2);
        monMesh.castShadow = true;
        group.add(monMesh);

        // Pendaran cahaya layar ke meja kerja (Workstation Screen Glow)
        const screenGlow = new THREE.PointLight(
          ag.status === 'working' ? color : 0x58c5d6,
          isSelected ? 3.0 : 1.6,
          1.8,
          2,
        );
        screenGlow.position.set(0, 0.95, -0.05);
        group.add(screenGlow);

        // Kristal/Beacon indikator status melayang di atas kepala agen
        const beaconGeo = new THREE.OctahedronGeometry(0.14, 0);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: isSelected ? 1.8 : 0.9,
          roughness: 0.15,
          metalness: 0.85,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, 1.28, 0.48);
        beacon.userData = { isBeacon: true, offset: idx * 0.7, baseY: 1.28 };
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
