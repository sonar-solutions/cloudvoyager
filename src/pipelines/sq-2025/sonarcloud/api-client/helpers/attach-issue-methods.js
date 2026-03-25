import * as iss from '../../api/issues.js';
import * as hs from '../../api/hotspots.js';

// -------- Attach Issue and Hotspot Delegation Methods --------

/** Attach issue and hotspot API methods to the client instance. */
export function attachIssueMethods(inst, client, org) {
  inst.getIssueChangelog = (k) => iss.getIssueChangelog(client, k);
  inst.transitionIssue = (i, t) => iss.transitionIssue(client, i, t);
  inst.assignIssue = (i, a) => iss.assignIssue(client, i, a);
  inst.addIssueComment = (i, t) => iss.addIssueComment(client, i, t);
  inst.setIssueTags = (i, t) => iss.setIssueTags(client, i, t);
  inst.searchIssues = (pk, f = {}) => iss.searchIssues(client, org, pk, f);
  inst.changeHotspotStatus = (h, s, r = null) => hs.changeHotspotStatus(client, h, s, r);
  inst.searchHotspots = (pk, f = {}) => hs.searchHotspots(client, pk, f);
  inst.addHotspotComment = (h, t) => hs.addHotspotComment(client, h, t);
}
