# Verification

<!-- Last updated: Mar 4, 2026 -->

After running a migration, use the `verify` command to compare your SonarQube instance against SonarCloud and confirm that all data was transferred correctly.

```bash
# Verify everything
cloudvoyager verify -c migrate-config.json

# Verbose output
cloudvoyager verify -c migrate-config.json --verbose

# Verify specific components only
cloudvoyager verify -c migrate-config.json --only scan-data
cloudvoyager verify -c migrate-config.json --only issue-metadata
cloudvoyager verify -c migrate-config.json --only quality-gates
```

## Output

Verification produces three report files in `./verification-output/`:

| File | Format | Purpose |
|------|--------|---------|
| `verification-report.json` | JSON | Machine-readable — full detail of every check, every mismatch |
| `verification-report.md` | Markdown | Human-readable summary with tables |
| `verification-report.pdf` | PDF | Shareable report for stakeholders |

## What Gets Verified

The verification system runs **58+ checks** across two levels: organization-wide and per-project.

### Organization-Level Checks

These run once per organization in your migration config.

#### Quality Gates

Compares quality gate **definitions** between SQ and SC.

| What | How |
|------|-----|
| Gate existence | SQ gates matched to SC gates by name |
| Conditions (custom gates) | Metric, operator (`op`), and threshold (`error`) compared per condition |
| Built-in gates | **Skipped** — "Sonar way" and "Sonar way for AI Code" have platform-managed conditions that differ between SQ and SC versions |

**Pass** if all custom gates exist and conditions match.
**Fail** if a custom gate is missing or has condition mismatches.

#### Quality Profiles

Compares quality profile **definitions** (not assignments — those are per-project).

| What | How |
|------|-----|
| Profile existence | SQ profiles matched to SC by `language + name` |
| Migration suffix | SC profiles named `"X (SonarQube Migrated)"` are treated as equivalent to SQ `"X"` |
| Active rule count | Compared for **custom profiles only** |
| Built-in profiles | Rule count differences **skipped** — platform versions have different rule sets |
| Unsupported languages | Profiles for SQ-only languages (e.g., `mulesoft`) are **skipped** — SC doesn't have the language |

**Pass** if all profiles for SC-supported languages exist and custom profiles have matching rule counts.
**Fail** if a profile is missing (for a supported language) or a custom profile's rule count differs.

#### Groups

Compares custom user groups.

| What | How |
|------|-----|
| Group existence | SQ custom groups matched to SC by name |
| Built-in groups | Filtered out (`anyone`, `sonar-users`, `sonar-administrators`, `Members`, `Owners`) |

**Pass** if all custom SQ groups exist in SC.

#### Global Permissions

Compares group-level permissions at the organization level.

| What | How |
|------|-----|
| Permission sets | For each SQ group, checks that all SQ permissions exist in SC |
| SC-unsupported perms | `applicationcreator` and `portfoliocreator` are **excluded** — these are SonarQube Enterprise permissions that don't exist in SonarCloud |
| Extra SC permissions | Allowed (e.g., SC may auto-grant `scan`) |

**Pass** if all SQ group permissions (minus unsupported ones) exist in SC.

#### Permission Templates

Compares permission template existence.

| What | How |
|------|-----|
| Template existence | SQ templates matched to SC by name |

**Pass** if all SQ templates exist in SC.

---

### Per-Project Checks

These run for every project mapping in your migration config.

#### Project Existence

Confirms the SC project exists.

**Pass** if SC project is found.

#### Branches

Compares branches between SQ and SC.

| What | How |
|------|-----|
| Branch names | Exact name match |
| Default branch | SQ and SC default branches are treated as **equivalent** even if named differently (e.g., SQ `main` ↔ SC `master`) |
| Missing branches | SQ branches not in SC (after default equivalence) |
| Extra branches | SC branches not in SQ (informational, doesn't fail) |

**Pass** if all SQ branches exist in SC (with default branch equivalence).

#### Issues

The most detailed check. Compares all issues between SQ and SC.

| What | How |
|------|-----|
| **Matching** | Issues matched by `rule + filePath + lineNumber` |
| **External rules** | SQ `mulesoft:MS058` matches SC `external_mulesoft:MS058` — the `external_` prefix is normalized |
| **Status** | Normalized from `status + resolution` (OPEN, FIXED, FALSE-POSITIVE, WONTFIX) |
| **Assignment** | Direct comparison of assignee |
| **Status history** | Fetches changelogs from both SQ and SC, extracts status transitions, and verifies that all SQ transitions appear in SC in order. Issues with no status changes are skipped |
| **Comments** | Counts SC comments containing `[Migrated from SonarQube]` marker; flags if fewer than SQ comment count |
| **Tags** | Only flags if SQ tags are **missing** from SC; SC adding extra tags (e.g., `type-dependent`) is expected |
| **External issue tags** | **Skipped entirely** — SC external issues don't preserve tags |
| **Rule not in SC** | If a rule has zero presence in SC (no matches at all), unmatched issues for that rule are **excluded** from the failure count — it's a platform difference, not a migration failure |
| **Type/severity changes** | Tracked as "unsyncable" warnings (SQ and SC may classify rules differently) |

**Pass** if all genuine issues match (excluding platform-unavailable rules) and no status/assignment/comment/status-history mismatches.
**Fail** if there are genuine unmatched issues, status mismatches, status history mismatches, or missing comments.

**Breakdowns reported:**
- Type distribution (BUG, CODE_SMELL, VULNERABILITY) for both SQ and SC
- Severity distribution (BLOCKER, CRITICAL, MAJOR, MINOR, INFO) for both SQ and SC
- Up to 200 unmatched issue details (rule, file, line, type, severity, message)

#### Hotspots

Compares security hotspots between SQ and SC.

| What | How |
|------|-----|
| **Matching** | Hotspots matched by `ruleKey + filePath + lineNumber` |
| **Status** | Normalized — `REVIEWED:SAFE`, `REVIEWED:ACKNOWLEDGED`, `REVIEWED:FIXED`, or `TO_REVIEW` |
| **Comments** | Fetches SC hotspot details and counts `[Migrated from SonarQube]` comments |
| **Assignments** | Tracked as "unsyncable" (hotspot API doesn't support assignment sync) |
| **Rule not in SC** | Same as issues — if a rule has zero presence in SC hotspots (e.g., reclassified from hotspot to issue, or rule unavailable), unmatched hotspots are **excluded** from the failure count |

**Pass** if all genuine hotspots match and no status/comment mismatches.

#### Measures

Compares project-level metric values.

**Metrics checked:** `ncloc`, `lines`, `statements`, `functions`, `classes`, `files`, `complexity`, `cognitive_complexity`, `violations`, `bugs`, `vulnerabilities`, `code_smells`, `coverage`, `line_coverage`, `branch_coverage`, `duplicated_lines_density`, `duplicated_blocks`, `duplicated_lines`

| What | How |
|------|-----|
| **Issue-derived metrics** | `violations`, `bugs`, `vulnerabilities`, `code_smells`, `security_hotspots` — **skipped** (already verified by issues/hotspots checker) |
| **Duplication metrics** | `duplicated_lines_density`, `duplicated_blocks`, `duplicated_lines` — **skipped** (SC recalculates with its own CPD engine) |
| **Line counts** | `lines`, `ncloc` — **1% tolerance** allowed (scanner implementations count lines differently) |
| **SQ-only metrics** | Reported as informational (e.g., `statements`, `functions`, `classes` may not be in SC) |
| **SC-only metrics** | Reported as informational |

**Pass** if all remaining metrics match (after filtering and tolerance).

#### Quality Gate (project-level)

Checks which quality gate is assigned to the project.

**Pass** if SQ and SC have the same gate assigned (by name).

#### Quality Profiles (project-level)

Checks which quality profile is assigned per language.

| What | How |
|------|-----|
| Profile assignment | Compared by language |
| Migration suffix | `"Sonar way (SonarQube Migrated)"` treated as equivalent to `"Sonar way"` |
| Unsupported languages | Languages not in SC (e.g., `mulesoft`) are **skipped** |

**Pass** if all SC-supported language profiles match.

#### Settings

Compares project-level settings (non-inherited only).

| What | How |
|------|-----|
| Setting values | Matched by key, deep equality comparison (JSON.stringify) |
| SQ-only settings | Flagged (informational) |

**Pass** if all shared settings have matching values.

#### Tags

Compares project tags.

**Pass** if all SQ tags exist in SC. Extra SC tags are allowed.

#### Links

Compares project links (homepage, CI, issue tracker, etc.).

**Pass** if all SQ links (matched by `name + url`) exist in SC.

#### New Code Periods

Compares new code period definitions.

**Pass** if the new code period type matches (e.g., `PREVIOUS_VERSION`, `NUMBER_OF_DAYS`).

#### DevOps Binding

Compares ALM/DevOps platform bindings.

**Pass** if both have the same binding (or neither has one). Fails if SQ has a binding that SC doesn't.

#### Permissions (project-level)

Same logic as global permissions, but scoped to the project.

**Pass** if all SQ group permissions exist in SC for the project.

---

### Portfolios

Portfolio verification is **always skipped** — it requires Enterprise API access. SQ portfolios are listed in the report for reference.

---

## `--only` Component Filters

You can run verification for specific components only:

| Component | What it runs |
|-----------|-------------|
| `scan-data` | Issues, hotspots, measures, branches (default branch only) |
| `scan-data-all-branches` | Issues, hotspots, measures, branches (all branches) |
| `issue-metadata` | Issue status, comments, assignments, tags |
| `hotspot-metadata` | Hotspot status, comments |
| `quality-gates` | Quality gate definitions and project assignments |
| `quality-profiles` | Quality profile definitions and project assignments |
| `permissions` | Global permissions, project permissions, permission templates, groups |
| `project-settings` | Settings, tags, links, new code periods, DevOps bindings |
| `portfolios` | Portfolio listing (always skipped) |

---

## Result Statuses

Each check produces one of these statuses:

| Status | Meaning |
|--------|---------|
| **pass** | SQ and SC match (within tolerance) |
| **fail** | Genuine mismatch that indicates a migration gap |
| **warning** | Unsyncable difference (e.g., type/severity reclassification, assignment on hotspots) — cannot be fixed via API |
| **skip** | Check was skipped (e.g., portfolios) |
| **error** | Check could not complete (API failure, timeout) |

---

## Platform Differences (Gotchas)

These are known differences between SonarQube and SonarCloud that the verification system handles automatically. They are **not** migration failures.

### Rule Availability

SQ and SC have different rule sets. Some rules exist in SQ but not SC (or vice versa):

- **Secret detection rules** (e.g., `secrets:S6702`) — SQ may detect secrets that SC's engine doesn't, or vice versa.
- **Plugin-specific rules** (e.g., `githubactions:S7631`, `text:S6389`) — SC may not ship all the same analyzers.
- **Rule reclassification** — a rule can be a "hotspot" in SQ but an "issue" in SC (e.g., `typescript:S2068` "hard-coded password" is a hotspot in SQ 10.x but an issue in SC). This means the hotspot won't match in SC's hotspot list, and SC will have an extra issue instead.

The verifier handles this by checking if a rule has **zero presence** in the SC side. If so, unmatched items for that rule are excluded from the failure count.

### External Issues (Plugin Migration)

When SQ has issues from plugins not available in SC (e.g., MuleSoft), the migration creates **external issues** in SC. These have a different rule key format:

| Platform | Rule key |
|----------|----------|
| SonarQube | `mulesoft:MS058` |
| SonarCloud | `external_mulesoft:MS058` |

The verifier normalizes rule keys by stripping the `external_` prefix before matching.

**Important:** External issues in SC do **not** preserve tags from SQ. Tag comparison is skipped entirely for external issues.

### Branch Naming

SQ and SC may have different default branch names (e.g., SQ uses `main`, SC uses `master`). The verifier detects each side's default branch (via the `isMain` flag) and treats them as equivalent.

### Quality Profile Naming

The migration creates profiles with a `(SonarQube Migrated)` suffix to avoid colliding with SC's built-in profiles:

| SonarQube | SonarCloud |
|-----------|------------|
| `Sonar way` | `Sonar way (SonarQube Migrated)` |

The verifier strips this suffix before comparing.

### Built-In Quality Gates and Profiles

Built-in quality gates ("Sonar way", "Sonar way for AI Code") and built-in profiles ("Sonar way" for each language) are managed by the platform. Their conditions and rule counts naturally differ between SQ and SC versions. The verifier skips detailed comparison for these.

### SonarCloud-Unsupported Permissions

These SonarQube Enterprise permissions don't exist in SonarCloud and are excluded from comparison:

- `applicationcreator` — create Applications (Enterprise feature)
- `portfoliocreator` — create Portfolios (Enterprise feature)

### Unsupported Languages

SQ may have plugins that add languages not available in SC (e.g., MuleSoft's `mulesoft` language). Quality profiles for these languages cannot be migrated and are excluded from the profile assignment check.

### Measure Differences

| Metric category | Behavior |
|----------------|----------|
| Issue-derived (`violations`, `bugs`, `vulnerabilities`, `code_smells`) | Skipped — already verified by issues checker |
| Duplication (`duplicated_lines_density`, `duplicated_blocks`, `duplicated_lines`) | Skipped — SC recalculates with its own CPD engine |
| Line counts (`lines`, `ncloc`) | 1% tolerance — different scanner implementations count lines slightly differently |
| SQ-only metrics (`statements`, `functions`, `classes`, `coverage`, `line_coverage`) | Informational only — SC may not report these |

### Tag Differences on Issues

SC may add its own tags to issues that SQ doesn't have (e.g., `type-dependent` on `typescript:S7755`). The verifier only flags tags that are **missing** from SC (SQ tags not found in SC), not extra SC tags.

### Hotspot Assignments

Hotspot assignments (who the hotspot is assigned to) cannot be synced via SC's API. Assignment differences on hotspots are reported as **unsyncable warnings**, not failures.

### Type and Severity Reclassification

SQ and SC may classify the same rule with different types (BUG vs CODE_SMELL) or severities (MAJOR vs CRITICAL). These are platform-level decisions that can't be overridden by the migration. They're reported as **unsyncable warnings**.

---

## SonarQube API Gotchas

These API quirks affect both migration and verification:

| API | Gotcha |
|-----|--------|
| `/api/qualitygates/list` | Returns no `id` field — only `name` |
| `/api/qualitygates/show` | Requires `name` param, not `id` |
| `/api/permissions/groups` | Max `ps=100` (not 500) |
| `/api/project_tags/search` | Max `ps=100` |
| `/api/qualityprofiles/backup` | Requires `language` + `qualityProfile` (name), not `profileKey` |
| `/api/qualityprofiles/search_users` | Requires `language` + `qualityProfile` (name) |
| `/api/settings/values` | Without `component` param returns server-level settings |
| `/api/hotspots/show` | Returns `comment` (singular, a list), not `comments` |
| Built-in quality gates/profiles | Permission APIs return 400 for built-in items — expected, handle gracefully |

---

## Troubleshooting Verification Failures

### "X unmatched issues"

1. Check the `unmatchedSqIssues` array in the JSON report for details (rule, file, line).
2. If all unmatched issues share the same rule, that rule likely doesn't exist in SC — this is a platform difference and should already be handled.
3. If issues are on different rules, check if the files exist in SC and were transferred correctly.

### "X unmatched hotspots"

Same as issues — check if the rules exist in SC. Common causes:
- Rule reclassified from hotspot to issue (or vice versa)
- Rule not available in SC's analyzer version

### "Quality profile rule count mismatch"

For built-in profiles, this is expected and should be skipped automatically. For custom profiles, check if SC has additional rules activated or if some SQ rules aren't available in SC.

### "Measures mismatch"

Check which metric is mismatched:
- `lines`/`ncloc` with small differences — scanner implementation difference (should be within 1% tolerance)
- `violations`/`bugs` etc. — tied to issue counts, check issues first
- `duplicated_*` — SC recalculates these, should be skipped automatically

### Report shows 19 failures but source code fixes pass

If you're running the compiled binary (`dist/bin/cloudvoyager-*`) and see failures that `node src/index.js verify` doesn't, you need to rebuild:

```bash
npm run build
```
