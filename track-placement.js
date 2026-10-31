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
  for (let i = 0; i < count; i++) {
    const track = await sequence.getVideoTrack(i);
    const clips = await track.getTrackItems(clipType, false);
    const intervals = [];
    for (const clip of clips) {
      intervals.push({start: Number((await clip.getStartTime()).ticks),
        end: Number((await clip.getEndTime()).ticks)});
    }
    if (hasRoom(intervals, start, duration)) return i;
  }
  // V1 first: empty tracks and gaps on populated tracks have equal priority.
  // A new track is needed only if no existing track can fit the whole still.
  return count;
}

module.exports = {hasRoom, chooseVideoTrack};
