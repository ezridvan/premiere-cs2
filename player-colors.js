const PLAYER_COLORS = [
  {id: 'yellow', name: 'Yellow', hex: '#fcff00', label: 'YELLOW'},
  {id: 'blue', name: 'Blue', hex: '#8bcef2', label: 'BLUE'},
  {id: 'green', name: 'Green', hex: '#169f82', label: 'GREEN'},
  {id: 'purple', name: 'Purple', hex: '#ba3094', label: 'PURPLE'},
  {id: 'orange', name: 'Orange', hex: '#e18230', label: 'MANGO'}
];
function getPlayerColor(id) { return PLAYER_COLORS.find(c => c.id === id) || null; }

// Set the source item BEFORE inserting a new timeline instance so that the
// instance inherits its label. No undocumented RGB preferences are modified.
async function applyPlayerLabel(ppro, project, item, colorId) {
  if (!colorId) return false; // Older libraries retain their existing labels.
  const color = getPlayerColor(colorId);
  if (!color) throw new Error('Geçersiz oyuncu rengi: ' + colorId);
  const index = ppro.Constants.ProjectItemColorLabel[color.label];
  if (!Number.isInteger(index)) throw new Error(color.name + ' label bu Premiere sürümünde bulunamadı.');
  if (await item.getColorLabelIndex() === index) return false;
  let ok = false;
  project.lockedAccess(() => {
    ok = project.executeTransaction(compound => {
      compound.addAction(item.createSetColorLabelAction(index));
    }, 'CS2 oyuncu label: ' + color.name);
  });
  if (!ok) throw new Error(color.name + ' label uygulanamadı.');
  return true;
}
module.exports = {PLAYER_COLORS, getPlayerColor, applyPlayerLabel};
