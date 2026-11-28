// What draws Yama's whole fight (kind "yama_full"). The scene is the one of
// phase 3, which is in client/assets/rendering.js: every presentation is
// handed `presentationOf(kind)` to reach it (as the sandbox does for its
// hosts). Its render config is phase 3's with the NPCs, the clips and the
// spot animations of the earlier phases added, and the glyphs as scene
// objects. Phase 3 itself has no presentation here: rendering.js holds it.
import { yamaNpcTypeId } from "./constants.js";
import { yamaActorId } from "./YamaEncounter.js";
import { yamaFullKind, npcTypeIds, throneActorId, yamaClips, throneClips, spots, entranceFlames, yamaFullAudio } from "./fullFightData.js";

// CACHE: 12153 is the throne's own sequence, 4675 and 11456 those of the
// Judge and of a fire spell. OBS: the Judge attacks with 69 and dies with
// 9042; the meteor's NPC plays 12118 from its spawn on and keeps it (solo 1,
// ticks 345 and 409). The empty throne goes on with the challenge's sequence
// (YamaFullEncounter, "emptyThrone").
const preloadNpcTypes = [
  { npcTypeId: npcTypeIds.throneYama, idleSeqId: 12153, attackClips: throneClips },
  { npcTypeId: npcTypeIds.throne, idleSeqId: 12153, attackClips: { challenge: throneClips.challenge } },
  { npcTypeId: npcTypeIds.judge, idleSeqId: 4675, attackClips: { attack: 69 }, deathSeqId: 9042 },
  { npcTypeId: npcTypeIds.fireSpell, idleSeqId: 11456, walkSeqId: 11456 }, // OBS: its walk is its pose too (fireSpells)
  { npcTypeId: npcTypeIds.meteor, idleSeqId: 12118 },
];
// OBS: a flare of shadow is the flare's NPC with these models in place of its own (the cache's are the red, fire
// flare's). It is drawn as a type of its own, made here from the flare's (as Araxxor's enraged body is,
// araxxor/presentation.js). In phase 3 both flares are of shadow.
const flareType = 14179;
const shadowFlareType = 1_000_000 + flareType;
const shadowFlareModels = [17003, 17006, 17009];
function withShadowFlare(npcModelLoader) {
  return Object.create(npcModelLoader, {
    loadNpcType: {
      value(npcTypeId) {
        if (npcTypeId !== shadowFlareType) return npcModelLoader.loadNpcType(npcTypeId);
        const type = npcModelLoader.loadNpcType(flareType);
        return type && Object.assign(Object.create(Object.getPrototypeOf(type)), type, { modelIds: [...shadowFlareModels] });
      },
    },
  });
}
// A sequence of the encounter's on the player (a jump, the teleports), once for the tick it names: loaded and played
// as the scene plays the intro of phase 3 (rendering.js, the compositor's player animation system and controller).
let playedOnPlayer = null;
function playOnPlayer(compositor, animation) {
  if (!animation || playedOnPlayer === animation.tick + ":" + animation.seqId) return;
  const system = compositor?.playerAnimationSystem;
  const seqType = system?.loadSeqType(animation.seqId);
  if (!seqType || !compositor.playerAnimController) return;
  playedOnPlayer = animation.tick + ":" + animation.seqId;
  // A skeletal sequence is not one the player's controller plays: then nothing is shown.
  const sequence = seqType.isSkeletalSeq() ? null : system.createSequenceFromSeqType(seqType);
  if (sequence) compositor.playerAnimController.triggerAttackWithSequence(sequence);
}
const glyphLocs = { shadow: { lit: 56335, fade: 56338 }, fire: { lit: 56336, fade: 56339 } }; // OBS

// The glyphs that are lit, and for a tick those going dark, from the
// encounter's snapshot, and the entrance flames while they burn. A spec is
// phase 3's start glyph (rendering.js, the scene object controller of its
// render config) with another object.
function glyphController(hostController) {
  const template = hostController?.activeSpecs?.range?.[0];
  return {
    consumeEvents() {},
    update({ state }) {
      const glyphs = state.encounter?.state?.glyphs;
      if (!template || !glyphs) return [];
      const flames = state.encounter.state.flamesLit
        ? entranceFlames.tiles.map(([localX, localY, rotation]) => {
            const id = `yama-flames-${localX}-${localY}`;
            return { ...template, id, meshId: id, classification: "sceneMesh", style: {}, data: { ...template.data, locId: entranceFlames.locId, rotation, localX, localY } };
          })
        : [];
      return flames.concat(glyphs.filter((glyph) => glyph.state !== "dark").map((glyph) => {
        const locId = glyphLocs[glyph.element][glyph.state];
        const id = `yama-glyph-${locId}-${glyph.tile[0]}-${glyph.tile[1]}`;
        return {
          ...template, id, meshId: id, style: { ...template.style, opacity: 1 },
          data: { ...template.data, locId, localX: glyph.tile[0], localY: glyph.tile[1], ...(glyph.state === "fade" ? { animationStartTick: glyph.changedTick } : {}) },
        };
      }));
    },
  };
}

const withEarlyPhases = (renderConfig) => ({
  ...renderConfig,
  preloadNpcTypes: [
    ...(renderConfig.preloadNpcTypes ?? []).map((entry) => (entry.npcTypeId === yamaNpcTypeId ? { ...entry, attackClips: { ...entry.attackClips, ...yamaClips } } : entry)),
    ...preloadNpcTypes,
    ...(renderConfig.preloadNpcTypes ?? []).filter((entry) => entry.npcTypeId === flareType).map((entry) => ({ ...entry, npcTypeId: shadowFlareType })),
  ],
  spotAnimIds: [...new Set([...(renderConfig.spotAnimIds ?? []), ...Object.values(spots)])],
  createSceneObjectController: () => glyphController(renderConfig.createSceneObjectController?.()),
});

export const presentation = (BaseScene, packHsl, { presentationOf } = {}) => {
  const host = () => presentationOf?.("yama_p3");
  let renderConfig = null;
  const ownRenderConfig = () => (renderConfig ??= withEarlyPhases(host()?.renderConfig ?? {}));
  return {
    kind: yamaFullKind,
    // Read by the application as a visit starts.
    get renderConfig() {
      return ownRenderConfig();
    },
    sceneBuilder(context) {
      const scene = host().sceneBuilder(context);
      scene.setEncounterRenderConfig?.(ownRenderConfig());
      // Phase 3's scene has its primary NPC from the first frame. Here he is
      // on his throne until he is challenged: no Yama in the arena before.
      const build = scene.build.bind(scene);
      scene.build = (input, ...rest) => {
        const state = input.simulationState;
        if (!state.npcs.some((npc) => npc.id === yamaActorId)) scene.compositor?.npcInstanceManager?.removeInstance("primary-npc");
        playOnPlayer(scene.compositor, state.encounter?.state?.playerAnimation);
        const shadowFlares = state.encounter?.state?.shadowFlareIds ?? [];
        if (shadowFlares.length === 0) return build(input, ...rest);
        const npcs = state.npcs.map((npc) => (shadowFlares.includes(npc.id) ? { ...npc, npcTypeId: shadowFlareType } : npc));
        return build({ ...input, simulationState: { ...state, npcs } }, ...rest);
      };
      // The throne is one NPC whose type changes (YamaFullEncounter): a drawn NPC keeps the type it was made
      // with, so it is made again (as araxxor/presentation.js does). OBS: its sequence (12154) goes on across the
      // change for about 9 ticks: the new one takes up the old one's from the frame it was on.
      const compositor = scene.compositor;
      const syncNpcInstances = compositor.syncNpcInstances.bind(compositor);
      compositor.syncNpcInstances = (npcs, ...rest) => {
        const manager = compositor.npcInstanceManager;
        const throne = npcs.find((npc) => npc.id === throneActorId);
        const drawnId = throne && compositor.getNpcRenderInstanceId(throneActorId);
        const drawnType = drawnId && manager.instanceRegistry.get(drawnId)?.npcTypeId;
        if (drawnType === undefined || drawnType === throne.npcTypeId || !compositor.isNpcTypeLoaded(throne.npcTypeId)) return syncNpcInstances(npcs, ...rest);
        const track = manager.instanceRegistry.get(drawnId).animController?.primaryTrack;
        manager.removeInstance(drawnId);
        const result = syncNpcInstances(npcs, ...rest);
        const controller = manager.instanceRegistry.get(compositor.getNpcRenderInstanceId(throneActorId))?.animController;
        const clips = Object.values(manager.typeRegistry.get(throne.npcTypeId)?.animationSet?.attackClips ?? {});
        const clip = track?.state === "attack" && clips.find((candidate) => candidate.seqId === track.clip.seqId);
        if (controller && clip) controller.restorePrimaryAt({ clip, duration: track.durationClientTicks, elapsedTicks: track.elapsedTicks, delayClientTicks: track.delayClientTicks });
        return result;
      };
      const loadNpcType = scene.loadNpcType.bind(scene);
      scene.loadNpcType = (npcTypeId, npcModelLoader, ...rest) => loadNpcType(npcTypeId, withShadowFlare(npcModelLoader), ...rest);
      return scene;
    },
    get defaultCamera() {
      return host()?.defaultCamera;
    },
    audio: yamaFullAudio,
    presentation: {
      title: "Yama",
      tagline: "The whole fight",
      setupContext: "Yama",
      blurb: "Challenge Yama on his throne and fight him from the start: glyphs, fire streaks, shadow waves, void flares and his Judge, then the third phase.",
      wikiUrl: "https://oldschool.runescape.wiki/w/Yama/Strategies",
    },
  };
};
