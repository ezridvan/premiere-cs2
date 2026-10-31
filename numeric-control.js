// Mouse events + contenteditable work in the Premiere UXP panel DOM.
// Click to type; drag either the number or label to scrub the value.
function bindNumericControl(field, label, doc, options) {
  const {min, max, fallback, step = 1} = options;
  let editStart = fallback, drag = null;
  const clamp = n => Math.max(min, Math.min(max, Math.round(n * 1000) / 1000));
  function parse(text) {
    const value = String(text).trim().replace(',', '.');
    return value === '' ? NaN : Number(value);
  }
  function read() { return parse(field.textContent); }
  function write(n) { field.textContent = String(clamp(n)); }
  function editing() { return field.getAttribute('contenteditable') === 'true'; }
  function commit() {
    if (!editing()) return;
    const value = read();
    write(Number.isFinite(value) ? value : editStart);
    field.setAttribute('contenteditable', 'false');
  }
  function beginEdit() {
    editStart = Number.isFinite(read()) ? read() : fallback;
    field.setAttribute('contenteditable', 'true');
    field.focus();
  }
  function stop() {
    if (!drag) return;
    const finished = drag;
    drag = null;
    doc.removeEventListener('mousemove', move);
    doc.removeEventListener('mouseup', release);
    doc.removeEventListener('mouseleave', cancelDrag);
    field.classList.remove('scrubbing');
    return finished;
  }
  function move(event) {
    if (!drag) return;
    const dx = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    if (!drag.moved) {
      if (Math.abs(event.clientX - drag.startX) < 3) return;
      drag.moved = true;
      field.classList.add('scrubbing');
      drag.value = drag.initial;
      drag.lastX = event.clientX;
      // Include the pixels traversed before crossing the drag threshold.
      drag.value += (event.clientX - drag.startX) * step * (event.altKey ? .1 : event.shiftKey ? 10 : 1);
    } else {
      drag.value += dx * step * (event.altKey ? .1 : event.shiftKey ? 10 : 1);
    }
    drag.value = clamp(drag.value);
    write(drag.value);
    event.preventDefault();
  }
  function release(event) {
    const finished = stop();
    if (finished && !finished.moved && finished.number) beginEdit();
    if (finished && finished.moved) event.preventDefault();
  }
  function cancelDrag() { stop(); }
  function press(event, number) {
    if (event.button !== undefined && event.button !== 0) return;
    if (number && editing()) return; // Keep ordinary caret/selection behavior.
    commit();
    stop();
    const initial = Number.isFinite(read()) ? read() : fallback;
    drag = {startX: event.clientX, lastX: event.clientX, initial, value: initial, moved: false, number};
    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', release);
    doc.addEventListener('mouseleave', cancelDrag);
    event.preventDefault();
  }
  field.setAttribute('contenteditable', 'false');
  field.setAttribute('tabindex', '0');
  field.setAttribute('role', 'spinbutton');
  field.setAttribute('aria-valuemin', String(min));
  field.setAttribute('aria-valuemax', String(max));
  field.setAttribute('aria-label', options.label);
  field.setAttribute('spellcheck', 'false');
  field.title = 'Tıkla: değer yaz · Sürükle: değiştir · Shift: hızlı · Alt: hassas';
  label.title = 'Sağa / sola sürükleyerek değeri değiştir';
  field.addEventListener('mousedown', e => press(e, true));
  label.addEventListener('mousedown', e => press(e, false));
  field.addEventListener('blur', commit);
  field.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editing()) { commit(); field.blur(); } else beginEdit();
    } else if (e.key === 'Escape' && editing()) {
      e.preventDefault(); write(editStart); field.setAttribute('contenteditable', 'false'); field.blur();
    } else if (!editing() && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const value = Number.isFinite(read()) ? read() : fallback;
      write(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.altKey ? .1 : e.shiftKey ? 10 : 1));
    } else if (!editing() && (e.key.length === 1 && /[0-9.,+-]/.test(e.key))) {
      e.preventDefault(); beginEdit(); field.textContent = e.key;
    }
  });
  field.addEventListener('paste', () => { if (!editing()) beginEdit(); });
  return {commit, stop, read};
}
module.exports = {bindNumericControl};
