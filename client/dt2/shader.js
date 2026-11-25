// Fragment shader of the "scene-dt2" program, which draws the elements and the light of the Desert Treasure II gateway. Like "scene-toa"
// it pairs with the renderer's scene-effects vertex shader, and a mesh picks
// its look with uniforms.u_animParams = [mode, a, b, c]:
//
//   15 stream  an element running along the floor. a = length, b = half width (tiles)
//   17 shaft   a beam of light
//
// Stream and shaft are sheets: normal.x runs from -1 to 1 across,
// normal.y from 0 to 1 along (toaMesh). Mode 16 was the rune ring round the
// vault's old door.
//
// Modes start at 15: the vertex shader animates 1 to 10, "scene-toa" has 11 to 14.
import { fragmentShaderHead, toaMesh } from "../toa/shader.js";

export const dt2ShaderModes = { stream: 15, shaft: 17 };

export const dt2FragmentShader = fragmentShaderHead + `
void main() {
  float mode = u_animParams.x;
  float seconds = u_currentTick * 0.6;
  // Sampling in blocks of 1/16 tile keeps the effects as coarse as the
  // game's own models and textures.
  vec3 cell = (floor(v_worldPos * 16.0) + 0.5) / 16.0;
  vec3 colour = v_color.rgb;
  float alpha = v_color.a;

  if (mode < 15.5) {
    vec2 sheet = (floor(vec2(v_normal.x * u_animParams.z, v_normal.y * u_animParams.y) * 16.0) + 0.5) / 16.0;
    float across = abs(sheet.x) / u_animParams.z;
    float flow = fbm(vec2(sheet.x * 3.0, sheet.y * 1.4 - seconds * 1.1));
    float body = 1.0 - smoothstep(0.35, 1.0, across + (flow - 0.5) * 0.8);
    float pulse = 0.6 + 0.4 * sin(sheet.y * 2.4 - seconds * 2.6);
    alpha = v_color.a * body * (0.45 + 0.55 * flow) * pulse;
    colour = mix(colour, vec3(1.0), 0.45 * body * flow * pulse);
  } else {
    float core = 1.0 - clamp(abs(v_normal.x), 0.0, 1.0);
    float drift = fbm(vec2(cell.x * 1.3 + cell.y * 1.7, cell.z * 0.45 - seconds * 0.3));
    alpha = v_color.a * core * (0.5 + 0.5 * drift);
    colour = mix(colour, vec3(1.0), 0.35 * core);
  }

  colour *= u_brightness / 0.6;
  fragColor = vec4(colour, alpha);
}`;

// Collects one mesh for the "scene-dt2" program (see toaMesh).
export const dt2Mesh = (meshId, zIndex, depth, animParams, modelMatrix) =>
  toaMesh(meshId, zIndex, depth, animParams, modelMatrix, "scene-dt2");
