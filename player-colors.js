const PLAYER_COLORS = [
  {id: 'yellow', name: 'Yellow', hex: '#fcff00', label: 'YELLOW'},
  {id: 'blue', name: 'Blue', hex: '#8bcef2', label: 'BLUE'},
  {id: 'green', name: 'Green', hex: '#169f82', label: 'GREEN'},
  {id: 'purple', name: 'Purple', hex: '#ba3094', label: 'PURPLE'},
  {id: 'orange', name: 'Orange', hex: '#e18230', label: 'ORANGE'}
];
function getPlayerColor(id) { return PLAYER_COLORS.find(c => c.id === id) || null; }

// Set the source item BEFORE inserting a new timeline instance so that the
// instance inherits its label. No undocumented RGB preferences are modified.
async function applyPlayerLabel(ppro, project, item, colorId, labelOverrides = {}) {
  if (!colorId) return false; // Older libraries retain their existing labels.
  const color = getPlayerColor(colorId);
  if (!color) throw new Error('Geçersiz oyuncu rengi: ' + colorId);
  const override = labelOverrides[colorId];
  if (override !== undefined && (!Number.isInteger(override) || override < 0 || override > 15)) {
    throw new Error('Geçersiz label eşleştirmesi. Orange label eşlemesini yeniden yap.');
  }
  const index = override === undefined ? ppro.Constants.ProjectItemColorLabel[color.label] : override;
  if (colorId === 'orange' && !Number.isInteger(index)) {
    throw new Error('Orange label eşlemesi gerekli: Ayarlarda Project panelinden Orange label öğren düğmesini kullan.');
  }
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
async function readSelectedLabel(ppro, project) {
  const selection = await ppro.ProjectUtils.getSelection(project);
  const items = await selection.getItems();
  if (items.length !== 1) throw new Error('Project panelinde Orange label verdiğin tek bir öğeyi seç. Timeline seçimi yeterli değil.');
  const index = await items[0].getColorLabelIndex();
  if (!Number.isInteger(index) || index < 0 || index > 15) throw new Error('Seçili öğenin label rengi okunamadı.');
  return index;
}
module.exports = {PLAYER_COLORS, getPlayerColor, applyPlayerLabel, readSelectedLabel};
