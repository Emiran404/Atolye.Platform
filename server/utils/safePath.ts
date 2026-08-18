// @ts-nocheck
import fs from 'fs';
import { dirname, resolve, sep } from 'path';

export const INVALID_PATH_CODE = 'INVALID_UPLOAD_PATH';

const unsafePathError = () => {
  const error = new Error('Yetkisiz dizin erişimi.');
  error.code = INVALID_PATH_CODE;
  return error;
};

const isWithinRoot = (root, candidate) => (
  candidate === root || candidate.startsWith(`${root}${sep}`)
);

/** Resolve an untrusted relative path and guarantee it remains below root. */
export const resolvePathWithinRoot = (rootPath, untrustedPath = '') => {
  if (typeof untrustedPath !== 'string' || untrustedPath.includes('\0')) {
    throw unsafePathError();
  }

  const root = resolve(rootPath);
  const candidate = resolve(root, untrustedPath);
  if (!isWithinRoot(root, candidate)) throw unsafePathError();
  return candidate;
};

/** Also reject existing symlinks that resolve outside root. */
export const resolveExistingPathWithinRoot = (rootPath, untrustedPath = '') => {
  const candidate = resolvePathWithinRoot(rootPath, untrustedPath);
  if (!fs.existsSync(candidate)) return candidate;

  const root = fs.realpathSync(resolve(rootPath));
  const realCandidate = fs.realpathSync(candidate);
  if (!isWithinRoot(root, realCandidate)) throw unsafePathError();
  return realCandidate;
};

/** Validate the nearest existing parent before creating a file or directory. */
export const resolvePathForCreationWithinRoot = (rootPath, untrustedPath = '') => {
  const candidate = resolvePathWithinRoot(rootPath, untrustedPath);
  const root = fs.realpathSync(resolve(rootPath));
  let existingAncestor = candidate;

  while (!fs.existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) throw unsafePathError();
    existingAncestor = parent;
  }

  const realAncestor = fs.realpathSync(existingAncestor);
  if (!isWithinRoot(root, realAncestor)) throw unsafePathError();
  return candidate;
};
