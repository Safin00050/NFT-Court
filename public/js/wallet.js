import { NETWORK } from "./config.js";

const ACCOUNT_KEY = "nftcourt.account";
const DISCONNECTED_KEY = "nftcourt.disconnected";

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
  if (!window.ethereum) throw new Error("Install MetaMask or Rabby to connect.");
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
