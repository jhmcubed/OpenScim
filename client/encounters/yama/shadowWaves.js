var defaultYamaWaveDeltas = [0, 14, 21];
var defaultYamaFirstCycleWaveDeltas = [14];
function getYamaWaveCyclePosition(tick, delta, periodTicks, startDelay) {
  const ticksSinceFirstCycle = tick + 1 - delta - startDelay;
  return {
    tp: ((ticksSinceFirstCycle % periodTicks) + periodTicks) % periodTicks,
    cycleNum: Math.floor(ticksSinceFirstCycle / periodTicks),
  };
}
function isYamaWaveActiveInCycle(delta, cycleNum, firstCycleDeltas) {
  return !(cycleNum < 0) && (cycleNum !== 0 || firstCycleDeltas.includes(delta));
}
function isInsideYamaWaveDiamond(diagonalDifference, diagonalSum) {
  return diagonalDifference >= -19 && diagonalDifference <= 19 && diagonalSum >= 40 && diagonalSum <= 81;
}
var yamaWaveRandomOffsets = [
  [0, 0],
  [0, -2],
  [-2, 0],
  [-2, -2],
];
function hashYamaWaveOffset(seed, waveIndex, cycleNum) {
  let hash = Math.imul(
    seed ^ 2654435769,
    (waveIndex + 1) * 2654435761 + (cycleNum + 1) * 340573321,
  );
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
function getYamaWaveRandomOffset(seed, waveIndex, delta, cycleNum) {
  if (delta === 0) {
    return yamaWaveRandomOffsets[0];
  }
  const offsetHash = hashYamaWaveOffset(seed, waveIndex, cycleNum);
  return yamaWaveRandomOffsets[offsetHash % yamaWaveRandomOffsets.length];
}
// A shadow wave is a pair of diagonal lines, each two tiles thick, that sweep
// across the arena. The "L" line is the tiles with y - x = leftWaveStart +
// distance, and the tiles one above them; the "R" line is the tiles with
// x + y = rightWaveStart + distance, and the tiles one above them. The
// distance is `speedTilesPerTick` times the ticks into the period. Only tiles
// inside the diamond of isInsideYamaWaveDiamond count. In every period of
// `periodTicks` one wave starts for each entry of `deltas`, that many ticks
// into the period; in the first period only those of `firstCycleDeltas`.
// `lines`, when given, names for each entry of `deltas` the one line its wave
// has, "L" or "R" (the waves of phases 1 and 2 come from one side).
function getYamaWaveTiles(tick, minX, maxX, minY, maxY, waveConfig) {
  const waveTiles = [];
  const periodTicks = waveConfig?.periodTicks ?? 70;
  const deltas = waveConfig?.deltas ?? defaultYamaWaveDeltas;
  const speedTilesPerTick = waveConfig?.speedTilesPerTick ?? 2;
  const startDelay = waveConfig?.startDelay ?? 7;
  const firstCycleDeltas = waveConfig?.firstCycleDeltas ?? defaultYamaFirstCycleWaveDeltas;
  const seed = waveConfig?.seed;
  const useRandomOffsets = waveConfig?.randomOffsets === true && seed !== undefined;
  for (let waveIndex = 0; waveIndex < deltas.length; waveIndex++) {
    const { tp: ticksIntoPeriod, cycleNum: cycleNum } = getYamaWaveCyclePosition(tick, deltas[waveIndex], periodTicks, startDelay);
    if (!isYamaWaveActiveInCycle(deltas[waveIndex], cycleNum, firstCycleDeltas)) {
      continue;
    }
    const tilesTravelled = speedTilesPerTick * ticksIntoPeriod;
    let leftWaveStart = -40;
    let rightWaveStart = 20;
    if (useRandomOffsets) {
      const randomOffset = getYamaWaveRandomOffset(seed, waveIndex, deltas[waveIndex], cycleNum);
      leftWaveStart += randomOffset[0];
      rightWaveStart += randomOffset[1];
    }
    const onlyLine = waveConfig?.lines?.[waveIndex];
    const leftDiagonalDifference = leftWaveStart + tilesTravelled;
    for (let x = onlyLine === "R" ? maxX + 1 : minX; x <= maxX; x++) {
      const lowerY = x + leftDiagonalDifference;
      const upperY = lowerY + 1;
      if (lowerY >= minY && lowerY <= maxY && isInsideYamaWaveDiamond(lowerY - x, x + lowerY)) {
        waveTiles.push({
          x: x,
          y: lowerY,
          waveType: "L",
          waveIndex: waveIndex,
          layer: 0,
        });
      }
      if (upperY >= minY && upperY <= maxY && isInsideYamaWaveDiamond(upperY - x, x + upperY)) {
        waveTiles.push({
          x: x,
          y: upperY,
          waveType: "L",
          waveIndex: waveIndex,
          layer: 1,
        });
      }
    }
    const rightDiagonalSum = rightWaveStart + tilesTravelled;
    for (let x = onlyLine === "L" ? maxX + 1 : minX; x <= maxX; x++) {
      const lowerY = rightDiagonalSum - x;
      const upperY = lowerY + 1;
      if (lowerY >= minY && lowerY <= maxY && isInsideYamaWaveDiamond(lowerY - x, x + lowerY)) {
        waveTiles.push({
          x: x,
          y: lowerY,
          waveType: "R",
          waveIndex: waveIndex,
          layer: 0,
        });
      }
      if (upperY >= minY && upperY <= maxY && isInsideYamaWaveDiamond(upperY - x, x + upperY)) {
        waveTiles.push({
          x: x,
          y: upperY,
          waveType: "R",
          waveIndex: waveIndex,
          layer: 1,
        });
      }
    }
  }
  return waveTiles;
}
export {
  defaultYamaWaveDeltas,
  defaultYamaFirstCycleWaveDeltas,
  getYamaWaveCyclePosition,
  isYamaWaveActiveInCycle,
  isInsideYamaWaveDiamond,
  getYamaWaveRandomOffset,
  getYamaWaveTiles,
};
