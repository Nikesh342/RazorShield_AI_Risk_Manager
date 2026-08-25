import json
import sys
from pathlib import Path

import joblib
import pandas as pd

from risk_engine import build_model_matrix, explain_transaction

ROOT = Path(__file__).resolve().parent
ARTIFACT = joblib.load(ROOT / "risk_model.joblib")


def score(rows):
    frame = pd.DataFrame(rows)
    X, enriched = build_model_matrix(frame, ARTIFACT["feature_columns"])
    probabilities = ARTIFACT["model"].predict_proba(X)[:, 1]
    results = []
    for row, probability in zip(enriched.to_dict("records"), probabilities):
        assessment = explain_transaction(row, float(probability))
        assessment["fraud_probability"] = round(float(probability), 6)
        results.append(assessment)
    return results


def main():
    payload = json.load(sys.stdin)
    print(json.dumps({"results": score(payload["rows"])}))


if __name__ == "__main__":
    main()
