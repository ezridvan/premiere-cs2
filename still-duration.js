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
module.exports = {stillDurationTicks, setStillSourceDuration, verifyStillSourceDuration};
