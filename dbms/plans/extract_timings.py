#!/usr/bin/env python3
"""Extract the three PostgreSQL Execution Time values from R/W plan files."""
from pathlib import Path
import csv
import re
import sys

BASE = Path(__file__).resolve().parent
CAPTURED = BASE / "captured_plans"
MAPPING = BASE / "plan_mapping.csv"
OUTPUT = BASE / "captured_plan_timings.csv"

rows = []
with MAPPING.open(newline="", encoding="utf-8") as f:
    for item in csv.DictReader(f):
        path = CAPTURED / item["Plan file"]
        if not path.exists():
            print(f"MISSING: {path.name}")
            sys.exit(1)
        text = path.read_text(encoding="utf-8", errors="replace")
        values = [float(x) for x in re.findall(r"Execution Time:\s*([0-9]+(?:\.[0-9]+)?)\s*ms", text)]
        if len(values) != 3:
            print(f"INCOMPLETE: {path.name} has {len(values)} Execution Time values; expected 3")
            sys.exit(1)
        avg = sum(values) / 3
        rows.append({
            "Plan file": item["Plan file"],
            "Query ID": item["Original query"],
            "Type": item["Type"],
            "Description": item["Description"],
            "Run 1 (ms)": f"{values[0]:.3f}",
            "Run 2 (ms)": f"{values[1]:.3f}",
            "Run 3 (ms)": f"{values[2]:.3f}",
            "Average (ms)": f"{avg:.3f}",
        })

with OUTPUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Extracted timings for {len(rows)} queries to {OUTPUT.name}")
print("Use these measured values to replace the simulated table in dbms/05_query_timings.md.")
