const TICKS_PER_SECOND = 254016000000;
const {IN_SECONDS, OUT_SECONDS} = require('./overlay-effects.js');

// Choose the shortest whole-frame still that fits both animations without
// speeding either up. Include the exclusive out-point's final visible frame.
function stillDurationTicks(timebase) {
  const ticksPerFrame = Number(timebase);
  if (!Number.isSafeInteger(ticksPerFrame) || ticksPerFrame <= 0) {
    throw new Error('Sequence kare süresi okunamadı.');
  }
  if (ticksPerFrame > TICKS_PER_SECOND) throw new Error('Geçersiz sequence kare süresi.');
  const frames = Math.ceil((IN_SECONDS + OUT_SECONDS) * TICKS_PER_SECOND / ticksPerFrame + 1);
  const ticks = ticksPerFrame * frames;
  if (!Number.isSafeInteger(ticks)) throw new Error('Fotoğraf süresi hesaplanamadı.');
  return String(ticks);
}

function setStillSourceDuration(ppro, project, item, ticks) {
  const source = ppro.ClipProjectItem.cast(item);
  if (!source) throw new Error('PNG kaynak klibi bulunamadı.');
  let ok = false;
  project.lockedAccess(() => {
    ok = project.executeTransaction(compound => {
      compound.addAction(source.createSetInOutPointsAction(
        ppro.TickTime.createWithTicks('0'), ppro.TickTime.createWithTicks(ticks)));
    }, 'CS2 fotoğraf süresini animasyona göre ayarla');
  });
  if (!ok) throw new Error('Fotoğraf süresi ayarlanamadı.');
}

async function verifyStillSourceDuration(ppro, item, ticks) {
  const source = ppro.ClipProjectItem.cast(item);
  const input = await source.getInPoint(ppro.Constants.MediaType.VIDEO);
  const output = await source.getOutPoint(ppro.Constants.MediaType.VIDEO);
  if (Number(input.ticks) !== 0 || Number(output.ticks) !== Number(ticks)) {
    throw new Error('PNG süresi doğrulanamadı; uzun klip eklememek için işlem durduruldu.');
  }
}
async function fitInsertedStill(ppro, resolve, ticks) {
  // getDuration() can disagree with timeline bounds for an imported still.
  // Use sequence end-start and source out-in, then trim the actual new item.
  const target = Number(ticks);
  async function bounds(clip) {
    const start = Number((await clip.getStartTime()).ticks);
    const end = Number((await clip.getEndTime()).ticks);
    const input = Number((await clip.getInPoint()).ticks);
    const output = Number((await clip.getOutPoint()).ticks);
    return {start, end, input, output};
  }
  let fresh = await resolve();
  let b = await bounds(fresh.clip);
  if (b.end - b.start === target && b.output - b.input === target) return '';
  let failure = '';
  try {
    let ok = false;
    fresh.project.lockedAccess(() => {
      ok = fresh.project.executeTransaction(compound => {
        compound.addAction(fresh.clip.createSetOutPointAction(
          ppro.TickTime.createWithTicks(String(b.input + target))));
        compound.addAction(fresh.clip.createSetEndAction(
          ppro.TickTime.createWithTicks(String(b.start + target))));
      }, 'CS2 eklenen PNG süresini düzelt');
    });
    if (!ok) failure = 'Premiere süre düzeltmesini kabul etmedi.';
  } catch (e) { failure = e.message || String(e); }
  fresh = await resolve(); // Mutations invalidate clip/parameter wrappers.
  b = await bounds(fresh.clip);
  if (b.end - b.start === target && b.output - b.input === target) return '';
  return 'Süre ayarlanamadı; animasyon mevcut klip süresine uygulandı.' + (failure ? ' ' + failure : '');
}
module.exports = {stillDurationTicks, setStillSourceDuration, verifyStillSourceDuration, fitInsertedStill};
