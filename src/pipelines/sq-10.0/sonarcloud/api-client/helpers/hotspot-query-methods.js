// -------- Hotspot Query Methods --------

export async function getHotspotDetails(client, hotspotKey) {
  const response = await client.get('/api/hotspots/show', { params: { hotspot: hotspotKey } });
  return response.data;
}
