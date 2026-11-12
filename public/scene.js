import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const EMBER = new THREE.Color('#FF7A1A');
const SAFE = new THREE.Color('#5CC8FF');
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.pow(1 - k, dt * 60));

function shieldShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.25 * s);
  sh.bezierCurveTo(0.45 * s, 1.05 * s, 0.8 * s, 1.0 * s, 1.05 * s, 0.98 * s);
  sh.lineTo(1.05 * s, 0.15 * s);
  sh.bezierCurveTo(1.05 * s, -0.62 * s, 0.55 * s, -1.08 * s, 0, -1.32 * s);
  sh.bezierCurveTo(-0.55 * s, -1.08 * s, -1.05 * s, -0.62 * s, -1.05 * s, 0.15 * s);
  sh.lineTo(-1.05 * s, 0.98 * s);
  sh.bezierCurveTo(-0.8 * s, 1.0 * s, -0.45 * s, 1.05 * s, 0, 1.25 * s);
  return sh;
}

export function createScene(canvas, { reduced = false } = {}) {
  const isSmall = () => innerWidth < 980;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 2));
  renderer.setClearColor(0x070b14, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const root = new THREE.Group();
  scene.add(root);
  const shield = new THREE.Group();
  root.add(shield);

  // glass body
  const S = 1.75;
  const shape = shieldShape(S);
  const depth = 0.32;
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 8, curveSegments: 48 });
  bodyGeo.center();
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xb9c6e0, metalness: 0, roughness: 0.12, transmission: 1, thickness: 1.1, ior: 1.45,
    iridescence: 0.35, iridescenceIOR: 1.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1,
    transparent: true, opacity: 0.92, attenuationColor: new THREE.Color('#2a3d66'), attenuationDistance: 2.5,
  });
  if ('dispersion' in glass) glass.dispersion = 1.2;
  shield.add(new THREE.Mesh(bodyGeo, glass));

  // glowing rims (front and back)
  const pts = shape.getSpacedPoints(220).map(p => new THREE.Vector3(p.x, p.y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const rimMat = new THREE.MeshBasicMaterial({ color: EMBER.clone().multiplyScalar(3.2), toneMapped: false });
  const rimGeo = new THREE.TubeGeometry(curve, 400, 0.028, 10, true);
  const rimF = new THREE.Mesh(rimGeo, rimMat); rimF.position.z = depth / 2 + 0.13;
  const rimB = new THREE.Mesh(rimGeo, rimMat); rimB.position.z = -depth / 2 - 0.13; rimB.scale.setScalar(0.985);
  shield.add(rimF, rimB);

  // pause bars inside the glass
  const barMat = new THREE.MeshBasicMaterial({ color: EMBER.clone().multiplyScalar(1.4), toneMapped: false });
  const barGeo = new THREE.CapsuleGeometry(0.17, 1.15, 8, 16);
  const barL = new THREE.Mesh(barGeo, barMat); barL.position.set(-0.36, 0.02, 0);
  const barR = new THREE.Mesh(barGeo, barMat); barR.position.set(0.36, 0.02, 0);
  shield.add(barL, barR);

  // orbit lines
  const orbitMat = new THREE.LineBasicMaterial({ color: EMBER.clone().multiplyScalar(1.6), transparent: true, opacity: 0.55, toneMapped: false });
  const orbitMat2 = new THREE.LineBasicMaterial({ color: new THREE.Color('#7FA8FF').multiplyScalar(1.2), transparent: true, opacity: 0.3, toneMapped: false });
  const orbits = new THREE.Group();
  root.add(orbits);
  const mkOrbit = (rx, ry, mat, rot) => {
    const c = new THREE.EllipseCurve(0, 0, rx, ry, 0, Math.PI * 2);
    const g = new THREE.BufferGeometry().setFromPoints(c.getPoints(256));
    const l = new THREE.LineLoop(g, mat); l.rotation.set(...rot); orbits.add(l); return l;
  };
  const o1 = mkOrbit(3.4, 1.15, orbitMat, [1.15, 0.25, 0.35]);
  const o2 = mkOrbit(3.9, 1.5, orbitMat2, [1.3, -0.4, -0.5]);

  // particles riding the orbits
  const N = isSmall() ? 260 : 520;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seed[i * 3] = Math.random() * Math.PI * 2;
    seed[i * 3 + 1] = 3.0 + Math.random() * 1.3;
    seed[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.035, color: EMBER.clone().multiplyScalar(2), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const particles = new THREE.Points(pGeo, pMat);
  particles.rotation.set(1.15, 0.25, 0.35);
  root.add(particles);

  // light for the glass
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 4, 6); scene.add(key);
  const fill = new THREE.PointLight(0xff7a1a, 6, 12); fill.position.set(0, 0, -2); scene.add(fill);

  // post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.38, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // state driven from the page
  const st = {
    mouseX: 0, mouseY: 0, mx: 0, my: 0,
    anchorX: 0.22, anchorY: 0.02, ax: 0.22, ay: 0.02, // viewport fractions from center
    close: 0, c: 0, safe: 0, s: 0, intro: 0, active: true, scale: 1,
  };

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (isSmall()) { st.anchorX = 0; st.anchorY = -0.2; st.scale = Math.min(0.62, w / 760); }
    else { st.anchorX = 0.215; st.anchorY = 0.0; st.scale = Math.min(1, h / 860); }
  }
  layout();
  addEventListener('resize', layout);
  if (!reduced && matchMedia('(pointer:fine)').matches) {
    addEventListener('pointermove', e => { st.mouseX = e.clientX / innerWidth - 0.5; st.mouseY = e.clientY / innerHeight - 0.5; });
  }

  const clock = new THREE.Clock();
  const tmpC = new THREE.Color();
  let t = 0;

  function frame() {
    requestAnimationFrame(frame);
    if (!st.active || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += reduced ? 0 : dt;

    st.mx = damp(st.mx, st.mouseX, 0.06, dt);
    st.my = damp(st.my, st.mouseY, 0.06, dt);
    st.c = damp(st.c, st.close, 0.08, dt);
    st.s = damp(st.s, st.safe, 0.06, dt);
    st.intro = damp(st.intro, 1, 0.035, dt);

    // place root at the phone's position in the viewport
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const vw = vh * camera.aspect;
    st.ax = damp(st.ax, st.anchorX, 0.08, dt); st.ay = damp(st.ay, st.anchorY, 0.08, dt);
    root.position.set(st.ax * vw + 0.35, st.ay * vh + 0.1 + Math.sin(t * 0.8) * 0.06, 0);
    const sc = st.scale * (0.75 + 0.25 * st.intro);
    root.scale.setScalar(sc);

    shield.position.set(1.45 - st.c * 0.15, 0.42, -1.6 + st.c * 0.1);
    shield.rotation.y = -0.38 + Math.sin(t * 0.35) * 0.1 + st.mx * 0.45 + st.c * 0.2;
    shield.rotation.x = -0.08 + st.my * 0.3;
    orbits.rotation.z = t * 0.06;
    o1.rotation.z = t * 0.12; o2.rotation.z = -t * 0.08;

    // particles flow along their ellipse
    for (let i = 0; i < N; i++) {
      const a = seed[i * 3] + t * (0.12 + (i % 7) * 0.012);
      const r = seed[i * 3 + 1];
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r * 0.36; pos[i * 3 + 2] = seed[i * 3 + 2];
    }
    pGeo.attributes.position.needsUpdate = true;
    particles.rotation.z = t * 0.05;

    // ember -> safe
    tmpC.copy(EMBER).lerp(SAFE, st.s);
    rimMat.color.copy(tmpC).multiplyScalar(3.2 - st.s * 0.8);
    barMat.color.copy(tmpC).multiplyScalar(1.4 * (1 - st.s * 0.8));
    pMat.color.copy(tmpC).multiplyScalar(2);
    orbitMat.color.copy(tmpC).multiplyScalar(1.6);
    fill.color.copy(tmpC);
    bloom.strength = 0.62 * st.intro;

    composer.render();
  }
  requestAnimationFrame(frame);

  return {
    setClose(v) { st.close = v; },
    setSafe(v) { st.safe = v; },
    setActive(v) { if (v && !st.active) clock.getDelta(); st.active = v; },
  };
}
