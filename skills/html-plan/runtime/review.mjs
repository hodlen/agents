#!/usr/bin/env node
// Serve one plan until its response is saved and acknowledged.
// stderr: diagnostics, review URL, and saved response path. stdout: this round's Markdown.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

try {
  const { values, positionals } = parseArgs({ options: { out: { type: 'string' } }, allowPositionals: true });
  if (positionals.length !== 1) throw new Error('Usage: node review.mjs plan.html [--out plan.response.md]');
  const input = resolve(positionals[0]);
  const output = values.out === undefined ? undefined : resolve(values.out);
  if (input === output) throw new Error('The response output must differ from the plan input.');
  let html = readFileSync(input, 'utf8');
  if (!/<html\b[^>]*\bdata-htmlplan-packed\b/i.test(html)) {
    const staging = mkdtempSync(join(tmpdir(), 'html-plan-'));
    try {
      const pack = fileURLToPath(new URL('./pack.mjs', import.meta.url));
      const packed = join(staging, 'plan.html');
      // Surface authoring diagnostics. The packer's output path belongs to the temporary directory.
      const bundle = spawnSync(process.execPath, [pack, input, '--root', process.cwd(), '-o', packed], { stdio: ['ignore', 'ignore', 'inherit'] });
      if (bundle.error) throw bundle.error;
      if (bundle.status !== 0) throw new Error(`Could not prepare ${input} for review (${bundle.signal ?? 'exit ' + bundle.status}).`);
      html = readFileSync(packed, 'utf8');
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }

  const saveResponse = markdown => {
    if (output !== undefined) {
      const existing = statSync(output, { throwIfNoEntry: false });
      if (existing) {
        const plan = statSync(input);
        if (existing.dev === plan.dev && existing.ino === plan.ino) {
          throw new Error('The response output must differ from the plan input.');
        }
      }
      writeFileSync(output, markdown, 'utf8');
      return output;
    }

    const stem = input.replace(/(?:\.packed)?\.html?$/i, '') + '.response';
    for (let version = 0; ; version++) {
      const path = version === 0 ? `${stem}.md` : `${stem}.v${version}.md`;
      try {
        // Claim the filename at submission so concurrent reviewers keep separate files.
        writeFileSync(path, markdown, { flag: 'wx' });
        return path;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  };

  const pagePath = `/${randomBytes(16).toString('hex')}/`;
  const responsePath = `${pagePath}response`;
  const meta = `<meta name="htmlplan-response" content="${responsePath}">`;
  const head = /<head\b[^>]*>/i.test(html) ? /<head\b[^>]*>/i : /<html\b[^>]*>/i;
  const page = html.replace(head, match => `${match}\n${meta}`);
  let origin, claimed = false;

  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  const fail = error => {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  };

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' && request.url === pagePath) {
      response.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' });
      response.end(page);
      return;
    }
    if (request.url !== responsePath) {
      response.writeHead(404).end('Not found.');
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end('Use POST.');
      return;
    }
    if (request.headers.origin !== origin) {
      response.writeHead(403).end('The response must come from this review page.');
      return;
    }

    let accepted = false;
    try {
      const markdown = await text(request);
      if (!markdown.trim()) {
        response.writeHead(400).end('The response must not be empty.');
        return;
      }
      if (claimed) {
        response.writeHead(409).end('This review already received a response.');
        return;
      }
      claimed = accepted = true;
      const savedPath = saveResponse(markdown);
      console.error(`Saved response to ${savedPath}`);
      response.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
      const acknowledged = finished(response);
      // End unfinished requests only after the ACK connection closes normally.
      request.socket.once('close', () => server.closeAllConnections());
      response.end('{"received":true}');
      await acknowledged;
      process.stdout.write(markdown);
      // Preserve the ACK connection while HTTP completes its normal close.
      server.close();
    } catch (error) {
      if (request.aborted && !accepted) return;
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain', Connection: 'close' });
        response.end('Could not save the response.', () => fail(error));
      } else {
        fail(error);
      }
    }
  });

  server.on('error', fail);
  process.once('SIGINT', () => { process.exitCode = 130; stop(); });
  process.once('SIGTERM', () => { process.exitCode = 143; stop(); });
  server.listen(0, '127.0.0.1', () => {
    origin = `http://127.0.0.1:${server.address().port}`;
    console.error(`${origin}${pagePath}`);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
