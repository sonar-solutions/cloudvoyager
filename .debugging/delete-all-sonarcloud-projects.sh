#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="$(cd "$(dirname "$0")" && pwd)/../migrate-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: migrate-config.json not found at $CONFIG_FILE"
  exit 1
fi

# Extract values from migrate-config.json
SQ_URL=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarqube.url)")
SQ_TOKEN=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarqube.token)")
ORG_KEY=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].key)")
SC_TOKEN=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].token)")
SC_URL=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.sonarcloud.organizations[0].url)")

echo "SonarQube URL  : $SQ_URL"
echo "SonarCloud Org : $ORG_KEY"
echo "SonarCloud URL : $SC_URL"
echo ""

# --- Fetch all project keys from SonarQube ---
echo "Fetching projects from SonarQube..."
SQ_PAGE=1
SQ_PAGE_SIZE=500
SQ_KEYS=()

while true; do
  SQ_RESPONSE=$(curl -sf \
    -u "$SQ_TOKEN:" \
    "$SQ_URL/api/projects/search?ps=$SQ_PAGE_SIZE&p=$SQ_PAGE")

  KEYS=$(echo "$SQ_RESPONSE" | node -e "
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
    SQ_KEYS+=("$KEY")
  done <<< "$KEYS"

  SQ_TOTAL=$(echo "$SQ_RESPONSE" | node -e "
    let data='';
    process.stdin.on('data',d=>data+=d);
    process.stdin.on('end',()=>{
      const json=JSON.parse(data);
      console.log(json.paging?.total||0);
    });
  ")

  SQ_FETCHED=$(( (SQ_PAGE - 1) * SQ_PAGE_SIZE + ${#SQ_KEYS[@]} ))
  if [ "$SQ_FETCHED" -ge "$SQ_TOTAL" ]; then
    break
  fi

  SQ_PAGE=$(( SQ_PAGE + 1 ))
done

echo "Found ${#SQ_KEYS[@]} project(s) in SonarQube."
echo ""

if [ "${#SQ_KEYS[@]}" -eq 0 ]; then
  echo "No projects found in SonarQube. Nothing to delete."
  exit 0
fi

# --- Fetch all project keys from SonarCloud ---
echo "Fetching projects from SonarCloud..."
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

  SC_FETCHED=$(( (SC_PAGE - 1) * SC_PAGE_SIZE + ${#SC_KEYS[@]} ))
  if [ "$SC_FETCHED" -ge "$SC_TOTAL" ]; then
    break
  fi

  SC_PAGE=$(( SC_PAGE + 1 ))
done

echo "Found ${#SC_KEYS[@]} project(s) in SonarCloud."
echo ""

# --- Find intersection: SonarCloud keys that also exist in SonarQube ---
SQ_KEYS_STR=$( IFS=$'\n'; echo "${SQ_KEYS[*]}" )

MATCHED_KEYS=()
for KEY in "${SC_KEYS[@]}"; do
  if echo "$SQ_KEYS_STR" | grep -qxF "$KEY"; then
    MATCHED_KEYS+=("$KEY")
  fi
done

TOTAL_COUNT=${#MATCHED_KEYS[@]}

if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "No matching project keys found between SonarQube and SonarCloud. Nothing to delete."
  exit 0
fi

echo "Found $TOTAL_COUNT SonarCloud project(s) matching SonarQube project keys:"
for KEY in "${MATCHED_KEYS[@]}"; do
  echo "  - $KEY"
done
echo ""

read -r -p "Are you sure you want to permanently delete these $TOTAL_COUNT project(s) from SonarCloud? [yes/N] " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for KEY in "${MATCHED_KEYS[@]}"; do
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
