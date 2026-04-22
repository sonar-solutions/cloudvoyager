#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="$(cd "$(dirname "$0")" && pwd)/../migrate-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: migrate-config.json not found at $CONFIG_FILE"
  exit 1
fi

# Extract values from migrate-config.json
ORG_KEY=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].key)")
SC_TOKEN=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].token)")
SC_URL=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].url)")

echo "SonarCloud Org : $ORG_KEY"
echo "SonarCloud URL : $SC_URL"
echo ""

# --- Fetch all project keys from SonarCloud ---
echo "Fetching ALL projects from SonarCloud..."
SC_PAGE=1
SC_PAGE_SIZE=500
SC_KEYS=()

while true; do
  SC_RESPONSE=$(curl -sf \
    -u "$SC_TOKEN:" \
    "$SC_URL/api/projects/search?organization=$ORG_KEY&ps=$SC_PAGE_SIZE&p=$SC_PAGE")

  KEYS=$(echo "$SC_RESPONSE" | node -e "
    let data='';
    process.stdin.on('data',d=>data+=d);
    process.stdin.on('end',()=>{
      const json=JSON.parse(data);
      (json.components||[]).forEach(c=>console.log(c.key));
    });
  ")

  if [ -z "$KEYS" ]; then
    break
  fi

  while IFS= read -r KEY; do
    SC_KEYS+=("$KEY")
  done <<< "$KEYS"

  SC_TOTAL=$(echo "$SC_RESPONSE" | node -e "
    let data='';
    process.stdin.on('data',d=>data+=d);
    process.stdin.on('end',()=>{
      const json=JSON.parse(data);
      console.log(json.paging?.total||0);
    });
  ")

  SC_FETCHED=${#SC_KEYS[@]}
  if [ "$SC_FETCHED" -ge "$SC_TOTAL" ]; then
    break
  fi

  SC_PAGE=$(( SC_PAGE + 1 ))
done

echo "Found ${#SC_KEYS[@]} project(s) in SonarCloud."
echo ""

TOTAL_COUNT=${#SC_KEYS[@]}

if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "No projects found in SonarCloud. Nothing to delete."
  exit 0
fi

echo "Will delete ALL $TOTAL_COUNT project(s) from SonarCloud:"
for KEY in "${SC_KEYS[@]}"; do
  echo "  - $KEY"
done
echo ""

read -r -p "Are you sure you want to permanently delete ALL $TOTAL_COUNT project(s) from SonarCloud? [yes/N] " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for KEY in "${SC_KEYS[@]}"; do
  (
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -u "$SC_TOKEN:" \
      "$SC_URL/api/projects/delete?project=$KEY")

    if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
      echo "[DELETED] $KEY"
      touch "$TMPDIR/deleted_$$_$RANDOM"
    else
      echo "[FAILED]  $KEY (HTTP $HTTP_STATUS)"
      touch "$TMPDIR/failed_$$_$RANDOM"
    fi
  ) &
done

wait

DELETED=$(ls "$TMPDIR"/deleted_* 2>/dev/null | wc -l | tr -d ' ')
FAILED=$(ls "$TMPDIR"/failed_* 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "Done. Deleted: $DELETED  |  Failed: $FAILED"
