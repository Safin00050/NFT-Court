import { pageShell, pageFooter, wireChrome } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell("home")}
<main class="page">
  <section class="hero">
    <div>
      <div class="kicker">Studio Next · chain 61997</div>
      <h1>The AI-refereed court for NFT trades.</h1>
      <p>A seller lists an NFT with condition claims for a named buyer. Payment locks. Delivery proof and evidence go on-chain. GenLayer validators decide whether the NFT matched what was claimed. Payment releases, refunds, or splits — then seller reputation updates.</p>
      <div class="toolbar">
        <a class="btn-primary" href="/pages/new-listing.html">List an NFT</a>
        <a class="btn-ghost" href="/pages/listings.html">See listings</a>
        <a class="btn-navy" href="/pages/verify.html">How to verify</a>
      </div>
    </div>
    <div class="hero-mark"><img src="/assets/logo.png" alt="NFT Dispute Court logo"></div>
  </section>
  <div class="flow">
    <span><b>01</b>List</span>
    <span><b>02</b>Escrow</span>
    <span><b>03</b>Deliver + evidence</span>
    <span><b>04</b>Verdict</span>
    <span><b>05</b>Settle + rep</span>
  </div>
  <div class="grid" style="margin-top:28px">
    <article class="card"><h3>Not a marketplace UI</h3><p class="muted">This is the court that sits between a specific buyer and seller pair.</p></article>
    <article class="card"><h3>Why validators</h3><p class="muted">Neither buyer nor seller should decide if the item matched the listing. Consensus reads the claims, the delivery proof, and the evidence.</p></article>
    <article class="card"><h3>Partial settlement</h3><p class="muted">A 65/100 against an 80 authenticity threshold is not a full refund or a full payout. The split follows the score.</p></article>
    <article class="card"><h3>Connect wallet first</h3><p class="muted">Every write is signed on Studio Next. Use the orange button in the header.</p></article>
  </div>
</main>
${pageFooter()}
`;
await wireChrome();
