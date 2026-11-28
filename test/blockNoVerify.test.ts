import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const hookCli = fileURLToPath(new URL('./cli.js', import.meta.resolve('block-no-verify')));

function runHook(command: string) {
  // These command strings are input data for the configured hook, never executed by a shell.
  const result = spawnSync(process.execPath, [hookCli], {
    encoding: 'utf8',
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
      session_id: 'hook-regression',
      tool_use_id: 'hook-regression',
      cwd: process.cwd(),
    }),
    timeout: 5_000,
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return { status: result.status, output: JSON.parse(result.stdout), stderr: result.stderr };
}

describe('contributor command hook', () => {
  it('blocks a hook bypass inside an executable commit-message substitution', () => {
    const result = runHook('git commit -m "note `HUSKY=0 git commit -m inner`"');

    expect(result.status).toBe(2);
    expect(result.output).toEqual({
      decision: 'block',
      reason: expect.stringContaining('BLOCKED'),
    });
    expect(result.stderr).toContain('BLOCKED');
  });

  it.each([
    ['single-quoted command text', "git commit -m 'note `HUSKY=0 git commit -m inner`'"],
    ['a flag mentioned in a commit message', 'git commit -am "--no-verify"'],
  ])('allows %s in a literal commit message', (_description, command) => {
    const result = runHook(command);

    expect(result.status).toBe(0);
    expect(result.output).toEqual({});
  });
});
