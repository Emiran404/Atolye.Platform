// @ts-nocheck
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  INVALID_PATH_CODE,
  resolveExistingPathWithinRoot,
  resolvePathForCreationWithinRoot,
  resolvePathWithinRoot
} from '../utils/safePath.js';

const temporaryDirectories = [];

const makeTemporaryDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atolye-safe-path-'));
  temporaryDirectories.push(directory);
  return directory;
};

const expectInvalidPath = (callback) => {
  expect(callback).toThrow(expect.objectContaining({ code: INVALID_PATH_CODE }));
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('resolvePathWithinRoot', () => {
  it('accepts the root and nested paths', () => {
    const root = makeTemporaryDirectory();

    expect(resolvePathWithinRoot(root, '')).toBe(path.resolve(root));
    expect(resolvePathWithinRoot(root, 'students/42/exam.pdf'))
      .toBe(path.resolve(root, 'students/42/exam.pdf'));
  });

  it.each([
    '../outside.txt',
    'students/../../../etc/passwd',
    '/etc/passwd',
    '\0outside.txt'
  ])('rejects paths outside the upload root: %s', (untrustedPath) => {
    const root = makeTemporaryDirectory();
    expectInvalidPath(() => resolvePathWithinRoot(root, untrustedPath));
  });

  it('does not confuse a sibling directory with the upload root', () => {
    const parent = makeTemporaryDirectory();
    const root = path.join(parent, 'uploads_student');
    fs.mkdirSync(root);

    expectInvalidPath(() => resolvePathWithinRoot(root, '../uploads_student_evil/file.txt'));
  });
});

describe('resolveExistingPathWithinRoot', () => {
  it('rejects a symlink that points outside the upload root', () => {
    const parent = makeTemporaryDirectory();
    const root = path.join(parent, 'uploads');
    const outside = path.join(parent, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'escape'));

    expectInvalidPath(() => resolveExistingPathWithinRoot(root, 'escape/secret.txt'));
  });
});

describe('resolvePathForCreationWithinRoot', () => {
  it('rejects creating a directory through an escaping symlink', () => {
    const parent = makeTemporaryDirectory();
    const root = path.join(parent, 'uploads');
    const outside = path.join(parent, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, 'escape'));

    expectInvalidPath(() => resolvePathForCreationWithinRoot(root, 'escape/new-folder'));
    expect(fs.existsSync(path.join(outside, 'new-folder'))).toBe(false);
  });
});
