# Dry-Run CSV Reference

<!-- Last updated: 2026-02-20 -->

## Overview

The `--dry-run` flag generates 8 exhaustive CSV files in `migration-output/mappings/`. Each CSV includes an **Include** column (first field) that defaults to `yes`. You can edit these CSVs to customize the migration before running the actual migration.

## Workflow

```
1. cloudvoyager migrate -c config.json --dry-run
   -> Extracts all data from SonarQube
   -> Generates exhaustive CSVs in migration-output/mappings/
   -> Prints summary + instructions
   -> Stops (no SonarCloud changes)

2. Review and edit CSVs (set Include=no to exclude resources)

3. cloudvoyager migrate -c config.json
   -> Detects existing CSVs, reads them into memory BEFORE wiping output dir
   -> Re-extracts from SonarQube, applies CSV overrides
   -> Migrates using filtered data
```

## Include Column

Every CSV has an `Include` column as the first field. Values are case-insensitive:

| Value | Meaning |
|-------|---------|
| `yes`, `true`, `1` | Include this row (default) |
| `no`, `false`, `0` | Exclude this row |
| *(empty)* | Include (treated as default) |

## CSV Files

### projects.csv

One row per project.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude project from migration |
| Project Key | Read-only | SonarQube project key |
| Project Name | Read-only | Project display name |
| Target Organization | Read-only | SonarCloud organization key |
| ALM Platform | Read-only | DevOps binding (github, gitlab, etc.) |
| Repository | Read-only | Repository identifier |
| Monorepo | Read-only | Whether project is part of a monorepo |
| Visibility | Read-only | Project visibility (public/private) |
| Last Analysis | Read-only | Date of last analysis |

### organizations.csv

One row per organization binding group.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude |
| Target Organization | Read-only | SonarCloud organization key |
| Binding Group | Read-only | DevOps binding group identifier |
| ALM Platform | Read-only | DevOps platform |
| Projects Count | Read-only | Number of projects in this group |

### group-mappings.csv

One row per group.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude group |
| Group Name | Read-only | Group name |
| Description | Read-only | Group description |
| Members Count | Read-only | Number of members |
| Is Default | Read-only | Whether this is a default group |
| Target Organization | Read-only | Target SonarCloud organization |

### profile-mappings.csv

One row per quality profile.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude profile |
| Profile Name | Read-only | Quality profile name |
| Language | Read-only | Language (java, js, etc.) |
| Is Default | Read-only | Whether this is the default profile for its language |
| Is Built-In | Read-only | Whether this is a built-in profile |
| Parent | Read-only | Parent profile name (if inherited) |
| Active Rules | Read-only | Number of active rules |
| Target Organization | Read-only | Target SonarCloud organization |

### gate-mappings.csv

One row per quality gate. Conditions are always migrated as-is from SonarQube — they cannot be modified via the CSV.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude this gate from migration |
| Gate Name | Read-only | Quality gate name |
| Is Default | Read-only | Whether this is the default gate |
| Is Built-In | Read-only | Whether this is a built-in gate |
| Conditions Count | Read-only | Number of conditions on this gate |
| Target Organization | Read-only | Target SonarCloud organization |

**Example:**
```csv
Include,Gate Name,Is Default,Is Built-In,Conditions Count,Target Organization
yes,Sonar way,true,true,2,my-org
yes,Custom Gate,false,false,3,my-org
no,Old Gate,false,false,1,my-org
```

In this example, `Old Gate` is excluded from migration. `Sonar way` and `Custom Gate` will be migrated with all their original conditions intact.

### portfolio-mappings.csv (Parent/Child Pattern)

Uses a **parent/child row pattern**. Portfolio header rows have empty member fields; member rows have the project details.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Exclude entire portfolio (header row) or individual member |
| Portfolio Key | Read-only | Portfolio key |
| Portfolio Name | Read-only | Portfolio display name |
| Description | Read-only | *(header row only)* Portfolio description |
| Visibility | Read-only | *(header row only)* Portfolio visibility |
| Member Project Key | Read-only | *(member row)* Project key |
| Member Project Name | Read-only | *(member row)* Project name |
| Target Organization | Read-only | Target SonarCloud organization |

### template-mappings.csv (Parent/Child Pattern)

Uses a **parent/child row pattern**. Template header rows have empty permission fields; permission rows have the assignment details.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Exclude entire template (header row) or individual permission |
| Template Name | Read-only | Permission template name |
| Description | Read-only | *(header row only)* Template description |
| Key Pattern | Read-only | *(header row only)* Project key pattern regex |
| Permission Key | Read-only | *(permission row)* Permission key (e.g., `admin`, `codeviewer`) |
| Group Name | Read-only | *(permission row)* Group that has this permission |
| Target Organization | Read-only | Target SonarCloud organization |

### global-permissions.csv

One row per group+permission combination.

| Column | Editable | Description |
|--------|----------|-------------|
| Include | Yes | Set to `no` to exclude this permission assignment |
| Group Name | Read-only | Group name |
| Permission | Read-only | Permission key (e.g., `admin`, `scan`, `provisioning`) |

## Common Edit Scenarios

### Exclude a project from migration
In `projects.csv`, set `Include` to `no` for the project row.

### Exclude a quality gate
In `gate-mappings.csv`, set `Include` to `no` for the gate row. All its conditions will be excluded along with it.

### Exclude a group
In `group-mappings.csv`, set `Include` to `no` for the group row.

### Remove a specific permission from a template
In `template-mappings.csv`, set `Include` to `no` on the specific permission row (not the template header).

### Remove a project from a portfolio
In `portfolio-mappings.csv`, set `Include` to `no` on the specific member row (not the portfolio header).

## Notes

- CSVs are RFC 4180 compliant. Fields containing commas, quotes, or newlines are properly quoted.
- Running `--dry-run` again will regenerate fresh CSVs, overwriting any edits.
- If CSV references entities that no longer exist in SonarQube (e.g., a project was deleted between dry-run and full run), a warning is logged and the reference is skipped.
- Gate names, project keys, and group names are matched **case-sensitively**.
