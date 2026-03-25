import { bindProfileGateMethods } from './delegated-profile-gate-methods.js';
import { bindIssueConfigMethods } from './delegated-issue-config-methods.js';

// -------- Bind Delegated API Methods to Client Instance --------

export function bindDelegatedMethods(ctx) {
  const c = ctx.client;
  const o = ctx.organization;
  const pk = ctx.projectKey;
  return {
    ...bindProfileGateMethods(c, o, pk),
    ...bindIssueConfigMethods(c, o, pk),
  };
}
