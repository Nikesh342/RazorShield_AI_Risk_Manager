import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd


REQUIRED = [
    "step", "type", "amount", "oldbalanceOrg",
    "newbalanceOrig", "oldbalanceDest", "newbalanceDest"
]


def make_features(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()

    for c in ["step", "amount", "oldbalanceOrg", "newbalanceOrig",
              "oldbalanceDest", "newbalanceDest"]:
        x[c] = pd.to_numeric(x[c], errors="coerce").fillna(0.0)

    x["type"] = x["type"].fillna("UNKNOWN").astype(str)

    eps = 1e-6
    x["amount_log"] = np.log1p(np.maximum(x["amount"], 0))
    x["sender_balance_error"] = np.abs(
        x["oldbalanceOrg"] - x["amount"] - x["newbalanceOrig"]
    )
    x["receiver_balance_change"] = (
        x["newbalanceDest"] - x["oldbalanceDest"]
    )
    x["amount_to_sender_balance"] = (
        x["amount"] / (x["oldbalanceOrg"] + eps)
    ).clip(0, 100)
    x["sender_empty_after"] = (
        (x["oldbalanceOrg"] > 0) & (x["newbalanceOrig"] <= eps)
    ).astype(int)
    x["receiver_zero_before"] = (
        x["oldbalanceDest"] <= eps
    ).astype(int)
    x["is_large_amount"] = (
        x["amount"] >= x["amount"].quantile(0.95)
    ).astype(int)

    # Cyclical time representation; PaySim step is hourly.
    x["hour"] = x["step"] % 24
    x["hour_sin"] = np.sin(2 * np.pi * x["hour"] / 24)
    x["hour_cos"] = np.cos(2 * np.pi * x["hour"] / 24)

    return x


def build_model_matrix(df: pd.DataFrame, feature_columns=None):
    x = make_features(df)

    numeric = [
        "step", "amount", "oldbalanceOrg", "newbalanceOrig",
        "oldbalanceDest", "newbalanceDest", "amount_log",
        "sender_balance_error", "receiver_balance_change",
        "amount_to_sender_balance", "sender_empty_after",
        "receiver_zero_before", "is_large_amount", "hour_sin", "hour_cos"
    ]

    # One-hot encode transaction type.
    matrix = pd.get_dummies(x[numeric + ["type"]], columns=["type"], dtype=float)

    if feature_columns is not None:
        matrix = matrix.reindex(columns=feature_columns, fill_value=0.0)

    return matrix, x


def explain_transaction(row, probability):
    reasons = []

    amount = float(row.get("amount", 0))
    old_sender = float(row.get("oldbalanceOrg", 0))
    new_sender = float(row.get("newbalanceOrig", 0))
    old_dest = float(row.get("oldbalanceDest", 0))
    new_dest = float(row.get("newbalanceDest", 0))
    tx_type = str(row.get("type", "UNKNOWN"))

    if old_sender > 0 and amount / (old_sender + 1e-6) >= 0.8:
        reasons.append("Transaction consumes most of the sender's available balance")

    if old_sender > 0 and new_sender <= 1e-6:
        reasons.append("Sender balance is nearly emptied after the transaction")

    if tx_type in {"TRANSFER", "CASH_OUT"}:
        reasons.append(f"{tx_type} is a higher-risk transaction category in this dataset")

    if amount >= 100000:
        reasons.append("Transaction amount is unusually large")

    if old_dest <= 1e-6 and new_dest > 0:
        reasons.append("Recipient had no recorded balance before receiving funds")

    if not reasons:
        reasons.append("No strong rule-based risk signal was triggered")

    p = float(probability)
    if p >= 0.85:
        action = "REVIEW"
    elif p >= 0.45:
        action = "VERIFY"
    else:
        action = "APPROVE"

    return {
        "risk_score": round(p * 100, 2),
        "decision": action,
        "reasons": reasons[:4],
        "recommended_action": {
            "REVIEW": "Hold for manual review and request additional verification.",
            "VERIFY": "Request step-up verification before completing the payment.",
            "APPROVE": "Allow the transaction and continue passive monitoring."
        }[action],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
