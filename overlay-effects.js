// Adobe UXP 25.6 APIs. Preset originals are retained in presets/.
const TICKS = 254016000000;
const MATCH = 'AE.ADBE Geometry2';
const TAG = / \[CS2:([^\]]+)\]$/;
const IN_SECONDS = 215913600000 / TICKS;
const OUT_SECONDS = (3678998400000 - 3458145600000) / TICKS;
const OFFSET = 1.5104166269302368 - 0.5;

function playerId(name) { return (String(name).match(TAG) || [])[1]; }
function clipName(player) { return player.name + ' [CS2:' + player.id + ']'; }

// Component keyframe positions use source time, NOT sequence time. Include the
// last visible frame rather than the exclusive out point. Short clips compress
// both animations proportionally so entry and exit can never overlap.
function animationKeys(inPoint, outPoint, frameSeconds, player, size) {
  const end = outPoint - frameSeconds;
  const span = end - inPoint;
  if (!(span > 0)) throw new Error('Animasyon için klip en az iki kare olmalı.');
  const ratio = Math.min(1, span / (IN_SECONDS + OUT_SECONDS));
  const enterEnd = inPoint + IN_SECONDS * ratio;
  const exitStart = end - OUT_SECONDS * ratio;
  const x = player.x / size.width, y = player.y / size.height;
  const keys = [];
  // UXP exposes interpolation modes but not the preset's temporal/spatial
  // tangent handles. Sample a smooth easing curve; do not claim a binary import
  // of the .prfpset or an exact reproduction of its Bezier handles.
  function segment(a, b, from, to) {
    const count = Math.max(1, Math.ceil((b - a) / frameSeconds));
    for (let i = 0; i <= count; i++) {
      const t = i / count, ease = t * t * (3 - 2 * t);
      const time = a + (b - a) * t;
      const point = {time, x: from + (to - from) * ease, y};
      if (keys.length && Math.abs(keys[keys.length - 1].time - time) < 1e-8) keys.pop();
      keys.push(point);
    }
  }
  segment(inPoint, enterEnd, x + OFFSET, x);
  segment(Math.max(enterEnd, exitStart), end, x, x + OFFSET);
  return keys;
}

function createEffects(ppro) {
  function transact(project, title, actions) {
    let ok = false;
    project.lockedAccess(() => {
      ok = project.executeTransaction(c => actions.forEach(a => c.addAction(a)), title);
    });
    if (!ok) throw new Error(title + ' başarısız.');
  }

  async function geometry(sequence, clip) {
    const [start, end, input, output, size, timebase] = await Promise.all([
      clip.getStartTime(), clip.getEndTime(), clip.getInPoint(), clip.getOutPoint(),
      sequence.getFrameSize(), sequence.getTimebase()
    ]);
    const frame = Number(timebase) / TICKS;
    if (!(frame > 0) || !(size.width > 0) || !(size.height > 0)) {
      throw new Error('Sequence kare hızı veya boyutu okunamadı.');
    }
    return {start, end, input, output, size, frame,
      signature: [start.ticks, end.ticks, input.ticks, output.ticks, timebase,
        size.width, size.height].join(':')};
  }

  async function findTransform(clip) {
    const chain = await clip.getComponentChain();
    for (let i = 0; i < chain.getComponentCount(); i++) {
      const c = chain.getComponentAtIndex(i);
      if (await c.getMatchName() === MATCH) return c;
    }
    return null;
  }

  async function apply(project, sequence, clip, player, adopt = false) {
    const g = await geometry(sequence, clip);
    const keys = animationKeys(g.input.seconds, g.output.seconds, g.frame, player, g.size);
    const chain = await clip.getComponentChain();
    let effect = await findTransform(clip);
    // Adoption must not take ownership of a user's existing Transform.
    if (adopt && effect && !playerId(await clip.getName())) {
      throw new Error('Klipte zaten Transform var; mevcut efekti korumak için atlandı.');
    }
    if (!effect) {
      effect = await ppro.VideoFilterFactory.createComponent(MATCH);
      transact(project, 'CS2 Transform ekle', [chain.createAppendComponentAction(effect)]);
      effect = await findTransform(clip);
    }
    if (!effect || effect.getParamCount() < 11) throw new Error('Transform parametreleri bulunamadı.');
    const position = effect.getParam(1);
    if (!await position.areKeyframesSupported()) throw new Error('Position keyframe desteklemiyor.');
    const actions = [];
    // Param indexes are the ordered Params array of the supplied Geometry2
    // preset, not localized display names or ParameterID values.
    const constants = [[0, new ppro.PointF(.5, .5)], [2, true],
      [3, player.scale], [4, player.scale], [5, 0], [6, 0],
      [7, player.rotation], [8, player.opacity], [9, false], [10, 360]];
    for (const [index, value] of constants) {
      const param = effect.getParam(index);
      actions.push(param.createSetTimeVaryingAction(false));
      actions.push(param.createSetValueAction(param.createKeyframe(value), true));
    }
    // Remove ALL old keys, including keys now outside the trimmed range.
    for (const time of position.getKeyframeListAsTickTimes()) {
      actions.push(position.createRemoveKeyframeAction(time, true));
    }
    actions.push(position.createSetTimeVaryingAction(true));
    for (const key of keys) {
      const k = position.createKeyframe(new ppro.PointF(key.x, key.y));
      k.position = ppro.TickTime.createWithSeconds(key.time);
      actions.push(position.createAddKeyframeAction(k));
      actions.push(position.createSetInterpolationAtKeyframeAction(
        k.position, ppro.Constants.InterpolationMode.LINEAR, true));
    }
    actions.push(clip.createSetNameAction(clipName(player)));
    transact(project, 'CS2 giriş / çıkış animasyonunu güncelle', actions);
    return g.signature;
  }

  async function clips(sequence) {
    const result = [];
    for (let i = 0; i < await sequence.getVideoTrackCount(); i++) {
      const track = await sequence.getVideoTrack(i);
      result.push(...await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false));
    }
    return result;
  }

  // Two stable observations avoid rewriting the animation throughout a drag.
  // Cache by wrapper only inside this scan; persistent ownership is in the
  // track item's name and therefore survives project/plugin reloads and copies.
  let busy = false, context = '';
  const observed = new Map(), completed = new Map();
  async function sync(players) {
    if (busy) return;
    busy = true;
    try {
      const project = await ppro.Project.getActiveProject();
      const sequence = project && await project.getActiveSequence();
      if (!sequence) return;
      const currentContext = project.guid.toString() + ':' + sequence.guid.toString();
      if (currentContext !== context) {
        context = currentContext; observed.clear(); completed.clear();
      }
      const seen = new Set(), failures = [];
      let index = 0;
      for (const clip of await clips(sequence)) {
        const key = index++;
        const id = playerId(await clip.getName());
        const player = players.find(p => p.id === id);
        if (!player) continue;
        seen.add(key);
        try {
          const g = await geometry(sequence, clip);
          const signature = JSON.stringify([player, g.signature]);
          if (completed.get(key) === signature) continue;
          if (observed.get(key) !== signature) { observed.set(key, signature); continue; }
          await apply(project, sequence, clip, player);
          completed.set(key, signature);
        } catch (e) { failures.push(player.name + ': ' + e.message); }
      }
      for (const key of observed.keys()) {
        if (!seen.has(key)) { observed.delete(key); completed.delete(key); }
      }
      if (failures.length) throw new Error(failures.join(' | '));
    } finally { busy = false; }
  }
  return {apply, clips, sync, isBusy: () => busy};
}

module.exports = {animationKeys, playerId, clipName, createEffects, IN_SECONDS, OUT_SECONDS};
