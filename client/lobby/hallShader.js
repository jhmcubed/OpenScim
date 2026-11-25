// The "scene-lobby" program: everything the lobby's hall draws of its own
// (lobby/hallScene.js builds the meshes). Its vertex shader takes the same
// inputs as the renderer's scene shaders; a mesh picks how it is drawn with
// uniforms.u_animParams = [mode, a, b, c]:
//
//   10 floor    lit stone with its paving; normal = the light on it (RGB)
//   11 inlay    light let into the floor. normal.x runs along a lane (tiles),
//               normal.y is a phase, normal.z 1 for a lane whose light flows
//               away from the player, 0 for an inlay that only breathes
//   12 spin     an inlay that turns: about the axis normal, at |normal|
//               radians a second, through the point (a, b, c)
//   13 motes    specks of light that rise and fade. Every corner of one has
//               its centre for position; normal = (corner x, corner y, seed).
//               a = how high one rises (tiles), b = its size, c = its speed
//   14 aura     a standing sheet of light: normal.x runs around or across it,
//               normal.y from 0 at the foot to 1 at the top
//   15 sky      the dome: the colour comes from the direction. a = floor height
//   16 moon     a disc and its halo; normal.xy runs from -1 to 1 across
//   17 clouds   the sea of cloud below the hall. a = floor height
//   18 pool     a soft disc of light; normal.xy runs from -1 to 1 across,
//               normal.z is a phase for its slow breathing
//   19 surface  lit stone without paving: plinths, rails, the rim
//
// The motion is slow and steady on purpose: nothing flickers, nothing comes
// at the camera, and a speck that drifts close to it fades out.

export const hallShaderModes = { floor: 10, inlay: 11, spin: 12, motes: 13, aura: 14, sky: 15, moon: 16, clouds: 17, pool: 18, surface: 19 };

// The platform's centre, which the sky and the floor's paving are drawn about.
const centre = "vec2(31.5, 25.5)";

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

vec3 rotateAbout(vec3 p, vec3 axis, float angle) {
  float c = cos(angle), s = sin(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

void main() {
  float mode = u_animParams.x;
  float seconds = u_currentTick * 0.6;
  vec3 pos = a_position;
  float alpha = a_alpha;
  v_corner = vec2(0.0);

  if (mode > 11.5 && mode < 12.5) {
    float speed = length(a_normal);
    vec3 pivot = u_animParams.yzw;
    pos = pivot + rotateAbout(pos - pivot, a_normal / max(speed, 0.0001), seconds * speed);
  } else if (mode > 12.5 && mode < 13.5) {
    float seed = a_normal.z;
    float period = mix(9.0, 16.0, fract(seed * 7.13)) / u_animParams.w;
    float life = fract(seconds / period + seed);
    pos.z += life * u_animParams.y;
    pos.x += sin(seconds * 0.31 + seed * 40.0) * 0.3;
    pos.y += cos(seconds * 0.27 + seed * 23.0) * 0.3;
    alpha *= smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.6, 1.0, life));
    // Turned to face the camera: its right and up are the first two rows of the view.
    vec3 right = normalize(vec3(u_viewProjMatrix[0][0], u_viewProjMatrix[1][0], u_viewProjMatrix[2][0]));
    vec3 up = normalize(vec3(u_viewProjMatrix[0][1], u_viewProjMatrix[1][1], u_viewProjMatrix[2][1]));
    float size = u_animParams.z * mix(0.7, 1.3, fract(seed * 3.7));
    pos += (right * a_normal.x + up * a_normal.y) * size;
    v_corner = a_normal.xy;
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

// The sky in a direction: the abyss below, a cold glow at the horizon, deep
// blue overhead, stars, and an aurora low in the north.
vec3 sky(vec3 direction, float seconds) {
  float up = direction.z;
  vec3 abyss = vec3(0.012, 0.016, 0.04);
  vec3 horizon = vec3(0.11, 0.15, 0.29);
  vec3 overhead = vec3(0.02, 0.028, 0.08);
  vec3 colour = up < 0.0
    ? mix(horizon, abyss, smoothstep(0.0, 0.45, -up))
    : mix(horizon, overhead, pow(smoothstep(0.0, 0.75, up), 0.6));
  float azimuth = atan(direction.y, direction.x);
  // Stars: on a grid of cells over the sphere, one star or none in each,
  // a point somewhere in its cell. A coarser grid holds the few bright ones.
  float elevation = asin(clamp(up, -1.0, 1.0));
  for (int layer = 0; layer < 2; layer++) {
    float density = layer == 0 ? 320.0 : 110.0;
    vec2 coordinate = vec2(azimuth, elevation) * density;
    vec2 cell = floor(coordinate);
    vec2 place = fract(coordinate) - 0.5 - (vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5) * 0.5;
    float present = step(layer == 0 ? 0.985 : 0.993, hash(cell));
    float size = layer == 0 ? 0.16 : 0.2;
    float point = 1.0 - smoothstep(size * 0.4, size, length(place));
    float twinkle = 0.7 + 0.3 * sin(seconds * (0.5 + hash(cell + 3.0)) + hash(cell + 9.0) * 30.0);
    vec3 tint = mix(vec3(0.6, 0.7, 1.0), vec3(1.0, 0.95, 0.85), hash(cell + 5.0));
    colour += present * point * twinkle * tint * smoothstep(0.02, 0.2, up) * (layer == 0 ? 0.7 : 1.0);
  }
  // The aurora: curtains of light that drift along the northern horizon.
  float north = smoothstep(-0.2, 0.9, sin(azimuth)) * smoothstep(0.03, 0.14, up) * (1.0 - smoothstep(0.22, 0.48, up));
  float curtain = fbm(vec2(azimuth * 5.0 - seconds * 0.015, seconds * 0.02));
  float rays = 0.6 + 0.4 * noise(vec2(azimuth * 60.0, seconds * 0.05));
  vec3 auroraColour = mix(vec3(0.2, 0.8, 0.7), vec3(0.5, 0.4, 1.0), smoothstep(0.08, 0.35, up));
  colour += auroraColour * north * smoothstep(0.45, 0.8, curtain) * rays * 0.32;
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
    // The paving: rings of slabs about the centre, each ring cut into more
    // pieces than the one inside it. Joints are thin and soft at any zoom.
    vec2 offset = v_worldPos.xy - ${centre};
    float radius = length(offset);
    float width = 2.0;
    float ring = floor(radius / width);
    float pieces = 8.0 + ring * 8.0;
    float turn = (atan(offset.y, offset.x) + PI) / (2.0 * PI);
    float slabIndex = floor(turn * pieces + ring * 0.37);
    float along = fract(radius / width) * width;
    float across = fract(turn * pieces + ring * 0.37) * radius * 2.0 * PI / pieces;
    float seamDistance = min(min(along, width - along), min(across, radius * 2.0 * PI / pieces - across));
    float pixel = fwidth(radius) * 1.2;
    float joint = 1.0 - smoothstep(0.015, 0.015 + pixel, seamDistance);
    float slab = hash(vec2(ring, slabIndex));
    float vein = fbm(cell.xy * 0.6 + slab * 13.0);
    colour *= 0.94 + 0.08 * slab + 0.1 * (vein - 0.5);
    // A sheen of moonlight, brighter towards the moon in the north.
    colour += vec3(0.05, 0.06, 0.09) * smoothstep(-6.0, 16.0, offset.y);
    colour *= 1.0 - 0.3 * joint;
    colour *= v_normal;
  } else if (mode < 11.5) {
    float glow = v_normal.z > 0.5
      // A lane: pulses of light run from the player towards the station.
      ? 0.55 + 0.45 * pow(0.5 + 0.5 * sin(v_normal.x * 0.45 - seconds * 1.4 + v_normal.y), 6.0)
      : 0.8 + 0.2 * sin(seconds * 0.7 + v_normal.y);
    colour = mix(colour, vec3(1.0), 0.15 * glow) * (0.55 + 0.65 * glow);
  } else if (mode < 12.5) {
    colour *= 1.05;
  } else if (mode < 13.5) {
    float distanceFromCentre = length(v_corner);
    float core = 1.0 - smoothstep(0.0, 0.35, distanceFromCentre);
    float halo = 1.0 - smoothstep(0.2, 1.0, distanceFromCentre);
    alpha *= halo * halo;
    colour = mix(colour, vec3(1.0), core * 0.7);
  } else if (mode < 14.5) {
    float up = clamp(v_normal.y, 0.0, 1.0);
    float drift = fbm(vec2(v_normal.x * 3.0, up * 2.2 - seconds * 0.12));
    alpha *= pow(1.0 - up, 1.6) * (0.6 + 0.4 * drift);
    colour = mix(colour, vec3(1.0), 0.35 * (1.0 - up));
  } else if (mode < 15.5) {
    vec3 direction = normalize(v_worldPos - vec3(${centre}, u_animParams.y));
    colour = sky(direction, seconds);
    alpha = 1.0;
  } else if (mode < 16.5) {
    float distanceFromCentre = length(v_normal.xy);
    float disc = 1.0 - smoothstep(0.5, 0.52, distanceFromCentre);
    vec2 surface = v_normal.xy * 6.0;
    float maria = fbm(surface + 4.0);
    vec3 moon = vec3(0.92, 0.94, 0.98) * (0.82 + 0.18 * smoothstep(0.35, 0.7, maria));
    // Lit from the upper right; the lower left falls into shadow.
    moon *= 0.55 + 0.45 * smoothstep(-0.6, 0.5, dot(v_normal.xy, vec2(0.6, 0.8)) / 0.5);
    float halo = pow(1.0 - smoothstep(0.45, 1.0, distanceFromCentre), 2.0) * 0.45;
    colour = mix(vec3(0.6, 0.7, 0.95), moon, disc);
    alpha = max(disc, halo);
  } else if (mode < 17.5) {
    vec2 offset = v_worldPos.xy - ${centre};
    float far = length(offset);
    vec2 flow = v_worldPos.xy * 0.035 + vec2(seconds * 0.006, seconds * 0.002);
    float cloud = fbm(flow) * 0.65 + fbm(flow * 2.7 - seconds * 0.004) * 0.35;
    float lit = smoothstep(0.35, 0.8, cloud);
    colour = mix(vec3(0.05, 0.07, 0.15), vec3(0.32, 0.40, 0.58), lit);
    alpha = smoothstep(0.3, 0.6, cloud) * (1.0 - smoothstep(55.0, 92.0, far)) * smoothstep(14.0, 24.0, far) * 0.9;
  } else if (mode < 18.5) {
    float fromCentre = length(v_normal.xy);
    float breathe = 0.85 + 0.15 * sin(seconds * 0.7 + v_normal.z);
    alpha *= pow(1.0 - smoothstep(0.0, 1.0, fromCentre), 1.5) * breathe;
  } else {
    colour *= v_normal;
  }

  colour *= u_brightness / 0.6;
  fragColor = vec4(colour, alpha);
}`;
