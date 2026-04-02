# CloudVoyager - Pseudocode Explanation

This document describes each feature of the CloudVoyager migration tool in pseudocode.

---

## Table of Contents

1. [CLI Commands](#1-cli-commands)
2. [Transfer Pipeline (Single-Project)](#2-transfer-pipeline)
3. [Migration Pipeline (Multi-Organization)](#3-migration-pipeline)
4. [Metadata Sync](#4-metadata-sync)
5. [Verification Pipeline](#5-verification-pipeline)
6. [Data Extraction](#6-data-extraction)
7. [Protobuf Building & Encoding](#7-protobuf-building--encoding)
8. [Report Upload to SonarCloud](#8-report-upload-to-sonarcloud)
9. [External Issues & Plugin Migration](#9-external-issues--plugin-migration)
10. [Issue & Hotspot Metadata Sync](#10-issue--hotspot-metadata-sync)
11. [Quality Gates Migration](#11-quality-gates-migration)
12. [Quality Profiles Migration](#12-quality-profiles-migration)
13. [Permissions & Groups Migration](#13-permissions--groups-migration)
14. [Organization Mapping & CSV Generation](#14-organization-mapping--csv-generation)
15. [Version Router and Pipeline Selection](#15-version-router-and-pipeline-selection)
16. [State Management](#16-state-management)
17. [Configuration & Validation](#17-configuration--validation)
18. [Performance Tuning](#18-performance-tuning)
19. [Checkpoint Journal and Pause/Resume](#19-checkpoint-journal--pauseresume)

---

## 1. CLI Commands

```
COMMAND: validate
  INPUT: --config <path>
  STEPS:
    1. Load config file from disk
    2. Validate against JSON schema (Ajv)
    3. Verify required project keys exist
    4. Display config summary (URLs, project keys, transfer mode)

COMMAND: test
  INPUT: --config <path>, [--verbose]
  STEPS:
    1. Load config
    2. Detect SonarQube version via version-router (GET /api/system/status)
    3. Load the correct pipeline for the detected version (sq-9.9, sq-10.0, sq-10.4, or sq-2025)
    4. Create SonarQubeClient from the selected pipeline
    5. Create SonarCloud client
    6. Test SonarCloud connection (GET /api/organizations/search)
    7. Report success or failure for each

COMMAND: status
  INPUT: --config <path>
  STEPS:
    1. Load config
    2. Initialize StateTracker from state file
    3. Display:
       - Last sync timestamp
       - Number of processed issues
       - Completed branches list
       - Sync history (last 10 entries)

COMMAND: reset
  INPUT: --config <path>, [--yes]
  STEPS:
    1. Load config
    2. IF not --yes: show confirmation prompt and exit
    3. Initialize StateTracker
    4. Clear all state (lastSync, processedIssues, completedBranches, syncHistory)
    5. Persist reset state to disk

COMMAND: transfer
  → See "Transfer Pipeline" section

COMMAND: migrate
  → See "Migration Pipeline" section

COMMAND: sync-metadata
  → See "Metadata Sync" section

COMMAND: verify
  → See "Verification Pipeline" section
```

---

## 2. Transfer Pipeline

Transfers a single SonarQube project to SonarCloud.

```
FUNCTION transferProject(sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, wait):

  // --- Setup ---
  state = new StateTracker(transferConfig.stateFile)
  state.initialize()
  sqClient = new SonarQubeClient(sonarqubeConfig)  // version-specific client from selected pipeline
  scClient = new SonarCloudClient(sonarcloudConfig)

  // --- Checkpoint Setup ---
  lock = new LockFile(transferConfig.stateFile)
  lock.acquire()                    // prevents concurrent runs
  journal = new CheckpointJournal(stateFile + '.journal')
  journal.initialize({ sonarQubeVersion, sonarQubeUrl, projectKey })
  cache = new ExtractionCache(outputDir)
  shutdownCoordinator.register(() => { journal.markInterrupted(); lock.release() })

  // --- Connection Test ---
  sqClient.testConnection()
  scClient.testConnection()

  // --- Project Setup ---
  projectName = sqClient.getProject().name
  scClient.ensureProject(projectName)   // create in SC if not exists

  // --- Branch Configuration ---
  branches = sqClient.getBranches()
  mainBranch = branches.find(b => b.isMain)
  nonMainBranches = branches.filter(b => !b.isMain)
  APPLY excludeBranches filter
  APPLY includeBranches filter (from CSV if present)

  // --- Rule Enrichment (for SQ < 10.0) ---
  scProfiles = scClient.getQualityProfiles()
  scRepos = scClient.getRuleRepositories()
  IF sqVersion < 10.0:
    ruleEnrichmentMap = buildRuleEnrichmentMap(scClient, scProfiles)
    // Fetches Clean Code attributes from SC to enrich old SQ data

  // --- Extract & Transfer Main Branch (checkpoint-aware) ---
  extractedData = DataExtractor.extractAllWithCheckpoints(journal, cache, shutdownCheck)
  // Each phase: check journal (skip if completed, load from cache) → execute → cache → mark complete
  mainResult = transferBranch(extractedData, mainBranch, ...)

  IF wait:
    scClient.waitForAnalysis(mainResult.ceTask.id)

  // --- Extract & Transfer Non-Main Branches ---
  FOR EACH branch IN nonMainBranches:
    IF state.isBranchCompleted(branch.name): SKIP
    IF branch.name IN excludeBranches: SKIP

    branchData = DataExtractor.extractBranch(branch.name, extractedData)
    branchResult = transferBranch(branchData, branch, ...)
    state.markBranchCompleted(branch.name)

  // --- Record State ---
  state.recordTransfer(aggregatedStats)
  RETURN stats


FUNCTION transferBranch(extractedData, branch, scConfig, scProfiles, scRepos, ...):

  // Step 1: Build protobuf messages from extracted data
  builder = new ProtobufBuilder(extractedData, scConfig, scProfiles, options)
  messages = builder.buildAll()

  // Step 2: Encode messages to binary protobuf
  encoder = new ProtobufEncoder()
  encoder.loadSchemas()
  encodedReport = encoder.encodeAll(messages)

  // Step 3: Upload to SonarCloud
  uploader = new ReportUploader(scClient)
  ceTask = uploader.upload(encodedReport, metadata)

  RETURN { stats, ceTask }
```

---

<!-- <subsection-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->
## 3. Migration Pipeline

Migrates all projects across multiple SonarCloud organizations.

```
FUNCTION migrateAll(sonarqubeConfig, sonarcloudOrgs, migrateConfig, transferConfig, ...):

  // --- Output Directory Setup ---
  CREATE directories: /mappings, /state, /quality-profiles, /cache, /reports, /logs

  // --- Load Cache (from previous runs) ---
  TRY load existing mapping CSVs (from dry-run)
  TRY load server-wide data cache

  // --- Connect & Extract Server-Wide Data ---
  sqClient.testConnection()

  IF cache hit:
    REUSE cached data
  ELSE:
    allProjects       = extractAllProjects()
    qualityGates      = extractQualityGates()
    qualityProfiles   = extractQualityProfiles()
    groups            = extractGroups()
    permissions       = extractPermissions()
    permTemplates     = extractPermissionTemplates()
    portfolios        = extractPortfolios()
    projectBindings   = extractDevOpsBindings()
    projectSettings   = extractProjectSettings()
    SAVE to cache

  // --- Generate Organization Mappings ---
  orgAssignments = mapProjectsToOrganizations(allProjects, projectBindings, sonarcloudOrgs)
  generateMappingCsvs(orgAssignments, extractedData, mappingsDir)
  // Produces 9 CSVs: organizations.csv, projects.csv, group-mappings.csv,
  //   profile-mappings.csv, gate-mappings.csv, portfolio-mappings.csv,
  //   template-mappings.csv, global-permissions.csv, user-mappings.csv

  // --- Dry Run: Stop Here ---
  IF migrateConfig.dryRun:
    LOG "CSV files generated. Edit them and re-run without --dry-run."
    RETURN

  // --- Apply CSV Overrides (from user edits) ---
  IF csvFiles exist in mappingsDir:
    APPLY Include=no filters (skip excluded items)
    APPLY threshold edits, project key overrides, etc.

  // --- Migrate Each Organization ---
  FOR EACH assignment IN orgAssignments:
    org = assignment.org
    projects = assignment.projects

    migrateOneOrganization(org, projects, extractedData, ...)

  // --- Migrate Portfolios (Enterprise) ---
  IF enterpriseConfig exists:
    migrateEnterprisePortfolios(portfolios, projectKeyMap)   // parallelized via mapConcurrent (concurrency 5)

  // --- Generate Reports ---
  writeAllReports(results)   // JSON + parallel Promise.all for Markdown, TXT, PDF (migration-report, executive-summary, performance-report)
  RETURN results


FUNCTION migrateOneOrganization(org, projects, extractedData, ...):

  scClient = new SonarCloudClient(org)
  scClient.testConnection()

  // --- Org-Wide Resources ---
  // (groups, gates, profiles, templates, permissions all parallelized internally via mapConcurrent)
  migrateGroups(extractedData.groups, scClient)
  migrateGlobalPermissions(extractedData.permissions, scClient)        // flatMap + mapConcurrent (concurrency 10)
  gateMapping = migrateQualityGates(extractedData.qualityGates, scClient)  // mapConcurrent (concurrency 5)
  profileMapping = migrateQualityProfiles(extractedData.qualityProfiles, scClient) // chains: mapConcurrent across, sequential within (concurrency 5)
  migratePermissionTemplates(extractedData.permTemplates, scClient)    // mapConcurrent (concurrency 5)

  // --- Migrate Projects (3 phases per project) ---
  FOR EACH project IN projects:
    // Phase 1: Upload scanner report (same as transfer pipeline)
    transferProject(sqConfig, scConfig(project), transferConfig, ...)

    // Phase 1: Project config (all 8 steps run in PARALLEL via single Promise.all)
    IF NOT skipProjectConfig:
      PARALLEL:
        migrateProjectSettings(project, scClient)    // internally: mapConcurrent (concurrency 10)
        migrateProjectTags(project, scClient)
        migrateProjectLinks(project, scClient)
        migrateNewCodeDefinition(project, scClient)
        migrateDevOpsBinding(project, scClient)
        assignQualityGate(project, gateMapping, scClient)
        assignQualityProfiles(project, profileMapping, scClient)
        migrateProjectPermissions(project, scClient) // internally: flatMap + mapConcurrent (concurrency 10)

    // Phase 2: Metadata sync (issues + hotspots run in PARALLEL)
    PARALLEL:
      IF NOT skipIssueMetadataSync:
        syncIssues(project, sqIssues, scClient, sqClient)
      IF NOT skipHotspotMetadataSync:
        syncHotspots(project, sqHotspots, scClient)
```

---

## 4. Metadata Sync

Re-syncs issue and hotspot metadata for already-migrated projects.

```
COMMAND sync-metadata:
  INPUT: --config <path>, [skip flags]

  STEPS:
    1. Load migration config
    2. SET skipProjectConfig = true    // don't re-run project setup
    3. SET dryRun = false
    4. CALL migrateAll() with modified config
       // Only runs the issue/hotspot sync portions
    5. Report success/failure
```

---

## 5. Verification Pipeline

Compares SonarQube and SonarCloud data to verify migration completeness.

```
FUNCTION verifyAll(sonarqubeConfig, sonarcloudOrgs, outputDir, onlyComponents, ...):

  results = { orgResults: [], projectResults: [], summary: {} }

  // --- Connect ---
  sqClient.testConnection()
  allProjects = sqClient.getAllProjects()
  orgAssignments = mapProjectsToOrganizations(allProjects, ...)

  // --- Per-Organization Checks ---
  FOR EACH org IN orgAssignments:
    scClient = new SonarCloudClient(org)

    orgChecks = {
      qualityGates:       verifyQualityGates(sqClient, scClient),
      qualityProfiles:    verifyQualityProfiles(sqClient, scClient),
      groups:             verifyGroups(sqClient, scClient),
      globalPermissions:  verifyGlobalPermissions(sqClient, scClient),
      permissionTemplates: verifyPermissionTemplates(sqClient, scClient),
    }

    // --- Per-Project Checks ---
    FOR EACH project IN org.projects:
      scProjectKey = resolveProjectKey(project)

      projectChecks = {
        existence:        checkProjectExists(scClient, scProjectKey),
        branches:         verifyBranches(sqClient, scClient, project),
        issues:           verifyIssues(sqClient, scClient, project),
        hotspots:         verifyHotspots(sqClient, scClient, project),
        measures:         verifyMeasures(sqClient, scClient, project),
        qualityGate:      verifyProjectQualityGate(sqClient, scClient, project),
        qualityProfiles:  verifyProjectQualityProfiles(sqClient, scClient, project),
        settings:         verifyProjectSettings(sqClient, scClient, project),
        tags:             verifyProjectTags(sqClient, scClient, project),
        links:            verifyProjectLinks(sqClient, scClient, project),
        newCodePeriods:   verifyNewCodePeriods(sqClient, scClient, project),
        devOpsBinding:    verifyDevOpsBinding(sqClient, scClient, project),
        permissions:      verifyProjectPermissions(sqClient, scClient, project),
      }

      // Each check returns: { status: pass|fail|warning|skipped|error, message, details }

  // --- Portfolios ---
  IF enterpriseConfig:
    verifyPortfolios(...)

  // --- Summary ---
  summary = COUNT passes, failures, warnings, errors across all checks

  // --- Reports ---
  writeVerificationReport(results, outputDir)   // Markdown + PDF
  RETURN results
```

---

## 6. Data Extraction

Extracts all data from SonarQube for a single project.

```
FUNCTION DataExtractor.extractAll():

  // Step 1: Project metadata
  project = sqClient.getProject()
  branches = sqClient.getBranches()
  qualityGate = sqClient.getQualityGate()

  // Step 2: Metric definitions
  metrics = sqClient.getMetrics()
  metricKeys = filterToCommonMetrics(metrics)

  // Step 3: Component tree with measures
  components = sqClient.getComponentTree(metricKeys)

  // Step 3b: Source file list (for language detection)
  sourceFilesList = sqClient.getSourceFiles()

  // Step 4: Active rules (filtered by detected languages)
  languages = UNIQUE(sourceFilesList.map(f => f.language))
  profiles = sqClient.getAllQualityProfiles()
  activeRules = []
  FOR EACH profile matching project languages:
    rules = sqClient.getActiveRules(profile.key)
    activeRules.APPEND(rules)
  DEDUPLICATE activeRules by repo:key

  // Step 5: Issues (date-window slicing for >10K projects)
  // Build 12 equal-width date windows from epoch to now
  // Fetch all 12 windows in parallel via mapConcurrent (concurrency configurable, default 6, max 12)
  // Each window bisects if it still exceeds 10K results
  issues = sqClient.getIssuesWithSlicing({ branch, createdAfter: state.lastSync })
  // Includes: key, rule, severity, status, message, textRange, flows,
  //           effort, author, tags, type, cleanCodeAttribute, impacts

  // Step 5b: Security hotspots (converted to issue format)
  hotspots = extractHotspotsAsIssues(sqClient)
  issues.APPEND(hotspots)

  // Step 6: Project-level measures
  measures = sqClient.getMeasures(projectKey, metricKeys)

  // Step 7: Source code content
  sources = []
  FOR EACH file IN sourceFilesList (with concurrency limit):
    content = sqClient.getSourceCode(file.key)
    sources.PUSH({ key: file.key, content, language: file.language })

  // Step 7b: Code duplications
  duplications = extractDuplications(sqClient, components)

  // Step 8: SCM blame data (changesets)
  changesets = extractChangesets(sqClient, sourceFilesList, components)

  // Step 9: Symbol references
  symbols = extractSymbols(sqClient, sourceFilesList)

  // Step 10: Syntax highlighting
  syntaxHighlightings = extractSyntaxHighlighting(sqClient, sourceFilesList)

  RETURN {
    project, metrics, issues, measures, components, sources,
    activeRules, duplications, changesets, symbols, syntaxHighlightings,
    metadata: { extractedAt, mode, scmRevisionId }
  }


FUNCTION DataExtractor.extractBranch(branchName, mainData):
  // Same shape as extractAll(), but:
  // - Reuses metric definitions from mainData
  // - Passes branch parameter to all API calls
  // - Returns branch-specific data
```

---

## 7. Protobuf Building & Encoding

Transforms extracted data into SonarCloud's scanner report protobuf format.

```
CLASS ProtobufBuilder:

  FUNCTION buildAll():
    metadata   = buildMetadata()
    components = buildComponents()
    { externalIssuesByComponent, adHocRules } = buildExternalIssues()
    issuesByComponent       = buildIssues()
    measuresByComponent     = buildMeasures()
    sourceFiles             = buildSourceFiles()
    activeRules             = buildActiveRules()
    changesetsByComponent   = buildChangesets()
    duplicationsByComponent = buildDuplications()

    RETURN all messages


  FUNCTION buildMetadata():
    RETURN {
      analysisDate:       current timestamp,
      organizationKey:    SC org key,
      projectKey:         SC project key,
      rootComponentRef:   1 (project component),
      branchName:         branch name,
      branchType:         LONG,
      referenceBranchName: main branch name,
      scmRevisionId:      commit hash (or generated fake),
      qprofilesPerLanguage: { lang -> { key, name, rulesUpdatedAt } },
      analyzedIndexedFileCountPerType: { lang -> file count },
    }


  FUNCTION buildComponents():
    components = []

    // Project component (ref=1)
    projectComponent = {
      ref: 1, type: PROJECT, key: projectKey, name: projectName
    }

    // File components
    FOR EACH source file with content:
      ref = nextRef++
      componentRefMap.SET(file.key, ref)
      component = {
        ref, type: FILE, key: file.key, name: file.path,
        language: sanitizeLanguage(file.language),
        lines: lineCount, status: ADDED
      }
      components.PUSH(component)

    projectComponent.childRef = components.map(c => c.ref)
    RETURN [projectComponent, ...components]


  FUNCTION buildIssues():
    issuesByComponent = new Map()

    FOR EACH issue WHERE NOT isExternalIssue(issue):
      IF component has no source code: SKIP

      componentRef = componentRefMap.GET(issue.component)
      protoIssue = {
        ruleRepository: extractRepo(issue.rule),
        ruleKey: extractKey(issue.rule),
        msg: issue.message,
        overriddenSeverity: mapSeverity(issue.severity),
        textRange: issue.textRange,  // startLine, endLine, startOffset, endOffset
        flow: issue.flows,           // list of locations
      }
      issuesByComponent.GET_OR_CREATE(componentRef).PUSH(protoIssue)

    RETURN issuesByComponent


  FUNCTION buildMeasures():
    measuresByComponent = new Map()

    FOR EACH component WHERE type == FILE:
      measures = []
      FOR EACH measure on component:
        protoMeasure = {
          metricKey: measure.metric
        }
        IF measure is string:  protoMeasure.stringValue = value
        IF measure is boolean: protoMeasure.booleanValue = value
        IF measure is int:     protoMeasure.intValue = value
        IF measure is long:    protoMeasure.longValue = value
        IF measure is float:   protoMeasure.doubleValue = value
        measures.PUSH(protoMeasure)

      measuresByComponent.SET(componentRef, measures)

    RETURN measuresByComponent


  FUNCTION buildActiveRules():
    rules = []

    FOR EACH activeRule WHERE NOT isExternalRule(rule):
      protoRule = {
        ruleRepository: rule.repo,
        ruleKey: rule.key,
        severity: mapSeverity(rule.severity),
        paramsByKey: rule.params,
        qProfileKey: resolveProfileKey(rule),
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }

      // Resolve impacts (SQ 10.0+ has native, SQ 9.9 uses enrichment map)
      IF rule.impacts:
        protoRule.impacts = rule.impacts
      ELSE IF ruleEnrichmentMap.HAS(rule.repo + ":" + rule.key):
        protoRule.impacts = ruleEnrichmentMap.GET(...).impacts

      rules.PUSH(protoRule)

    RETURN rules


CLASS ProtobufEncoder:

  FUNCTION loadSchemas():
    root = protobuf.load("constants.proto", "scanner-report.proto")

  FUNCTION encodeAll(messages):
    RETURN {
      metadata:      encode("ScannerReport.Metadata", messages.metadata),
      components:    messages.components.map(c => encode("ScannerReport.Component", c)),
      issues:        FOR EACH ref: concatenate length-delimited Issue messages,
      measures:      FOR EACH ref: concatenate length-delimited Measure messages,
      sourceFilesText: FOR EACH ref: join lines with newlines (plain UTF-8),
      activeRules:   concatenate length-delimited ActiveRule messages,
      changesets:    FOR EACH ref: encode Changesets message,
      externalIssues: FOR EACH ref: concatenate length-delimited ExternalIssue messages,
      adHocRules:    concatenate length-delimited AdHocRule messages,
      duplications:  FOR EACH ref: concatenate length-delimited Duplication messages,
    }
```

---

## 8. Report Upload to SonarCloud

Packages the encoded protobuf report and submits it to SonarCloud's Compute Engine.

```
CLASS ReportUploader:

  FUNCTION upload(encodedReport, metadata):

    // Step 1: Package into zip archive
    zip = new AdmZip()
    zip.addFile("metadata.pb",                encodedReport.metadata)
    FOR EACH component:
      zip.addFile("component-{ref}.pb",       encodedReport.components[i])
    FOR EACH (ref, buffer) IN encodedReport.issues:
      zip.addFile("issues-{ref}.pb",          buffer)
    FOR EACH (ref, buffer) IN encodedReport.measures:
      zip.addFile("measures-{ref}.pb",        buffer)
    FOR EACH source IN encodedReport.sourceFilesText:
      zip.addFile("source-{ref}.txt",         source.text)
    zip.addFile("activerules.pb",             encodedReport.activeRules)
    FOR EACH (ref, buffer) IN encodedReport.changesets:
      zip.addFile("changesets-{ref}.pb",      buffer)
    FOR EACH (ref, buffer) IN encodedReport.externalIssues:
      zip.addFile("external-issues-{ref}.pb", buffer)
    zip.addFile("adhocrules.pb",              encodedReport.adHocRules)
    FOR EACH (ref, buffer) IN encodedReport.duplications:
      zip.addFile("duplications-{ref}.pb",    buffer)
    zip.addFile("context-props.pb",           empty)

    zipBuffer = zip.toBuffer()

    // Step 2: Submit to Compute Engine
    ceTask = submitToComputeEngine(zipBuffer, metadata)
    RETURN ceTask


  FUNCTION submitToComputeEngine(reportData, metadata):
    MAX_ATTEMPTS = 2

    FOR attempt = 1 TO MAX_ATTEMPTS:
      formData = new FormData()
      formData.append("report", reportData)
      formData.append("projectKey", metadata.projectKey)
      formData.append("organization", metadata.organization)
      IF NOT mainBranch:
        formData.append("characteristic", "branch=" + branchName)
        formData.append("characteristic", "branchType=LONG")

      TRY:
        response = POST /api/ce/submit (formData, timeout=60s)
        RETURN response.task    // { id: ceTaskId }
      CATCH timeout:
        // Response timed out — check if task was created anyway
        task = _findTaskFromActivity(uploadStartTime)
        IF task: RETURN task
        IF last attempt: THROW error
        // Otherwise retry


  FUNCTION uploadAndWait(encodedReport, metadata):
    ceTask = upload(encodedReport, metadata)
    finalTask = scClient.waitForAnalysis(ceTask.id)
    RETURN finalTask
```

---

## 9. External Issues & Plugin Migration

Automatically detects issues from unsupported rule repositories (e.g., MuleSoft) and migrates them as external issues.

```
FUNCTION isExternalIssue(issue, sonarCloudRepos):
  repo = issue.rule.split(":")[0]
  RETURN NOT sonarCloudRepos.HAS(repo)


FUNCTION buildExternalIssues():
  externalIssuesByComponent = new Map()
  adHocRules = []
  seenRules = new Set()

  FOR EACH issue IN extractedData.issues:
    repo = issue.rule.split(":")[0]
    IF sonarCloudRepos.HAS(repo): CONTINUE    // native issue, skip
    IF component has no source code: CONTINUE

    engineId = repo         // e.g., "mulesoft"
    ruleId = issue.rule.split(":")[1]   // e.g., "MS058"

    // --- Resolve Clean Code Attribute ---
    //   CRITICAL: Must be a protobuf enum (varint int), NOT a string!
    //   SonarCloud CE silently ignores external issues if string-encoded.
    IF issue.cleanCodeAttribute:
      cleanCodeAttr = mapCleanCodeAttribute(issue.cleanCodeAttribute)
      // Maps: "CONVENTIONAL"->1, "FORMATTED"->2, ... "TRUSTWORTHY"->14
    ELSE IF ruleEnrichmentMap.HAS(engineId + ":" + ruleId):
      cleanCodeAttr = ruleEnrichmentMap.GET(...).cleanCodeAttribute
    ELSE:
      cleanCodeAttr = defaultCleanCodeAttribute(issue.type)
      // CODE_SMELL->1(CONVENTIONAL), BUG->7(LOGICAL), VULNERABILITY->14(TRUSTWORTHY)

    // --- Resolve Impacts ---
    IF issue.impacts:
      impacts = issue.impacts.map(i => { softwareQuality, severity })
    ELSE IF ruleEnrichmentMap.HAS(...):
      impacts = ruleEnrichmentMap.GET(...).impacts
    ELSE:
      impacts = deriveFromTypeAndSeverity(issue.type, issue.severity)

    // --- Create ExternalIssue Message ---
    externalIssue = {
      engineId, ruleId,
      msg: issue.message,
      severity: mapSeverity(issue.severity),
      effort: parseEffort(issue.effort),    // "30min" -> 30, "1h30min" -> 90
      type: mapIssueType(issue.type),
      cleanCodeAttribute: cleanCodeAttr,    // enum int (1-14)
      impacts: impacts,
      textRange: issue.textRange,
      flow: issue.flows,
    }
    externalIssuesByComponent.GET_OR_CREATE(componentRef).PUSH(externalIssue)

    // --- Create AdHocRule (once per unique rule) ---
    ruleKey = engineId + ":" + ruleId
    IF NOT seenRules.HAS(ruleKey):
      seenRules.ADD(ruleKey)
      adHocRules.PUSH({
        engineId, ruleId,
        name: issue.rule,
        description: issue.message,
        type: mapIssueType(issue.type),
        cleanCodeAttribute: cleanCodeAttr,
        defaultImpacts: impacts,
      })

  RETURN { externalIssuesByComponent, adHocRules }


FUNCTION buildRuleEnrichmentMap(scClient, scProfiles):
  // For SQ < 10.0: fetch Clean Code taxonomy from SonarCloud
  enrichmentMap = new Map()

  FOR EACH profile IN scProfiles:
    rules = scClient.getActiveRules(profile.key)
    FOR EACH rule:
      enrichmentMap.SET(rule.repo + ":" + rule.key, {
        cleanCodeAttribute: rule.cleanCodeAttribute,
        impacts: rule.impacts,
      })

  RETURN enrichmentMap
```

---

## 10. Issue & Hotspot Metadata Sync

Syncs issue/hotspot statuses, assignments, comments, and tags from SonarQube to SonarCloud after scanner report upload.

```
FUNCTION syncIssues(projectKey, sqIssues, scClient, options):

  // Step 1: Fetch all SC issues for matching
  scIssues = scClient.searchIssues(projectKey)

  // Step 2: Build match key lookup
  scIssueMap = new Map()
  FOR EACH scIssue:
    matchKey = scIssue.rule + "|" + extractFilePath(scIssue.component) + "|" + scIssue.line
    scIssueMap.SET(matchKey, scIssue)

  // Step 3: Match SQ issues to SC issues
  matchedPairs = []
  FOR EACH sqIssue:
    matchKey = sqIssue.rule + "|" + extractFilePath(sqIssue.component) + "|" + sqIssue.line
    scIssue = scIssueMap.GET(matchKey)
    IF scIssue:
      matchedPairs.PUSH({ sq: sqIssue, sc: scIssue })

  // Step 4: Sync metadata for each matched pair (with concurrency limit)
  FOR EACH { sq, sc } IN matchedPairs (CONCURRENT):

    // 4a. Replay status transitions from changelog
    IF sqClient available:
      changelog = sqClient.getIssueChangelog(sq.key)
      FOR EACH statusChange IN changelog:
        transition = mapChangelogDiffToTransition(statusChange.diffs)
        // Maps: WONTFIX->'wontfix', FALSE-POSITIVE->'falsepositive',
        //       CONFIRMED->'confirm', REOPENED->'reopen', ACCEPTED->'accept', etc.
        IF transition:
          scClient.transitionIssue(sc.key, transition)

    // 4b. Sync assignment
    IF sq.assignee AND sq.assignee != sc.assignee:
      scClient.assignIssue(sc.key, sq.assignee)

    // 4c. Sync comments
    FOR EACH comment IN sq.comments:
      scClient.addIssueComment(sc.key, formatComment(comment))

    // 4d. Sync tags
    IF sq.tags NOT EMPTY:
      scClient.setIssueTags(sc.key, sq.tags)

    // 4e. Mark as metadata-synchronized
    scClient.setIssueTags(sc.key, [...existing, "metadata-synchronized"])

    // 4f. Add source link back to SonarQube
    scClient.addIssueComment(sc.key, "SonarQube Source: {sonarqubeUrl}/issues?id=...")

  RETURN { matched, transitioned, assigned, commented, tagged, failed }


FUNCTION syncHotspots(projectKey, sqHotspots, scClient, options):

  // Step 1: Fetch all SC hotspots
  scHotspots = scClient.getHotspots(projectKey)

  // Step 2: Match (rule + component + line)
  matchedPairs = matchByKey(sqHotspots, scHotspots)

  // Step 3: Sync each matched hotspot
  FOR EACH { sq, sc } IN matchedPairs (CONCURRENT):

    // Status sync
    IF sq.status != sc.status:
      scClient.changeHotspotStatus(sc.key, mapStatus(sq.status), mapResolution(sq.resolution))

    // Comments sync
    FOR EACH comment IN sq.comments:
      scClient.addHotspotComment(sc.key, formatComment(comment))

    // Source link
    scClient.addHotspotComment(sc.key, "SonarQube Source: {url}")

  RETURN { matched, statusChanged, commentAdded, failed }
```

---

<!-- <subsection-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->
## 11. Quality Gates Migration

```
FUNCTION migrateQualityGates(extractedGates, scClient):
  gateMapping = new Map()    // gateName -> gateId

  // --- Extract gate details in parallel ---
  gateDetails = mapConcurrent(extractedGates, gate => {
    conditions = scClient.getQualityGateConditions(gate.id)
    permissions = scClient.getQualityGatePermissions(gate.id)
    RETURN { gate, conditions, permissions }
  }, { concurrency: 5 })

  // --- Create gates in parallel ---
  mapConcurrent(gateDetails, ({ gate, conditions, permissions }) => {
    IF gate.isBuiltIn: SKIP    // SC has its own built-in gates

    // Create gate
    { id } = scClient.createQualityGate(gate.name)

    // Create conditions
    FOR EACH condition IN conditions:
      scClient.createQualityGateCondition(id, condition.metric, condition.op, condition.error)

    // Set as default
    IF gate.isDefault:
      scClient.setDefaultQualityGate(id)

    // Set permissions
    FOR EACH group IN permissions WHERE group.selected:
      scClient.addGroupPermission(group.name, "gateadmin")

    gateMapping.SET(gate.name, id)
  }, { concurrency: 5 })

  RETURN gateMapping


FUNCTION assignQualityGatesToProjects(gateMapping, projectAssignments, scClient):
  // Filter to assignments with valid gate mappings, then assign in parallel
  validAssignments = projectAssignments.filter(({ gateName }) => gateMapping.HAS(gateName))
  mapConcurrent(validAssignments, ({ projectKey, gateName }) => {
    gateId = gateMapping.GET(gateName)
    scClient.assignQualityGateToProject(gateId, projectKey)
  }, { concurrency: 10 })
```

---

## 12. Quality Profiles Migration

```
// Quality profile diff markdown rendering (src/shared/reports/format-rules-comparison/helpers/format-profile-section.js):
FUNCTION formatProfileSection(langKey, diff):
  lines = [header with profile names and rule counts]
  IF diff.missingRules not empty:
    lines.APPEND section "Rules missing from SonarCloud" with markdown table (key, name, type, severity)
  IF diff.addedRules not empty:
    lines.APPEND section "Rules added in SonarCloud" with markdown table
  IF both empty:
    lines.APPEND "Profiles are identical"
  RETURN lines joined with newline

// Quality profile rules comparison report rendering (src/shared/reports/format-rules-comparison/index.js):
// <!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
FUNCTION formatRulesComparisonReport(rulesComparisonData):
  // rulesComparisonData: { [langKey]: { sqProfileName, scProfileName, missingRules: [], addedRules: [] } }
  lines = ["# Quality Profile Rules Comparison Report", ""]
  FOR EACH langKey IN rulesComparisonData:
    diff = rulesComparisonData[langKey]
    section = formatProfileSection(langKey, diff)
    lines.APPEND(section)
    lines.APPEND("")
  RETURN lines joined with newline

FUNCTION migrateQualityProfiles(extractedProfiles, scClient):
  profileMapping = new Map()
  builtInProfileMapping = new Map()

  // --- Separate custom and built-in ---
  customProfiles = profiles.filter(p => NOT p.isBuiltIn)
  builtInProfiles = profiles.filter(p => p.isBuiltIn)

  // --- Restore custom profiles (respecting inheritance order) ---
  chains = buildInheritanceChains(customProfiles)
  // chains = [[parent, child, grandchild], ...]
  // Restore parents before children
  // Chains parallelized across (concurrency 5), sequential within each chain

  mapConcurrent(chains, chain => {
    FOR EACH profile IN chain:       // sequential within chain (parent before child)
      scClient.restoreQualityProfile(profile.backupXml)
      profileMapping.SET(profile.name, profile)
  }, { concurrency: 5 })

  // --- Restore built-in profiles as custom (with renamed suffix) ---
  FOR EACH profile IN builtInProfiles:
    renamedXml = modifyBackupXml(profile.backupXml, {
      name: profile.name + " (SonarQube Migrated)"
    })
    scClient.restoreQualityProfile(renamedXml)
    builtInProfileMapping.SET(profile.language, profile.name + " (SonarQube Migrated)")

  // --- Set defaults ---
  FOR EACH profile IN customProfiles WHERE profile.isDefault:
    scClient.setDefaultQualityProfile(profile.language, profile.name)

  // --- Set permissions ---
  FOR EACH profile IN customProfiles:
    FOR EACH group IN profile.permissions.groups WHERE group.selected:
      scClient.addQualityProfileGroupPermission(profile.name, profile.language, group.name)
    FOR EACH user IN profile.permissions.users WHERE user.selected:
      scClient.addQualityProfileUserPermission(profile.name, profile.language, user.login)

  RETURN { profileMapping, builtInProfileMapping }


FUNCTION buildInheritanceChains(profiles):
  parentMap = new Map()    // profileKey -> profile
  chains = []

  FOR EACH profile:
    chain = [profile]
    current = profile
    WHILE current.parentKey:
      parent = parentMap.GET(current.parentKey)
      chain.UNSHIFT(parent)    // parent first
      current = parent
    IF chain.length > 1:
      chains.PUSH(chain)

  RETURN chains
```

---

---

## 12b. Project Issues Delta Report (sq-2025 only)

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->

Gathers a per-project, per-rule breakdown of issue count differences between SonarQube and SonarCloud post-migration, then renders a Markdown report.

```
// --- Data gathering layer (src/pipelines/sq-2025/sonarcloud/reports/issues-delta/) ---

FUNCTION diffProjectIssues(sqIssues, scIssues):
  // sqIssues / scIssues: array of { rule, component, line, status, ... }
  sqKeys = SET(sqIssues.map(i => i.rule + "|" + i.component + "|" + i.line))
  scKeys = SET(scIssues.map(i => i.rule + "|" + i.component + "|" + i.line))

  disappeared = sqIssues.filter(i => NOT scKeys.HAS(matchKey(i)))
  appeared    = scIssues.filter(i => NOT sqKeys.HAS(matchKey(i)))
  RETURN { disappeared, appeared }


FUNCTION buildRuleBreakdown(disappeared, appeared):
  // Groups issue lists by rule key, counting disappeared and appeared per rule
  breakdown = {}                         // { ruleKey -> { disappeared: n, appeared: n } }
  FOR EACH issue IN disappeared:
    breakdown[issue.rule].disappeared += 1
  FOR EACH issue IN appeared:
    breakdown[issue.rule].appeared += 1
  RETURN breakdown


FUNCTION gatherProjectDelta(sqClient, scClient, sqProjectKey, scProjectKey):
  sqIssues = sqClient.searchIssues(sqProjectKey)
  scIssues = scClient.searchIssues(scProjectKey)
  { disappeared, appeared } = diffProjectIssues(sqIssues, scIssues)
  ruleBreakdown = buildRuleBreakdown(disappeared, appeared)
  RETURN {
    sqProjectKey,
    scProjectKey,
    totalDisappeared: disappeared.length,
    totalAppeared:    appeared.length,
    ruleBreakdown
  }


FUNCTION gatherAllDelta(sqClient, scClient, projectKeyMap):
  // projectKeyMap: { sqKey -> scKey } for all migrated projects
  deltas = []
  FOR EACH [sqKey, scKey] IN projectKeyMap:
    delta = gatherProjectDelta(sqClient, scClient, sqKey, scKey)
    deltas.PUSH(delta)
  RETURN deltas


// --- Pipeline integration (sq-2025 migrate pipeline) ---

FUNCTION gatherIssuesDelta(ctx):
  // ctx.projectKeyMap populated by run-org-migrations.js
  // ctx.sqClient, ctx.scClient available from pipeline context
  deltas = gatherAllDelta(ctx.sqClient, ctx.scClient, ctx.projectKeyMap)
  ctx.results.issuesDeltaData = deltas
  RETURN deltas


// --- Markdown rendering (src/shared/reports/format-issues-delta/index.js) ---

FUNCTION formatIssuesDeltaReport(issuesDeltaData):
  lines = ["# Project Issues Delta Report", ""]
  FOR EACH delta IN issuesDeltaData:
    lines.APPEND("## " + delta.sqProjectKey)
    lines.APPEND("- Disappeared: " + delta.totalDisappeared)
    lines.APPEND("- Appeared:    " + delta.totalAppeared)
    IF delta.ruleBreakdown not empty:
      lines.APPEND("| Rule | Disappeared | Appeared |")
      lines.APPEND("|------|-------------|----------|")
      FOR EACH [ruleKey, counts] IN delta.ruleBreakdown:
        lines.APPEND("| " + ruleKey + " | " + counts.disappeared + " | " + counts.appeared + " |")
    lines.APPEND("")
  RETURN lines joined with newline
```

---

<!-- <subsection-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->
## 13. Permissions & Groups Migration

```
FUNCTION migrateGroups(extractedGroups, scClient):
  FOR EACH group IN extractedGroups:
    TRY:
      scClient.createGroup(group.name, group.description)
    CATCH already exists:
      LOG "Group already exists, skipping"


FUNCTION migrateGlobalPermissions(extractedPermissions, scClient):
  // Flatten N permissions × M groups/users into a single batch, then run in parallel
  allGrants = extractedPermissions.global.flatMap(permission => [
    ...permission.groups.map(g => ({ type: 'group', name: g.name, key: permission.key })),
    ...permission.users.map(u => ({ type: 'user', login: u.login, key: permission.key }))
  ])
  mapConcurrent(allGrants, grant => {
    IF grant.type == 'group':
      scClient.addGroupPermission(grant.name, grant.key)
    ELSE:
      scClient.addUserPermission(grant.login, grant.key)
  }, { concurrency: 10 })


FUNCTION migratePermissionTemplates(extractedTemplates, scClient):
  mapConcurrent(extractedTemplates, template => {
    scClient.createPermissionTemplate(template.name, template.description, template.projectKeyPattern)

    FOR EACH permission IN template.permissions:
      FOR EACH group IN permission.groups:
        scClient.addGroupToTemplate(template.name, group.name, permission.key)
      FOR EACH user IN permission.users:
        scClient.addUserToTemplate(template.name, user.login, permission.key)
  }, { concurrency: 5 })


FUNCTION migrateProjectPermissions(project, scClient):
  // Flatten N permissions × M groups/users into a single batch, then run in parallel
  allGrants = project.permissions.flatMap(permission => [
    ...permission.groups.map(g => ({ type: 'group', name: g.name, key: permission.key })),
    ...permission.users.map(u => ({ type: 'user', login: u.login, key: permission.key }))
  ])
  mapConcurrent(allGrants, grant => {
    IF grant.type == 'group':
      scClient.addProjectGroupPermission(project.key, grant.name, grant.key)
    ELSE:
      scClient.addProjectUserPermission(project.key, grant.login, grant.key)
  }, { concurrency: 10 })
```

---

## 14. Organization Mapping & CSV Generation

Maps SonarQube projects to SonarCloud organizations and generates editable CSV files.

```
FUNCTION mapProjectsToOrganizations(allProjects, projectBindings, sonarcloudOrgs):
  orgAssignments = []

  FOR EACH org IN sonarcloudOrgs:
    orgAssignments.PUSH({ org, projects: [] })

  FOR EACH project IN allProjects:
    binding = projectBindings.GET(project.key)

    IF binding:
      // Use DevOps binding (ALM + slug) to determine org
      targetOrg = resolveOrgFromBinding(binding, sonarcloudOrgs)
    ELSE:
      // Default to first SC org
      targetOrg = sonarcloudOrgs[0]

    assignment = orgAssignments.FIND(a => a.org.key == targetOrg.key)
    assignment.projects.PUSH(project)

  RETURN orgAssignments


FUNCTION generateMappingCsvs(orgAssignments, extractedData, mappingsDir):

  // 9 CSV files generated:

  // 1. organizations.csv
  //   Organization key, name, target URL

  // 2. projects.csv
  //   Include | SonarQubeKey | SonarCloudKey | Organization | Branches
  //   yes     | my-project   | my-project    | my-org       | main,develop

  // 3. group-mappings.csv
  //   Include | GroupName | MemberCount

  // 4. profile-mappings.csv
  //   Include | Language | ProfileName | IsDefault | ParentProfile

  // 5. gate-mappings.csv
  //   Include | QualityGateName | Condition | Metric | Threshold | Operator | Groups

  // 6. portfolio-mappings.csv
  //   Include | PortfolioKey | Name | ProjectCount | Projects

  // 7. template-mappings.csv
  //   Include | TemplateName | Description | ProjectKeyPattern | Permissions

  // 8. global-permissions.csv
  //   Include | Type | Name | Permission | GroupOrUser

  // 9. user-mappings.csv
  //   Include | SonarQubeLogin | SonarCloudLogin
  //   (User edits SonarCloudLogin to map logins between SQ and SC)

  WRITE all CSV files to mappingsDir
  // User reviews/edits, then re-runs without --dry-run


FUNCTION applyCsvOverrides(csvData, extractedData, resourceMappings, orgAssignments):
  // For each CSV:
  //   - Filter rows where Include == "no"
  //   - Apply edits (threshold changes, key overrides, etc.)
  //   - Return filtered versions of all data objects
  RETURN { filteredData, filteredMappings, filteredAssignments }
```

---

## 15. Version Router and Pipeline Selection

Detects SonarQube version at runtime and loads the correct version-specific pipeline.

```
FUNCTION detectAndRoute(sonarqubeConfig):
  // Step 1: Detect server version
  response = GET /api/system/status
  version = response.version    // e.g., "9.9.1", "10.4.0", "2025.1"

  // Step 2: Map version to pipeline
  pipelineId = resolvePipelineId(version):
    IF version >= 2025.1: RETURN "sq-2025"
    IF version >= 10.4:   RETURN "sq-10.4"
    IF version >= 10.0:   RETURN "sq-10.0"
    IF version >= 9.9:    RETURN "sq-9.9"

  // Step 3: Dynamically import the correct pipeline
  transferModule = IMPORT(`src/pipelines/${pipelineId}/transfer-pipeline.js`)
  migrateModule  = IMPORT(`src/pipelines/${pipelineId}/migrate-pipeline.js`)

  RETURN { pipelineId, transferProject, migrateAll }


// Each pipeline has its own SonarQubeClient with version-specific behavior hardcoded:
//   sq-9.9:  uses "statuses" param, batches metricKeys at 15, enriches Clean Code from SC
//   sq-10.0: uses "statuses" param, batches metricKeys at 15, native Clean Code
//   sq-10.4: uses "issueStatuses" param, batches metricKeys at 15, native Clean Code
//   sq-2025: uses "issueStatuses" param, no metricKeys batching, Web API V2 fallbacks
//
// No runtime version checks within any pipeline — all differences resolved by pipeline selection.
```

---

## 16. State Management

Tracks migration progress for incremental transfers.

```
CLASS StateTracker:
  STATE SHAPE:
    {
      lastSync: "2026-02-15T00:00:00Z" | null,
      processedIssues: ["issue-key-1", "issue-key-2", ...],
      completedBranches: ["main", "develop", ...],
      syncHistory: [
        { timestamp, success: true, stats: {...} },
        ...   // last 10 entries
      ]
    }

  FUNCTION initialize(lockFile):
    state = storage.load() OR defaultState
    IF lockFile:
      lock = lockFile
      lock.acquire()    // ensures single-instance access

  FUNCTION recordTransfer(stats):
    state.lastSync = now()
    state.syncHistory.PUSH({ timestamp: now(), success: true, stats })
    IF syncHistory.length > 10: TRIM to last 10
    storage.save(state)

  FUNCTION saveAfterBranch(branchName, stats):
    state.completedBranches.ADD(branchName)
    state.lastSync = now()
    storage.save(state)    // persist immediately after each branch

  FUNCTION reset():
    state = defaultState
    storage.clear()

  // Query methods:
  getLastSync()              -> state.lastSync
  isIssueProcessed(key)      -> key IN state.processedIssues
  isBranchCompleted(name)    -> name IN state.completedBranches

  // Mutation methods:
  markIssueProcessed(key)    -> ADD key to processedIssues
  markBranchCompleted(name)  -> ADD name to completedBranches
  updateLastSync(timestamp)  -> SET lastSync
```

---

## 17. Configuration & Validation

```
FUNCTION loadConfig(configPath):

  // Step 1: Read and parse JSON
  rawConfig = readFile(configPath)
  config = JSON.parse(rawConfig)

  // Step 2: Apply environment variable overrides
  IF process.env.SONARQUBE_TOKEN:  config.sonarqube.token = env value
  IF process.env.SONARCLOUD_TOKEN: config.sonarcloud.token = env value
  IF process.env.SONARQUBE_URL:    config.sonarqube.url = env value
  IF process.env.SONARCLOUD_URL:   config.sonarcloud.url = env value

  // Step 3: Validate against JSON schema (Ajv)
  valid = ajv.validate(configSchema, config)
  IF NOT valid: THROW ConfigurationError(ajv.errors)

  // Step 4: Apply defaults
  config.transfer.mode      = config.transfer.mode      OR "incremental"
  config.transfer.stateFile = config.transfer.stateFile  OR "./.cloudvoyager-state.json"
  config.transfer.batchSize = config.transfer.batchSize  OR 100

  RETURN config


CONFIG SCHEMA:
  sonarqube:    (required)
    url:          string (URI format)
    token:        string (min 1 char)
    projectKey:   string (optional for migrate command)

  sonarcloud:   (required)
    url:          string (default: https://sonarcloud.io)
    token:        string (min 1 char)
    organization: string (required)
    projectKey:   string (optional for migrate command)

  transfer:     (optional)
    mode:             "full" | "incremental" (default: incremental)
    stateFile:        string (default: ./.cloudvoyager-state.json)
    batchSize:        integer 1-500 (default: 100)
    syncAllBranches:  boolean (default: true)
    excludeBranches:  string[] (default: [])

  migrate:      (optional)
    outputDir:                string (default: ./migration-output)
    skipIssueMetadataSync:    boolean
    skipHotspotMetadataSync:  boolean
    skipQualityProfileSync:   boolean
    dryRun:                   boolean

  rateLimit:    (optional)
    maxRetries:           integer
    baseDelay:            integer (ms)
    minRequestInterval:   integer (ms)

  performance:  (optional)
    maxConcurrency:                   integer
    sourceExtraction.concurrency:     integer
    hotspotExtraction.concurrency:    integer
    issueSync.concurrency:            integer
    hotspotSync.concurrency:          integer
    projectMigration.concurrency:     integer
    dateWindowSlicing.concurrency:    integer (default: 6, max: 12)
    permissionSync.concurrency:       integer (default: 10, max: 50)
    settingsSync.concurrency:         integer (default: 10, max: 50)
```

---

<!-- <subsection-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->
## 18. Performance Tuning

```
PERFORMANCE FEATURES:

  // Concurrency control — all sequential bottlenecks now use mapConcurrent
  - Source file extraction uses configurable concurrency (default: 10)
  - Issue/hotspot sync uses configurable concurrency (default: 5)
  - Project migration uses configurable concurrency (default: 3)
  - Date-window slicing fetches 12 windows in parallel (configurable, default: 6, max: 12)
  - Global/project permissions: flatMap + mapConcurrent (concurrency: 10, configurable max: 50)
  - Project settings: mapConcurrent (concurrency: 10, configurable max: 50)
  - Quality gate creation + detail extraction: mapConcurrent (concurrency: 5)
  - Quality gate assignment to projects: filter + mapConcurrent (concurrency: 10)
  - Permission template migration: mapConcurrent (concurrency: 5)
  - Quality profile chains: mapConcurrent across chains, sequential within (concurrency: 5)
  - Portfolio migration: mapConcurrent (concurrency: 5)
  - Report generation: text + PDF via Promise.all
  - All concurrent operations use semaphore-style limiting

  // New config knobs (under performance)
  performance.dateWindowSlicing.concurrency   = 6     // max 12
  performance.permissionSync.concurrency      = 10    // max 50
  performance.settingsSync.concurrency        = 10    // max 50

  // Auto-tuning
  IF --auto-tune:
    Detect available CPU cores and memory
    Set concurrency = min(cores * 2, 20)
    Set maxMemory based on available RAM

  // CLI overrides
  --concurrency <n>:     override I/O concurrency
  --max-memory <mb>:     set Node.js heap size
  --project-concurrency: max concurrent project migrations

  // Rate limiting
  rateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000,        // ms between retries (exponential backoff)
    minRequestInterval: 100 // ms between API calls
  }

  // Caching
  - Server-wide extracted data is cached between runs
  - Mapping CSVs from dry-run are reused in migration run
  - Rule enrichment map is built once and shared across projects

  // Upload retry
  - CE submit has 2 attempts with timeout fallback
  - On timeout: checks /api/ce/activity for the submitted task
```

---

## 19. Checkpoint Journal and Pause/Resume

```
CHECKPOINT JOURNAL:

CLASS CheckpointJournal:
  JOURNAL SHAPE:
    {
      version: 2,
      sessionFingerprint: { sonarQubeVersion, sonarQubeUrl, projectKey, startedAt },
      status: "in_progress" | "completed" | "interrupted",
      phases: {
        "extract:project_metadata": { status: "completed", completedAt },
        "extract:issues":           { status: "in_progress", startedAt },
        "extract:hotspots":         { status: "pending" },
        ...
      },
      branches: {
        "main":    { status: "completed", ceTaskId: "AY..." },
        "develop": { status: "in_progress" },
      },
      uploadedCeTasks: {
        "main": { taskId, submittedAt, status: "SUCCESS" }
      }
    }

  FUNCTION initialize(fingerprint):
    IF journal file exists:
      LOAD existing journal
      validateFingerprint(fingerprint)    // warn/block on SQ version mismatch
    ELSE:
      CREATE new journal with fingerprint

  FUNCTION isPhaseCompleted(phaseName):
    RETURN phases[phaseName].status == "completed"

  FUNCTION startPhase(phaseName):
    phases[phaseName] = { status: "in_progress", startedAt: now() }
    atomicSave()

  FUNCTION completePhase(phaseName):
    phases[phaseName] = { status: "completed", completedAt: now() }
    atomicSave()

  FUNCTION recordUpload(branch, ceTaskId):
    uploadedCeTasks[branch] = { taskId: ceTaskId, submittedAt: now() }
    atomicSave()

  FUNCTION markInterrupted():
    status = "interrupted"
    atomicSave()


CLASS LockFile:
  FUNCTION acquire():
    IF lock file exists:
      lockData = READ lock file
      IF lockData.pid is alive AND lockData.hostname == currentHostname:
        THROW LockError("Another instance is running")
      IF lockData.hostname != currentHostname:
        THROW LockError("Lock held by different machine, use --force-unlock")
      IF lockData is stale (PID dead or >6h old):
        LOG warning, overwrite lock
    WRITE { pid, startedAt, hostname } to lock file

  FUNCTION release():
    DELETE lock file

  FUNCTION forceRelease():
    DELETE lock file (unconditionally)


CLASS ShutdownCoordinator:
  FUNCTION register(handler):
    cleanupHandlers.PUSH(handler)

  ON SIGINT (first time):
    shuttingDown = true
    RUN all cleanup handlers (save journal, release lock)
    process.exit(0)

  ON SIGINT (second time):
    process.exit(1)    // force exit

  FUNCTION isShuttingDown():
    RETURN shuttingDown


CLASS ExtractionCache:
  FUNCTION save(phaseName, branch, data):
    path = outputDir/cache/extractions/projectKey/branch/phaseName.json.gz
    GZIP(JSON.stringify(data))
    WRITE to path with integrity metadata

  FUNCTION load(phaseName, branch):
    TRY:
      READ and decompress from path
      VERIFY integrity
      RETURN parsed data
    CATCH:
      RETURN null    // corrupt cache = re-extract


CLASS MigrationJournal:
  JOURNAL SHAPE:
    {
      version: 1,
      status: "in_progress",
      organizations: {
        "org-1": {
          status: "in_progress",
          orgWideResources: "completed",
          projects: {
            "project-a": { status: "completed" },
            "project-b": { status: "in_progress", lastCompletedStep: "upload_scanner_report" },
          }
        }
      }
    }

  FUNCTION isOrgCompleted(orgKey):     RETURN orgs[orgKey].status == "completed"
  FUNCTION isProjectCompleted(orgKey, projectKey): RETURN projects[key].status == "completed"
  FUNCTION completeProject(orgKey, projectKey):    SET status, atomicSave()
  FUNCTION completeStep(orgKey, projectKey, step): SET lastCompletedStep, atomicSave()
```
