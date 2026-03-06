/**
 * Clone GitHub repos into the shared workspace directory.
 * @module services/repo-clone
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { env } from '../env.js';
import pino from 'pino';

const execFileAsync = promisify(execFile);
const log = pino({ name: 'repo-clone', level: env.LOG_LEVEL });

export interface CloneResult {
  localPath: string;
  defaultBranch: string;
}

/**
 * Clone a GitHub repo, or fetch if it already exists.
 * @param orgRepo - GitHub org/repo (e.g. "phj6688/cortex")
 * @param targetPath - Local path to clone into
 * @returns Clone result with detected default branch
 */
export async function cloneRepo(
  orgRepo: string,
  targetPath: string,
): Promise<CloneResult> {
  if (existsSync(targetPath)) {
    log.info({ targetPath }, 'Repo already exists, fetching latest');
    await execFileAsync('git', ['-C', targetPath, 'fetch', 'origin', '--quiet'], {
      timeout: 60_000,
    });
  } else {
    const githubToken = env.GITHUB_TOKEN;
    const cloneUrl = githubToken
      ? `https://x-access-token:${githubToken}@github.com/${orgRepo}.git`
      : `https://github.com/${orgRepo}.git`;

    log.info({ orgRepo, targetPath, hasToken: !!githubToken }, 'Cloning repo');

    await execFileAsync('git', ['clone', '--depth', '1', cloneUrl, targetPath], {
      timeout: 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  }

  const { stdout } = await execFileAsync(
    'git',
    ['-C', targetPath, 'rev-parse', '--abbrev-ref', 'HEAD'],
    { timeout: 10_000 },
  );

  return { localPath: targetPath, defaultBranch: stdout.trim() };
}
