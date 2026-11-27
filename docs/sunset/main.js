// Sunset & Silver Lake: three.js scene built from docs/sunset/data/scene.json.
// See three/three.md. Data © OpenStreetMap contributors, ODbL 1.0.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SINK = 0.25; // terrain mesh drawn this far below the sampled ground
const EYE = 1.6, CURB = 0.15, WALK = 8, RUN = 28;     // street-view speeds, m/s
const JUMP_V = 7.8, GRAVITY = 9.8;                    // Space: ~3 m hop (height = v²/2g)
const TURN = 1.8;                                     // A/D turn rate in street view, rad/s
const LIFT = { service: 0.02, residential: 0.03, unclassified: 0.03, living_street: 0.03,
               tertiary: 0.035, secondary: 0.04, primary: 0.05 };
const COLORS = {
  ground: 0xd9cfb4, asphalt: 0x4a4d50, sidewalk: 0xc9c6bd, curb: 0xa9a59b, footway: 0xb9b2a2,
  park: 0x8fb36b, pool: 0x5fb7d9, grass: 0x9dbb7a, pole: 0x3b3f42, head: 0xd9a400,
  tactile: 0xe8c547, deck: 0x9a968e,
  building: { house: 0xe9dcc4, residential: 0xe3d3b8, apartments: 0xcdbfa8, retail: 0xd8b9a0,
              commercial: 0xc9b6a6, hotel: 0xbfb0c4, industrial: 0xb0b0aa, default: 0xddd6c8 },
};

const AREA_COLORS = { park: COLORS.park, garden: COLORS.park, playground: COLORS.park, grass: COLORS.grass,
  swimming_pool: COLORS.pool, water: COLORS.pool, wood: 0x6f9a52, scrub: 0x93a868,
  retail: 0xd2cbbf, commercial: 0xd2cbbf, construction: 0xcdb98f, parking: 0xb9b6b0 };
// Cache-busting: index.html loads main.js?v=<hash> (scripts/stamp_sunset.py); pass it on to data files.
const V = new URL(import.meta.url).searchParams.get("v");
const bust = (u) => V ? `${u}?v=${V}` : u;
const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd3e6);
scene.fog = new THREE.Fog(0xbcd3e6, 250, 700);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: "fixed", top: 0, left: 0, pointerEvents: "none" });
document.body.appendChild(labelRenderer.domElement);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
const orbit = new OrbitControls(camera, renderer.domElement);
Object.assign(orbit, { enableDamping: true, maxPolarAngle: 1.48, minDistance: 5, maxDistance: 600 });

// ---- lights: late-afternoon sun from the west-southwest --------------------------------
scene.add(new THREE.HemisphereLight(0xe8f1ff, 0x8a7d63, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
{
  const az = THREE.MathUtils.degToRad(245), el = THREE.MathUtils.degToRad(28), r = 300;
  sun.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 1, far: 800 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.3;
  scene.add(sun, sun.target);
}

// ---- helpers ----------------------------------------------------------------------------
let T; // terrain
function ground(x, z) {
  const fx = Math.min(Math.max((x - T.x0) / T.cell, 0), T.nx - 1.001);
  const fz = Math.min(Math.max((z - T.z0) / T.cell, 0), T.nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = T.heights, n = T.nx;
  const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Right-hand normals (x east, z south: right of travel is (-dz, dx)), mitred at joints.
function normals(line) {
  const seg = [];
  for (let i = 0; i < line.length - 1; i++) {
    const dx = line[i + 1][0] - line[i][0], dz = line[i + 1][1] - line[i][1], L = Math.hypot(dx, dz) || 1;
    seg.push([-dz / L, dx / L]);
  }
  return line.map((_, i) => {
    const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i)];
    let nx = a[0] + b[0], nz = a[1] + b[1];
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const s = Math.min(3, 1 / Math.max(0.33, nx * b[0] + nz * b[1]));
    return [nx * s, nz * s];
  });
}

function cumLen(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++)
    out.push(out[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  return out;
}

// Trim a polyline by `a` metres at the start and `b` at the end.
function trim(line, a, b) {
  const len = cumLen(line), total = len[len.length - 1];
  if (total <= a + b + 1) return null;
  const at = (s) => {
    let i = 1; while (i < len.length - 1 && len[i] < s) i++;
    const t = (s - len[i - 1]) / (len[i] - len[i - 1] || 1);
    return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
  };
  const out = [at(a)];
  for (let i = 0; i < line.length; i++) if (len[i] > a && len[i] < total - b) out.push(line[i]);
  out.push(at(total - b));
  return out;
}

// Ribbon between lateral offsets l and r (metres, + is right of travel). yAt(i, x, z) gives height.
function ribbon(line, l, r, yAt, uScale = 1) {
  const n = normals(line), len = cumLen(line), pos = [], uv = [], idx = [];
  line.forEach((p, i) => {
    for (const [o, v] of [[l, 0], [r, 1]]) {
      const x = p[0] + n[i][0] * o, z = p[1] + n[i][1] * o;
      pos.push(x, yAt(i, x, z), z); uv.push(len[i] / uScale, v);
    }
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // make sure faces point up
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { g.index.array.reverse(); g.index.needsUpdate = true; g.computeVertexNormals(); }
  return g;
}

// Vertical wall along offset o, from yBot(i,x,z) to yTop(i,x,z).
function wall(line, o, yBot, yTop) {
  const n = normals(line), pos = [], idx = [];
  line.forEach((p, i) => {
    const x = p[0] + n[i][0] * o, z = p[1] + n[i][1] * o;
    pos.push(x, yBot(i, x, z), z, x, yTop(i, x, z), z);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function addMerged(geoms, material, { cast = false, receive = true } = {}) {
  geoms = geoms.filter(Boolean);
  if (!geoms.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geoms.map((g) => g.index ? g.toNonIndexed() : g)), material);
  m.castShadow = cast; m.receiveShadow = receive;
  scene.add(m);
  return m;
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- build ------------------------------------------------------------------------------
const pickables = [];
const presets = [];

function build(S) {
  T = S.terrain;

  // terrain
  {
    const w = (T.nx - 1) * T.cell, d = (T.nz - 1) * T.cell;
    const g = new THREE.PlaneGeometry(w, d, T.nx - 1, T.nz - 1);
    g.rotateX(-Math.PI / 2);
    g.translate(T.x0 + w / 2, 0, T.z0 + d / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, T.heights[k] - SINK); // sunk so draped ribbons never z-fight
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, lambert(COLORS.ground));
    m.receiveShadow = true; scene.add(m); pickables.push(m);
  }

  // parks, pools, other areas (draped)
  for (const a of S.areas) {
    const shape = new THREE.Shape(a.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, ground(p.getX(k), p.getZ(k)) + 0.025);
    const color = AREA_COLORS[a.kind];
    if (color === undefined) continue; // e.g. landuse=residential: leave bare ground
    const m = new THREE.Mesh(g, lambert(color, { polygonOffset: true, polygonOffsetFactor: -1 }));
    m.receiveShadow = true; scene.add(m);
    if (a.name) label(a.name, a.ring[0][0], a.ring[0][1], "area");
  }

  // roads
  const roadG = [], deckG = [], whiteDash = [], whiteSolid = [], yellow = [];
  for (const r of S.roads) {
    const lift = LIFT[r.kind] ?? 0.03;
    const yAt = r.y ? (i) => r.y[i] + lift : (i, x, z) => ground(x, z) + lift;
    roadG.push(ribbon(r.line, -r.w / 2, r.w / 2, yAt));
    if (r.bridge) {
      const under = (i, x, z) => yAt(i, x, z) - 0.9, top = (i, x, z) => yAt(i, x, z) + 1.0;
      for (const s of [-1, 1]) deckG.push(wall(r.line, s * (r.w / 2 + 3.2), under, top));
    }
    if (r.kind === "service") continue;
    // lane markings, trimmed back from the junctions
    const L = trim(r.line, 7, 7);
    if (!L) continue;
    const lanes = r.f + r.b, edge = r.bike * 1.5 + r.park * 2.4;
    const left = -r.w / 2 + edge, lw = (r.w - 2 * edge) / Math.max(1, lanes);
    const mark = (o, wdt, list, uScale = 1) =>
      list.push(ribbon(L, o - wdt / 2, o + wdt / 2,
        r.y ? (i, x, z) => ground(x, z) + lift + 0.01 : (i, x, z) => ground(x, z) + lift + 0.01, uScale));
    if (r.y) continue; // bridge markings skipped (y index differs after trim)
    for (let k = 1; k < lanes; k++) {
      const o = left + k * lw;
      if (k === r.b && r.f > 0 && r.b > 0) { mark(o - 0.12, 0.1, yellow); mark(o + 0.12, 0.1, yellow); }
      else mark(o, 0.12, whiteDash, 12);
    }
    if (r.bike) { mark(left, 0.15, whiteSolid); mark(-left, 0.15, whiteSolid); }
  }
  const road = addMerged(roadG, lambert(COLORS.asphalt)); if (road) pickables.push(road);
  addMerged(deckG, lambert(COLORS.deck, { side: THREE.DoubleSide }), { cast: true });
  const dashTex = canvasTexture(64, 4, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w / 4, h); });
  addMerged(whiteDash, lambert(0xf2f2f2, { map: dashTex, alphaTest: 0.5, transparent: false }));
  addMerged(whiteSolid, lambert(0xf2f2f2));
  addMerged(yellow, lambert(0xe9b824));

  // crosswalks
  const zebraTex = canvasTexture(32, 64, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 6, w / 2, h - 12); });
  const ladderTex = canvasTexture(32, 64, (c, w, h) => {
    c.fillStyle = "#fff"; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5); c.fillRect(0, 6, w / 2, h - 12);
  });
  const edgeTex = canvasTexture(32, 64, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5); });
  const cw = { zebra: [], ladder: [], edge: [] };
  for (const c of S.crossings) {
    if (c.markings === "no") continue;
    const kind = c.markings === "zebra" ? "zebra" : c.markings === "ladder" ? "ladder" : "edge";
    cw[kind].push(ribbon(c.line, -1.5, 1.5, (i, x, z) => ground(x, z) + 0.075, 1.2));
  }
  for (const [k, tex] of [["zebra", zebraTex], ["ladder", ladderTex], ["edge", edgeTex]])
    addMerged(cw[k], lambert(0xf4f4f4, { map: tex, alphaTest: 0.5 }));

  // sidewalks: raised slab with curb faces on both sides
  const swTop = [], swFace = [];
  for (const s of S.sidewalks) {
    const base = s.y ? (i) => s.y[i] + 0.05 : (i, x, z) => ground(x, z);
    const top = (i, x, z) => base(i, x, z) + CURB;
    swTop.push(ribbon(s.line, -s.w / 2, s.w / 2, top));
    for (const o of [-s.w / 2, s.w / 2]) swFace.push(wall(s.line, o, (i, x, z) => base(i, x, z) - SINK, top));
  }
  const sw = addMerged(swTop, lambert(COLORS.sidewalk)); if (sw) pickables.push(sw);
  addMerged(swFace, lambert(COLORS.curb, { side: THREE.DoubleSide }));

  // other footways and steps
  addMerged(S.footways.map((f) => ribbon(f.line, -f.w / 2, f.w / 2, (i, x, z) => ground(x, z) + 0.08)),
    lambert(COLORS.footway));

  // kerb ramps: tactile pads where tagged (ramps themselves: TODO)
  const pads = [];
  for (const k of S.kerbs) {
    if (!k.tactile) continue;
    const g = new THREE.BoxGeometry(1.2, 0.03, 1.2);
    g.translate(k.p[0], ground(k.p[0], k.p[1]) + 0.09, k.p[1]);
    pads.push(g);
  }
  addMerged(pads, lambert(COLORS.tactile));

  // buildings: extruded footprints, base at lowest ground under the footprint
  const bg = [];
  const col = new THREE.Color();
  for (const b of S.buildings) {
    if (b.ring.length < 3 || b.h < 1) continue;
    const ys = b.ring.map(([x, z]) => ground(x, z));
    const lo = Math.min(...ys), mean = ys.reduce((a, c) => a + c, 0) / ys.length;
    const base = lo - 0.3, depth = mean + b.h - base;
    const shape = new THREE.Shape(b.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, base, 0);
    col.set(COLORS.building[b.kind] ?? COLORS.building.default);
    col.offsetHSL(0, 0, ((b.id % 7) - 3) * 0.012); // a little variety
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    bg.push(g);
  }
  const bm = addMerged(bg, new THREE.MeshLambertMaterial({ vertexColors: true }), { cast: true });
  if (bm) pickables.push(bm);

  // signal poles (positions guessed): pole, mast arm toward the junction, head
  const poleG = [], headG = [];
  for (const p of S.poles) {
    const [x, z] = p.p, y = ground(x, z) + CURB;
    const pole = new THREE.CylinderGeometry(0.13, 0.16, 6.5, 10); pole.translate(x, y + 3.25, z); poleG.push(pole);
    const dx = p.toward[0] - x, dz = p.toward[1] - z, L = Math.hypot(dx, dz) || 1, arm = Math.min(7, L * 0.6);
    const a = new THREE.CylinderGeometry(0.08, 0.08, arm, 8);
    a.rotateZ(Math.PI / 2); a.rotateY(-Math.atan2(dz, dx)); a.translate(x + dx / L * arm / 2, y + 6.2, z + dz / L * arm / 2);
    poleG.push(a);
    const h = new THREE.BoxGeometry(0.35, 1.0, 0.35);
    h.translate(x + dx / L * arm, y + 5.6, z + dz / L * arm); headG.push(h);
  }
  for (const m of [addMerged(poleG, lambert(COLORS.pole), { cast: true }),
                   addMerged(headG, lambert(COLORS.head), { cast: true })]) if (m) m.userData.noPhoto = true;

  // labels
  for (const l of S.labels) label(l.text.replace(/^West /, ""), l.p[0], l.p[1], "street");
  for (const p of S.pois) label("☕ " + p.name, p.p[0], p.p[1], "poi", 8);

  // presets
  presets.push({ name: "Overview", mode: "orbit", pos: [150, 120, 170], target: [0, 0, 0] });
  const corners = S.poles.slice(0, 4);
  for (const c of corners) {
    const ns = c.p[1] < 0 ? "N" : "S", ew = c.p[0] > 0 ? "E" : "W";
    presets.push({ name: `${ns}${ew} corner`, mode: "street", x: c.p[0], z: c.p[1],
                   yaw: Math.atan2(-(c.toward[0] - c.p[0]), -(c.toward[1] - c.p[1])) });
  }
  const cafe = S.pois[0].p;
  presets.push({ name: "Cafe Tropical", mode: "street", x: cafe[0] + 4, z: cafe[1] + 4,
                 yaw: Math.atan2(-(cafe[0] - cafe[0] - 4), -(cafe[1] - cafe[1] - 4)) });
  const br = S.roads.find((r) => r.bridge);
  if (br) {
    const m = br.line[Math.floor(br.line.length / 2)];
    presets.push({ name: "Sunset bridge", mode: "orbit", pos: [m[0] - 30, ground(m[0], m[1]) + 12, m[1] + 35], target: [m[0], ground(m[0], m[1]), m[1]] });
  }
  const sel = $("preset");
  presets.forEach((p, i) => sel.add(new Option(p.name, i)));
}

function label(text, x, z, cls, dy = 4) {
  const div = document.createElement("div");
  div.className = "label"; div.textContent = text;
  Object.assign(div.style, cls === "street"
    ? { color: "#fff", background: "#1d2327cc", padding: "1px 6px", borderRadius: "3px" }
    : cls === "poi" ? { color: "#1d2327", background: "#ffe08a", padding: "2px 7px", borderRadius: "10px" }
    : { color: "#2f4a1a", textShadow: "0 0 3px #fff" });
  const o = new CSS2DObject(div);
  o.position.set(x, ground(x, z) + dy, z);
  scene.add(o);
}

// ---- controls ---------------------------------------------------------------------------
let mode = "orbit";
const street = { x: 0, z: 0, yaw: 0, pitch: 0, vantage: null, jumpY: 0, vy: 0 }; // vantage: {eye, quat, fov} from a photo
const FOV = 60;
function leaveVantage(keepFov) {
  const v = street.vantage; if (!v) return;
  const e = new THREE.Euler().setFromQuaternion(v.quat, "YXZ"); // carry the photo's look (roll dropped)
  street.yaw = e.y; street.pitch = -e.x;
  street.vantage = null;
  if (!keepFov) { camera.fov = FOV; camera.updateProjectionMatrix(); }
}
const keys = new Set();

function setMode(m, opts = {}) {
  mode = m;
  orbit.enabled = m === "orbit";
  $("mode").setAttribute("aria-pressed", String(m === "street"));
  $("mode").textContent = m === "street" ? "Orbit view" : "Street view";
  $("help").textContent = m === "street"
    ? "Drag to look around · W/S walk · A/D turn (hold Right Shift or / to strafe) · Left Shift = faster · Space to jump · double-click ground to go there · V for orbit"
    : "Drag to rotate · right-drag to pan · scroll to zoom · WASD / arrows to move · Q/E rotate · R/F tilt · +/− or PgUp/PgDn zoom (Left Shift = faster) · V for street view";
  if (m === "street") {
    if (opts.x === undefined) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      Object.assign(street, { x: orbit.target.x, z: orbit.target.z, yaw: Math.atan2(-dir.x, -dir.z), pitch: 0 });
    } else Object.assign(street, { pitch: 0, vantage: null, ...opts });
    camera.fov = street.vantage?.fov ?? FOV; camera.updateProjectionMatrix();
  } else if (opts.pos) {
    street.vantage = null; camera.fov = FOV; camera.updateProjectionMatrix();
    camera.position.set(...opts.pos); orbit.target.set(...opts.target);
  } else {
    street.vantage = null; camera.fov = FOV; camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 25);
    camera.position.y += 20; // step back up a little so orbit has room
  }
  saveHash();
}

$("mode").onclick = () => setMode(mode === "orbit" ? "street" : "orbit");
$("preset").onchange = (e) => {
  const p = presets[+e.target.value]; e.target.value = "";
  if (!p) return;
  if (p.photo) return goVantage(p.photo);
  p.mode === "street" ? setMode("street", { x: p.x, z: p.z, yaw: p.yaw }) : setMode("orbit", p);
};
addEventListener("keydown", (e) => {
  if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
  if (e.key === "v" || e.key === "V") return setMode(mode === "orbit" ? "street" : "orbit");
  if (e.code === "Space") {        // don't scroll or click a focused button
    e.preventDefault(); document.activeElement?.blur?.();
    if (mode === "street" && street.jumpY === 0) street.vy = JUMP_V;
  }
  if (e.code.startsWith("Arrow") || e.code === "PageUp" || e.code === "PageDown") e.preventDefault();
  keys.add(e.code);
});
addEventListener("keyup", (e) => { keys.delete(e.code); });
addEventListener("blur", () => keys.clear());

// street-view drag look
let drag = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (mode !== "street") return;
  leaveVantage(true);
  drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!drag || mode !== "street") return;
  street.yaw += (e.clientX - drag.x) * 0.004;
  street.pitch = THREE.MathUtils.clamp(street.pitch - (e.clientY - drag.y) * 0.004, -1.3, 1.3);
  drag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerup", () => { if (drag) { drag = null; saveHash(); } });

// double-click: jump (street) or focus (orbit)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener("dblclick", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (!hit) return;
  if (mode === "street") { leaveVantage(false); street.x = hit.point.x; street.z = hit.point.z; }
  else orbit.target.copy(hit.point);
  saveHash();
});

function updateStreet(dt) {
  const sp = (keys.has("ShiftLeft") ? RUN : WALK) * dt;
  const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const lr = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const strafing = keys.has("ShiftRight") || keys.has("Slash");   // modifier: A/D strafe instead of turn
  const side = strafing ? lr : 0;
  if (lr && !strafing) { leaveVantage(false); street.yaw -= lr * TURN * dt; hashDirty = true; }
  if (fwd || side) {
    leaveVantage(false);
    street.x += (-Math.sin(street.yaw) * fwd + Math.cos(street.yaw) * side) * sp;
    street.z += (-Math.cos(street.yaw) * fwd - Math.sin(street.yaw) * side) * sp;
    hashDirty = true;
  }
  if (street.vy || street.jumpY) {  // jump: rise, then fall back to the ground
    street.vy -= GRAVITY * dt; street.jumpY += street.vy * dt;
    if (street.jumpY <= 0) { street.jumpY = 0; street.vy = 0; }
  }
  const v = street.vantage;
  camera.position.set(street.x, ground(street.x, street.z) + (v ? v.eye : CURB + EYE) + street.jumpY, street.z);
  if (v) { camera.quaternion.copy(v.quat); return; }
  camera.rotation.set(-street.pitch, street.yaw, 0, "YXZ");
}

// Orbit keyboard: WASD/arrows move over the ground, Q/E rotate, R/F tilt, +/- and PgUp/PgDn zoom.
const _off = new THREE.Vector3(), _sph = new THREE.Spherical(), _fwd = new THREE.Vector3(), _rt = new THREE.Vector3();
function updateOrbitKeys(dt) {
  const k = (...c) => c.some((x) => keys.has(x)) ? 1 : 0;
  const fwd = k("KeyW", "ArrowUp") - k("KeyS", "ArrowDown"), side = k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft");
  const rot = k("KeyE") - k("KeyQ"), tilt = k("KeyF") - k("KeyR");
  const zoom = k("Equal", "NumpadAdd", "PageUp") - k("Minus", "NumpadSubtract", "PageDown");
  if (!(fwd || side || rot || tilt || zoom)) return;
  const fast = keys.has("ShiftLeft") ? 3 : 1;
  _off.subVectors(camera.position, orbit.target);
  if (fwd || side) {
    const speed = Math.max(10, _off.length() * 0.8) * fast * dt;
    camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    _rt.set(-_fwd.z, 0, _fwd.x);
    const move = _fwd.multiplyScalar(fwd * speed).addScaledVector(_rt, side * speed);
    orbit.target.add(move);
  }
  _sph.setFromVector3(_off);
  _sph.theta -= rot * 1.2 * fast * dt;
  _sph.phi = THREE.MathUtils.clamp(_sph.phi + tilt * 0.8 * fast * dt, 0.05, orbit.maxPolarAngle);
  _sph.radius = THREE.MathUtils.clamp(_sph.radius * Math.exp(-zoom * 1.5 * fast * dt), orbit.minDistance, orbit.maxDistance);
  camera.position.copy(orbit.target).add(_off.setFromSpherical(_sph));
  camera.lookAt(orbit.target);
  hashDirty = true;
}

// ---- URL hash: #v=street&x=..&z=..&yaw=..&pitch=..  or  #v=orbit&c=x,y,z&t=x,y,z ---------
let hashDirty = false;
const f1 = (n) => n.toFixed(1), f2 = (n) => n.toFixed(2);
function saveHash() { hashDirty = true; }
function writeHash() {
  if (!hashDirty) return; hashDirty = false;
  const ph = (photoUI.flat.checked ? "f" : "") + (photoUI.mapped.checked ? "m" : "");
  const off = photos.map((P, i) => P.enabled ? "" : i + 1).filter(Boolean).join(",");
  const extra = (ph ? `&ph=${ph}` : "") + (off ? `&poff=${off}` : "") + (street.vantage && mode === "street" ? `&at=${street.vantage.id}` : "");
  const h = (mode === "street"
    ? `v=street&x=${f1(street.x)}&z=${f1(street.z)}&yaw=${f2(street.yaw)}&pitch=${f2(street.pitch)}`
    : `v=orbit&c=${camera.position.toArray().map(f1)}&t=${orbit.target.toArray().map(f1)}`) + extra;
  history.replaceState(null, "", "#" + h);
}
setInterval(writeHash, 500);
orbit.addEventListener("end", saveHash);
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const ph = q.get("ph") || "";
  photoUI.flat.checked = ph.includes("f"); photoUI.mapped.checked = ph.includes("m");
  const off = (q.get("poff") || "").split(",").map(Number);
  photos.forEach((P, i) => { P.enabled = !off.includes(i + 1); P.checkbox.checked = P.enabled; });
  applyPhotoToggles();
  const at = photos.find((p) => p.id === q.get("at"));
  if (at) return goVantage(at);
  if (q.get("v") === "street")
    return setMode("street", { x: +q.get("x") || 0, z: +q.get("z") || 0, yaw: +q.get("yaw") || 0, pitch: +q.get("pitch") || 0 });
  const c = q.get("c")?.split(",").map(Number), t = q.get("t")?.split(",").map(Number);
  if (c?.length === 3 && t?.length === 3 && c.every(isFinite) && t.every(isFinite)) setMode("orbit", { pos: c, target: t });
  else setMode("orbit", presets[0]);
}

// ---- field photos ------------------------------------------------------------------------
// Photos are projected with their SfM pose and the camera's radial distortion (Mapillary
// perspective model: f normalised by max(w, h), k1, k2). Two toggles apply to all photos:
//  - flat:   each photo on a plane in front of its vantage (undistorted by the same projection)
//  - mapped: surfaces receive the projection. Per photo, a depth pass from its camera keeps
//            hidden surfaces from being painted. Where photos overlap, the first one in
//            photos.json that sees the surface wins (no blending).
const MAXP = 5;
const photos = [];
const photoUI = { flat: $("ph-flat"), mapped: $("ph-mapped") };
const PHOTO_FN = `
vec2 photoST(vec3 w, mat4 V, vec3 K, vec2 sc) { // world -> image [0,1]^2 (y down); outside when not in view
  vec4 pc = V * vec4(w, 1.0);
  if (pc.z < 0.3) return vec2(-1.0);
  vec2 n = pc.xy / pc.z; float r2 = dot(n, n);
  if (r2 > 4.0) return vec2(-1.0);
  float d = 1.0 + K.y * r2 + K.z * r2 * r2;
  return 0.5 + K.x * d * n * sc;
}
float photoEdge(vec2 st) { return smoothstep(0.0, 0.015, min(min(st.x, 1.0 - st.x), min(st.y, 1.0 - st.y))); }
`;
const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
const photoU = {
  photoOn: { value: 0 }, photoCount: { value: 0 }, photoEnabled: { value: Array(MAXP).fill(1) }, depthNF: { value: new THREE.Vector2(0.5, 800) },
  photoTex: { value: Array(MAXP).fill(blank) }, photoDepth: { value: Array(MAXP).fill(blank) },
  photoView: { value: Array.from({ length: MAXP }, () => new THREE.Matrix4()) },
  photoDepthMat: { value: Array.from({ length: MAXP }, () => new THREE.Matrix4()) },
  photoK: { value: Array.from({ length: MAXP }, () => new THREE.Vector3()) },
  photoScale: { value: Array.from({ length: MAXP }, () => new THREE.Vector2(1, 1)) },
};

// Patch the Lambert materials so they can receive the projected photos (unlit, replaces colour).
function patchMaterial(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, photoU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPhotoW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPhotoW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vPhotoW; uniform float photoOn; uniform int photoCount; uniform vec2 depthNF; uniform float photoEnabled[${MAXP}];
uniform sampler2D photoTex[${MAXP}]; uniform sampler2D photoDepth[${MAXP}];
uniform mat4 photoView[${MAXP}]; uniform mat4 photoDepthMat[${MAXP}];
uniform vec3 photoK[${MAXP}]; uniform vec2 photoScale[${MAXP}];
${PHOTO_FN}
float photoVisible(vec3 w, mat4 DM, sampler2D D) {
  vec4 dc = DM * vec4(w, 1.0);
  vec3 dn = dc.xyz / dc.w;
  if (any(greaterThan(abs(dn.xy), vec2(1.0)))) return 0.0;
  float z = texture2D(D, dn.xy * 0.5 + 0.5).x * 2.0 - 1.0;
  float n = depthNF.x, f = depthNF.y;
  float lin = 2.0 * n * f / (f + n - z * (f - n));
  return step(dc.w, lin + 0.3 + 0.015 * dc.w);
}`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
if (photoOn > 0.5) {
  bool photoDone = false;
  #pragma unroll_loop_start
  for ( int i = 0; i < ${MAXP}; i ++ ) {
    if (!photoDone && UNROLLED_LOOP_INDEX < photoCount && photoEnabled[ i ] > 0.5) {
      vec2 st = photoST(vPhotoW, photoView[ i ], photoK[ i ], photoScale[ i ]);
      float a = photoEdge(st);
      if (a > 0.0) a *= photoVisible(vPhotoW, photoDepthMat[ i ], photoDepth[ i ]);
      if (a > 0.0) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, texture2D(photoTex[ i ], vec2(st.x, 1.0 - st.y)).rgb, a);
        photoDone = a > 0.99;
      }
    }
  }
  #pragma unroll_loop_end
}`);
  };
  mat.customProgramCacheKey = () => "photo-v3";
  mat.needsUpdate = true;
}

// Invert the radial distortion: image offset u (normalised, = f*d*n) -> ray n.
function undistort(ux, uy, P) {
  let nx = ux / P.f, ny = uy / P.f;
  for (let i = 0; i < 30; i++) {
    const r2 = nx * nx + ny * ny, d = 1 + P.k1 * r2 + P.k2 * r2 * r2;
    nx = ux / (P.f * d); ny = uy / (P.f * d);
  }
  return [nx, ny];
}

function photoSetup(P) {
  // R_enu maps ENU (e, n, u) to camera (right, down, forward). three: x=e, y=u, z=-n.
  const R = P.R_enu, row = (i) => new THREE.Vector3(R[i][0], R[i][2], -R[i][1]);
  const right = row(0), down = row(1), fwd = row(2);
  const C = new THREE.Vector3(P.p[0], ground(P.p[0], P.p[1]) + P.h, P.p[1]);
  const view = new THREE.Matrix4().set(...[right, down, fwd].flatMap((a) => [a.x, a.y, a.z, -a.dot(C)]), 0, 0, 0, 1);
  const quat = new THREE.Quaternion().setFromRotationMatrix( // three.js camera: +x right, +y up, looks down -z
    new THREE.Matrix4().makeBasis(right, down.clone().negate(), fwd.clone().negate()));
  const mx = Math.max(P.width, P.height);
  const hx = 0.5 * P.width / mx, hy = 0.5 * P.height / mx;
  const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([ux, uy]) => undistort(ux, uy, P));
  const at = (nx, ny, dist) => C.clone().addScaledVector(fwd, dist).addScaledVector(right, nx * dist).addScaledVector(down, ny * dist);
  Object.assign(P, { right, down, fwd, C, view, quat, corners, at, scale: new THREE.Vector2(mx / P.width, mx / P.height),
    vfov: THREE.MathUtils.radToDeg(2 * Math.atan(undistort(0, hy, P)[1])),
    // points used to decide whether a photo's coverage is in the viewer's view
    probes: [C, ...[5, 20, 50].flatMap((d) => [at(0, 0, d), ...corners.map(([x, y]) => at(x, y, d))])] });
}

// Depth pass from each photo camera (the scene is static, so once per photo).
function renderPhotoDepth(P, i) {
  const vf = 2 * Math.atan(Math.max(...P.corners.map(([, y]) => Math.abs(y))) * 1.1);
  const cam = new THREE.PerspectiveCamera(Math.min(170, THREE.MathUtils.radToDeg(vf)), 1, depthNF().x, depthNF().y);
  cam.layers.set(1);
  cam.position.copy(P.C); cam.quaternion.copy(P.quat); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // aspect so the horizontal extent (corners, with distortion) is covered too
  cam.aspect = Math.max(...P.corners.map(([x]) => Math.abs(x))) * 1.1 / Math.tan(vf / 2); cam.updateProjectionMatrix();
  P.depthRT = new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048) });
  const on = photoU.photoOn.value; photoU.photoOn.value = 0; // never sample a depth texture while writing one
  renderer.setRenderTarget(P.depthRT); renderer.render(scene, cam); renderer.setRenderTarget(null);
  photoU.photoOn.value = on;
  photoU.photoDepth.value[i] = P.depthRT.depthTexture;
  photoU.photoDepthMat.value[i].multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}
const depthNF = () => photoU.depthNF.value;

// Flat photo: a plane D metres in front of the vantage, with a frustum outline and a marker.
function buildFlat(P) {
  const g0 = new THREE.Group(), D = 6;
  const ext = P.corners.reduce((a, [x, y]) => [Math.max(a[0], Math.abs(x)), Math.max(a[1], Math.abs(y))], [0, 0]);
  // plane big enough for every ray; the shader cuts it to the photo's (distorted) outline
  const g = new THREE.BufferGeometry().setFromPoints([P.at(-ext[0], -ext[1], D), P.at(ext[0], -ext[1], D),
    P.at(ext[0], ext[1], D), P.at(-ext[0], ext[1], D)]);
  g.setIndex([0, 2, 1, 0, 3, 2]);
  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: P.texture }, V: { value: P.view }, K: { value: new THREE.Vector3(P.f, P.k1, P.k2) }, sc: { value: P.scale } },
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `varying vec3 vW; uniform sampler2D tex; uniform mat4 V; uniform vec3 K; uniform vec2 sc; ${PHOTO_FN}
      void main() { vec2 st = photoST(vW, V, K, sc); if (photoEdge(st) <= 0.0) discard;
        gl_FragColor = vec4(texture2D(tex, vec2(st.x, 1.0 - st.y)).rgb, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const plane = new THREE.Mesh(g, mat); plane.renderOrder = 999;
  const pts = [];
  P.corners.forEach(([x, y], i) => {
    const [x2, y2] = P.corners[(i + 1) % 4];
    pts.push(P.C, P.at(x, y, D), P.at(x, y, D), P.at(x2, y2, D));
  });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xff7a00, depthTest: false }));
  lines.renderOrder = 998;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff7a00 }));
  dot.position.copy(P.C);
  const tag = document.createElement("div");
  tag.className = "label"; tag.textContent = String(P.n);
  Object.assign(tag.style, { color: "#fff", background: "#ff7a00", padding: "1px 6px", borderRadius: "9px" });
  const tagObj = new CSS2DObject(tag); tagObj.position.copy(P.C).add(new THREE.Vector3(0, 1.2, 0));
  g0.add(plane, lines, dot, tagObj);
  scene.add(g0);
  P.flat = g0;
}

function goVantage(P) {
  setMode("street", { x: P.p[0], z: P.p[1], vantage: { id: P.id, eye: P.h, quat: P.quat, fov: P.vfov } });
}

function applyPhotoToggles() {
  photos.forEach((P, i) => {
    P.flat.visible = photoUI.flat.checked && P.enabled;
    photoU.photoEnabled.value[i] = P.enabled ? 1 : 0;
  });
  photoU.photoOn.value = photoUI.mapped.checked ? 1 : 0;
  updatePhotoInfo(true);
  saveHash();
}

// "Photos in view": time range and credits for the shown photos whose coverage is on screen.
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "short",
  day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
let lastInfo = 0, lastKey = "";
function updatePhotoInfo(force = false) {
  const now = performance.now();
  if (!photos.length || (!force && now - lastInfo < 300)) return;
  lastInfo = now;
  const on = photoUI.flat.checked || photoUI.mapped.checked;
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const seen = on ? photos.filter((P) => P.enabled && P.probes.some((p) => frustum.containsPoint(p))) : [];
  const key = on + seen.map((P) => P.id).join();
  if (!force && key === lastKey) return;
  lastKey = key;
  const el = $("photo-time"), credit = $("photo-credit");
  el.hidden = !on; credit.hidden = !seen.length;
  if (!on) return;
  if (!seen.length) { el.textContent = "Photos in view: none"; return; }
  const t = seen.map((P) => P.captured_at).sort((a, b) => a - b);
  const a = timeFmt.format(t[0]), b = timeFmt.format(t[t.length - 1]);
  el.textContent = `Photos in view (${seen.length}): ` + (a === b ? a : `${a} – ${b}`);
  credit.replaceChildren(" · Photos ", ...seen.flatMap((P, i) => {
    const l = document.createElement("a");
    Object.assign(l, { href: P.url, target: "_blank", rel: "noopener", textContent: `${P.creator} ${new Date(P.captured_at).toISOString().slice(0, 10)}` });
    return i ? [", ", l] : [l];
  }), " via Mapillary, CC BY-SA 4.0");
}

async function setupPhotos() {
  let list = [];
  try { list = (await (await fetch(bust("./data/photos.json"))).json()).photos; } catch { return; }
  const loader = new THREE.TextureLoader();
  for (const P of list.slice(0, MAXP)) {
    P.texture = await loader.loadAsync(bust("./" + P.image));
    P.texture.colorSpace = THREE.SRGBColorSpace;
    P.texture.anisotropy = 8;
    photoSetup(P);
    P.n = photos.length + 1; P.enabled = true;
    photos.push(P);
  }
  if (!photos.length) return;
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.noPhoto) return;
    o.layers.enable(1);                       // seen by the photo depth passes
    if (o.material?.isMeshLambertMaterial) patchMaterial(o.material);
  });
  photos.forEach((P, i) => {
    photoU.photoTex.value[i] = P.texture;
    photoU.photoView.value[i] = P.view;
    photoU.photoK.value[i].set(P.f, P.k1, P.k2);
    photoU.photoScale.value[i].copy(P.scale);
    renderPhotoDepth(P, i);
  });
  photoU.photoCount.value = photos.length;
  for (const P of photos) {
    buildFlat(P);
    const label = `Photo vantage ${new Date(P.captured_at).toISOString().slice(0, 10)}`;
    presets.push({ name: label, photo: P });
    $("preset").add(new Option(label, presets.length - 1));
  }
  photoUI.flat.onchange = photoUI.mapped.onchange = applyPhotoToggles;
  // numbered per-photo checkboxes; the number is also the precedence order (1 wins)
  const box = $("photo-list");
  photos.forEach((P) => {
    const l = document.createElement("label"), c = document.createElement("input");
    c.type = "checkbox"; c.checked = true;
    c.onchange = () => { P.enabled = c.checked; applyPhotoToggles(); };
    l.title = `Photo ${P.n}: ${P.creator}, ${timeFmt.format(P.captured_at)}`;
    l.append(c, String(P.n));
    box.append(l);
    P.checkbox = c;
  });
  $("photo-toggles").hidden = false;
}

// ---- go ---------------------------------------------------------------------------------
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});

const S = await (await fetch(bust("./data/scene.json"))).json();
build(S);
await setupPhotos();
$("loading").remove();
readHash();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (mode === "street") updateStreet(dt); else { updateOrbitKeys(dt); orbit.update(); }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  updatePhotoInfo();
});
window.__scene = { scene, camera, S, photos }; // for debugging in the console
