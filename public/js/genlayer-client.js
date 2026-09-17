import { NETWORK, SDK, getContractAddress } from "./config.js";

let sdk = null;
let chains = null;

export async function loadSdk() {
  if (sdk) return sdk;
  const version = SDK.genlayerJs;
  const mod = await import(`https://esm.sh/genlayer-js@${version}?bundle`);
  let chainMod = {};
  try {
    chainMod = await import(`https://esm.sh/genlayer-js@${version}/chains?bundle`);
  } catch {
    chainMod = mod;
  }
  sdk = { ...mod, chains: chainMod };
  chains = chainMod;
  return sdk;
}

export function getStudioChain() {
  const fromSdk = chains?.studioDevnet || chains?.studioNext || null;
  const base = fromSdk && Number(fromSdk.id) === NETWORK.chainId ? fromSdk : null;
  return {
    ...(base || {}),
    id: NETWORK.chainId,
    name: NETWORK.name,
    rpcUrls: { default: { http: [NETWORK.rpc] } },
    nativeCurrency: NETWORK.currency,
    blockExplorers: { default: { name: "Studio Next Explorer", url: NETWORK.explorer } },
  };
}

export async function createReadClient() {
  const { createClient, createAccount } = await loadSdk();
  const chain = getStudioChain();
  const account = typeof createAccount === "function" ? createAccount() : null;
  return createClient({
    chain,
    endpoint: NETWORK.rpc,
    account: account?.address ? account : undefined,
  });
}

export async function createWriteClient(address) {
  const { createClient } = await loadSdk();
  if (!window.ethereum) throw new Error("Connect a wallet first.");
  return createClient({
    chain: getStudioChain(),
    endpoint: NETWORK.rpc,
    account: address,
    provider: window.ethereum,
  });
}

export async function connectClient(client) {
  if (typeof client.connect !== "function") return;
  for (const name of [NETWORK.connectName, "studio-next", "studio-dev", "studioDevnet"]) {
    try {
      await client.connect(name);
      return;
    } catch {
      /* next */
    }
  }
}

async function attachFees(client, write) {
  for (const fn of ["estimateTransactionFeesForWrite", "estimateTransactionFees"]) {
    if (typeof client[fn] !== "function") continue;
    try {
      const estimate = await client[fn](write);
      if (estimate?.distribution && estimate?.feeValue != null) {
        return { ...write, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } };
      }
    } catch (error) {
      console.warn("Fee estimate skipped:", error?.message || error);
    }
  }
  return write;
}

async function waitForTx(client, hash) {
  if (!hash) return null;
  for (const fn of ["waitForDecision", "waitForTransactionReceipt", "waitForFinalization"]) {
    if (typeof client[fn] !== "function") continue;
    try {
      return await client[fn]({ hash });
    } catch (error) {
      console.warn(`${fn}:`, error?.message || error);
    }
  }
  return { hash };
}

export function requireContract() {
  const address = getContractAddress();
  if (!address) throw new Error("Paste your Studio Next contract address on Setup first.");
  return address;
}

export async function readContract(functionName, args = []) {
  const client = await createReadClient();
  return client.readContract({ address: requireContract(), functionName, args });
}

export async function writeContract(functionName, args, account, value) {
  const client = await createWriteClient(account);
  await connectClient(client);
  const write = { address: requireContract(), functionName, args };
  if (value != null) write.value = BigInt(value);
  const hash = await client.writeContract(await attachFees(client, write));
  const receipt = await waitForTx(client, hash);
  return { hash, receipt };
}

function asObject(result) {
  if (result == null || result === "") return null;
  if (typeof result === "object") return result;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

export async function listListingIds() {
  const result = await readContract("list_listing_ids", []);
  const parsed = asObject(result);
  if (Array.isArray(parsed)) return parsed.map(String);
  if (Array.isArray(result)) return result.map(String);
  return [];
}

export async function getListing(id) {
  const result = await readContract("get_listing", [id]);
  return asObject(result);
}

export async function getDelivery(id) {
  const result = await readContract("get_delivery", [id]);
  return asObject(result);
}

export async function getEvidence(id) {
  const result = await readContract("get_evidence", [id]);
  const parsed = asObject(result);
  return Array.isArray(parsed) ? parsed : [];
}

export async function getVerdict(id) {
  const result = await readContract("get_verdict", [id]);
  return asObject(result);
}

export async function getReputation() {
  const result = await readContract("get_seller_reputation", []);
  const parsed = asObject(result);
  return Array.isArray(parsed) ? parsed : [];
}
