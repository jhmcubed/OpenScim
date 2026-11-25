// Beams of light for the lobby: a column of light that always turns to face
// the camera, so it looks round from every side and never shows the edge of a
// sheet. It fades in from its foot and out towards its top, so it has no hard
// end where it meets a roof (lobby/hallShader.js, mode "beam").
import { hallShaderModes } from "./hallShader.js";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * One mesh of beams. Each beam is { x, y, z, height, width, colour, alpha }:
 * its foot at (x, y, z) in the mesh's own space, `width` across in tiles,
 * `colour` packed HSL. `modelMatrix` places the mesh (a gateway passes its turn).
 */
export function beamMesh(meshId, beams, modelMatrix = identity) {
  const positions = [], normals = [], colors = [], alphas = [], indices = [];
  for (const { x, y, z, height, width, colour, alpha = 0.6 } of beams) {
    const first = alphas.length;
    // The shader turns each beam to the camera: normal = (across -1..1, up 0..1,
    // the beam's width); the top corners stand `height` above the foot.
    for (const [across, up] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      positions.push(x, y, z + up * height);
      normals.push(across, up, width);
      colors.push(colour);
      alphas.push(alpha);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  return {
    kind: "mesh3d",
    meshId: "lobby-beams-" + meshId,
    materialId: "osrs-terrain",
    modelMatrix,
    cullFace: "none",
    zIndex: 9,
    depth: "read",
    blend: "normal",
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    perVertexHslColors: new Float32Array(colors),
    perVertexAlphas: new Float32Array(alphas),
    indices: new Uint16Array(indices),
    shaderId: "scene-lobby",
    uniforms: { u_animParams: [hallShaderModes.beam, 0, 0, 0] },
  };
}
