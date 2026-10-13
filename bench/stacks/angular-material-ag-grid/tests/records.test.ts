import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { dataset } from '@perception-bench/scenarios';
import adapter from '../adapters/records.ts';
import { BrowserSession } from '../../../src/runner/browser.ts';
import type { Counts } from '../../../src/runner/models.ts';
import { assessOutput } from '../../../src/evidence/index.ts';
import { records } from '../../../cases/records.ts';

// Serves only this app's already-built assets. No build, install or browser download side effects.
test('records states, filtering, selection, dialogs and deterministic reset', async () => {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  await readFile(resolve(root, 'index.html'));
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/fixture/')) { response.writeHead(404).end(); return; }
    const file = resolve(root, path.slice('/fixture/'.length) || 'index.html');
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end(); return; }
    try {
      const content = await readFile(file);
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: dataset.environment.viewport,
      locale: dataset.environment.locale,
      timezoneId: dataset.environment.timezoneId,
      reducedMotion: 'reduce',
      colorScheme: 'light',
    });
    const external: string[] = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(dataset.environment.clock));
    await page.goto(`${origin}/fixture/`);
    await adapter.prepare(page, 'browsing');
    const grid = page.getByRole('grid', { name: 'Purchase requests', exact: true });
    const search = page.getByRole('searchbox', { name: 'Search requests', exact: true });
    await search.fill('Northwind');
    await grid.getByRole('gridcell', { name: 'RQ-1041', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await grid.getByRole('gridcell', { name: 'RQ-1043', exact: true }).count(), 1);
    await search.fill('');
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Overdue');
    await grid.getByRole('gridcell', { name: 'RQ-1043', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await grid.getByRole('gridcell', { name: 'RQ-1042', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
    await grid.getByRole('gridcell', { name: 'RQ-1043', exact: true }).waitFor();
    await adapter.assertReady(page, 'browsing');
    await adapter.prepare(page, 'target-actions-available');
    await page.getByRole('button', { name: 'View request', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Request RQ-1042', exact: true });
    await dialog.waitFor();
    for (const value of ['Acme Supplies', '$1,200.00', 'Overdue', 'Morgan Lee']) {
      assert.equal(await dialog.getByText(value, { exact: true }).count(), 1);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Reassign owner', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Reassign owner for RQ-1042', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('combobox', { name: 'New owner', exact: true }).selectOption('Jamie Chen');
    await dialog.getByRole('button', { name: 'Save assignment', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const target = grid.getByRole('row').filter({ has: page.getByRole('gridcell', { name: 'RQ-1042', exact: true }) });
    await target.getByRole('gridcell', { name: 'Jamie Chen', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
    await target.getByRole('gridcell', { name: 'Morgan Lee', exact: true }).waitFor();
    await adapter.assertReady(page, 'browsing');
    await adapter.prepare(page, 'target-actions-available');
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await adapter.assertReady(page, 'browsing');
    // Select a different record to establish that actions are not hard-coded to the target.
    await grid.getByRole('gridcell', { name: 'RQ-1041', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Actions for RQ-1041', exact: true }).waitFor();
    await adapter.prepare(page, 'browsing');
    assert.deepEqual(errors, [], 'No browser errors');
    assert.deepEqual(external, [], 'No external requests');
  } finally {
    await browser?.close();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  }
});

// Oracle and acquisition imports remain in this Node-only test, never in the app bundle.
test('harness raw goals and fresh capture determinism for both records states', async t => {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const files: Record<string, string> = {};
  async function collect(directory: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await collect(path, name + '/');
      else files[name] = (await readFile(path)).toString('base64');
    }
  }
  await collect(root);
  const counts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const session = new BrowserSession(files, counts);
  try {
    for (const state of records.states) {
      await t.test(state.id, async () => {
        const first = await session.capture(state.id, adapter);
        const second = await session.capture(state.id, adapter);
        const assessments = [first, second].map(capture => assessOutput(capture.html, state, capture.html, 'html'));
        for (const assessment of assessments) {
          assert.equal(assessment.reader.status, 'ok');
          assert.equal(assessment.fullFidelity, true, JSON.stringify(assessment.requirements.filter(item => !item.passed), null, 2));
          const expected = state.id === 'browsing' ? 3 : 5;
          assert.equal(assessment.retention.overall.denominator, expected);
          assert.equal(assessment.retention.overall.numerator, expected);
          assert.equal(assessment.semanticRetention.overall.numerator, expected, 'Raw goals must have explicit semantic evidence');
        }
        assert.ok(first.html === second.html, `${state.id}: fresh raw capture bytes must be identical`);
        assert.deepEqual(assessments[0], assessments[1], 'Raw output assessments must be identical');
        assert.ok(first.screenshot === second.screenshot, `${state.id}: fresh PNG screenshots must be identical`);
        console.log(`${state.id}: ${assessments[0]!.retention.overall.numerator}/${assessments[0]!.retention.overall.denominator} raw and semantic goals; identical HTML, assessment and PNG across two fresh contexts`);
      });
    }
  } finally { await session.close(); }
});
