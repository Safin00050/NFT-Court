export const NETWORK = {
  name: "GenLayer Studio Next",
  connectName: "studioDevnet",
  chainId: 61997,
  chainIdHex: "0xf22d",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpc: "https://studio-next.genlayer.com/api",
  explorer: "https://explorer-studio-dev.genlayer.com",
  studioUrl: "https://studio-next.genlayer.com",
};

export const SDK = { genlayerJs: "2.0.0-rc.1" };

const STORAGE_KEY = "nftcourt.contractAddress";
const ZERO = "0x0000000000000000000000000000000000000000";

export function getContractAddress() {
  const stored = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (stored && stored !== ZERO) return stored;
  const baked = (window.NFTCOURT_CONTRACT_ADDRESS || "").trim();
  if (baked && baked !== ZERO) return baked;
  return "";
}

export function setContractAddress(address) {
  const value = (address || "").trim();
  if (!value) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, value);
}

export function explorerTx(hash) {
  if (!hash) return NETWORK.explorer;
  return `${NETWORK.explorer}/tx/${hash}`;
}

export function explorerAddress(address) {
  if (!address) return NETWORK.explorer;
  return `${NETWORK.explorer}/address/${address}`;
}
