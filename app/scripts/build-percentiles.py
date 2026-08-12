"""
Build the percentile tables.

Source: NHANES (CDC/NCHS), the US National Health and Nutrition Examination
Survey. US federal government work, public domain, freely redistributable.

Why this exists: "your BMI is 26.4" is noise. "your BMI is higher than 71% of
men aged 25 to 29" is signal. It is the difference between a thermometer and a
reading. NHANES is a nationally representative probability sample, which is a
far more honest reference population than any app's own userbase, because an
app's users are self-selected for caring about fitness.

Survey weights (WTMEC2YR) are applied, so the percentiles represent the US
population rather than the people who happened to be sampled.

Output: src/data/percentiles.json, small enough to ship in the bundle.

Usage: python3 scripts/build-percentiles.py
"""

import io
import json
import os
import urllib.request

import numpy as np
import pandas as pd

# NHANES cycles. Key is the first year, which is what the CDC path uses.
CYCLES = {
    2011: "G",
    2013: "H",
    2015: "I",
    2017: "J",
}

BASE = "https://wwwn.cdc.gov/nchs/data/nhanes/public/{year}/DataFiles/{name}_{suffix}.xpt"

AGE_BANDS = [(18, 24), (25, 29), (30, 34), (35, 39), (40, 49), (50, 59), (60, 79)]
CENTILES = [5, 10, 25, 50, 75, 90, 95]
CACHE = os.path.join(os.path.dirname(__file__), ".nhanes-cache")


def fetch(name: str, year: int, suffix: str) -> pd.DataFrame | None:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{name}_{suffix}.xpt")
    if not os.path.exists(path):
        url = BASE.format(year=year, name=name, suffix=suffix)
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = r.read()
        except Exception as e:  # noqa: BLE001
            print(f"  skip {name}_{suffix}: {e}")
            return None
        if len(data) < 50_000:
            print(f"  skip {name}_{suffix}: suspiciously small ({len(data)} bytes)")
            return None
        with open(path, "wb") as f:
            f.write(data)
    with open(path, "rb") as f:
        return pd.read_sas(io.BytesIO(f.read()), format="xport")


def weighted_percentile(values, weights, q):
    """Percentiles that respect the survey design weights."""
    order = np.argsort(values)
    v = np.asarray(values)[order]
    w = np.asarray(weights)[order]
    cum = np.cumsum(w) - 0.5 * w
    cum /= np.sum(w)
    return np.interp(np.asarray(q) / 100.0, cum, v)


def main():
    frames = []
    for year, suffix in CYCLES.items():
        print(f"cycle {year}-{year + 1} ({suffix})")
        demo = fetch("DEMO", year, suffix)
        bmx = fetch("BMX", year, suffix)
        if demo is None or bmx is None:
            continue

        cols = ["SEQN", "RIAGENDR", "RIDAGEYR", "WTMEC2YR"]
        body = ["SEQN", "BMXBMI", "BMXWAIST", "BMXHT", "BMXWT", "BMXHIP", "BMXARMC"]
        m = demo[[c for c in cols if c in demo.columns]].merge(
            bmx[[c for c in body if c in bmx.columns]], on="SEQN", how="inner"
        )

        grip = fetch("MGX", year, suffix)
        if grip is not None and "MGDCGSZ" in grip.columns:
            m = m.merge(grip[["SEQN", "MGDCGSZ"]], on="SEQN", how="left")

        m["cycle"] = year
        frames.append(m)
        print(f"  merged rows: {len(m)}")

    if not frames:
        raise SystemExit("no cycles downloaded")

    df = pd.concat(frames, ignore_index=True)

    # Pooling cycles means the weights must be divided by how many cycles were
    # pooled, per the NHANES analytic guidelines.
    df["W"] = df["WTMEC2YR"] / len(frames)

    df = df[(df.RIDAGEYR >= 18) & (df.RIDAGEYR <= 79)]
    df["whtr"] = df.BMXWAIST / df.BMXHT

    metrics = {
        "bmi": "BMXBMI",
        "whtr": "whtr",
        "waist": "BMXWAIST",
    }
    if "MGDCGSZ" in df.columns:
        metrics["grip"] = "MGDCGSZ"

    out = {
        "source": "NHANES (CDC/NCHS), cycles " + ", ".join(f"{y}-{y + 1}" for y in CYCLES),
        "licence": "US public domain",
        "note": (
            "Weighted percentiles for the US adult population. NHANES is a US sample: "
            "for South Asian and East Asian bodies these percentiles describe a different "
            "population and the app says so where it uses them."
        ),
        "centiles": CENTILES,
        "ageBands": [f"{a}-{b}" for a, b in AGE_BANDS],
        "metrics": {},
    }

    for key, col in metrics.items():
        if col not in df.columns:
            continue
        out["metrics"][key] = {}
        for sex_code, sex in ((1, "male"), (2, "female")):
            rows = {}
            for lo, hi in AGE_BANDS:
                sub = df[
                    (df.RIAGENDR == sex_code)
                    & (df.RIDAGEYR >= lo)
                    & (df.RIDAGEYR <= hi)
                    & df[col].notna()
                    & df.W.notna()
                ]
                if len(sub) < 80:
                    continue
                vals = weighted_percentile(sub[col].values, sub.W.values, CENTILES)
                rows[f"{lo}-{hi}"] = {
                    "n": int(len(sub)),
                    "p": [round(float(v), 2) for v in vals],
                }
            out["metrics"][key][sex] = rows

    target = os.path.join(os.path.dirname(__file__), "..", "src", "data", "percentiles.json")
    target = os.path.normpath(target)
    with open(target, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size = os.path.getsize(target)
    total = sum(
        band["n"]
        for metric in out["metrics"].values()
        for sex in metric.values()
        for band in sex.values()
    )
    print(f"\nmetrics: {list(out['metrics'])}")
    print(f"observations behind the tables: {total:,}")
    print(f"written: {target} ({size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
