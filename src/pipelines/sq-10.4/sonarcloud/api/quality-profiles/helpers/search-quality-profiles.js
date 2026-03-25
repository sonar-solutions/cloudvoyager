// -------- Main Logic --------

// Search quality profiles in SonarCloud, optionally filtered by language.
export async function searchQualityProfiles(client, organization, language = null) {
  const params = { organization };
  if (language) params.language = language;
  const response = await client.get('/api/qualityprofiles/search', { params });
  return response.data.profiles || [];
}
