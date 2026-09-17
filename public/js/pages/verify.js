import { NETWORK, getContractAddress, explorerAddress } from "../config.js";
import { pageShell, pageFooter, wireChrome } from "../ui.js";

const contract = getContractAddress();

document.getElementById("app").innerHTML = `
${pageShell("verify")}
<main class="page">
  <h1>How to verify</h1>
  <p class="muted">For reviewers: this app calls a real Intelligent Contract on Studio Next. Simulated UI scores are not used in live mode.</p>
  <div class="panel">
    <ol>
      <li>Header Connect wallet → MetaMask on chain <b>61997</b>.</li>
      <li>Setup has the deployed address. Explorer: ${
        contract
          ? `<a href="${explorerAddress(contract)}" target="_blank" rel="noopener">${contract}</a>`
          : "(paste it on Setup first)"
      }</li>
      <li>Seller opens New listing, buyer address is a second wallet, authenticity threshold 80.</li>
      <li>Buyer pays escrow. Seller submits delivery proof + evidence.</li>
      <li>Either party clicks Request GenLayer verdict and waits. Do not refresh mid-vote.</li>
      <li>Scores and decision appear from <code>request_verdict</code>, then Settle writes seller reputation.</li>
      <li>Compare the explorer tx on ${NETWORK.explorer} with the docket pills.</li>
    </ol>
    <p>Decentralized judgment matters here because neither the buyer nor the seller should referee their own trade. Validators read the condition claims, the delivery proof, and the evidence together.</p>
  </div>
</main>
${pageFooter()}
`;
await wireChrome();
