import { explorerTx } from "../config.js";
import { getListing, getEvidence, getVerdict, getDelivery, writeContract } from "../genlayer-client.js";
import { connectWallet, getAccount, sameAddress, shortAddr } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, pageLoader, escapeHtml, statusClass, formValue, withSpinner, rememberListing, readLastOpenedId, burstCoins } from "../ui.js";

const listingId = new URLSearchParams(location.search).get("id") || readLastOpenedId() || "";

document.getElementById("app").innerHTML = `
${pageShell("market")}
<main class="page">
  <h1>Listing docket</h1>
  <p class="mono" id="listingLabel">${escapeHtml(listingId || "missing id")}</p>
  <div id="docket" class="panel"></div>
  <div id="actions" style="margin-top:18px"></div>
  <p class="muted" id="txOut"></p>
</main>
${pageFooter()}
`;
await wireChrome();

async function needWallet() {
  return (await getAccount()) || (await connectWallet());
}

async function run(name, args, label) {
  toast(`Confirm ${name}…`);
  const account = await needWallet();
  const { hash } = await writeContract(name, args, account);
  document.getElementById("txOut").innerHTML = `${escapeHtml(label)}. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View tx</a>`;
  toast(label, "ok");
  await render(true);
}

async function render() {
  const docket = document.getElementById("docket");
  const actions = document.getElementById("actions");
  if (!listingId) {
    docket.textContent = "Open a listing from the Listings page.";
    return;
  }
  pageLoader(docket, "Reading on-chain listing…");
  const listing = await getListing(listingId);
  if (!listing) {
    docket.textContent = "No record yet. Wait for consensus, then reload.";
    return;
  }
  rememberListing(listingId);
  let evidence = [];
  let delivery = null;
  let verdict = null;
  try {
    evidence = await getEvidence(listingId);
  } catch {
    evidence = [];
  }
  if (listing.delivery_id) {
    try {
      delivery = await getDelivery(listing.delivery_id);
    } catch {
      delivery = null;
    }
  }
  if (listing.verdict_id) {
    try {
      verdict = await getVerdict(listing.verdict_id);
    } catch {
      verdict = null;
    }
  }

  docket.innerHTML = `
    <div class="toolbar">
      <span class="${statusClass(listing.status)}">${escapeHtml(listing.status)}</span>
      <span class="pill">threshold ${escapeHtml(listing.authenticity_threshold)}</span>
      <span class="pill">price ${escapeHtml(listing.price)} ${escapeHtml(listing.currency || "")}</span>
    </div>
    <p><strong>NFT</strong><br>${escapeHtml(listing.nft_title)}</p>
    <p><strong>Condition claims</strong><br>${escapeHtml(listing.condition_claims)}</p>
    <p class="mono">Seller ${escapeHtml(shortAddr(listing.seller_agent) || "—")} · Buyer ${escapeHtml(shortAddr(listing.buyer_agent) || "—")}</p>
    <p class="muted">Delivery deadline ${escapeHtml(listing.delivery_deadline)} · settlement ${escapeHtml(listing.settlement_status || "UNSETTLED")}</p>
    ${
      delivery
        ? `<details open><summary>Delivery proof</summary><pre>${escapeHtml(delivery.delivery_proof)}</pre><p class="muted">delivered ${escapeHtml(delivery.delivery_timestamp)} · late ${delivery.is_late}</p></details>`
        : ""
    }
    ${
      evidence.length
        ? `<details open><summary>Evidence (${evidence.length})</summary>${evidence
            .map((item) => `<p><b>${escapeHtml(item.evidence_type)}</b> — ${escapeHtml(item.content)}</p>`)
            .join("")}</details>`
        : ""
    }
    ${
      verdict
        ? `<div class="toolbar"><div class="score-ring"><span>${escapeHtml(verdict.final_score)}</span></div>
           <div><p><b>${escapeHtml(verdict.decision)}</b></p>
           <p class="muted">claim ${escapeHtml(verdict.claim_score)} · condition ${escapeHtml(verdict.condition_score)} · complete ${escapeHtml(verdict.completeness_score)} · evidence ${escapeHtml(verdict.evidence_score)} · timeliness ${escapeHtml(verdict.timeliness_score)}</p>
           <p>${escapeHtml(verdict.reasoning || "")}</p></div></div>`
        : ""
    }
  `;

  const account = await getAccount();
  const isSeller = sameAddress(account, listing.seller_agent);
  const isBuyer = sameAddress(account, listing.buyer_agent);
  const bits = [];

  if (listing.status === "LISTED" && isBuyer) {
    bits.push(`<button class="btn-primary" id="escrowBtn" type="button">Pay / lock escrow</button>`);
  }
  if (listing.status === "ESCROWED" && isSeller) {
    bits.push(`<button class="btn-primary" id="startBtn" type="button">Begin delivery</button>`);
  }
  if ((listing.status === "ESCROWED" || listing.status === "DELIVERY_IN_PROGRESS") && isSeller) {
    bits.push(`
      <form class="panel" id="deliveryForm">
        <label>Delivery proof<textarea name="delivery_proof" rows="6" required placeholder="Token id, contract address, tx hash, metadata link — whatever the validators should read"></textarea></label>
        <label>Delivery timestamp<input name="delivery_timestamp" required placeholder="2026-09-17T16:00:00Z"></label>
        <button class="btn-primary" type="submit">Submit delivery</button>
      </form>`);
  }
  if (["DELIVERED", "DISPUTED", "DELIVERY_IN_PROGRESS"].includes(listing.status) && (isSeller || isBuyer)) {
    bits.push(`
      <form class="panel" id="evForm">
        <label>Evidence type<input name="evidence_type" required placeholder="screenshot / appraisal / on-chain check"></label>
        <label>Content<textarea name="content" rows="3" required></textarea></label>
        <button class="btn-ghost" type="submit">Add evidence</button>
      </form>`);
  }
  if ((listing.status === "DELIVERED" || listing.status === "DISPUTED") && listing.delivery_id) {
    bits.push(`<button class="btn-navy" id="judgeBtn" type="button">Request GenLayer verdict</button>
      <p class="muted">This step is slow on purpose — validators score the delivery. Do not refresh until it finishes.</p>`);
  }
  if (["AS_DESCRIBED", "DEFECTIVE", "PARTIAL_MATCH"].includes(listing.status) && (isSeller || isBuyer)) {
    bits.push(`
      <form class="panel" id="disForm">
        <label>Dispute reason<textarea name="reason" rows="3" required></textarea></label>
        <button class="btn-ghost" type="submit">Raise dispute</button>
      </form>
      <button class="btn-primary" id="settleBtn" type="button">Settle payout split</button>`);
  }

  actions.innerHTML = bits.join("") || `<p class="muted">Connect the seller or buyer wallet to act on this listing.</p>`;

  document.getElementById("escrowBtn")?.addEventListener("click", async (e) => {
    await withSpinner(e.currentTarget, () => run("pay_escrow", [listingId], "Escrow paid"));
  });
  document.getElementById("startBtn")?.addEventListener("click", async (e) => {
    await withSpinner(e.currentTarget, () => run("begin_delivery", [listingId], "Delivery started"));
  });
  document.getElementById("judgeBtn")?.addEventListener("click", async (e) => {
    await withSpinner(e.currentTarget, () => run("request_verdict", [listingId], "Verdict requested"));
  });
  document.getElementById("settleBtn")?.addEventListener("click", async (e) => {
    await withSpinner(e.currentTarget, async () => {
      await run("settle_trade", [listingId], "Settled");
      burstCoins(docket);
    });
  });
  document.getElementById("deliveryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    await withSpinner(form.querySelector("button"), () =>
      run("submit_delivery", [listingId, formValue(form, "delivery_proof"), formValue(form, "delivery_timestamp")], "Delivery submitted")
    );
  });
  document.getElementById("evForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    await withSpinner(form.querySelector("button"), () =>
      run("submit_evidence", [listingId, formValue(form, "evidence_type"), formValue(form, "content")], "Evidence stored")
    );
  });
  document.getElementById("disForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    await withSpinner(form.querySelector("button"), () =>
      run("raise_dispute", [listingId, formValue(form, "reason")], "Dispute raised")
    );
  });
}

try {
  await render();
} catch (error) {
  toast(error.message || String(error), "err");
}
