# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.types import *
import json

STATUS_LISTED = "LISTED"
STATUS_ESCROWED = "ESCROWED"
STATUS_DELIVERY_IN_PROGRESS = "DELIVERY_IN_PROGRESS"
STATUS_DELIVERED = "DELIVERED"
STATUS_AS_DESCRIBED = "AS_DESCRIBED"
STATUS_DEFECTIVE = "DEFECTIVE"
STATUS_PARTIAL_MATCH = "PARTIAL_MATCH"
STATUS_DISPUTED = "DISPUTED"
STATUS_SETTLED = "SETTLED"
STATUS_REFUNDED = "REFUNDED"

VERDICT_PRINCIPLE = (
    "Two verdict results are equivalent when claim_score, condition_score, "
    "completeness_score, evidence_score and timeliness_score each differ by at most "
    "five points on a 0-100 scale and the decision about whether the NFT matched its "
    "listing claims is the same. Wording differences must not cause disagreement."
)


class NFTDisputeCourt(gl.contract.Contract):
    listings_json: str
    deliveries_json: str
    evidence_json: str
    verdicts_json: str
    disputes_json: str
    settlements_json: str
    reputation_json: str
    listing_counter: str
    evidence_counter: str
    dispute_counter: str
    clock: str
    owner: str

    def __init__(self):
        self.listings_json = "{}"
        self.deliveries_json = "{}"
        self.evidence_json = "{}"
        self.verdicts_json = "{}"
        self.disputes_json = "{}"
        self.settlements_json = "{}"
        self.reputation_json = "[]"
        self.listing_counter = "0"
        self.evidence_counter = "0"
        self.dispute_counter = "0"
        self.clock = "0"
        self.owner = str(gl.message.sender_address)

    def _sender(self):
        return str(gl.message.sender_address)

    def _now(self):
        n = int(self.clock or "0") + 1
        self.clock = str(n)
        return "t-" + str(n)

    def _loads(self, raw):
        if raw is None or raw == "":
            return {}
        try:
            data = json.loads(str(raw))
        except Exception:
            try:
                data = json.loads(str(raw), strict=False)
            except Exception:
                return {}
        if data is None:
            return {}
        return data

    def _dump(self, data):
        return json.dumps(data, ensure_ascii=True)

    def _listings(self):
        return self._loads(self.listings_json)

    def _put_listing(self, listing_id, record):
        data = self._listings()
        data[listing_id] = record
        self.listings_json = self._dump(data)

    def _need(self, listing_id):
        data = self._listings()
        assert listing_id in data, "listing_not_found"
        return data[listing_id]

    def _bump(self, field):
        n = int(getattr(self, field) or "0") + 1
        setattr(self, field, str(n))
        return n

    def _clamp(self, value):
        n = int(value)
        if n < 0:
            return 0
        if n > 100:
            return 100
        return n

    @gl.public.write
    def create_listing(
        self,
        buyer_agent: str,
        nft_title: str,
        condition_claims: str,
        price: int,
        currency: str,
        delivery_deadline: str,
        authenticity_threshold: int,
    ) -> str:
        assert len(nft_title.strip()) > 0, "nft_title_required"
        assert len(condition_claims.strip()) > 0, "condition_claims_required"
        assert price > 0, "invalid_price"
        assert authenticity_threshold > 0 and authenticity_threshold <= 100, "invalid_authenticity_threshold"
        assert len(delivery_deadline.strip()) > 0, "invalid_delivery_deadline"
        seller = self._sender()
        assert str(buyer_agent).strip() != seller, "buyer_cannot_equal_seller"
        n = self._bump("listing_counter")
        listing_id = "listing-" + str(n)
        record = {
            "listing_id": listing_id,
            "seller_agent": seller,
            "buyer_agent": str(buyer_agent).strip(),
            "nft_title": nft_title,
            "condition_claims": condition_claims,
            "price": int(price),
            "currency": currency or "GEN",
            "delivery_deadline": delivery_deadline,
            "authenticity_threshold": int(authenticity_threshold),
            "status": STATUS_LISTED,
            "created_at": self._now(),
            "delivery_id": "",
            "verdict_id": "",
            "settlement_status": "UNSETTLED",
        }
        self._put_listing(listing_id, record)
        return listing_id

    @gl.public.write
    def pay_escrow(self, listing_id: str) -> None:
        listing = self._need(listing_id)
        assert self._sender() == listing["buyer_agent"], "unauthorized_buyer"
        assert listing["status"] == STATUS_LISTED, "invalid_state_for_escrow"
        listing["status"] = STATUS_ESCROWED
        self._put_listing(listing_id, listing)

    @gl.public.write
    def begin_delivery(self, listing_id: str) -> None:
        listing = self._need(listing_id)
        assert self._sender() == listing["seller_agent"], "unauthorized_seller"
        assert listing["status"] == STATUS_ESCROWED, "invalid_state_for_delivery_start"
        listing["status"] = STATUS_DELIVERY_IN_PROGRESS
        self._put_listing(listing_id, listing)

    @gl.public.write
    def submit_delivery(self, listing_id: str, delivery_proof: str, delivery_timestamp: str) -> str:
        listing = self._need(listing_id)
        assert self._sender() == listing["seller_agent"], "unauthorized_seller"
        assert listing["status"] == STATUS_ESCROWED or listing["status"] == STATUS_DELIVERY_IN_PROGRESS, "invalid_state_for_delivery"
        assert listing.get("delivery_id", "") == "", "delivery_already_exists"
        assert len(delivery_proof.strip()) > 0, "empty_delivery_proof"
        delivery_id = "del-" + listing_id
        is_late = delivery_timestamp > listing["delivery_deadline"]
        deliveries = self._loads(self.deliveries_json)
        deliveries[delivery_id] = {
            "delivery_id": delivery_id,
            "listing_id": listing_id,
            "seller_agent": listing["seller_agent"],
            "delivery_proof": delivery_proof,
            "delivery_timestamp": delivery_timestamp,
            "submitted_at": self._now(),
            "is_late": is_late,
        }
        self.deliveries_json = self._dump(deliveries)
        listing["delivery_id"] = delivery_id
        listing["status"] = STATUS_DELIVERED
        self._put_listing(listing_id, listing)
        return delivery_id

    @gl.public.write
    def submit_evidence(self, listing_id: str, evidence_type: str, content: str) -> str:
        listing = self._need(listing_id)
        sender = self._sender()
        assert sender == listing["seller_agent"] or sender == listing["buyer_agent"], "unauthorized_participant"
        assert listing["status"] in (STATUS_DELIVERED, STATUS_DISPUTED, STATUS_DELIVERY_IN_PROGRESS), "invalid_state_for_evidence"
        assert len(content.strip()) > 0, "empty_evidence_content"
        n = self._bump("evidence_counter")
        evidence_id = "ev-" + str(n)
        ev = self._loads(self.evidence_json)
        rows = ev.get(listing_id, [])
        if not isinstance(rows, list):
            rows = []
        rows.append({
            "evidence_id": evidence_id,
            "listing_id": listing_id,
            "delivery_id": listing.get("delivery_id", ""),
            "evidence_type": evidence_type,
            "content": content,
            "timestamp": self._now(),
        })
        ev[listing_id] = rows
        self.evidence_json = self._dump(ev)
        return evidence_id

    @gl.public.write
    def request_verdict(self, listing_id: str) -> str:
        listing = self._need(listing_id)
        sender = self._sender()
        assert sender == listing["seller_agent"] or sender == listing["buyer_agent"], "unauthorized_participant"
        assert listing["status"] == STATUS_DELIVERED or listing["status"] == STATUS_DISPUTED, "invalid_state_for_verdict"
        assert listing.get("delivery_id", "") != "", "no_delivery_to_judge"
        deliveries = self._loads(self.deliveries_json)
        delivery = deliveries[listing["delivery_id"]]
        ev = self._loads(self.evidence_json)
        rows = ev.get(listing_id, [])
        lines = []
        if isinstance(rows, list):
            for item in rows:
                lines.append(str(item.get("evidence_type", "")) + ": " + str(item.get("content", "")))
        evidence_text = "\n".join(lines) if len(lines) > 0 else "No supplementary evidence was submitted."
        claims_text = listing["condition_claims"]
        proof_text = delivery["delivery_proof"]
        deadline_text = listing["delivery_deadline"]
        completion_text = delivery["delivery_timestamp"]
        late_text = "yes" if delivery.get("is_late") else "no"

        def evaluate():
            prompt = (
                "You referee an NFT trade dispute between a buyer and seller agent. "
                "Return only JSON: "
                '{"claim_score":0,"condition_score":0,"completeness_score":0,'
                '"evidence_score":0,"timeliness_score":0,"reasoning":"text"}. '
                "Each score is an integer 0-100, reflecting how well the delivered NFT "
                "matches the listing's condition claims. "
                "LISTING CONDITION CLAIMS:\n" + claims_text + "\n\n"
                "DELIVERY PROOF (seller-submitted):\n" + proof_text + "\n\n"
                "EVIDENCE:\n" + evidence_text + "\n\n"
                "DELIVERY DEADLINE: " + deadline_text + "\n"
                "DELIVERED AT: " + completion_text + "\n"
                "LATE: " + late_text
            )
            raw = str(gl.nondet.exec_prompt(prompt)).replace("```json", "").replace("```", "").strip()
            try:
                response = json.loads(raw)
            except Exception:
                response = {}
            return {
                "claim_score": int(response.get("claim_score", 0)),
                "condition_score": int(response.get("condition_score", 0)),
                "completeness_score": int(response.get("completeness_score", 0)),
                "evidence_score": int(response.get("evidence_score", 0)),
                "timeliness_score": int(response.get("timeliness_score", 0)),
                "reasoning": str(response.get("reasoning", ""))[:400],
            }

        parsed = gl.eq_principle.prompt_comparative(evaluate, VERDICT_PRINCIPLE)
        claim = self._clamp(parsed.get("claim_score", 0))
        cond = self._clamp(parsed.get("condition_score", 0))
        comp = self._clamp(parsed.get("completeness_score", 0))
        evid = self._clamp(parsed.get("evidence_score", 0))
        time_s = self._clamp(parsed.get("timeliness_score", 0))
        weighted = claim * 30 + cond * 25 + comp * 20 + evid * 15 + time_s * 10
        final_score = self._clamp(weighted // 100)
        threshold = int(listing["authenticity_threshold"])
        if final_score >= threshold:
            decision = STATUS_AS_DESCRIBED
        elif final_score >= threshold // 2:
            decision = STATUS_PARTIAL_MATCH
        else:
            decision = STATUS_DEFECTIVE
        verdict_id = "vd-" + listing_id
        verdicts = self._loads(self.verdicts_json)
        verdicts[verdict_id] = {
            "verdict_id": verdict_id,
            "listing_id": listing_id,
            "delivery_id": listing["delivery_id"],
            "claim_score": claim,
            "condition_score": cond,
            "completeness_score": comp,
            "evidence_score": evid,
            "timeliness_score": time_s,
            "final_score": final_score,
            "decision": decision,
            "reasoning": str(parsed.get("reasoning", ""))[:400],
            "decided_at": self._now(),
        }
        self.verdicts_json = self._dump(verdicts)
        listing["verdict_id"] = verdict_id
        listing["status"] = decision
        self._put_listing(listing_id, listing)
        return verdict_id

    @gl.public.write
    def raise_dispute(self, listing_id: str, reason: str) -> str:
        listing = self._need(listing_id)
        sender = self._sender()
        assert sender == listing["seller_agent"] or sender == listing["buyer_agent"], "unauthorized_participant"
        assert listing["status"] in (STATUS_AS_DESCRIBED, STATUS_DEFECTIVE, STATUS_PARTIAL_MATCH), "invalid_state_for_dispute"
        assert len(reason.strip()) > 0, "empty_dispute_reason"
        n = self._bump("dispute_counter")
        dispute_id = "dis-" + str(n)
        d = self._loads(self.disputes_json)
        d[dispute_id] = {
            "dispute_id": dispute_id,
            "listing_id": listing_id,
            "raised_by": sender,
            "reason": reason,
            "status": "OPEN",
            "prior_status": listing["status"],
            "raised_at": self._now(),
            "resolution": "",
        }
        self.disputes_json = self._dump(d)
        listing["status"] = STATUS_DISPUTED
        self._put_listing(listing_id, listing)
        return dispute_id

    @gl.public.write
    def resolve_dispute(self, dispute_id: str, resolution: str, request_reevaluation: bool) -> None:
        d = self._loads(self.disputes_json)
        assert dispute_id in d, "dispute_not_found"
        dispute = d[dispute_id]
        assert dispute["status"] == "OPEN", "dispute_not_open"
        listing = self._need(dispute["listing_id"])
        sender = self._sender()
        assert sender == listing["seller_agent"] or sender == listing["buyer_agent"], "unauthorized_participant"
        dispute["status"] = "RESOLVED"
        dispute["resolution"] = resolution
        d[dispute_id] = dispute
        self.disputes_json = self._dump(d)
        if request_reevaluation:
            listing["status"] = STATUS_DELIVERED
        else:
            listing["status"] = dispute["prior_status"]
        self._put_listing(listing["listing_id"], listing)

    @gl.public.write
    def settle_trade(self, listing_id: str) -> str:
        listing = self._need(listing_id)
        assert listing["status"] in (STATUS_AS_DESCRIBED, STATUS_DEFECTIVE, STATUS_PARTIAL_MATCH), "invalid_state_for_settlement"
        assert listing.get("settlement_status") != "SETTLED", "already_settled"
        assert listing.get("verdict_id", "") != "", "missing_verdict"
        verdicts = self._loads(self.verdicts_json)
        verdict = verdicts[listing["verdict_id"]]
        if listing["status"] == STATUS_AS_DESCRIBED:
            seller_pct = 100
        elif listing["status"] == STATUS_DEFECTIVE:
            seller_pct = 0
        else:
            seller_pct = self._clamp(verdict.get("final_score", 0))
        price = int(listing["price"])
        seller_payout = (price * seller_pct) // 100
        buyer_refund = price - seller_payout
        settlement_id = "set-" + listing_id
        sets = self._loads(self.settlements_json)
        sets[settlement_id] = {
            "settlement_id": settlement_id,
            "listing_id": listing_id,
            "decision": listing["status"],
            "seller_payout": seller_payout,
            "buyer_refund": buyer_refund,
            "settled_at": self._now(),
        }
        self.settlements_json = self._dump(sets)
        listing["settlement_status"] = "SETTLED"
        if listing["status"] == STATUS_DEFECTIVE:
            listing["status"] = STATUS_REFUNDED
        else:
            listing["status"] = STATUS_SETTLED
        self._put_listing(listing_id, listing)
        reps = self._loads(self.reputation_json)
        if not isinstance(reps, list):
            reps = []
        reps.append({
            "agent": listing["seller_agent"],
            "listing_id": listing_id,
            "decision": verdict["decision"],
            "condition_score": verdict.get("condition_score", 0),
            "timeliness_score": verdict.get("timeliness_score", 0),
            "evidence_score": verdict.get("evidence_score", 0),
            "final_score": verdict.get("final_score", 0),
            "settlement_result": settlement_id,
            "recorded_at": self._now(),
        })
        self.reputation_json = self._dump(reps)
        return settlement_id

    @gl.public.view
    def get_listing(self, listing_id: str) -> str:
        return self._dump(self._need(listing_id))

    @gl.public.view
    def get_listing_state(self, listing_id: str) -> str:
        return self._need(listing_id)["status"]

    @gl.public.view
    def list_listing_ids(self) -> str:
        return self._dump(list(self._listings().keys()))

    @gl.public.view
    def get_delivery(self, delivery_id: str) -> str:
        data = self._loads(self.deliveries_json)
        assert delivery_id in data, "delivery_not_found"
        return self._dump(data[delivery_id])

    @gl.public.view
    def get_evidence(self, listing_id: str) -> str:
        ev = self._loads(self.evidence_json)
        rows = ev.get(listing_id, [])
        if not isinstance(rows, list):
            rows = []
        return self._dump(rows)

    @gl.public.view
    def get_verdict(self, verdict_id: str) -> str:
        data = self._loads(self.verdicts_json)
        assert verdict_id in data, "verdict_not_found"
        return self._dump(data[verdict_id])

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        data = self._loads(self.disputes_json)
        assert dispute_id in data, "dispute_not_found"
        return self._dump(data[dispute_id])

    @gl.public.view
    def get_settlement(self, settlement_id: str) -> str:
        data = self._loads(self.settlements_json)
        assert settlement_id in data, "settlement_not_found"
        return self._dump(data[settlement_id])

    @gl.public.view
    def get_seller_reputation(self) -> str:
        reps = self._loads(self.reputation_json)
        if not isinstance(reps, list):
            reps = []
        return self._dump(reps)

    @gl.public.view
    def get_owner(self) -> str:
        return self.owner
