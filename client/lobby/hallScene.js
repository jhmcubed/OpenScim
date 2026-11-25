// What the lobby's hall draws of its own, around its bosses and gateways: a
// moonlit observatory platform floating above a sea of cloud. The renderer
// asks for these meshes once (buildHallMeshes) and draws them every frame;
// hallShader.js draws them and moves what moves.
//
// The floor is lit where the stations are: each throws a pool of its group's
// colour, and a lane of the same colour runs to it from the tile the player
// arrives on. In the middle of the floor an astrolabe turns slowly.
import { packHsl } from "../util/packHsl.js";
import { hallShaderModes as modes } from "./hallShader.js";
import { gatewayStations, groups, plinthHeight, plinthRadius, platform, spawnPoint, stations } from "./hall.js";

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
    get size() {
      return alphas.length;
    },
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

// Where each station's light falls: a boss's plinth, or the mouth of a
// gateway's causeway at the rim.
const thresholdRadius = rimRadius - 0.9;
const stationPoint = (station) =>
  station.kind === "boss"
    ? station.centre
    : [cx + Math.cos(rad(station.angle)) * thresholdRadius, cy + Math.sin(rad(station.angle)) * thresholdRadius];

const lights = [
  ...stations.map((station) => ({ at: stationPoint(station), rgb: rgbOfCss(station.css), strength: 0.75, reach: 5.5 })),
  { at: spawnPoint, rgb: [1, 0.93, 0.8], strength: 0.35, reach: 4 },
  { at: [cx, cy], rgb: [1, 0.88, 0.6], strength: 0.3, reach: 6 },
];
const moonlight = [0.6, 0.66, 0.84];

// The light on the floor at a point, as RGB multipliers.
function lightAt(x, y) {
  const rgb = [...moonlight];
  for (const { at, rgb: colour, strength, reach } of lights) {
    const falloff = Math.max(0, 1 - Math.hypot(x - at[0], y - at[1]) / reach);
    for (let channel = 0; channel < 3; channel++) rgb[channel] += colour[channel] * strength * falloff * falloff;
  }
  // The rim falls a little darker than the middle.
  const edge = 1 - 0.18 * Math.max(0, (Math.hypot(x - cx, y - cy) - 11) / 6);
  return rgb.map((value) => Math.min(1.7, value * edge));
}

// --- Colours -----------------------------------------------------------

const moonstone = packHsl(152, 32, 84);
const darkStone = packHsl(160, 32, 62);
const rimStone = packHsl(160, 32, 46);
const underside = packHsl(165, 64, 30);
const railStone = packHsl(150, 32, 150);
const gold = packHsl(34, 160, 170);
const paleGold = packHsl(36, 96, 200);
const silver = packHsl(150, 64, 205);
const groupColour = (group) => packHsl(...groups[group].colour);

// --- The platform ------------------------------------------------------

function buildFloor(baseZ, gatewayFloor) {
  const floor = hallMesh();
  const rings = Math.round(rimRadius / 0.5), segments = 192;
  const grid = [];
  for (let ring = 0; ring <= rings; ring++) {
    const radius = (ring / rings) * rimRadius;
    const row = [];
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * TAU;
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      row.push(floor.vertex(x, y, baseZ, moonstone, 1, ...lightAt(x, y)));
    }
    grid.push(row);
  }
  for (let ring = 0; ring < rings; ring++)
    for (let segment = 0; segment < segments; segment++)
      floor.quad(grid[ring][segment], grid[ring][segment + 1], grid[ring + 1][segment + 1], grid[ring + 1][segment]);

  // The gateways' causeways, beyond the rim, on a grid of quarter tiles.
  const step = 0.25;
  const onCauseway = (x, y) => Math.hypot(x - cx, y - cy) > rimRadius - 0.3 && gatewayFloor(x, y);
  const sides = hallMesh();
  for (let x = 0; x < 64; x += step)
    for (let y = 0; y < 64; y += step) {
      if (!onCauseway(x + step / 2, y + step / 2)) continue;
      const corner = (u, v) => floor.vertex(u, v, baseZ, moonstone, 1, ...lightAt(u, v));
      floor.quad(corner(x, y), corner(x + step, y), corner(x + step, y + step), corner(x, y + step));
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

  // The rim: a band of stone, then the underside narrowing into the dark.
  const profile = [
    [rimRadius, 0, rimStone, 0.75], [rimRadius, -1.4, rimStone, 0.45], [rimRadius - 2.5, -3.2, underside, 0.4],
    [rimRadius - 7, -6.5, underside, 0.3], [4, -10, underside, 0.2], [0.5, -12.5, underside, 0.12],
  ];
  const segmentsRim = 128;
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

  return [floor.command("floor", 0, modes.floor), sides.command("sides", 0, modes.surface)];
}

// A cylinder's wall and its top, on the surface mesh.
function cylinder(mesh, x, y, radius, bottom, top, sideColour, topColour, light, segments = 40) {
  const centre = mesh.vertex(x, y, top, topColour, 1, ...light);
  let previous = null;
  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * TAU;
    const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
    // Faces turned towards the moon (north) catch more of its light.
    const facing = 0.7 + 0.25 * Math.sin(angle);
    const lower = mesh.vertex(px, py, bottom, sideColour, 1, ...light.map((value) => value * facing * 0.7));
    const upper = mesh.vertex(px, py, top, sideColour, 1, ...light.map((value) => value * facing));
    const rim = mesh.vertex(px, py, top, topColour, 1, ...light);
    if (previous) {
      mesh.quad(previous.lower, lower, upper, previous.upper);
      mesh.tri(centre, previous.rim, rim);
    }
    previous = { lower, upper, rim };
  }
}

// A flat ring on the floor, from `inner` to `outer`, between two angles.
function ring(mesh, x, y, z, inner, outer, colour, alpha, normalAt, from = 0, to = TAU, segments = 64) {
  let previous = null;
  for (let segment = 0; segment <= segments; segment++) {
    const angle = from + ((to - from) * segment) / segments;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const normal = normalAt(angle);
    const pair = [
      mesh.vertex(x + cos * inner, y + sin * inner, z, colour, alpha, ...normal),
      mesh.vertex(x + cos * outer, y + sin * outer, z, colour, alpha, ...normal),
    ];
    if (previous) mesh.quad(previous[0], pair[0], pair[1], previous[1]);
    previous = pair;
  }
}

function buildStations(baseZ) {
  const stone = hallMesh();
  const inlays = hallMesh();
  const auras = hallMesh();
  const pools = hallMesh();
  const top = baseZ + plinthHeight;
  stations.forEach((station, index) => {
    const colour = groupColour(station.group);
    const breathe = () => [0, index * 1.7, 0];
    if (station.kind === "boss") {
      const [x, y] = station.centre;
      const light = lightAt(x, y);
      cylinder(stone, x, y, plinthRadius + 0.25, baseZ, baseZ + 0.1, rimStone, darkStone, light);
      cylinder(stone, x, y, plinthRadius, baseZ + 0.1, top, rimStone, darkStone, light.map((value) => value * 0.85));
      ring(inlays, x, y, top + 0.008, plinthRadius - 0.32, plinthRadius - 0.16, colour, 1, breathe);
      ring(inlays, x, y, baseZ + 0.108, plinthRadius + 0.06, plinthRadius + 0.16, colour, 1, breathe);
      // A pool of the group's colour on the plinth, under the boss.
      const poolRadius = plinthRadius - 0.2;
      const poolCorner = (u, v) => pools.vertex(x + u * poolRadius, y + v * poolRadius, top + 0.004, colour, 0.55, u, v, index * 1.7);
      pools.quad(poolCorner(-1, -1), poolCorner(1, -1), poolCorner(1, 1), poolCorner(-1, 1));
      // A faint veil of the same colour rising round the boss, fading upward.
      const segments = 36, radius = plinthRadius - 0.1, height = 2.6;
      for (let segment = 0; segment < segments; segment++) {
        const a1 = (segment / segments) * TAU, a2 = ((segment + 1) / segments) * TAU;
        const around1 = (segment / segments) * 6, around2 = ((segment + 1) / segments) * 6;
        const p1 = [x + Math.cos(a1) * radius, y + Math.sin(a1) * radius];
        const p2 = [x + Math.cos(a2) * radius, y + Math.sin(a2) * radius];
        auras.quad(
          auras.vertex(...p1, top, colour, 0.13, around1, 0, index),
          auras.vertex(...p2, top, colour, 0.13, around2, 0, index),
          auras.vertex(...p2, top + height, colour, 0.13, around2, 1, index),
          auras.vertex(...p1, top + height, colour, 0.13, around1, 1, index),
        );
      }
    } else {
      // A gateway's threshold: an arc across the mouth of its causeway.
      const angle = rad(station.angle), half = 2.6 / thresholdRadius;
      ring(inlays, cx, cy, baseZ + 0.012, thresholdRadius - 0.12, thresholdRadius + 0.12, colour, 1, breathe, angle - half, angle + half, 16);
      ring(inlays, cx, cy, baseZ + 0.012, thresholdRadius + 0.5, thresholdRadius + 0.62, colour, 1, breathe, angle - half * 0.8, angle + half * 0.8, 16);
    }
  });
  return [
    stone.command("plinths", 1, modes.surface),
    inlays.command("station-inlays", 2, modes.inlay),
    pools.command("pools", 7, modes.pool, [0, 0, 0], "read"),
    auras.command("auras", 8, modes.aura, [0, 0, 0], "read"),
  ];
}

// The lanes: from the tile the player arrives on to every station, light
// let into the floor, with pulses running outward along them.
const medallionRadius = 4.6;
function buildLanes(baseZ) {
  const lanes = hallMesh();
  const z = baseZ + 0.012;
  stations.forEach((station, index) => {
    const target = stationPoint(station);
    const dx = target[0] - spawnPoint[0], dy = target[1] - spawnPoint[1];
    const length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length;
    const start = 2.1, end = length - (station.kind === "boss" ? plinthRadius + 0.45 : 0.3);
    const half = 0.07, colour = groupColour(station.group);
    let previous = null;
    for (let along = start; along <= end + 1e-6; along += 0.25) {
      const x = spawnPoint[0] + ux * along, y = spawnPoint[1] + uy * along;
      // The lanes pass under the astrolabe rather than across it.
      if (Math.hypot(x - cx, y - cy) < medallionRadius) {
        previous = null;
        continue;
      }
      const pair = [
        lanes.vertex(x - uy * half, y + ux * half, z, colour, 1, along, index * 0.9, 1),
        lanes.vertex(x + uy * half, y - ux * half, z, colour, 1, along, index * 0.9, 1),
      ];
      if (previous) lanes.quad(previous[0], previous[1], pair[1], pair[0]);
      previous = pair;
    }
  });
  // Where the player arrives: a ring, and a mark in each group's colour
  // pointing the way to each station.
  const [sx, sy] = spawnPoint;
  ring(lanes, sx, sy, z, 1.38, 1.45, railStone, 1, () => [0, 0, 0]);
  stations.forEach((station) => {
    const [tx, ty] = stationPoint(station);
    const angle = Math.atan2(ty - sy, tx - sx);
    const tip = [sx + Math.cos(angle) * 1.95, sy + Math.sin(angle) * 1.95];
    const left = [sx + Math.cos(angle + 0.12) * 1.58, sy + Math.sin(angle + 0.12) * 1.58];
    const right = [sx + Math.cos(angle - 0.12) * 1.58, sy + Math.sin(angle - 0.12) * 1.58];
    const colour = groupColour(station.group);
    lanes.tri(lanes.vertex(...left, z, colour, 1, 0, 0, 0), lanes.vertex(...tip, z, colour, 1, 0, 0, 0), lanes.vertex(...right, z, colour, 1, 0, 0, 0));
  });
  return [lanes.command("lanes", 2, modes.inlay)];
}

// The astrolabe let into the middle of the floor: a still star, and two
// rings of marks that turn slowly in opposite directions.
function buildMedallion(baseZ) {
  const still = hallMesh();
  const z = baseZ + 0.014;
  ring(still, cx, cy, z, medallionRadius - 0.3, medallionRadius - 0.15, gold, 1, () => [0, 0, 0], 0, TAU, 128);
  ring(still, cx, cy, z, 3.02, 3.1, paleGold, 1, () => [0, 2, 0], 0, TAU, 96);
  const points = 8;
  const centre = still.vertex(cx, cy, z + 0.002, paleGold, 1, 0, 1, 0);
  for (let point = 0; point < points; point++) {
    const angle = (point / points) * TAU + Math.PI / 2;
    const long = point % 2 === 0 ? 2.6 : 1.7;
    const colour = point % 2 === 0 ? paleGold : silver;
    const tip = still.vertex(cx + Math.cos(angle) * long, cy + Math.sin(angle) * long, z + 0.002, colour, 1, 0, 1, 0);
    const left = still.vertex(cx + Math.cos(angle + 0.32) * 0.55, cy + Math.sin(angle + 0.32) * 0.55, z + 0.002, colour, 1, 0, 1, 0);
    const right = still.vertex(cx + Math.cos(angle - 0.32) * 0.55, cy + Math.sin(angle - 0.32) * 0.55, z + 0.002, colour, 1, 0, 1, 0);
    still.tri(centre, left, tip);
    still.tri(centre, tip, right);
  }

  // The turning rings: each mark is a quad, turned about the centre by the shader.
  const turning = (name, inner, outer, marks, speed, colour) => {
    const mesh = hallMesh();
    const axis = [0, 0, speed];
    ring(mesh, cx, cy, z, inner - 0.08, inner, colour, 1, () => axis, 0, TAU, 96);
    for (let mark = 0; mark < marks; mark++) {
      const angle = (mark / marks) * TAU;
      const long = mark % 4 === 0;
      const width = long ? 0.06 : 0.035, reach = long ? outer : inner + (outer - inner) * 0.5;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      mesh.quad(
        mesh.vertex(cx + cos * inner - sin * width, cy + sin * inner + cos * width, z, colour, 1, ...axis),
        mesh.vertex(cx + cos * reach - sin * width, cy + sin * reach + cos * width, z, colour, 1, ...axis),
        mesh.vertex(cx + cos * reach + sin * width, cy + sin * reach - cos * width, z, colour, 1, ...axis),
        mesh.vertex(cx + cos * inner + sin * width, cy + sin * inner - cos * width, z, colour, 1, ...axis),
      );
    }
    return mesh.command(name, 3, modes.spin, [cx, cy, z]);
  };
  return [
    still.command("medallion", 2, modes.inlay),
    turning("astrolabe-outer", 3.35, 4.05, 48, 0.035, gold),
    turning("astrolabe-inner", 1.0, 1.35, 24, -0.06, silver),
  ];
}

// A low rail round the rim, open where the causeways leave it.
function buildRail(baseZ) {
  const rail = hallMesh();
  const openings = gatewayStations.map((station) => rad(station.angle));
  const radius = rimRadius - 0.2;
  const isOpen = (angle) => openings.some((opening) => Math.abs(Math.atan2(Math.sin(angle - opening), Math.cos(angle - opening))) < 0.19);
  const posts = 56;
  const box = (x, y, angle, halfAlong, halfAcross, bottom, top, colour) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const corner = (a, b) => [x + cos * a - sin * b, y + sin * a + cos * b];
    const light = lightAt(x, y);
    const corners = [corner(-halfAlong, -halfAcross), corner(halfAlong, -halfAcross), corner(halfAlong, halfAcross), corner(-halfAlong, halfAcross)];
    for (let side = 0; side < 4; side++) {
      const [a, b] = [corners[side], corners[(side + 1) % 4]];
      const facing = 0.6 + 0.3 * Math.sin(Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2);
      rail.quad(
        rail.vertex(...a, bottom, colour, 1, ...light.map((value) => value * facing * 0.75)),
        rail.vertex(...b, bottom, colour, 1, ...light.map((value) => value * facing * 0.75)),
        rail.vertex(...b, top, colour, 1, ...light.map((value) => value * facing)),
        rail.vertex(...a, top, colour, 1, ...light.map((value) => value * facing)),
      );
    }
    rail.quad(...corners.map((point) => rail.vertex(...point, top, colour, 1, ...light)));
  };
  for (let post = 0; post < posts; post++) {
    const angle = (post / posts) * TAU;
    if (isOpen(angle)) continue;
    const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
    box(x, y, angle + Math.PI / 2, 0.13, 0.13, baseZ, baseZ + 0.95, railStone);
    box(x, y, angle + Math.PI / 2, 0.17, 0.17, baseZ + 0.95, baseZ + 1.05, railStone);
    const next = ((post + 1) / posts) * TAU;
    if (isOpen(next)) continue;
    const middle = (angle + next) / 2, span = radius * Math.sin((next - angle) / 2);
    box(cx + Math.cos(middle) * radius * Math.cos((next - angle) / 2), cy + Math.sin(middle) * radius * Math.cos((next - angle) / 2),
      middle + Math.PI / 2, span, 0.07, baseZ + 0.78, baseZ + 0.88, railStone);
  }
  return [rail.command("rail", 1, modes.surface)];
}

// --- The sky -----------------------------------------------------------

function buildSky(baseZ) {
  const dome = hallMesh();
  const radius = 95, rings = 24, segments = 48;
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

  // The moon, low in the north beyond the raids' door.
  const moon = hallMesh();
  const azimuth = rad(64), elevation = rad(11), distance = 80, half = 10;
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

function buildMotes(baseZ) {
  const random = seeded(0x5eed1);
  const drifting = hallMesh();
  const pale = packHsl(150, 64, 210);
  for (let index = 0; index < 220; index++) {
    const angle = random() * TAU, radius = Math.sqrt(random()) * 19;
    mote(drifting, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, baseZ + 0.3 + random() * 4, pale, 0.5, random());
  }
  // Sparks of each group's colour, rising from its plinths and thresholds.
  const sparks = hallMesh();
  for (const station of stations) {
    const [x, y] = stationPoint(station);
    const colour = packHsl(station.colour[0], station.colour[1], 190);
    const spread = station.kind === "boss" ? plinthRadius - 0.1 : 1.6;
    const z = baseZ + (station.kind === "boss" ? plinthHeight : 0);
    for (let index = 0; index < 14; index++) {
      const angle = random() * TAU;
      mote(sparks, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, z, colour, 0.8, random());
    }
  }
  return [
    drifting.command("motes", 9, modes.motes, [2.2, 0.07, 1], "read"),
    sparks.command("sparks", 9, modes.motes, [3.2, 0.055, 1.3], "read"),
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
    medallion: buildMedallion(baseZ),
    lanes: buildLanes(baseZ),
    stations: buildStations(baseZ),
    motes: buildMotes(baseZ),
  };
}
