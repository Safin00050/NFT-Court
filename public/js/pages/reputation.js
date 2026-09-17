import { getReputation } from "../genlayer-client.js";
import { shortAddr } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, pageLoader, escapeHtml, statusClass } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell("rep")}
<main class="page">
  <h1>Seller reputation</h1>
  <p class="muted">On-chain snapshots written when a trade settles.</p>
  <div id="list"></div>
</main>
${pageFooter()}
`;
await wireChrome();

const root = document.getElementById("list");
pageLoader(root, "Reading snapshots…");
try {
  const rows = await getReputation();
  if (!rows.length) {
    root.innerHTML = `<p class="muted">No snapshots yet. Settle a verdicted listing first.</p>`;
  } else {
    root.innerHTML = rows
      .slice()
      .reverse()
      .map(
        (row) => `
      <div class="deal-row">
        <span class="mono">${escapeHtml(shortAddr(row.agent) || row.agent || "")}</span>
        <div>
          <strong>${escapeHtml(row.listing_id)}</strong>
          <div class="muted">condition ${escapeHtml(row.condition_score)} · evidence ${escapeHtml(row.evidence_score)} · timeliness ${escapeHtml(row.timeliness_score)} · final ${escapeHtml(row.final_score)}</div>
        </div>
        <span class="${statusClass(row.decision)}">${escapeHtml(row.decision)}</span>
        <span class="muted">${escapeHtml(row.recorded_at || "")}</span>
      </div>`
      )
      .join("");
  }
} catch (error) {
  root.innerHTML = `<p class="muted">${escapeHtml(error.message || String(error))}</p>`;
  toast(error.message || String(error), "err");
}
