import { NETWORK, getContractAddress, explorerAddress } from "./config.js";
import { connectWallet, disconnectWallet, getAccount, shortAddr, switchAccount, onAccountsChanged, detectWalletBrand } from "./wallet.js";

// Original, generic wallet glyph (not any brand's actual logo) -- tinted
// per-provider via currentColor so it visually reflects which wallet is
// connected without reproducing trademarked artwork.
const WALLET_ICON_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="6" width="19" height="13" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 9.6h19" stroke="currentColor" stroke-width="1.6"/><circle cx="17.1" cy="13.3" r="1.3" fill="currentColor"/></svg>`;

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toast(message, kind = "info") {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const el = document.createElement("div");
  el.className = `toast ${kind === "err" ? "err" : kind === "ok" ? "ok" : ""}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function pageLoader(node, msg = "Loading…") {
  node.innerHTML = `<div class="loading"><span class="spinner"></span>${escapeHtml(msg)}</div>`;
}

export function statusClass(status) {
  const v = String(status || "").toUpperCase();
  if (["AS_DESCRIBED", "SETTLED", "ESCROWED"].includes(v)) return "pill ok";
  if (["DEFECTIVE", "REFUNDED"].includes(v)) return "pill bad";
  if (["PARTIAL_MATCH", "DISPUTED", "DELIVERED", "DELIVERY_IN_PROGRESS"].includes(v)) return "pill warn";
  return "pill navy";
}

export function formValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

export async function withSpinner(button, task) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Working`;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

export function pageShell(active) {
  return `
  <svg class="wave-top" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0,32 C240,80 480,0 720,32 C960,64 1200,16 1440,40 L1440,0 L0,0 Z"></path></svg>
  <header class="nav">
    <a class="brand" href="/index.html"><img src="/assets/logo.png" alt="NFT Dispute Court logo"><span class="brand-name">NFT Dispute Court</span></a>
    <nav class="nav-links">
      <a class="${active === "home" ? "active" : ""}" href="/index.html">Home</a>
      <a class="${active === "market" ? "active" : ""}" href="/pages/listings.html">Listings</a>
      <a class="${active === "new" ? "active" : ""}" href="/pages/new-listing.html">New listing</a>
      <a class="${active === "rep" ? "active" : ""}" href="/pages/reputation.html">Reputation</a>
      <a class="${active === "verify" ? "active" : ""}" href="/pages/verify.html">Verify</a>
      <a class="${active === "setup" ? "active" : ""}" href="/pages/setup.html">Setup</a>
    </nav>
    <div class="wallet-box">
      <button class="btn-primary" id="connectBtn" type="button">
        <span class="wallet-icon" id="walletIcon">${WALLET_ICON_SVG}</span>
        <span class="btn-label" id="connectLabel">Connect wallet</span>
      </button>
      <button class="btn-ghost" id="switchBtn" type="button" hidden>Switch</button>
      <button class="btn-ghost" id="disconnectBtn" type="button" hidden>Disconnect</button>
    </div>
  </header>`;
}

export function pageFooter() {
  const contract = getContractAddress();
  return `
  <footer class="site-foot">
    <p>NFT Dispute Court · Studio Next · chain ${NETWORK.chainId}</p>
    <p class="mono">${contract ? `<a href="${explorerAddress(contract)}" target="_blank" rel="noopener">${contract.slice(0, 10)}…</a>` : "No contract set — open Setup"}</p>
    <p>Verdicts come from GenLayer validators, not the UI.</p>
  </footer>
  <svg class="wave-bottom" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0,20 C180,70 420,0 720,28 C1020,56 1260,8 1440,36 L1440,80 L0,80 Z"></path></svg>`;
}

export async function wireChrome() {
  const connectBtn = document.getElementById("connectBtn");
  const switchBtn = document.getElementById("switchBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  async function refresh() {
    const account = await getAccount();
    const label = document.getElementById("connectLabel");
    const icon = document.getElementById("walletIcon");
    const brand = detectWalletBrand();
    if (icon) icon.style.color = brand.color;
    if (account) {
      if (label) label.textContent = shortAddr(account);
      connectBtn.title = `Connected via ${brand.name}`;
      connectBtn.className = "btn-ghost";
      switchBtn.hidden = false;
      disconnectBtn.hidden = false;
    } else {
      if (label) label.textContent = "Connect wallet";
      connectBtn.removeAttribute("title");
      connectBtn.className = "btn-primary";
      switchBtn.hidden = true;
      disconnectBtn.hidden = true;
    }
  }

  connectBtn?.addEventListener("click", async () => {
    try {
      await connectWallet();
      toast("Wallet connected on Studio Next", "ok");
      await refresh();
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
  switchBtn?.addEventListener("click", async () => {
    try {
      await switchAccount();
      toast("Account switched", "ok");
      await refresh();
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
  disconnectBtn?.addEventListener("click", async () => {
    disconnectWallet();
    toast("Disconnected");
    await refresh();
  });
  onAccountsChanged(() => refresh());
  window.addEventListener("nftcourt:wallet", () => refresh());
  await refresh();
}

export function rememberListing(id) {
  const ids = loadListingIds();
  if (id && !ids.includes(id)) ids.unshift(id);
  localStorage.setItem("nftcourt.listingIds", JSON.stringify(ids.slice(0, 40)));
}

export function loadListingIds() {
  try {
    return JSON.parse(localStorage.getItem("nftcourt.listingIds") || "[]");
  } catch {
    return [];
  }
}

// Fallback for the id being lost from the URL on navigation (hosting/CDN can
// strip query strings on redirect) — set right before navigating to a listing,
// read back on the listing page if location.search has nothing.
export function rememberLastOpenedId(id) {
  try {
    sessionStorage.setItem("nftcourt.lastId", id);
  } catch {
    /* ignore */
  }
}

export function readLastOpenedId() {
  try {
    return sessionStorage.getItem("nftcourt.lastId") || "";
  } catch {
    return "";
  }
}

export function burstCoins(root) {
  if (!root) return;
  root.classList.add("coins");
  root.style.minHeight = "80px";
  for (let i = 0; i < 12; i++) {
    const c = document.createElement("span");
    c.className = "coin";
    c.style.left = `${8 + i * 7}%`;
    c.style.animationDelay = `${i * 0.08}s`;
    root.appendChild(c);
    setTimeout(() => c.remove(), 2400);
  }
}
