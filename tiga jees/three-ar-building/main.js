import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const loaderEl = document.getElementById("loader");
const loaderProgressEl = document.querySelector(".loader-progress");
const arToggleBtn = document.getElementById("arToggleBtn");
const arToggleText = document.getElementById("arToggleText");
const arHud = document.getElementById("arHud");
const exitArBtn = document.getElementById("exitArBtn");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Renderer (dipakai untuk preview dan AR)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
renderer.setClearColor(0x000000, 0); // transparan saat AR
if (previewEl) previewEl.appendChild(renderer.domElement);

// Scene + Camera (preview)
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a12, 2, 8);

const previewCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 30);
previewCamera.position.set(1.25, 0.9, 1.35);

const xrCamera = new THREE.PerspectiveCamera(70, 1, 0.01, 30);

// Lighting (cukup sederhana untuk AR)
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(2, 4, 1);
scene.add(dir);

// Lantai halus untuk preview (tidak terlihat saat AR karena latar kamera)
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(2.0, 64),
  new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = false;
scene.add(floor);

// Reticle (target tempat objek akan ditempel)
const reticleGeo = new THREE.RingGeometry(0.06, 0.08, 48).rotateX(-Math.PI / 2);
const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ffd5, transparent: true, opacity: 0.9 });
const reticle = new THREE.Mesh(reticleGeo, reticleMat);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// Objek: "bangunan ruang" (kombinasi bangun ruang 3D)
function createBuilding() {
  const group = new THREE.Group();

  const matMain = new THREE.MeshStandardMaterial({
    color: 0x7aa7ff,
    metalness: 0.05,
    roughness: 0.65
  });
  const matAccent = new THREE.MeshStandardMaterial({
    color: 0x22304d,
    metalness: 0.1,
    roughness: 0.7
  });
  const matRoof = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    metalness: 0.05,
    roughness: 0.75
  });

  // Podium/base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.35), matAccent);
  base.position.set(0, 0.03, 0);
  group.add(base);

  // Menara utama (balok)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.40, 0.22), matMain);
  tower.position.set(-0.05, 0.06 + 0.20, 0);
  group.add(tower);

  // Blok samping (balok lebih pendek)
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), matMain);
  block.position.set(0.16, 0.06 + 0.13, -0.04);
  group.add(block);

  // Atap (limas sederhana menggunakan ConeGeometry dengan 4 sisi)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 4), matRoof);
  roof.position.set(-0.05, 0.06 + 0.40 + 0.06, 0);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  // Detail "jendela" (garis tipis)
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.4 });
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.008, 0.002), windowMat);
    w.position.set(-0.05, 0.14 + i * 0.06, 0.111);
    group.add(w);
  }

  // Skala supaya nyaman di AR (dalam meter)
  group.scale.setScalar(1);
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  return group;
}

let buildingTemplate = null; // akan diisi dari file OBJ
let placedBuilding = null;
let previewBuilding = null;

function setLoaderProgress(pct) {
  if (!loaderProgressEl) return;
  const p = Math.max(0, Math.min(100, Math.floor(pct)));
  loaderProgressEl.textContent = `${p}%`;
}

function showLoader(text = "Menyiapkan pratinjau…") {
  if (loaderEl) loaderEl.style.display = "grid";
  const textEl = document.querySelector(".loader-text");
  if (textEl) textEl.textContent = text;
  setLoaderProgress(0);
}

function hideLoader() {
  if (loaderEl) loaderEl.style.display = "none";
}

// Load objek 3D dari file (supaya unsur Three.js-nya jelas: loader + model eksternal)
async function loadBuildingOBJ() {
  showLoader("Memuat objek 3D…");

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    // Progress dari jumlah file (MTL + OBJ)
    if (itemsTotal > 0) setLoaderProgress((itemsLoaded / itemsTotal) * 100);
  };
  manager.onError = () => {
    setStatus("Gagal memuat file 3D, pakai model bawaan.");
  };

  try {
    const mtlLoader = new MTLLoader(manager);
    mtlLoader.setPath("./assets/");
    const materials = await mtlLoader.loadAsync("bangunan-ruang.mtl");
    materials.preload();

    const objLoader = new OBJLoader(manager);
    objLoader.setMaterials(materials);
    objLoader.setPath("./assets/");
    const obj = await objLoader.loadAsync("bangunan-ruang.obj");

    // Normalisasi: material & bayangan
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        // Pastikan material mendukung lighting (kalau material dari MTL sederhana)
        if (!(o.material instanceof THREE.MeshStandardMaterial)) {
          const old = o.material;
          o.material = new THREE.MeshStandardMaterial({
            color: old?.color || new THREE.Color(0x7aa7ff),
            metalness: 0.05,
            roughness: 0.7
          });
        }
      }
    });

    // Skala agar enak dilihat (OBJ ini sudah kira-kira meter, tapi kita kecilkan sedikit)
    obj.scale.setScalar(0.8);

    buildingTemplate = obj;

    previewBuilding = buildingTemplate.clone(true);
    previewBuilding.position.set(0, 0, 0);
    scene.add(previewBuilding);

    hideLoader();
    setStatus("Siap. Tekan “Buka Mode AR” (butuh HTTPS dan perangkat yang mendukung).");
  } catch (err) {
    // Fallback ke model prosedural
    buildingTemplate = createBuilding();
    previewBuilding = buildingTemplate.clone(true);
    previewBuilding.position.set(0, 0, 0);
    scene.add(previewBuilding);

    hideLoader();
    setStatus("Objek 3D gagal dimuat, memakai model bawaan.");
  }
}

// Orbit controls (hanya untuk preview)
const controls = new OrbitControls(previewCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0.02, 0.24, 0);
controls.minDistance = 0.6;
controls.maxDistance = 3.0;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minPolarAngle = Math.PI * 0.12;

// WebXR Hit Test setup
let hitTestSource = null;
let hitTestSourceRequested = false;

function onSelect() {
  if (!reticle.visible) return;

  if (!buildingTemplate) {
    setStatus("Objek 3D belum siap. Tunggu sebentar…");
    return;
  }

  // Hapus objek lama (opsional: hanya 1 bangunan di scene)
  if (placedBuilding) scene.remove(placedBuilding);

  placedBuilding = buildingTemplate.clone(true);
  placedBuilding.position.setFromMatrixPosition(reticle.matrix);
  placedBuilding.quaternion.setFromRotationMatrix(reticle.matrix);

  // Naikkan sedikit supaya tidak "tenggelam"
  placedBuilding.position.y += 0.001;
  scene.add(placedBuilding);
}

const controller = renderer.xr.getController(0);
controller.addEventListener("select", onSelect);
scene.add(controller);

let xrSession = null;
let arActive = false;

renderer.xr.addEventListener("sessionstart", () => {
  arActive = true;
  document.body.classList.add("ar");
  if (arHud) arHud.hidden = false;
  if (arToggleText) arToggleText.textContent = "Tutup AR";
  setStatus("Mode AR aktif. Arahkan ke permukaan datar lalu ketuk layar untuk menaruh bangunan.");
  if (previewBuilding) previewBuilding.visible = false;
  floor.visible = false;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  xrCamera.aspect = window.innerWidth / window.innerHeight;
  xrCamera.updateProjectionMatrix();
});
renderer.xr.addEventListener("sessionend", () => {
  arActive = false;
  document.body.classList.remove("ar");
  if (arHud) arHud.hidden = true;
  if (arToggleText) arToggleText.textContent = "Buka Mode AR";
  setStatus("Mode AR ditutup.");
  hitTestSourceRequested = false;
  hitTestSource = null;
  reticle.visible = false;
  xrSession = null;
  if (previewBuilding) previewBuilding.visible = true;
  floor.visible = true;
  setPreviewSize();
});

async function startAR() {
  if (!navigator.xr) {
    setStatus("Perangkat/browser ini belum mendukung WebXR.");
    return;
  }
  if (!window.isSecureContext) {
    setStatus("AR butuh HTTPS. Deploy ke hosting HTTPS (GitHub Pages/Netlify/Vercel).");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) {
      setStatus("Mode AR tidak didukung di perangkat ini. Coba Chrome Android + ARCore.");
      return;
    }

    xrSession = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.body }
    });

    await renderer.xr.setSession(xrSession);
  } catch (err) {
    setStatus("Gagal memulai AR: " + (err?.message || String(err)));
  }
}

async function stopAR() {
  try {
    const session = renderer.xr.getSession();
    if (session) await session.end();
  } catch (err) {
    setStatus("Gagal keluar AR: " + (err?.message || String(err)));
  }
}

function toggleAR() {
  if (renderer.xr.getSession()) stopAR();
  else startAR();
}

if (arToggleBtn) arToggleBtn.addEventListener("click", toggleAR);
if (exitArBtn) exitArBtn.addEventListener("click", stopAR);

function setPreviewSize() {
  if (!previewEl) return;
  const rect = previewEl.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}

// Loader palsu (biar mirip contoh)
loadBuildingOBJ();
setPreviewSize();

// Render loop
renderer.setAnimationLoop((timestamp, frame) => {
  const session = renderer.xr.getSession();

  // Preview (non-AR)
  if (!session) {
    reticle.visible = false;
    if (previewBuilding) previewBuilding.rotation.y += 0.0025;
    controls.update();
    renderer.render(scene, previewCamera);
    return;
  }

  // AR
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSourceRequested) {
      session
        .requestReferenceSpace("viewer")
        .then((viewerSpace) => session.requestHitTestSource({ space: viewerSpace }))
        .then((source) => {
          hitTestSource = source;
          hitTestSourceRequested = true;
        })
        .catch((err) => {
          setStatus("Hit-test gagal: " + (err?.message || String(err)));
        });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, xrCamera);
});

// Resize
window.addEventListener("resize", () => {
  if (arActive) return; // ukuran saat AR dihandle oleh WebXR fullscreen
  setPreviewSize();
});

// Info kompatibilitas
if (!navigator.xr) {
  if (arToggleBtn) arToggleBtn.disabled = true;
  setStatus("WebXR tidak tersedia. Coba Chrome Android dan pastikan HTTPS.");
}
