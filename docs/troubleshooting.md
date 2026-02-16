# Troubleshooting

## Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube
- Verify the organization key is correct in SonarCloud

## Generic "Issue whilst processing" Error

This vague SonarCloud error can be caused by:
- **Branch name mismatch** - SonarQube and SonarCloud have different main branch names. The tool handles this automatically via `getMainBranchName()`, but verify your SonarCloud project's branch configuration
- **Line count mismatch** - Source file line counts don't match component metadata. The tool uses actual source content line counts to avoid this

## Report Rejected by SonarCloud
- **Empty ScmInfo** - Ensure `changesetIndexByLine` is populated for ADDED files (array of zeros, one per line)
- **Issue gap field** - The `gap` field should not be included in issues (it's scanner-computed, not from SonarQube)
- **Duplicate report** - SonarCloud rejects reports with the same `scm_revision_id`. Use a different commit or update the source project

## Connection Timeouts
- Check network connectivity to both servers
- Verify firewall rules allow access
- Use `--verbose` flag for detailed connection logs

## Large Reports

Limit source file extraction for testing:

```bash
export MAX_SOURCE_FILES=10
node src/index.js transfer -c config.json
```
