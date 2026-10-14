/* ============================================================
 * mobile-sheet.js — Phone bottom sheets (Expiring Soon, Pick Items
 * to Sell, Low On Stock).
 *
 * The sheet is flush with the left / right / bottom edges, can be
 * dragged by its handle and always settles on one of two stops:
 * 50% (half view) or 90% (full view) of the screen height.
 * Dragging it far down, tapping the dark area, or tapping its tab
 * again closes it.
 * ============================================================ */

const PHONE_QUERY = "(max-width: 767px)";
export const SNAP_HALF = 0.5;
export const SNAP_FULL = 0.9;
const CLOSE_BELOW = 0.32;

export const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

let backdrop = null;
let active = null;           // the sheet that is currently open

function ensureBackdrop() {
  if (backdrop && document.body.contains(backdrop)) return backdrop;
  backdrop = document.createElement("div");
  backdrop.className = "m-sheet-backdrop";
  backdrop.addEventListener("click", () => active?.close());
  document.body.appendChild(backdrop);
  return backdrop;
}

const viewportH = () => window.innerHeight || document.documentElement.clientHeight || 800;

/**
 * @param {object}      o
 * @param {HTMLElement} o.sheet     the element that becomes the sheet (.m-sheet)
 * @param {HTMLElement} o.handle    drag handle inside the sheet
 * @param {HTMLElement} o.host      element that receives the "sheet-open" class
 * @param {() => void}  [o.onChange] called after every open / close
 */
export function createSheet({ sheet, handle, host, onChange }) {
  ensureBackdrop();
  sheet.classList.add("m-sheet");
  let snap = SNAP_HALF;
  let fixed = false;       // true → locked at 90%, no dragging (Pick Items to Sell)

  const setHeight = px => sheet.style.setProperty("--sheet-h", `${Math.round(px)}px`);

  const sheetApi = {
    isOpen: () => host.classList.contains("sheet-open"),
    open({ locked = false } = {}) {
      if (!isPhone()) return;
      if (active && active !== sheetApi) active.close();
      fixed = locked;
      sheet.classList.toggle("is-locked", locked);
      setHeight(viewportH() * (locked ? SNAP_FULL : snap));
      host.classList.add("sheet-open");
      document.body.classList.add("m-sheet-open");
      active = sheetApi;
      onChange?.();
    },
    close() {
      if (!host.classList.contains("sheet-open")) return;
      host.classList.remove("sheet-open");
      document.body.classList.remove("m-sheet-open");
      if (active === sheetApi) active = null;
      onChange?.();
    },
    toggle(opts) { sheetApi.isOpen() ? sheetApi.close() : sheetApi.open(opts); }
  };

  // ---- dragging -------------------------------------------------------
  let startY = 0, startH = 0, dragging = false;

  handle.addEventListener("pointerdown", e => {
    if (fixed || !sheetApi.isOpen() || e.target.closest("button")) return;
    dragging = true;
    startY = e.clientY;
    startH = sheet.getBoundingClientRect().height;
    sheet.classList.add("dragging");
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener("pointermove", e => {
    if (!dragging) return;
    const h = Math.max(viewportH() * 0.15, Math.min(viewportH() * SNAP_FULL, startH + (startY - e.clientY)));
    setHeight(h);
  });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove("dragging");
    handle.releasePointerCapture?.(e.pointerId);
    const ratio = sheet.getBoundingClientRect().height / viewportH();
    if (ratio < CLOSE_BELOW) { sheetApi.close(); return; }
    snap = Math.abs(ratio - SNAP_HALF) <= Math.abs(ratio - SNAP_FULL) ? SNAP_HALF : SNAP_FULL;
    setHeight(viewportH() * snap);
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);

  // Keep the sheet on its stop when the phone rotates; close it if we leave phone size.
  const onResize = () => {
    if (!document.body.contains(sheet)) { window.removeEventListener("resize", onResize); return; }
    if (!isPhone()) { sheetApi.close(); return; }
    if (sheetApi.isOpen()) setHeight(viewportH() * (fixed ? SNAP_FULL : snap));
  };
  window.addEventListener("resize", onResize);

  return sheetApi;
}

/** Small markup used by every sheet: grip + optional collapse button. */
export function sheetHandleHtml(id, withCollapse = false) {
  return `<div class="m-sheet-handle" ${id ? `id="${id}"` : ""}>
    <span class="m-sheet-grip"></span>
    ${withCollapse ? `<button type="button" class="m-sheet-collapse" data-sheet-collapse aria-label="Close"><img class="btn-icon" src="src/icon/dark/dropdown-close-expand.svg" alt=""></button>` : ""}
  </div>`;
}
