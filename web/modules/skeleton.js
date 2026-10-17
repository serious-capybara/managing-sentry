const bar = (w, h = 14) => `<span class="skeleton" style="width:${w};height:${h}px"></span>`;

function tableRows(count, columns) {
  return Array.from({ length: count }, () =>
    `<div class="skeleton-row">${columns.map(w => bar(w)).join("")}</div>`).join("");
}

/** Gray placeholder shapes shown while the first data is still on its way. */
export function skeletonHtml() {
  return `
    <div class="skeleton-page" aria-busy="true" aria-label="Loading">
      <div class="skeleton-stats">
        ${Array.from({ length: 4 }, () => `<div class="skeleton-card">${bar("40px", 40)}<div>${bar("90px", 10)}${bar("120px", 20)}</div></div>`).join("")}
      </div>
      <div class="skeleton-toolbar">${bar("160px", 40)}<span style="flex:1"></span>${bar("220px", 40)}</div>
      <div class="skeleton-table">
        <div class="skeleton-row head">${["8%", "26%", "16%", "12%", "12%", "12%"].map(w => bar(w, 12)).join("")}</div>
        ${tableRows(9, ["6%", "30%", "14%", "10%", "10%", "12%"])}
      </div>
    </div>`;
}

export function showSkeleton() {
  const root = document.getElementById("pageContent");
  if (root) root.innerHTML = skeletonHtml();
}
