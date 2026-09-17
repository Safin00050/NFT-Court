import { explorerTx } from "../config.js";
import { writeContract } from "../genlayer-client.js";
import { connectWallet, getAccount } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, formValue, withSpinner } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell("new")}
<main class="page">
  <h1>New listing</h1>
  <p class="muted">Seller wallet signs <code>create_listing</code>. Buyer address cannot be the seller.</p>
  <form class="panel" id="listingForm">
    <label>Buyer agent address
      <input name="buyer_agent" required placeholder="0x… buyer wallet">
    </label>
    <label>NFT title
      <input name="nft_title" required placeholder="e.g. Azuki #1204, or a description of what's being sold">
    </label>
    <label>Condition claims
      <textarea name="condition_claims" rows="4" required placeholder="What you're claiming about it: rarity traits, edition, on-chain provenance, condition, included assets…"></textarea>
    </label>
    <label>Price (integer units recorded on-chain)
      <input name="price" type="number" min="1" required value="5">
    </label>
    <label>Currency label
      <input name="currency" value="GEN">
    </label>
    <label>Delivery deadline (ISO or any sortable timestamp)
      <input name="delivery_deadline" required placeholder="2026-09-17T18:00:00Z">
    </label>
    <label>Authenticity threshold (1–100)
      <input name="authenticity_threshold" type="number" min="1" max="100" required value="80">
    </label>
    <button class="btn-primary" id="postBtn" type="submit">Create listing on GenLayer</button>
    <p class="muted" id="txOut"></p>
  </form>
</main>
${pageFooter()}
`;
await wireChrome();

document.getElementById("listingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const button = document.getElementById("postBtn");
  await withSpinner(button, async () => {
    try {
      const account = (await getAccount()) || (await connectWallet());
      toast("Confirm create_listing in the wallet…");
      const { hash } = await writeContract(
        "create_listing",
        [
          formValue(form, "buyer_agent"),
          formValue(form, "nft_title"),
          formValue(form, "condition_claims"),
          Number(formValue(form, "price")),
          formValue(form, "currency") || "GEN",
          formValue(form, "delivery_deadline"),
          Number(formValue(form, "authenticity_threshold")),
        ],
        account
      );
      document.getElementById("txOut").innerHTML = `Posted. After consensus, open Listings and reload. Tx <a href="${explorerTx(hash)}" target="_blank" rel="noopener">${hash || "submitted"}</a>`;
      toast("Listing submitted", "ok");
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
