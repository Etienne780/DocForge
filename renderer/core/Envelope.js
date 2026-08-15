export function wrapEntity(kind, entityVersion, data) {
  return { kind, storageVersion: entityVersion, data };
}

export function unwrapEntity(raw, migrateFn, currentVersion) {
  if (!raw || typeof raw !== 'object')
    return null;

  const version = raw.storageVersion ?? 0;
  const data = 'data' in raw ? raw.data : raw;

  return migrateFn(data, version, currentVersion);
}