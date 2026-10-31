// Adobe UXP 25.6 APIs. Preset originals are retained in presets/.
const TICKS = 254016000000;
const MATCH = 'AE.ADBE Geometry2';
const TAG = / \[CS2:([^\]]+)\]$/;
// Match the requested arrival timing ratio: 44 instead of 50 (12% shorter).
const IN_SECONDS = (215913600000 / TICKS) * (44 / 50);
// Exit takes 45 frames in the user's 60 fps sequence.
const OUT_SECONDS = 45 / 60;
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
  // Distance is independent of duration and the player's resting Position X.
  // Missing values in existing libraries use the new half-distance default.
  const percentage = player.slideDistance === undefined ? 50 : player.slideDistance;
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 200) {
    throw new Error('Kayma mesafesi 0 ile 200 arasında olmalı.');
  }
  const offset = OFFSET * percentage / 100;
  const x = player.x / size.width, y = player.y / size.height;
  const keys = [];
  // UXP exposes interpolation modes but not the preset's temporal/spatial
  // tangent handles. Sample a smooth easing curve; do not claim a binary import
  // of the .prfpset or an exact reproduction of its Bezier handles.
  function segment(a, b, from, to, decelerate = false) {
    const count = Math.max(1, Math.ceil((b - a) / frameSeconds));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      // Entrance: immediate movement, progressively gentler arrival.
      // Exit keeps its existing ease-in/out profile.
      const ease = decelerate ? 1 - Math.pow(1 - t, 4) : t * t * (3 - 2 * t);
      const time = a + (b - a) * t;
      const point = {time, x: from + (to - from) * ease, y};
      if (keys.length && Math.abs(keys[keys.length - 1].time - time) < 1e-8) keys.pop();
      keys.push(point);
    }
  }
  segment(inPoint, enterEnd, x + offset, x, true);
  segment(Math.max(enterEnd, exitStart), end, x, x + offset);
  return keys;
}

function createEffects(ppro) {
  function transact(project, title, buildActions) {
    let ok = false;
    project.lockedAccess(() => {
      ok = project.executeTransaction(c => buildActions().forEach(a => c.addAction(a)), title);
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

  async function describe(clip) {
    return {cs2Locator: true, track: await clip.getTrackIndex(),
      start: (await clip.getStartTime()).ticks};
  }

  async function resolve(projectId, sequenceId, locator) {
    const project = await ppro.Project.getActiveProject();
    if (!project || project.guid.toString() !== projectId) throw new Error('Aktif proje değişti.');
    const sequence = await project.getSequence(ppro.Guid.fromString(sequenceId));
    if (!sequence) throw new Error('Sequence bulunamadı.');
    const track = await sequence.getVideoTrack(locator.track);
    const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    const matches = [];
    for (const item of items) {
      if ((await item.getStartTime()).ticks === locator.start) matches.push(item);
    }
    if (matches.length !== 1) throw new Error('Klip taşındı veya silindi; yeniden dene.');
    return {project, sequence, clip: matches[0]};
  }

  async function apply(project, sequence, clip, player, adopt = false) {
    const projectId = project.guid.toString(), sequenceId = sequence.guid.toString();
    const locator = clip.cs2Locator ? clip : await describe(clip);
    let chain, effect, position;
    async function refresh() {
      const fresh = await resolve(projectId, sequenceId, locator);
      project = fresh.project; sequence = fresh.sequence; clip = fresh.clip;
      chain = await clip.getComponentChain();
      effect = await findTransform(clip);
      position = effect && effect.getParam(1);
    }
    await refresh();
    const g = await geometry(sequence, clip);
    const keys = animationKeys(g.input.seconds, g.output.seconds, g.frame, player, g.size);
    // Adoption must not take ownership of a user's existing Transform.
    if (adopt && effect && !playerId(await clip.getName())) {
      throw new Error('Klipte zaten Transform var; mevcut efekti korumak için atlandı.');
    }
    let appended = false;
    if (!effect) {
      effect = await ppro.VideoFilterFactory.createComponent(MATCH);
      transact(project, 'CS2 Transform ekle', () => [chain.createAppendComponentAction(effect)]);
      appended = true;
    }
    let phase = 'Transform sonrası klibi yenile';
    try {
    await refresh();
    if (!effect || effect.getParamCount() < 11) throw new Error('Transform parametreleri bulunamadı.');
    position = effect.getParam(1);
    if (!await position.areKeyframesSupported()) throw new Error('Position keyframe desteklemiyor.');
    // Commit modes before constructing actions that depend on those modes.
    // Native Premiere validates keyframe existence when interpolation actions
    // are created, not only when the transaction eventually executes.
    const constants = [[0, new ppro.PointF(.5, .5)], [2, true],
      [3, player.scale], [4, player.scale], [5, 0], [6, 0],
      [7, player.rotation], [8, player.opacity], [9, false], [10, 360]];
    phase = 'Animasyon kanallarını hazırla';
    transact(project, 'CS2 animasyon kanallarını hazırla', () => {
      const actions = [];
      for (const time of position.getKeyframeListAsTickTimes()) {
        actions.push(position.createRemoveKeyframeAction(time, true));
      }
      for (const [index] of constants) {
        actions.push(effect.getParam(index).createSetTimeVaryingAction(false));
      }
      actions.push(position.createSetTimeVaryingAction(true));
      return actions;
    });
    phase = 'Keyframe eklemek için referansları yenile';
    await refresh();
    phase = 'Giriş / çıkış keyframe ekle';
    transact(project, 'CS2 giriş / çıkış keyframe ekle', () => {
      const actions = [];
      for (const [index, value] of constants) {
        const param = effect.getParam(index);
        actions.push(param.createSetValueAction(param.createKeyframe(value), true));
      }
      for (const key of keys) {
        const k = position.createKeyframe(new ppro.PointF(key.x, key.y));
        k.position = ppro.TickTime.createWithSeconds(key.time);
        actions.push(position.createAddKeyframeAction(k));
      }
      return actions;
    });
    phase = 'Eğri için referansları yenile';
    await refresh();
    phase = 'Animasyon eğrisini ayarla';
    transact(project, 'CS2 animasyon eğrisini ayarla', () => {
      const actions = keys.map(key => position.createSetInterpolationAtKeyframeAction(
        ppro.TickTime.createWithSeconds(key.time), ppro.Constants.InterpolationMode.BEZIER, true));
      actions.push(clip.createSetNameAction(clipName(player)));
      return actions;
    });
    phase = 'Keyframe sonucunu doğrula';
    await refresh();
    const actual = position.getKeyframeListAsTickTimes();
    if (actual.length !== keys.length) {
      throw new Error('Keyframe doğrulaması başarısız: beklenen ' + keys.length + ', bulunan ' + actual.length);
    }
    return g.signature;
    } catch (error) {
      // Never leave an unowned partial Transform behind after a failed setup;
      // otherwise a retry would mistake our own leftover for a user effect.
      if (appended && effect) {
        try { await refresh(); transact(project, 'CS2 eksik efekti temizle',
          () => [chain.createRemoveComponentAction(effect)]); }
        catch (cleanupError) {
          throw new Error(error.message + ' | Eksik Transform temizlenemedi: ' + cleanupError.message);
        }
      }
      throw new Error(phase + ': ' + error.message);
    }
  }

  async function clips(sequence, shouldStop = () => false) {
    const result = [];
    for (let i = 0; i < await sequence.getVideoTrackCount(); i++) {
      if (shouldStop()) break;
      const track = await sequence.getVideoTrack(i);
      result.push(...await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false));
    }
    return result;
  }

  // Two stable observations avoid rewriting the animation throughout a drag.
  // Cache by wrapper only inside this scan; persistent ownership is in the
  // track item's name and therefore survives project/plugin reloads and copies.
  let busy = false, paused = 0, context = '';
  const idleWaiters = [];
  const observed = new Map(), completed = new Map();
  async function pauseTracking() {
    paused++;
    if (busy) await new Promise(resolve => idleWaiters.push(resolve));
    let released = false;
    return () => { if (!released) { released = true; paused--; } };
  }
  async function sync(players) {
    if (busy || paused) return;
    busy = true;
    try {
      const project = await ppro.Project.getActiveProject();
      if (paused) return;
      const sequence = project && await project.getActiveSequence();
      if (!sequence || paused) return;
      const currentContext = project.guid.toString() + ':' + sequence.guid.toString();
      if (currentContext !== context) {
        context = currentContext; observed.clear(); completed.clear();
      }
      const seen = new Set(), failures = [], pending = [];
      const byId = new Map(players.map(player => [player.id, player]));
      // Snapshot only managed clips before making any edits. Avoid rescanning a
      // whole track separately for every unchanged overlay on a large timeline.
      for (const item of await clips(sequence, () => paused > 0)) {
        if (paused) return;
        const name = await item.getName();
        const id = playerId(name), player = byId.get(id);
        if (!player) continue;
        try {
          const locator = await describe(item);
          if (paused) return;
          const g = await geometry(sequence, item);
          pending.push({locator, player, signature: JSON.stringify([player, g.signature])});
        } catch (e) { failures.push(player.name + ': ' + e.message); }
      }
      if (paused) return;
      const projectId = project.guid.toString(), sequenceId = sequence.guid.toString();
      for (const {locator, player, signature} of pending) {
        if (paused) return;
        const key = locator.track + ':' + locator.start + ':' + player.id;
        seen.add(key);
        if (completed.get(key) === signature) continue;
        if (observed.get(key) !== signature) { observed.set(key, signature); continue; }
        try {
          const fresh = await resolve(projectId, sequenceId, locator);
          if (paused) return;
          await apply(fresh.project, fresh.sequence, locator, player);
          completed.set(key, signature);
        } catch (e) { failures.push(player.name + ': ' + e.message); }
      }
      for (const key of observed.keys()) {
        if (!seen.has(key)) { observed.delete(key); completed.delete(key); }
      }
      if (failures.length) throw new Error(failures.join(' | '));
    } finally {
      busy = false;
      idleWaiters.splice(0).forEach(resolve => resolve());
    }
  }
  return {apply, clips, describe, sync, pauseTracking, isBusy: () => busy};
}

module.exports = {animationKeys, playerId, clipName, createEffects, IN_SECONDS, OUT_SECONDS};
