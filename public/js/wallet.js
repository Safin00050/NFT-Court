import { NETWORK } from "./config.js";

const ACCOUNT_KEY = "nftcourt.account";
const DISCONNECTED_KEY = "nftcourt.disconnected";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

// Any wallet app's own in-app browser injects window.ethereum the same way
// a desktop extension does (EIP-1193) — MetaMask, Trust, Coinbase Wallet,
// Rainbow, etc. all do this. So if window.ethereum exists, we already
// support "any wallet" with zero extra code; the gap is only what happens
// on mobile when NO wallet app's browser is currently hosting the page.
function isInsideKnownWalletBrowser() {
  const eth = window.ethereum;
  if (!eth) return false;
  return Boolean(eth.isMetaMask || eth.isTrust || eth.isCoinbaseWallet || eth.isRainbow || eth.isRabby);
}

// Deep links that open each wallet app with this exact page loaded inside
// its own in-app browser. The user does not need to type the URL manually —
// tapping one of these does it for them, if that app is installed.
function walletDeepLinks() {
  const fullUrl = location.href;
  const hostPath = `${location.host}${location.pathname}${location.search}`;
  return [
    { id: "metamask", name: "MetaMask", url: `https://metamask.app.link/dapp/${hostPath}` },
    { id: "trust", name: "Trust Wallet", url: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(fullUrl)}` },
    { id: "coinbase", name: "Coinbase Wallet", url: `https://go.cb-wallet.com/dapp?cb_url=${encodeURIComponent(fullUrl)}` },
    { id: "rainbow", name: "Rainbow", url: `https://rnbwapp.com/dapp?url=${encodeURIComponent(fullUrl)}` },
  ];
}

// Lightweight, dependency-free chooser — no CSS file changes needed.
// Lets the user pick whichever wallet app they actually have installed,
// instead of us guessing and hardcoding one.
function showWalletChooser() {
  return new Promise((resolve, reject) => {
    if (document.getElementById("nftcourt-wallet-chooser")) return;

    const overlay = document.createElement("div");
    overlay.id = "nftcourt-wallet-chooser";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;" +
      "display:flex;align-items:center;justify-content:center;padding:20px;";

    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;border-radius:12px;padding:20px;max-width:340px;width:100%;" +
      "font-family:inherit;color:#111;";
    panel.innerHTML = `<p style="margin:0 0 14px;font-weight:600;">Open this page in your wallet app</p>
      <p style="margin:0 0 14px;font-size:13px;color:#555;">A phone browser can't connect to a wallet directly. Pick the app you have installed — it'll reopen this page inside that app's browser.</p>`;

    walletDeepLinks().forEach(({ name, url }) => {
      const btn = document.createElement("button");
      btn.textContent = name;
      btn.style.cssText =
        "display:block;width:100%;margin-bottom:8px;padding:10px;border-radius:8px;" +
        "border:1px solid #ddd;background:#f7f7f7;font-size:14px;cursor:pointer;";
      btn.addEventListener("click", () => {
        location.href = url;
      });
      panel.appendChild(btn);
    });

    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText =
      "display:block;width:100%;margin-top:6px;padding:10px;border-radius:8px;" +
      "border:none;background:transparent;color:#888;font-size:13px;cursor:pointer;";
    cancel.addEventListener("click", () => {
      overlay.remove();
      reject(new Error("Wallet connect cancelled."));
    });
    panel.appendChild(cancel);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export function sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export function getSavedAccount() {
  return localStorage.getItem(ACCOUNT_KEY) || "";
}

function saveAccount(address) {
  if (address) localStorage.setItem(ACCOUNT_KEY, address);
  else localStorage.removeItem(ACCOUNT_KEY);
}

function sameChain(chainId) {
  if (chainId == null) return false;
  return Number.parseInt(String(chainId), 16) === NETWORK.chainId || Number(chainId) === NETWORK.chainId;
}

export async function ensureStudioNetwork() {
  if (!window.ethereum) throw new Error("No injected wallet found.");
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (sameChain(current)) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: NETWORK.chainIdHex }],
    });
    return;
  } catch (error) {
    const code = error?.code ?? error?.data?.originalError?.code;
    if (code !== 4902 && code !== -32603) throw error;
  }
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: NETWORK.chainIdHex,
        chainName: NETWORK.name,
        nativeCurrency: NETWORK.currency,
        rpcUrls: [NETWORK.rpc],
        blockExplorerUrls: [NETWORK.explorer],
      },
    ],
  });
}

export function disconnectWallet() {
  saveAccount("");
  localStorage.setItem(DISCONNECTED_KEY, "1");
  window.dispatchEvent(new CustomEvent("nftcourt:wallet"));
}

export async function connectWallet() {
  if (!window.ethereum) {
    if (isMobile()) {
      // No wallet app is hosting this page right now — let the user pick
      // which one to open it in, instead of assuming MetaMask.
      await showWalletChooser();
      // showWalletChooser navigates away on selection; if we're still here,
      // the user cancelled.
      throw new Error("Pick a wallet app to continue, or open this page inside your wallet app's browser directly.");
    }
    throw new Error("Install MetaMask, Trust Wallet, Coinbase Wallet, or another browser wallet extension to connect.");
  }
  localStorage.removeItem(DISCONNECTED_KEY);
  await ensureStudioNetwork();
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const address = accounts?.[0];
  if (!address) throw new Error("Wallet returned no account.");
  saveAccount(address);
  window.dispatchEvent(new CustomEvent("nftcourt:wallet"));
  return address;
}

export async function getAccount() {
  if (localStorage.getItem(DISCONNECTED_KEY) === "1") return "";
  if (!window.ethereum) return getSavedAccount();
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts?.[0]) {
      saveAccount(accounts[0]);
      return accounts[0];
    }
  } catch {
    /* ignore */
  }
  return getSavedAccount();
}

export async function switchAccount() {
  if (!window.ethereum) throw new Error("No wallet found.");
  await window.ethereum.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }],
  });
  return connectWallet();
}

export function onAccountsChanged(fn) {
  if (!window.ethereum?.on) return;
  window.ethereum.on("accountsChanged", fn);
  window.ethereum.on("chainChanged", () => location.reload());
}
