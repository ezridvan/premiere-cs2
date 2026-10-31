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

function isLogoName(name) {
  return String(name || '').replace(/\\/g, '/').split('/').pop().toLowerCase() === 'logo.png';
}

async function isLogoClip(clip, sourcePath) {
  if (typeof clip.getName === 'function' && isLogoName(await clip.getName())) return true;
  if (sourcePath && isLogoName(await sourcePath(clip))) return true;
  if (typeof clip.getProjectItem === 'function') {
    const item = await clip.getProjectItem();
    if (item && isLogoName(item.name)) return true;
  }
  return false;
}

async function chooseVideoTrack(sequence, clipType, startTicks, durationTicks, sourcePath) {
  const start = Number(startTicks), duration = Number(durationTicks);
  hasRoom([], start, duration);
  const count = await sequence.getVideoTrackCount();
  const tracks = [];
  let logoTrack = -1;
  // Inspect every track before choosing a gap: a logo may sit above an empty V1.
  for (let i = 0; i < count; i++) {
    const track = await sequence.getVideoTrack(i);
    const clips = await track.getTrackItems(clipType, false);
    const intervals = [];
    for (const clip of clips) {
      if (await isLogoClip(clip, sourcePath)) logoTrack = Math.max(logoTrack, i);
      intervals.push({start: Number((await clip.getStartTime()).ticks),
        end: Number((await clip.getEndTime()).ticks)});
    }
    tracks.push(intervals);
  }
  // Start directly above the highest Logo.png, or at V1 if there is no logo.
  for (let i = logoTrack + 1; i < count; i++) {
    if (hasRoom(tracks[i], start, duration)) return i;
  }
  // A new track is needed only if no existing track can fit the whole still.
  return count;
}

module.exports = {hasRoom, chooseVideoTrack, isLogoName};
