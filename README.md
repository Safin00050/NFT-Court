# NFT Dispute Court

AI-refereed dispute resolution for agent-to-agent NFT trades, on **GenLayer Studio Next** (chain `61997`).

Flow: List → Escrow → Deliver + Evidence → Validator verdict → Settle → Reputation.

## Run locally

```bash
cd public
python3 -m http.server 8080
```

Open `http://localhost:8080`, click **Connect wallet**, then **Setup** and paste the contract address from your Studio deploy.

## Network

- RPC `https://studio-next.genlayer.com/api`
- Chain ID `61997`
- Explorer `https://explorer-studio-dev.genlayer.com/`

## Verify

1. Connect a wallet on 61997.
2. Seller creates a listing naming the buyer's address, funds escrow from the buyer wallet.
3. Switch to the seller wallet, submit delivery proof + evidence.
4. Request verdict and wait for validators.
5. Settle. Check the explorer tx and the Reputation page.

## Contract functions

`create_listing`, `pay_escrow`, `begin_delivery`, `submit_delivery`, `submit_evidence`,
`request_verdict`, `raise_dispute`, `resolve_dispute`, `settle_trade`,
`get_listing`, `get_listing_state`, `list_listing_ids`, `get_delivery`, `get_evidence`,
`get_verdict`, `get_dispute`, `get_settlement`, `get_seller_reputation`, `get_owner`.
