#!/usr/bin/env bash
set -euo pipefail

PLAN_DIR="$(cd "$(dirname "$0")" && pwd)/captured_plans"
failed=0
checked=0
for prefix in R W; do
  if [[ "$prefix" == "R" ]]; then max=30; else max=16; fi
  for n in $(seq 1 "$max"); do
    file=$(printf "%s%02d.txt" "$prefix" "$n")
    path="$PLAN_DIR/$file"
    checked=$((checked + 1))
    if [[ ! -f "$path" ]]; then
      echo "MISSING: $file"
      failed=1
      continue
    fi
    count=$(grep -c "Execution Time:" "$path" || true)
    if [[ "$count" -ne 3 ]]; then
      echo "INCOMPLETE: $file has $count/3 Execution Time records"
      failed=1
    else
      echo "OK: $file (3 executions)"
    fi
  done
done
if [[ "$failed" -ne 0 ]]; then
  echo "Validation failed. Capture missing plans, then rerun this script."
  exit 1
fi
echo "Validated $checked plan files; every file contains three Execution Time records."
