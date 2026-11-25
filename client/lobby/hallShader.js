// The "scene-lobby" program: everything the lobby's hall draws of its own
// (lobby/hallScene.js builds the meshes, lobby/beams.js the beams). Its vertex
// shader takes the same inputs as the renderer's scene shaders; a mesh picks
// how it is drawn with uniforms.u_animParams = [mode, a, b, c]:
//
//   10 floor    the floor of the platform and the causeways: a tile of dark
//               smoked glass on every game tile, as the old lobby's were, with
//               the cloud below showing through, inlaid bands and a border by
//               the rim. normal = the light on it (RGB)
//   11 inlay    light let into stone that breathes slowly. normal.y is a phase
//   13 motes    specks of light that drift and fade. Every corner of one has
//               its centre for position; normal = (corner x, corner y, seed).
//               a = how high one rises (tiles), b = its size, c = its speed
//   15 sky      the dome: the colour comes from the direction. a = floor height
//   16 moon     Zanaris, its glow and its halo; normal.xy runs from -1 to 1 across
//   17 clouds   the sea of cloud below the hall. a = floor height
//   18 pool     a soft disc of light; normal.xy runs from -1 to 1 across,
//               normal.z is a phase for its slow breathing
//   19 surface  lit stone without paving: pedestals, rails, the rim
//   20 seal     the seal let into the middle of the floor; normal.xy is the
//               point in tiles from its middle, a = its radius
//   21 beam     a column of light that turns to face the camera (beams.js):
//               normal = (across -1..1, up 0..1, width in tiles)
//
// The light of the hall is the moon's: teal and cold, with the warmer colour
// of each group about its own stations. The motion is slow and steady:
// nothing flickers, and a speck that drifts close to the camera fades out.

import { platform } from "./gateway.js";

export const hallShaderModes = { floor: 10, inlay: 11, motes: 13, sky: 15, moon: 16, clouds: 17, pool: 18, surface: 19, seal: 20, beam: 21 };

// The platform's centre, which the sky, the paving and the seal are drawn
// about, and the radius of its border by the rim.
const centre = `vec2(${platform.x.toFixed(1)}, ${platform.y.toFixed(1)})`;
const rimRadius = (platform.radius - 0.6).toFixed(2);

export const hallVertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=4) in float a_hslColor;
layout(location=6) in float a_alpha;
uniform mat4 u_viewProjMatrix;
uniform float u_currentTick;
uniform float u_zBias;
uniform vec4 u_animParams;
out vec3 v_worldPos;
out vec3 v_normal;
out vec4 v_color;
out vec2 v_corner;

const float OSRS_PALETTE_GAMMA = 0.6;
float when_lt(float x, float y) { return max(sign(y - x), 0.0); }
vec3 hslToRgb(int hsl) {
  const float onethird = 1.0 / 3.0;
  const float twothird = 2.0 / 3.0;
  const float rcpsixth = 6.0;
  float hue = float(hsl >> 10) / 64.0 + 0.0078125;
  float sat = float((hsl >> 7) & 0x7) / 8.0 + 0.0625;
  float lum = float(hsl & 0x7f) / 128.0;
  vec3 xt = vec3(rcpsixth * (hue - twothird), 0.0, rcpsixth * (1.0 - hue));
  xt = mix(xt, vec3(0.0, rcpsixth * (twothird - hue), rcpsixth * (hue - onethird)), when_lt(hue, twothird));
  xt = mix(xt, vec3(rcpsixth * (onethird - hue), rcpsixth * hue, 0.0), when_lt(hue, onethird));
  xt = min(xt, 1.0);
  float sat2 = 2.0 * sat;
  float satinv = 1.0 - sat;
  float luminv = 1.0 - lum;
  float lum2m1 = (2.0 * lum) - 1.0;
  vec3 ct = (sat2 * xt) + satinv;
  vec3 rgb = mix((luminv * ct) + lum2m1, lum * ct, when_lt(lum, 0.5));
  return pow(rgb, vec3(OSRS_PALETTE_GAMMA));
}

void main() {
  float mode = u_animParams.x;
  float seconds = u_currentTick * 0.6;
  vec3 pos = a_position;
  float alpha = a_alpha;
  v_corner = vec2(0.0);

  if (mode > 12.5 && mode < 13.5) {
    float seed = a_normal.z;
    float period = mix(10.0, 18.0, fract(seed * 7.13)) / u_animParams.w;
    float life = fract(seconds / period + seed);
    pos.z += life * u_animParams.y;
    pos.x += sin(seconds * 0.23 + seed * 40.0) * 0.6;
    pos.y += cos(seconds * 0.19 + seed * 23.0) * 0.6;
    alpha *= smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.6, 1.0, life));
    // Turned to face the camera: its right and up are the first two rows of the view.
    vec3 right = normalize(vec3(u_viewProjMatrix[0][0], u_viewProjMatrix[1][0], u_viewProjMatrix[2][0]));
    vec3 up = normalize(vec3(u_viewProjMatrix[0][1], u_viewProjMatrix[1][1], u_viewProjMatrix[2][1]));
    float size = u_animParams.z * mix(0.7, 1.3, fract(seed * 3.7));
    pos += (right * a_normal.x + up * a_normal.y) * size;
    v_corner = a_normal.xy;
  } else if (mode > 20.5 && mode < 21.5) {
    // A beam turns about its own upright axis to face the camera.
    vec2 right = normalize(vec2(u_viewProjMatrix[0][0], u_viewProjMatrix[1][0]) + vec2(1e-6, 0.0));
    pos.xy += right * a_normal.x * a_normal.z * 0.5;
  }

  gl_Position = u_viewProjMatrix * vec4(pos, 1.0);
  if (mode > 12.5 && mode < 13.5) {
    // Specks near the camera fade before they could grow large.
    alpha *= smoothstep(4.0, 9.0, gl_Position.w);
  }
  gl_Position.z += u_zBias * gl_Position.w;
  v_worldPos = pos;
  v_normal = a_normal;
  v_color = vec4(hslToRgb(int(a_hslColor)), alpha);
}`;

export const hallFragmentShader = `#version 300 es
precision highp float;
in vec3 v_worldPos;
in vec3 v_normal;
in vec4 v_color;
in vec2 v_corner;
uniform float u_currentTick;
uniform vec4 u_animParams;
uniform float u_brightness;
out vec4 fragColor;

const float PI = 3.14159265;
// The colours of Zanaris and its light.
const vec3 ZANARIS = vec3(0.45, 0.98, 0.92);
const vec3 TEAL = vec3(0.12, 0.62, 0.66);
const vec3 GOLD = vec3(0.95, 0.80, 0.48);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0, weight = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += weight * noise(p);
    p = p * 2.03 + 19.7;
    weight *= 0.5;
  }
  return sum / 0.9375;
}
// A line of width w (in the units of d) at distance d, smoothed over a pixel.
float line(float d, float w) {
  float pixel = max(fwidth(d), 1e-4);
  return 1.0 - smoothstep(w * 0.5, w * 0.5 + pixel, abs(d));
}
float band(float d, float from, float to) {
  float pixel = max(fwidth(d), 1e-4);
  return smoothstep(from - pixel, from, d) * (1.0 - smoothstep(to, to + pixel, d));
}

// The aurora: wide curtains of light that fold and drift across the north
// and over the hall, cyan at their foot, blue and violet at their crown.
vec3 aurora(vec3 direction, float seconds) {
  float up = direction.z;
  if (up < 0.0) return vec3(0.0);
  float azimuth = atan(direction.y, direction.x);
  vec3 sum = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float f = float(layer);
    // The foot of each curtain wanders up and down as it runs across the sky.
    float foot = 0.07 + 0.05 * f + 0.05 * sin(azimuth * (2.0 + f) + seconds * (0.02 + 0.01 * f) + f * 2.1);
    float rise = up - foot;
    if (rise < 0.0) continue;
    float reach = 0.32 + 0.12 * f;
    float body = smoothstep(0.0, 0.025, rise) * exp(-rise / reach * 2.2);
    float rays = 0.55 + 0.45 * noise(vec2(azimuth * (70.0 + 20.0 * f) + seconds * 0.04, f * 7.0));
    float folds = smoothstep(0.25, 0.85, fbm(vec2(azimuth * (3.0 + f) - seconds * 0.012 * (f + 1.0), f * 3.3 + seconds * 0.01)));
    float side = smoothstep(-0.55, 0.45, sin(azimuth + 0.25 * f)) * 0.85 + 0.15;
    vec3 tint = mix(vec3(0.25, 1.0, 0.82), vec3(0.25, 0.55, 1.0), smoothstep(0.0, reach * 0.6, rise));
    tint = mix(tint, vec3(0.62, 0.38, 1.0), smoothstep(reach * 0.5, reach * 1.4, rise));
    sum += tint * body * rays * folds * side * (0.42 - 0.1 * f);
  }
  return sum;
}

// The sky in a direction: the abyss below, a teal glow along the horizon,
// deep blue overhead, stars, and the aurora.
vec3 sky(vec3 direction, float seconds) {
  float up = direction.z;
  vec3 abyss = vec3(0.006, 0.02, 0.035);
  vec3 horizon = vec3(0.05, 0.19, 0.24);
  vec3 overhead = vec3(0.012, 0.03, 0.07);
  vec3 colour = up < 0.0
    ? mix(horizon, abyss, smoothstep(0.0, 0.4, -up))
    : mix(horizon, overhead, pow(smoothstep(0.0, 0.7, up), 0.55));
  float azimuth = atan(direction.y, direction.x);
  float elevation = asin(clamp(up, -1.0, 1.0));
  // Stars: on a grid of cells over the sphere, one star or none in each,
  // a point somewhere in its cell. A coarser grid holds the few bright ones.
  for (int layer = 0; layer < 2; layer++) {
    float density = layer == 0 ? 320.0 : 110.0;
    vec2 coordinate = vec2(azimuth, elevation) * density;
    vec2 cell = floor(coordinate);
    vec2 place = fract(coordinate) - 0.5 - (vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5) * 0.5;
    float present = step(layer == 0 ? 0.985 : 0.993, hash(cell));
    float size = layer == 0 ? 0.16 : 0.2;
    float point = 1.0 - smoothstep(size * 0.4, size, length(place));
    float twinkle = 0.7 + 0.3 * sin(seconds * (0.5 + hash(cell + 3.0)) + hash(cell + 9.0) * 30.0);
    vec3 tint = mix(vec3(0.6, 0.9, 1.0), vec3(1.0, 0.97, 0.9), hash(cell + 5.0));
    colour += present * point * twinkle * tint * smoothstep(0.02, 0.2, up) * (layer == 0 ? 0.6 : 0.95);
  }
  colour += aurora(direction, seconds);
  return colour;
}

void main() {
  float mode = u_animParams.x;
  float seconds = u_currentTick * 0.6;
  // Sampled in blocks of 1/16 tile, as coarse as the game's own textures.
  vec3 cell = (floor(v_worldPos * 16.0) + 0.5) / 16.0;
  vec3 colour = v_color.rgb;
  float alpha = v_color.a;

  if (mode < 10.5) {
    // The platform: a tile of dark smoked glass on every game tile, set in
    // darker joints, the cloud far below seen through it. A tile is a shade
    // lighter or darker than its neighbours, clouded inside, and catches the
    // moon along its north and east edges as if bevelled.
    vec2 offset = v_worldPos.xy - ${centre};
    float radius = length(offset);
    float turn = (atan(offset.y, offset.x) + PI) / (2.0 * PI);
    vec2 tile = floor(v_worldPos.xy);
    vec2 inTile = fract(v_worldPos.xy);
    float edge = min(min(inTile.x, 1.0 - inTile.x), min(inTile.y, 1.0 - inTile.y));
    float joint = 1.0 - smoothstep(0.03, 0.045, edge);
    float shade = hash(tile + 0.5);
    float smoke = fbm(cell.xy * 0.9 + shade * 17.0);
    vec3 glass = vec3(0.03, 0.075, 0.09) * (0.75 + 0.35 * shade) * (0.8 + 0.45 * smoke);
    float bevel = (1.0 - smoothstep(0.045, 0.1, 1.0 - inTile.y)) * 0.7 + (1.0 - smoothstep(0.045, 0.1, 1.0 - inTile.x)) * 0.4;
    bevel *= 1.0 - joint;
    colour = glass + TEAL * 0.07 * bevel;
    colour = mix(colour, vec3(0.006, 0.014, 0.018), joint);
    alpha = mix(0.5 + 0.12 * shade, 0.88, joint);
    // The light on it, from the moon and the stations, and a sheen of
    // moonlight towards Zanaris in the north, where the glass shows less of
    // what is below.
    colour *= v_normal * 1.5;
    float north = smoothstep(-8.0, 20.0, offset.y);
    colour += vec3(0.015, 0.05, 0.06) * north;
    alpha += 0.12 * north * (1.0 - joint);

    // Inlaid bands of gold, and by the rim a darker border with a running
    // pattern of teal lozenges, all of them solid in the glass.
    float rim = ${rimRadius};
    float gold = clamp(line(radius - 6.6, 0.05) + line(radius - 11.0, 0.035) + line(radius - (rim - 1.7), 0.05) + line(radius - (rim - 0.15), 0.04), 0.0, 1.0);
    float border = band(radius, rim - 1.6, rim - 0.25);
    float lozengeTurn = fract(turn * 96.0) - 0.5;
    float lozenge = 1.0 - smoothstep(0.0, 0.06, abs(lozengeTurn) * 0.9 + abs(radius - (rim - 0.92)) * 0.45 - 0.16);
    colour = mix(colour, colour * 0.6, border);
    alpha = mix(alpha, 0.9, border);
    colour = mix(colour, TEAL * 0.85, border * lozenge * 0.7);
    colour = mix(colour, GOLD * 0.8 * (0.85 + 0.3 * v_normal.g), gold * 0.9);
    alpha = mix(alpha, 0.97, gold);
  } else if (mode < 11.5) {
    float glow = 0.82 + 0.18 * sin(seconds * 0.7 + v_normal.y);
    colour = mix(colour, vec3(1.0), 0.15 * glow) * (0.6 + 0.6 * glow);
  } else if (mode < 13.5) {
    float distanceFromCentre = length(v_corner);
    float core = 1.0 - smoothstep(0.0, 0.35, distanceFromCentre);
    float halo = 1.0 - smoothstep(0.2, 1.0, distanceFromCentre);
    alpha *= halo * halo;
    colour = mix(colour, vec3(1.0), core * 0.7);
  } else if (mode < 15.5) {
    vec3 direction = normalize(v_worldPos - vec3(${centre}, u_animParams.y));
    colour = sky(direction, seconds);
    alpha = 1.0;
  } else if (mode < 16.5) {
    // Zanaris: a teal world, its swirling cloud turning slowly, lit from the
    // upper right, with a soft glow about it and a faint ring of light.
    vec2 p = v_normal.xy;
    float r = length(p);
    float discR = 0.42;
    float disc = 1.0 - smoothstep(discR - 0.006, discR, r);
    vec2 surface = p / discR;
    float bulge = sqrt(max(0.0, 1.0 - dot(surface, surface)));
    vec2 swirlP = surface / (0.6 + 0.4 * bulge);
    float spin = seconds * 0.01;
    swirlP = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * swirlP;
    float bands = fbm(vec2(swirlP.x * 2.0 + fbm(swirlP * 2.5 + 3.0) * 1.4, swirlP.y * 5.0));
    vec3 world = mix(vec3(0.05, 0.45, 0.5), vec3(0.62, 1.0, 0.95), smoothstep(0.25, 0.8, bands));
    float light = 0.35 + 0.65 * smoothstep(-0.7, 0.6, dot(surface, normalize(vec2(0.7, 0.6))) + bulge * 0.4);
    world *= light;
    world += ZANARIS * pow(1.0 - bulge, 3.0) * 0.6;
    float glow = exp(-max(r - discR, 0.0) * 9.0) * 0.55 + exp(-max(r - discR, 0.0) * 3.0) * 0.2;
    float halo = line(r - 0.86, 0.025) * 0.12 * (0.8 + 0.2 * sin(seconds * 0.3));
    colour = mix(ZANARIS * 0.85, world, disc);
    alpha = clamp(max(disc, glow + halo), 0.0, 1.0) * (1.0 - smoothstep(0.92, 1.0, r));
  } else if (mode < 17.5) {
    vec2 offset = v_worldPos.xy - ${centre};
    float far = length(offset);
    vec2 flow = v_worldPos.xy * 0.035 + vec2(seconds * 0.006, seconds * 0.002);
    float cloud = fbm(flow) * 0.65 + fbm(flow * 2.7 - seconds * 0.004) * 0.35;
    float lit = smoothstep(0.35, 0.8, cloud);
    colour = mix(vec3(0.02, 0.07, 0.1), vec3(0.2, 0.45, 0.5), lit);
    alpha = smoothstep(0.3, 0.6, cloud) * (1.0 - smoothstep(55.0, 92.0, far)) * 0.9;
  } else if (mode < 18.5) {
    float fromCentre = length(v_normal.xy);
    float breathe = 0.85 + 0.15 * sin(seconds * 0.6 + v_normal.z);
    alpha *= pow(1.0 - smoothstep(0.0, 1.0, fromCentre), 1.6) * breathe;
  } else if (mode < 19.5) {
    colour *= v_normal;
  } else if (mode < 20.5) {
    // The seal: a teal stone at its heart, a star of gold with eight points,
    // and bands of rings, glyphs and marks that turn slowly, each its own way.
    vec2 p = v_normal.xy;
    float r = length(p);
    float size = u_animParams.y;
    float angle = atan(p.y, p.x);
    vec3 stone = vec3(0.04, 0.085, 0.1);
    vec3 c = stone * (0.9 + 0.2 * fbm(p * 1.5));
    float a = 0.0;
    // Rings of gold.
    float rings = line(r - 1.05, 0.06) + line(r - 3.95, 0.08) + line(r - 4.1, 0.03) + line(r - 5.25, 0.05) + line(r - size + 0.08, 0.1);
    // The star: long points to the four winds, short ones between.
    float sector = mod(angle + PI / 8.0, PI / 4.0) - PI / 8.0;
    float index = floor((angle + PI / 8.0) / (PI / 4.0));
    float longPoint = mod(index, 2.0) < 0.5 ? 1.0 : 0.0;
    float reach = mix(2.6, 3.85, longPoint);
    float halfWidth = 0.42 * (1.0 - r / reach);
    float onStar = 1.0 - smoothstep(-0.02, 0.02, abs(sin(sector)) * r - halfWidth);
    onStar *= step(0.5, r) * step(r, reach);
    // Each point lit on one side and shadowed on the other, as if bevelled.
    float bevel = sector > 0.0 ? 1.0 : 0.62;
    vec3 starColour = mix(GOLD * 0.8, GOLD * 1.15, longPoint) * bevel;
    // The glyphs between the rings, turning slowly westward.
    float glyphTurn = angle + seconds * 0.02;
    float slot = floor(glyphTurn / (2.0 * PI) * 40.0);
    vec2 inSlot = vec2(fract(glyphTurn / (2.0 * PI) * 40.0), (r - 4.25) / 0.85);
    float strokes = 0.0;
    for (int s = 0; s < 3; s++) {
      float fs = float(s);
      float h = hash(vec2(slot, fs));
      vec2 from = vec2(0.25 + 0.5 * hash(vec2(slot, fs + 3.0)), 0.15 + 0.7 * h);
      vec2 to = vec2(0.25 + 0.5 * hash(vec2(slot, fs + 7.0)), 0.15 + 0.7 * hash(vec2(slot, fs + 9.0)));
      vec2 pa = inSlot - from, ba = to - from;
      float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      strokes = max(strokes, 1.0 - smoothstep(0.035, 0.07, length((pa - ba * t) * vec2(1.0, 0.9))));
    }
    float glyphs = strokes * band(r, 4.22, 5.1);
    // Marks round the edge, turning the other way.
    float markTurn = angle - seconds * 0.015;
    float mark = fract(markTurn / (2.0 * PI) * 120.0);
    float longMark = step(0.5, 1.0 - step(0.001, mod(floor(markTurn / (2.0 * PI) * 120.0), 10.0)));
    float marks = (1.0 - smoothstep(0.08, 0.14, abs(mark - 0.5))) * band(r, size - mix(0.5, 0.75, longMark), size - 0.2);
    // The heart: a teal stone, glowing and breathing.
    float heart = 1.0 - smoothstep(0.55, 0.6, r);
    float breathe = 0.8 + 0.2 * sin(seconds * 0.8);
    vec3 heartColour = mix(TEAL, ZANARIS, (1.0 - r / 0.6)) * (0.8 + 0.6 * breathe);
    c = mix(c, starColour, onStar);
    c = mix(c, GOLD, clamp(rings, 0.0, 1.0) * 0.95);
    c = mix(c, ZANARIS * 0.9, glyphs * (0.75 + 0.25 * breathe));
    c = mix(c, GOLD * 0.9, marks);
    c = mix(c, heartColour, heart);
    // A soft teal light pooling about the heart.
    c += ZANARIS * 0.12 * exp(-r * 0.9) * breathe;
    colour = c * v_normal.z;
    // Its stone is dark glass like the floor's; what is let into it is solid.
    float inlaid = clamp(onStar + rings + glyphs + marks + heart, 0.0, 1.0);
    alpha = mix(0.62, 1.0, inlaid) * (1.0 - smoothstep(size - 0.02, size, r));
  } else {
    // A beam: brightest at its core, fading in from its foot and out towards
    // its top, with a slow drift of light rising through it.
    float across = v_normal.x;
    float up = clamp(v_normal.y, 0.0, 1.0);
    float core = exp(-across * across * 3.2);
    float rise = 0.75 + 0.25 * fbm(vec2(across * 1.5, up * 5.0 - seconds * 0.25));
    alpha *= core * smoothstep(0.0, 0.2, up) * pow(1.0 - up, 1.4) * rise;
    colour = mix(colour, vec3(1.0), core * core * 0.45);
  }

  colour *= u_brightness / 0.6;
  fragColor = vec4(colour, alpha);
}`;
