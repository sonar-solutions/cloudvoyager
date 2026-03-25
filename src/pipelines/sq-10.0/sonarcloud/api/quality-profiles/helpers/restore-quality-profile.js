import logger from '../../../../../../shared/utils/logger.js';

// -------- Restore Quality Profile --------

export async function restoreQualityProfile(client, organization, backupXml) {
  logger.info('Restoring quality profile from backup...');

  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('backup', Buffer.from(backupXml, 'utf-8'), { filename: 'profile-backup.xml', contentType: 'application/xml' });
  form.append('organization', organization);

  const response = await client.post('/api/qualityprofiles/restore', form, { headers: form.getHeaders() });
  return response.data;
}
