function hasRoom(intervals, start, duration) {
  const end = start + duration;
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Klip yerleştirme süresi geçersiz.');
  }
  return intervals.every(({start: a, end: b}) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
      throw new Error('Mevcut track zamanları okunamadı.');
    }
    // End points are exclusive: touching the preceding/following clip is safe.
    return b <= start || a >= end;
  });
}

async function chooseVideoTrack(sequence, clipType, startTicks, durationTicks) {
  const start = Number(startTicks), duration = Number(durationTicks);
  hasRoom([], start, duration);
  const count = await sequence.getVideoTrackCount();
  let empty = null;
  for (let i = count - 1; i >= 0; i--) {
    const track = await sequence.getVideoTrack(i);
    const clips = await track.getTrackItems(clipType, false);
    if (!clips.length) { if (empty === null) empty = i; continue; }
    const intervals = [];
    for (const clip of clips) {
      intervals.push({start: Number((await clip.getStartTime()).ticks),
        end: Number((await clip.getEndTime()).ticks)});
    }
    if (hasRoom(intervals, start, duration)) return i;
  }
  // Reuse a gap on a populated track first, then an entirely empty track.
  // Returning count creates a new track only if every existing track is busy.
  return empty === null ? count : empty;
}

module.exports = {hasRoom, chooseVideoTrack};
