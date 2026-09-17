import { listListingIds, getListing } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, pageLoader, escapeHtml, statusClass, rememberListing, loadListingIds, rememberLastOpenedId } from "../ui.js";
import { shortAddr } from "../wallet.js";

document.getElementById("app").innerHTML = `
${pageShell("market")}
<main class="page">
  <h1>Listings</h1>
  <p class="muted">Live listings from <code>list_listing_ids</code> + <code>get_listing</code> on Studio Next.</p>
  <div class="toolbar">
    <a class="btn-primary" href="/pages/new-listing.html">New listing</a>
    <button class="btn-ghost" id="reloadBtn" type="button">Reload from chain</button>
  </div>
  <div id="list"></div>
</main>
${pageFooter()}
`;
await wireChrome();

async function load() {
  const root = document.getElementById("list");
  pageLoader(root, "Reading listings…");
  try {
    let ids = [];
    try {
      ids = await listListingIds();
    } catch (error) {
      console.warn(error);
    }
    for (const id of loadListingIds()) if (!ids.includes(id)) ids.push(id);
    if (!ids.length) {
      root.innerHTML = `<p class="muted">No listings yet. Create one, or set the contract on Setup.</p>`;
      return;
    }
    const rows = [];
    for (const id of ids) {
      try {
        const listing = await getListing(id);
        if (!listing) continue;
        rememberListing(id);
        rows.push({ id, listing });
      } catch (error) {
        console.warn(id, error);
      }
    }
    if (!rows.length) {
      root.innerHTML = `<p class="muted">Could not decode listings. Confirm the Setup address is the one you just deployed.</p>`;
      return;
    }
    root.innerHTML = rows
      .map(
        ({ id, listing }) => `
      <div class="deal-row">
        <span class="mono">${escapeHtml(id)}</span>
        <div>
          <strong>${escapeHtml(listing.nft_title || "Untitled listing")}</strong>
          <div class="muted">price ${escapeHtml(listing.price)} ${escapeHtml(listing.currency || "")} · seller ${escapeHtml(shortAddr(listing.seller_agent) || "—")}</div>
        </div>
        <span class="${statusClass(listing.status)}">${escapeHtml(listing.status || "?")}</span>
        <a class="btn-ghost" data-id="${escapeHtml(id)}" href="/pages/listing.html?id=${encodeURIComponent(id)}">Open</a>
      </div>`
      )
      .join("");
    root.querySelectorAll("[data-id]").forEach((a) => {
      a.addEventListener("click", () => rememberLastOpenedId(a.dataset.id));
    });
  } catch (error) {
    root.innerHTML = `<p class="muted">${escapeHtml(error.message || String(error))}</p>`;
    toast(error.message || String(error), "err");
  }
}

document.getElementById("reloadBtn").addEventListener("click", load);
await load();
