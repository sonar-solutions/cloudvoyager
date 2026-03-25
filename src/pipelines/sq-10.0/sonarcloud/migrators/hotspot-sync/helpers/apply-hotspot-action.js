// -------- Apply Hotspot Action --------

/**
 * Apply a single hotspot action (status + resolution) to SonarCloud.
 */
export async function applyHotspotAction(client, hotspotKey, action) {
  if (action.resolution) {
    await client.changeHotspotStatus(hotspotKey, action.status, action.resolution);
  } else {
    await client.changeHotspotStatus(hotspotKey, action.status);
  }
}
