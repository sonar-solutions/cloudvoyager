# Business Value

<!-- Last updated: 2026-05-07 -->

CloudVoyager delivers a complete SonarQube Server-to-SonarQube Cloud migration without requiring a single line of code to be re-scanned. By reverse-engineering SonarScanner's internal protobuf report protocol, CloudVoyager extracts all data directly from SonarQube Server's API and repackages it into the exact binary format that SonarQube Cloud's Compute Engine expects.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 1. Time Savings — No Re-scanning Required

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### The Hidden Cost of Re-Scanning

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Traditional migration approaches require re-running CI/CD scanners against every project. For a portfolio of 50 projects across multiple teams, this means:

- **Days to weeks of pipeline execution** — Each scan must complete in sequence or with limited parallelism, constrained by CI/CD runner availability
- **Developer interruption** — Teams must update branch configurations, trigger manual pipelines, and monitor for failures
- **Locked CI/CD resources** — Build agents are occupied running scans instead of their normal development work
- **Extended validation cycles** — Each re-scan potentially surfaces new issues that did not exist in the original SonarQube Server, requiring investigation

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### CloudVoyager Eliminates This Entirely

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager connects directly to your existing SonarQube Server via API, extracts all project data, and uploads it to SonarQube Cloud as a legitimate scanner submission — without touching your source code or CI/CD pipelines.

**Real-world example from production use:**

| Metric | Value |
|--------|-------|
| Projects migrated | 29 |
| Quality profiles migrated | 53 |
| User groups created | 2 |
| Total migration time | ~16 minutes |
| Resource types migrated | 12+ per organization |

This same migration via re-scanning would have taken days,占用 significant CI/CD resources and requiring coordination across multiple development teams.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### What This Means for Your Team

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

- **No CI/CD disruption** — Migration runs in the background while your pipelines continue normal operations
- **No coordination required** — Individual development teams do not need to take any action
- **Predictable timeline** — A 50-project portfolio migrates in hours, not weeks
- **Zero re-scan risk** — Code that passed SonarQube Server analysis arrives in SonarQube Cloud with the same issue status, not potentially different results from a re-run

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 2. Data Preservation — All Historical Issues, Hotspots, and Measures Preserved

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Complete Data Fidelity

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager migrates every category of data that SonarQube Server tracks:

| Category | Data Preserved |
|----------|---------------|
| **Issues** | All code issues with status, assignee, comments, tags, text ranges, and flows |
| **Security Hotspots** | All hotspots with status, resolution, and review comments |
| **Measures** | 18 key metrics per component (coverage, complexity, duplications, violations, ncloc, etc.) |
| **Source Code** | Full source files with language metadata |
| **SCM Data** | Changeset information (author, date, revision) per file |
| **Branches** | All branches transferred, with main branch processed first |

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Issue Lifecycle Preservation

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Each issue carries its complete lifecycle history from SonarQube Server:

- **Original creation date** — Preserved via SCM date backdating, so SonarQube Cloud shows the same temporal distribution as SonarQube Server
- **Status transitions** — Confirmed, False Positive, Accepted, Won't Fix, Resolved, Reopened states all synced
- **Assignments** — Issues assigned to specific users transfer to the corresponding SonarQube Cloud user
- **Comments** — Full comment history preserved with `[Migrated from SonarQube Server]` attribution
- **Tags** — Custom categorization labels maintained

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Accurate Issue Creation Dates

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager preserves each issue's original SonarQube Server creation date by backdating SCM changeset blame dates in the protobuf report. Issues appear in SonarQube Cloud with the same creation timestamp they had in SonarQube Server, maintaining the historical distribution in the creation date facet.

For calendar days with more than 5,000 issues, CloudVoyager automatically splits into sub-groups with 1-day-spaced synthetic dates to prevent clustering, ensuring a realistic distribution across the project's history.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 3. Risk Reduction — Verified Migration with Rollback Capability

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Three-Layer Safety System

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
#### Layer 1: Dry-Run Preview

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Before any data touches SonarQube Cloud, run the migration in dry-run mode:

```bash
cloudvoyager migrate -c migrate-config.json --dry-run
```

This extracts all data and generates 9 CSV mapping files for review. You can:

- Verify which projects map to which SonarQube Cloud organizations
- Exclude specific projects or branches from migration
- Map SonarQube Server users to SonarQube Cloud users before migration
- Review quality gate and profile assignments

Only after reviewing the generated CSVs do you proceed to the actual migration.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
#### Layer 2: Checkpoint Journal with Pause/Resume

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Every migration step is individually checkpointed. If migration is interrupted — by CTRL+C, network failure, or system crash — running the same command again resumes from the last completed step. No data is lost or duplicated.

The checkpoint journal tracks:
- Per-organization completion status
- Per-project progress across 11 migration phases
- Upload deduplication via CE task ID verification (prevents re-uploading completed analyses)
- Session fingerprint validation (warns on SonarQube Server version changes between runs)

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
#### Layer 3: Post-Migration Verification

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

After migration completes, the verification pipeline runs **58+ automated checks** comparing SonarQube Server against SonarQube Cloud:

| Verification Area | Checks Performed |
|-------------------|-----------------|
| **Issues** | Count parity, status matching, status history (changelog sequence), assignments, comments, tags |
| **Hotspots** | Count parity, status matching (Safe, Acknowledged, Fixed, To Review), comments |
| **Branches** | All SonarQube Server branches exist in SonarQube Cloud |
| **Measures** | 18 key metrics compared (ncloc, complexity, coverage, violations, etc.) |
| **Quality Gates** | Existence, condition definitions, project assignments |
| **Quality Profiles** | Existence, active rule counts, project assignments |
| **Permissions** | Global permissions, project permissions, permission templates |
| **Project Config** | Settings, tags, links, new code periods, DevOps bindings |
| **Groups** | Custom user group existence |

The verification command is read-only — it does not modify any data:

```bash
cloudvoyager verify -c migrate-config.json --verbose
```

Reports generate in JSON, Markdown, and PDF formats, including collapsible detail sections for any mismatches found.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 4. Cost Efficiency — No CI/CD Pipeline Re-Runs Needed

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### The True Cost of Re-Scanning

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Re-running CI/CD pipelines for migration is not free. Consider the hidden costs:

| Cost Factor | Impact |
|-------------|--------|
| **CI/CD runner consumption** | Minutes to hours of build agent time per project |
| **Developer coordination** | Time spent triggering manual runs, monitoring results, fixing failures |
| **Pipeline lock contention** | Other work queued behind migration scans |
| **Extended timeline** | Parallelism limited by available runners; large portfolios take days |
| **Re-scan divergence risk** | A re-run may surface different results than the original analysis |

For a 50-project portfolio, re-scanning could consume hundreds of CI/CD minutes, tie up developer attention, and extend the migration timeline from hours to weeks.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### One Command, Full Migration

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager runs as a single command that orchestrates the entire migration:

```bash
cloudvoyager migrate -c migrate-config.json --verbose --auto-tune
```

The `--auto-tune` flag automatically detects your hardware (CPU cores, RAM) and sets optimal performance values, so no manual tuning is required.

**Typical resource requirements:**

| Portfolio Size | Recommended RAM | Typical Duration |
|---------------|-----------------|------------------|
| Small (< 10 projects, < 1,000 issues) | Default (auto-tuned) | Minutes |
| Medium (10-50 projects, 1K-50K issues) | 4-8 GB | 15-60 minutes |
| Large (50+ projects, 50K+ issues) | 8+ GB | 1-3 hours |

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Parallel Processing Architecture

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager uses a zero-dependency concurrency engine to maximize throughput:

- **Source file extraction** — Parallel fetching across 10+ concurrent connections
- **Issue and hotspot sync** — Worker threads achieve 100 concurrent API calls for large projects (20 workers x 5 concurrency each)
- **Organization migration** — Multiple target orgs migrate in parallel
- **Project migration** — Independent projects within an org migrate concurrently

This parallelism means CloudVoyager fully utilizes available resources without requiring manual tuning.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 5. Governance Continuity — Permissions, Quality Gates, Profiles Maintained

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Complete Governance Preservation

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Moving to SonarQube Cloud should not mean rebuilding your entire quality governance framework from scratch. CloudVoyager migrates every governance artifact:

| Governance Element | What Gets Migrated |
|-------------------|-------------------|
| **Quality Gates** | Full gate definitions with all conditions (metric + operator + threshold), permissions, and project assignments |
| **Quality Profiles** | All rule activations, severity overrides, rule parameter values, inheritance chains, and language-specific configurations |
| **User Groups** | Custom group definitions with names and descriptions |
| **Global Permissions** | Organization-wide permissions assigned to groups (admin, quality gate admin, quality profile admin) |
| **Project Permissions** | Per-project group permissions (codeviewer, issueadmin, securityhotspotadmin) |
| **Permission Templates** | Reusable templates with group assignments, set as defaults where applicable |
| **Portfolios** | Portfolio definitions with project associations preserved for executive-level views |

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Quality Gate Integrity

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Quality gates are recreated with their exact condition logic:

- **Metric + operator + threshold** preserved for every condition
- **Gate permissions** migrated for custom gates
- **Project assignments** applied per organization mapping
- Built-in gates (Sonar way) use SonarQube Cloud's default since they are platform-managed

This means your existing quality standards continue uninterrupted — projects that passed SonarQube Server's gate pass SonarQube Cloud's gate with the same criteria.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Quality Profile Fidelity

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Quality profiles use SonarQube Server's native backup/restore XML format, preserving:

- **All rule activations and deactivations**
- **Severity overrides** for individual rules
- **Rule parameter values** (for rules with configurable parameters)
- **Inheritance chains** — profiles restored in dependency order so parent profiles exist before children

**Built-in profile handling** is handled specially. SonarQube Cloud's built-in profiles cannot be overwritten, so CloudVoyager extracts the built-in profile's rules from SonarQube Server and creates a custom profile with a `(SonarQube Server Migrated)` suffix. This ensures the exact same rules are active in SonarQube Cloud as they were in SonarQube Server.

**Quality profile diff reports** are generated after migration, showing:
- **Missing rules** — Active in SonarQube Server but not available in SonarQube Cloud
- **Added rules** — Available in SonarQube Cloud but not in SonarQube Server

This enables governance teams to review rule parity before cutting over to SonarQube Cloud.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Project Settings and Bindings

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Per-project configuration that transfers includes:

- **Project visibility and description**
- **Custom tags** for categorization
- **External links** (CI/CD, documentation, issue trackers)
- **New code period definitions** controlling which code is considered "new" for quality gate evaluation
- **DevOps bindings** (GitHub, GitLab, Azure DevOps, Bitbucket) for pull request decoration and automatic branch analysis
- **Non-inherited project-level settings**

This ensures each project arrives in SonarQube Cloud fully configured and ready for your development teams to use immediately.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## Summary

CloudVoyager's business value is straightforward:

| Value Driver | What You Get |
|-------------|--------------|
| **Time Savings** | 29 projects migrated in ~16 minutes, no CI/CD re-runs |
| **Data Preservation** | All issues, hotspots, measures, and project configuration preserved |
| **Risk Reduction** | Dry-run preview, checkpoint journal with resume, 58+ post-migration verification checks |
| **Cost Efficiency** | No CI/CD runner consumption, no developer coordination overhead |
| **Governance Continuity** | Quality gates, profiles, permissions, groups, and templates maintained across the migration |

CloudVoyager is purpose-built for enterprises that need to migrate to SonarQube Cloud without disrupting development teams, sacrificing historical data, or rebuilding governance configuration from scratch.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## Further Reading

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

- [Key Capabilities](key-capabilities.md) — Comprehensive technical overview
- [Architecture](architecture.md) — Project structure and data flow
- [Scenario: Single Organization Migration](scenario-single-org.md) — Step-by-step migration guide
- [Verification](verification.md) — Post-migration verification details
- [Configuration Reference](configuration.md) — All config options
