import { getContractAddress, setContractAddress, explorerAddress, NETWORK } from "../config.js";
import { pageShell, pageFooter, wireChrome, toast } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell("setup")}
<main class="page">
  <h1>Setup</h1>
  <p class="muted">Paste the NFTDisputeCourt contract address from your successful Studio Next deploy. Chain must stay ${NETWORK.chainId}.</p>
  <form class="panel" id="setupForm">
    <label>Intelligent contract address
      <input name="address" required placeholder="0x…" value="${getContractAddress()}">
    </label>
    <div class="toolbar">
      <button class="btn-primary" type="submit">Save address</button>
      <a class="btn-ghost" href="${NETWORK.studioUrl}" target="_blank" rel="noopener">Open Studio Next</a>
    </div>
    <p class="muted" id="preview"></p>
  </form>
</main>
${pageFooter()}
`;
await wireChrome();

const preview = document.getElementById("preview");
const current = getContractAddress();
preview.innerHTML = current
  ? `Saved. Explorer: <a href="${explorerAddress(current)}" target="_blank" rel="noopener">${current}</a>`
  : "Nothing saved yet.";

document.getElementById("setupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const address = String(new FormData(event.target).get("address") || "").trim();
  if (!address.startsWith("0x") || address.length < 16) {
    toast("That does not look like a contract address", "err");
    return;
  }
  setContractAddress(address);
  toast("Contract saved", "ok");
  preview.innerHTML = `Saved. Explorer: <a href="${explorerAddress(address)}" target="_blank" rel="noopener">${address}</a>`;
});
