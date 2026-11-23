import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import runtime from '../skills/html-plan/runtime/htmlplan.js';

test('an authored plan collects two review rounds without replacing earlier feedback', { timeout: 10000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'html-plan-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'plan.html');
  await copyFile(new URL('../skills/html-plan/examples/scheduled-send.html', import.meta.url), input);
  const original = await readFile(input, 'utf8');
  const command = fileURLToPath(new URL('../skills/html-plan/runtime/review.mjs', import.meta.url));
  const rounds = [
    { markdown: '# Re: Scheduled Send\n\nKeep the cancel action visible.\n', filename: 'plan.response.md' },
    { markdown: '# Re: Scheduled Send\n\nThe revised plan is ready.\n', filename: 'plan.response.v1.md' },
  ];

  for (const { markdown, filename } of rounds) {
    const child = spawn(process.execPath, [command, input], { stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'close');
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exited;
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', data => { stdout += data; });
    child.stderr.setEncoding('utf8').on('data', data => { stderr += data; });
    const url = await new Promise((resolve, reject) => {
      child.stderr.on('data', () => {
        const address = stderr.match(/http:\/\/127\.0\.0\.1:\d+\/[^\s]+/);
        if (address) resolve(address[0]);
      });
      child.once('exit', () => reject(new Error(stderr || 'Review exited before sharing its URL.')));
      child.once('error', reject);
    });

    const page = await fetch(url);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Scheduled Send Plan/);

    const endpoint = html.match(/<meta name="htmlplan-response" content="([^"]+)">/)[1];
    // A browser supplies Origin when the reader clicks Respond.
    const browserFetch = (target, init) => fetch(target, {
      ...init, headers: { ...init.headers, Origin: new URL(url).origin },
    });
    let received = false;
    await runtime.sendResponse(new URL(endpoint, url), markdown, browserFetch, () => { received = true; });
    assert.ok(received);
    assert.deepEqual(await exited, [0, null]);
    assert.equal(stdout, markdown);
    assert.ok(stderr.includes(join(directory, filename)), stderr);
  }

  for (const { markdown, filename } of rounds) {
    assert.equal(await readFile(join(directory, filename), 'utf8'), markdown);
  }
  assert.equal(await readFile(input, 'utf8'), original);
});
