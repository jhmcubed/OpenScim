// What the lobby's hall draws of its own, around its bosses and gateways: a
// platform of moonlit stone floating above a sea of cloud, under Zanaris and
// the aurora. The renderer asks for these meshes once (buildHallMeshes) and
// draws them every frame; hallShader.js draws them and moves what moves.
//
// The floor is lit by Zanaris, teal and cold, and each station throws a pool
// of its group's warmer colour. A seal is let into the middle of the floor.
// Every boss stands on a pedestal, and lanterns stand along the rail.
import { packHsl } from "../util/packHsl.js";
import { beamMesh } from "./beams.js";
import { hallShaderModes as modes } from "./hallShader.js";
import { gatewayStations, groups, plinthRadius, platform, spawnPoint, stations } from "./hall.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const { x: cx, y: cy, radius: rimRadius } = platform;
const TAU = Math.PI * 2;
const rad = (degrees) => (degrees * Math.PI) / 180;

// A seeded generator, so that the hall is the same on every visit.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Collects one mesh for the "scene-lobby" program.
function hallMesh() {
  const positions = [], normals = [], colors = [], alphas = [], indices = [];
  const vertex = (x, y, z, color, alpha = 1, nx = 1, ny = 1, nz = 1) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(color);
    alphas.push(alpha);
    return alphas.length - 1;
  };
  return {
    vertex,
    quad: (a, b, c, d) => indices.push(a, b, c, a, c, d),
    tri: (a, b, c) => indices.push(a, b, c),
    // `depth` "readwrite" draws it solid; "read" blends it over what is behind.
    command(meshId, zIndex, mode, params = [0, 0, 0], depth = "readwrite") {
      const command = {
        kind: "mesh3d",
        meshId: "lobby-hall-" + meshId,
        materialId: "osrs-terrain",
        modelMatrix: identity,
        cullFace: "none",
        zIndex,
        depth,
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        perVertexHslColors: new Float32Array(colors),
        perVertexAlphas: new Float32Array(alphas),
        indices: alphas.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
        shaderId: "scene-lobby",
        uniforms: { u_animParams: [mode, ...params] },
      };
      if (depth === "read") command.blend = "normal";
      return command;
    },
  };
}

// --- Light -------------------------------------------------------------

const rgbOfCss = (css) => [1, 3, 5].map((index) => parseInt(css.slice(index, index + 2), 16) / 255);

// Where each station's light falls: a boss's pedestal, or the mouth of a
// gateway's causeway at the rim.
const thresholdRadius = rimRadius - 1.2;
const stationPoint = (station) =>
  station.kind === "boss"
    ? station.centre
    : [cx + Math.cos(rad(station.angle)) * thresholdRadius, cy + Math.sin(rad(station.angle)) * thresholdRadius];

// The moon's light, a little brighter in the north where Zanaris hangs, and
// each station's own.
const zanarisLight = [0.42, 0.57, 0.63];
const lights = [
  ...stations.map((station) => ({ at: stationPoint(station), rgb: rgbOfCss(station.css), strength: station.kind === "boss" ? 0.55 : 0.4, reach: 5 })),
  { at: spawnPoint, rgb: [0.7, 0.95, 1], strength: 0.25, reach: 5 },
  { at: [cx, cy], rgb: [0.45, 1, 0.92], strength: 0.4, reach: 8 },
];

// The light on the floor at a point, as RGB multipliers.
function lightAt(x, y) {
  const north = 0.92 + 0.12 * Math.max(-1, Math.min(1, (y - cy) / rimRadius));
  const rgb = zanarisLight.map((value) => value * north);
  for (const { at, rgb: colour, strength, reach } of lights) {
    const falloff = Math.max(0, 1 - Math.hypot(x - at[0], y - at[1]) / reach);
    for (let channel = 0; channel < 3; channel++) rgb[channel] += colour[channel] * strength * falloff * falloff;
  }
  return rgb.map((value) => Math.min(1.6, value));
}

// --- Colours -----------------------------------------------------------

const slate = packHsl(140, 32, 72);
const rimStone = packHsl(140, 32, 40);
const underside = packHsl(140, 64, 26);
const railStone = packHsl(140, 32, 104);
const lanternGlass = packHsl(118, 192, 150);
const silver = packHsl(130, 64, 205);
const groupColour = (group) => packHsl(...groups[group].colour);

// --- The platform ------------------------------------------------------

function buildFloor(baseZ, gatewayFloor) {
  const floor = hallMesh();
  const rings = Math.round(rimRadius / 0.5), segments = 224;
  const grid = [];
  for (let ring = 0; ring <= rings; ring++) {
    const radius = (ring / rings) * rimRadius;
    const row = [];
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * TAU;
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      row.push(floor.vertex(x, y, baseZ, slate, 1, ...lightAt(x, y)));
    }
    grid.push(row);
  }
  for (let ring = 0; ring < rings; ring++)
    for (let segment = 0; segment < segments; segment++)
      floor.quad(grid[ring][segment], grid[ring][segment + 1], grid[ring + 1][segment + 1], grid[ring + 1][segment]);

  // The gateways' causeways and daises, beyond the rim, on a grid of quarter
  // tiles: the same glass as the platform, on walls of stone.
  const step = 0.25;
  const onCauseway = (x, y) => Math.hypot(x - cx, y - cy) > rimRadius - 0.3 && gatewayFloor(x, y);
  const causeway = hallMesh();
  const sides = hallMesh();
  for (let x = -16; x < 80; x += step)
    for (let y = -16; y < 80; y += step) {
      if (!onCauseway(x + step / 2, y + step / 2)) continue;
      const corner = (u, v) => causeway.vertex(u, v, baseZ, slate, 1, ...lightAt(u, v));
      causeway.quad(corner(x, y), corner(x + step, y), corner(x + step, y + step), corner(x, y + step));
      // A wall down from every edge that has no floor beside it.
      for (const [dx, dy, x1, y1, x2, y2] of [
        [0, -1, x, y, x + step, y], [1, 0, x + step, y, x + step, y + step],
        [0, 1, x + step, y + step, x, y + step], [-1, 0, x, y + step, x, y],
      ]) {
        const nx = x + step / 2 + dx * step, ny = y + step / 2 + dy * step;
        if (onCauseway(nx, ny) || Math.hypot(nx - cx, ny - cy) < rimRadius - 0.05) continue;
        const shade = lightAt(x1, y1).map((value) => value * 0.55);
        sides.quad(
          sides.vertex(x1, y1, baseZ, rimStone, 1, ...shade),
          sides.vertex(x2, y2, baseZ, rimStone, 1, ...shade),
          sides.vertex(x2, y2, baseZ - 1.4, underside, 1, ...shade.map((value) => value * 0.6)),
          sides.vertex(x1, y1, baseZ - 1.4, underside, 1, ...shade.map((value) => value * 0.6)),
        );
      }
    }

  // The rim: a band of stone, and a ledge under its inside edge that holds
  // the glass. Nothing else is under the floor, so the cloud shows through.
  const profile = [
    [rimRadius, 0, rimStone, 0.75], [rimRadius, -1.4, rimStone, 0.45], [rimRadius - 1.1, -1.4, underside, 0.4], [rimRadius - 1.1, -0.9, underside, 0.3],
  ];
  const segmentsRim = 160;
  const rows = profile.map(([radius, dz, colour, light]) => {
    const row = [];
    for (let segment = 0; segment <= segmentsRim; segment++) {
      const angle = (segment / segmentsRim) * TAU;
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      const lit = lightAt(cx + Math.cos(angle) * (rimRadius - 0.5), cy + Math.sin(angle) * (rimRadius - 0.5));
      row.push(sides.vertex(x, y, baseZ + dz, colour, 1, ...lit.map((value) => value * light)));
    }
    return row;
  });
  for (let row = 0; row < rows.length - 1; row++)
    for (let segment = 0; segment < segmentsRim; segment++)
      sides.quad(rows[row][segment], rows[row][segment + 1], rows[row + 1][segment + 1], rows[row + 1][segment]);

  return [
    floor.command("floor", 0, modes.floor, [0, 0, 0], "read"),
    causeway.command("causeways", 0, modes.floor, [0, 0, 0], "read"),
    sides.command("sides", 0, modes.surface),
  ];
}

// A ring of `segments` facets from `bottom` to `top`, and its top, on a surface mesh.
function drum(mesh, x, y, radius, bottom, top, sideColour, topColour, light, { segments = 48, topRadius = radius } = {}) {
  const centre = mesh.vertex(x, y, top, topColour, 1, ...light);
  let previous = null;
  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * TAU;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Faces turned towards Zanaris (north) catch more of its light.
    const facing = 0.68 + 0.27 * sin;
    const lower = mesh.vertex(x + cos * radius, y + sin * radius, bottom, sideColour, 1, ...light.map((value) => value * facing * 0.7));
    const upper = mesh.vertex(x + cos * topRadius, y + sin * topRadius, top, sideColour, 1, ...light.map((value) => value * facing));
    const rim = mesh.vertex(x + cos * topRadius, y + sin * topRadius, top, topColour, 1, ...light);
    if (previous) {
      mesh.quad(previous.lower, lower, upper, previous.upper);
      mesh.tri(centre, previous.rim, rim);
    }
    previous = { lower, upper, rim };
  }
}

// A flat ring from `inner` to `outer`.
function ring(mesh, x, y, z, inner, outer, colour, alpha, normal, segments = 64) {
  let previous = null;
  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * TAU;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const pair = [mesh.vertex(x + cos * inner, y + sin * inner, z, colour, alpha, ...normal), mesh.vertex(x + cos * outer, y + sin * outer, z, colour, alpha, ...normal)];
    if (previous) mesh.quad(previous[0], pair[0], pair[1], previous[1]);
    previous = pair;
  }
}
// A soft disc of light.
function pool(mesh, x, y, z, radius, colour, alpha, phase) {
  const corner = (u, v) => mesh.vertex(x + u * radius, y + v * radius, z, colour, alpha, u, v, phase);
  mesh.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
}

// The pedestals, made of what the floor is: a drum of dark glass-black stone
// on a low step, one fine line of the floor's gold round its top, and a soft
// pool of its group's light under the boss. Each throws a faint pool of that
// light on the glass about it.
const pedestalStone = packHsl(132, 96, 20);
const pedestalTop = packHsl(132, 96, 15);
const trimGold = packHsl(30, 128, 118);
function buildPedestals(baseZ) {
  const stone = hallMesh();
  const trim = hallMesh();
  const pools = hallMesh();
  const floorPools = hallMesh();
  // Gold is lit by the moon alone, so every trim reads the same.
  const goldLight = [0.9, 0.9, 0.9];
  stations.forEach((station, index) => {
    const colour = groupColour(station.group);
    const phase = index * 1.7;
    if (station.kind !== "boss") return;
    const [x, y] = station.centre;
    const top = baseZ + station.standHeight;
    // The moon's light and a little of the boss's own, not the full pool.
    const light = lightAt(x, y).map((value, channel) => Math.min(value, zanarisLight[channel] * 1.5));
    drum(stone, x, y, plinthRadius + 0.24, baseZ, baseZ + 0.12, pedestalStone, pedestalTop, light, { topRadius: plinthRadius + 0.18 });
    drum(stone, x, y, plinthRadius, baseZ + 0.12, top - 0.06, pedestalStone, pedestalTop, light.map((value) => value * 0.9));
    drum(stone, x, y, plinthRadius, top - 0.06, top, pedestalStone, pedestalTop, light, { topRadius: plinthRadius - 0.05 });
    // One line of gold round the top, as fine as the floor's inlays.
    ring(trim, x, y, top + 0.004, plinthRadius - 0.16, plinthRadius - 0.08, trimGold, 1, goldLight);
    pool(pools, x, y, top + 0.006, plinthRadius - 0.3, colour, 0.22, phase);
    pool(floorPools, x, y, baseZ + 0.008, plinthRadius + 2.2, colour, 0.12, phase);
  });
  // A halo of each boss's light, rising faintly behind it.
  const halos = stations
    .filter((station) => station.kind === "boss")
    .map((station) => ({ x: station.centre[0], y: station.centre[1], z: baseZ + station.standHeight, height: 6, width: 3.6, colour: packHsl(station.colour[0], station.colour[1], 170), alpha: 0.16 }));
  return [
    stone.command("pedestals", 1, modes.surface),
    trim.command("pedestal-trim", 1, modes.surface),
    floorPools.command("floor-pools", 1, modes.pool, [0, 0, 0], "read"),
    pools.command("pedestal-pools", 7, modes.pool, [0, 0, 0], "read"),
    beamMesh("boss-halos", halos),
  ];
}

// The thresholds: an arc of each gateway's colour across the mouth of its causeway.
function buildThresholds(baseZ) {
  const inlays = hallMesh();
  gatewayStations.forEach((station, index) => {
    const angle = rad(station.angle), half = 2.9 / thresholdRadius;
    const colour = groupColour(station.group);
    for (const [inner, outer, width] of [[thresholdRadius - 0.1, thresholdRadius + 0.1, 1], [thresholdRadius + 0.45, thresholdRadius + 0.53, 0.8]]) {
      let previous = null;
      for (let segment = 0; segment <= 16; segment++) {
        const a = angle - half * width + (2 * half * width * segment) / 16;
        const pair = [
          inlays.vertex(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, baseZ + 0.012, colour, 1, 0, index * 1.3, 0),
          inlays.vertex(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer, baseZ + 0.012, colour, 1, 0, index * 1.3, 0),
        ];
        if (previous) inlays.quad(previous[0], pair[0], pair[1], previous[1]);
        previous = pair;
      }
    }
  });
  return [inlays.command("thresholds", 2, modes.inlay)];
}

// The seal in the middle of the floor (hallShader.js draws all of it).
const sealRadius = 6;
function buildSeal(baseZ) {
  const seal = hallMesh();
  const corner = (u, v) => seal.vertex(cx + u * sealRadius, cy + v * sealRadius, baseZ + 0.01, silver, 1, u * sealRadius, v * sealRadius, 1);
  seal.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
  return [seal.command("seal", 2, modes.seal, [sealRadius, 0, 0], "read")];
}

// A low rail round the rim, open where the causeways leave it, with a lantern
// of Zanaris's light on every fourth post.
function buildRail(baseZ) {
  const rail = hallMesh();
  const lanterns = hallMesh();
  const glows = hallMesh();
  const openings = gatewayStations.map((station) => rad(station.angle));
  const radius = rimRadius - 0.2;
  const isOpen = (angle) => openings.some((opening) => Math.abs(Math.atan2(Math.sin(angle - opening), Math.cos(angle - opening))) < 0.16);
  const posts = 72;
  const box = (mesh, x, y, angle, halfAlong, halfAcross, bottom, top, colour, normalScale = 1) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const corner = (a, b) => [x + cos * a - sin * b, y + sin * a + cos * b];
    const light = lightAt(x, y).map((value) => value * normalScale);
    const corners = [corner(-halfAlong, -halfAcross), corner(halfAlong, -halfAcross), corner(halfAlong, halfAcross), corner(-halfAlong, halfAcross)];
    for (let side = 0; side < 4; side++) {
      const [a, b] = [corners[side], corners[(side + 1) % 4]];
      const facing = 0.6 + 0.3 * Math.sin(Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2);
      mesh.quad(
        mesh.vertex(...a, bottom, colour, 1, ...light.map((value) => value * facing * 0.75)),
        mesh.vertex(...b, bottom, colour, 1, ...light.map((value) => value * facing * 0.75)),
        mesh.vertex(...b, top, colour, 1, ...light.map((value) => value * facing)),
        mesh.vertex(...a, top, colour, 1, ...light.map((value) => value * facing)),
      );
    }
    mesh.quad(...corners.map((point) => mesh.vertex(...point, top, colour, 1, ...light)));
  };
  for (let post = 0; post < posts; post++) {
    const angle = (post / posts) * TAU;
    if (isOpen(angle)) continue;
    const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
    const lantern = post % 4 === 0;
    box(rail, x, y, angle + Math.PI / 2, 0.12, 0.12, baseZ, baseZ + (lantern ? 1.25 : 0.95), railStone);
    box(rail, x, y, angle + Math.PI / 2, 0.16, 0.16, baseZ + (lantern ? 1.25 : 0.95), baseZ + (lantern ? 1.33 : 1.03), railStone);
    if (lantern) {
      box(lanterns, x, y, angle + Math.PI / 2, 0.07, 0.07, baseZ + 1.33, baseZ + 1.5, lanternGlass, 1.2);
      pool(glows, x, y, baseZ + 0.01, 2.4, lanternGlass, 0.22, post * 0.37);
    }
    const next = ((post + 1) / posts) * TAU;
    if (isOpen(next)) continue;
    const middle = (angle + next) / 2, span = radius * Math.sin((next - angle) / 2);
    box(rail, cx + Math.cos(middle) * radius * Math.cos((next - angle) / 2), cy + Math.sin(middle) * radius * Math.cos((next - angle) / 2),
      middle + Math.PI / 2, span, 0.06, baseZ + 0.8, baseZ + 0.89, railStone);
  }
  // A soft glow about each lantern, turned to the camera.
  const lanternHalos = [];
  for (let post = 0; post < posts; post += 4) {
    const angle = (post / posts) * TAU;
    if (isOpen(angle)) continue;
    lanternHalos.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, z: baseZ + 1.1, height: 0.8, width: 0.75, colour: lanternGlass, alpha: 0.32 });
  }
  return [
    rail.command("rail", 1, modes.surface),
    lanterns.command("lanterns", 2, modes.inlay),
    glows.command("lantern-glows", 1, modes.pool, [0, 0, 0], "read"),
    beamMesh("lantern-halos", lanternHalos),
  ];
}

// --- The sky -----------------------------------------------------------

function buildSky(baseZ) {
  const dome = hallMesh();
  const radius = 95, rings = 28, segments = 56;
  const rows = [];
  for (let ring = 0; ring <= rings; ring++) {
    const polar = (ring / rings) * Math.PI;
    const row = [];
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * TAU;
      row.push(dome.vertex(cx + Math.sin(polar) * Math.cos(angle) * radius, cy + Math.sin(polar) * Math.sin(angle) * radius, baseZ + Math.cos(polar) * radius, 0));
    }
    rows.push(row);
  }
  for (let ring = 0; ring < rings; ring++)
    for (let segment = 0; segment < segments; segment++)
      dome.quad(rows[ring][segment], rows[ring][segment + 1], rows[ring + 1][segment + 1], rows[ring + 1][segment]);

  // Zanaris, in the north-east above the raids.
  const moon = hallMesh();
  const azimuth = rad(72), elevation = rad(11), distance = 80, half = 17;
  const mx = cx + Math.cos(elevation) * Math.cos(azimuth) * distance;
  const my = cy + Math.cos(elevation) * Math.sin(azimuth) * distance;
  const mz = baseZ + Math.sin(elevation) * distance;
  const right = [-Math.sin(azimuth), Math.cos(azimuth), 0];
  const up = [-Math.sin(elevation) * Math.cos(azimuth), -Math.sin(elevation) * Math.sin(azimuth), Math.cos(elevation)];
  const corner = (u, v) => moon.vertex(mx + (right[0] * u + up[0] * v) * half, my + (right[1] * u + up[1] * v) * half, mz + (right[2] * u + up[2] * v) * half, silver, 1, u, v, 0);
  moon.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));

  // The sea of cloud far below.
  const clouds = hallMesh();
  const cloudRings = 24, cloudSegments = 64, cloudZ = baseZ - 18;
  const cloudRows = [];
  for (let ring = 0; ring <= cloudRings; ring++) {
    const r = (ring / cloudRings) * 95;
    const row = [];
    for (let segment = 0; segment <= cloudSegments; segment++) {
      const angle = (segment / cloudSegments) * TAU;
      row.push(clouds.vertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cloudZ, 0));
    }
    cloudRows.push(row);
  }
  for (let ring = 0; ring < cloudRings; ring++)
    for (let segment = 0; segment < cloudSegments; segment++)
      clouds.quad(cloudRows[ring][segment], cloudRows[ring][segment + 1], cloudRows[ring + 1][segment + 1], cloudRows[ring + 1][segment]);

  return [
    dome.command("sky", -10, modes.sky, [baseZ, 0, 0]),
    clouds.command("clouds", -9, modes.clouds, [baseZ, 0, 0], "read"),
    moon.command("moon", -8, modes.moon, [0, 0, 0], "read"),
  ];
}

// --- Motes -------------------------------------------------------------

function mote(mesh, x, y, z, colour, alpha, seed) {
  const corner = (u, v) => mesh.vertex(x, y, z, colour, alpha, u, v, seed);
  mesh.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
}

// Specks of Zanaris's light drifting over the hall, and sparks of each
// group's colour rising from its pedestals.
function buildMotes(baseZ) {
  const random = seeded(0x5eed1);
  const drifting = hallMesh();
  const pale = packHsl(118, 128, 200);
  for (let index = 0; index < 260; index++) {
    const angle = random() * TAU, radius = Math.sqrt(random()) * 23;
    mote(drifting, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, baseZ + 0.3 + random() * 4.5, pale, 0.55, random());
  }
  const sparks = hallMesh();
  for (const station of stations) {
    if (station.kind !== "boss") continue;
    const [x, y] = station.centre;
    const colour = packHsl(station.colour[0], station.colour[1], 190);
    for (let index = 0; index < 10; index++) {
      const angle = random() * TAU;
      mote(sparks, x + Math.cos(angle) * (plinthRadius - 0.2), y + Math.sin(angle) * (plinthRadius - 0.2), baseZ + station.standHeight, colour, 0.7, random());
    }
  }
  return [
    drifting.command("motes", 9, modes.motes, [2, 0.06, 0.8], "read"),
    sparks.command("sparks", 9, modes.motes, [2.6, 0.05, 1.1], "read"),
  ];
}

// --- All of it ---------------------------------------------------------

// The parts, each a list of commands, by the name the debug flags use to
// hide one: "lobby_<name>": false.
export function buildHallMeshes({ baseZ, gatewayFloor }) {
  return {
    sky: buildSky(baseZ),
    floor: buildFloor(baseZ, gatewayFloor),
    rail: buildRail(baseZ),
    seal: buildSeal(baseZ),
    thresholds: buildThresholds(baseZ),
    pedestals: buildPedestals(baseZ),
    motes: buildMotes(baseZ),
  };
}
