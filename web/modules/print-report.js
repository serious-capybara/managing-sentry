// shared layout for printed reports

import { escapeHtml, formatAsiaManila } from "./utils.js";
import { getSession } from "./state.js";
import { STORE_NAME, STORE_ADDRESS, STORE_TEL } from "./receipt.js";

export function printStamp(date = new Date()) {
  return formatAsiaManila(date, true);
}

export function docNumber(prefix) {
  const d = new Date();
  const p2 = n => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
}

// section heading
export function proHeading(title, note = "") {
  return `<h3 class="pro-heading"><span>${title}</span>${note ? `<small>${note}</small>` : ""}</h3>`;
}

// summary figures, 4 per row: [{label, value, note?, tone?: "good"|"bad"}]
export function proSummary(items) {
  return `<div class="pro-summary">${items.map(i => `
    <div class="pro-figure ${i.tone ? `is-${i.tone}` : ""}">
      <span class="pro-figure-label">${escapeHtml(i.label)}</span>
      <strong class="pro-figure-value">${i.value}</strong>
      ${i.note ? `<span class="pro-figure-note">${escapeHtml(i.note)}</span>` : ""}
    </div>`).join("")}</div>`;
}

// whole document: letterhead, title, details, body, signatures
export function proDocument({ prefix, title, subtitle = "", details = [], body }) {
  const session = getSession();
  const preparedBy = session?.fullName || session?.username || "—";
  const allDetails = [
    ["Document No.", docNumber(prefix)],
    ...details,
    ["Generated", printStamp()],
    ["Prepared by", preparedBy]
  ];

  return `
    <article class="pro-report">
      <header class="pro-letterhead">
        <div class="pro-brand">
          <div class="pro-store">${escapeHtml(STORE_NAME)}</div>
          <div class="pro-store-sub">${escapeHtml(STORE_ADDRESS)} &nbsp;•&nbsp; Tel: ${escapeHtml(STORE_TEL)}</div>
        </div>
        <div class="pro-confidential">Confidential</div>
      </header>

      <div class="pro-title-block">
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>

      <dl class="pro-details">
        ${allDetails.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
      </dl>

      ${body}

      <div class="pro-signatures">
        <div><span class="pro-sign-line"></span><span>Prepared by</span><small>${escapeHtml(preparedBy)}</small></div>
        <div><span class="pro-sign-line"></span><span>Reviewed &amp; approved by</span><small>Manager / Administrator</small></div>
      </div>
      <p class="pro-endnote">— End of report —</p>
    </article>`;
}
