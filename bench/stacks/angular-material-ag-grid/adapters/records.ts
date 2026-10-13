import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import type { CellAdapter } from '../../../src/contracts.ts';
import { dataset } from '@perception-bench/scenarios';

type State = 'browsing' | 'target-actions-available';
function supportedState(stateId: string): asserts stateId is State {
  if (stateId !== 'browsing' && stateId !== 'target-actions-available') {
    throw new Error(`angular-material-ag-grid/records/selection-toolbar does not support state: ${stateId}`);
  }
}

/** The harness owns initial navigation, environment and raw capture. */
export const recordsAdapter: CellAdapter<Page> = {
  caseId: 'records',
  stackId: 'angular-material-ag-grid',
  variantId: 'selection-toolbar',

  async prepare(page, stateId) {
    supportedState(stateId);
    await page.reload({ waitUntil: 'load' });
    await page.getByRole('heading', { name: 'Purchase requests', exact: true }).waitFor();
    const grid = page.getByRole('grid', { name: 'Purchase requests', exact: true });
    for (const record of dataset.requests) {
      await grid.getByRole('gridcell', { name: record.id, exact: true }).waitFor();
    }
    await recordsAdapter.assertReady(page, 'browsing');
    if (stateId === 'target-actions-available') {
      await grid.getByRole('gridcell', { name: 'RQ-1042', exact: true }).click();
      await page.getByRole('toolbar', { name: 'Actions for RQ-1042', exact: true }).waitFor();
    }
    await recordsAdapter.assertReady(page, stateId);
  },

  async assertReady(page, stateId) {
    supportedState(stateId);
    assert.equal(await page.getByRole('alert').count(), 0, 'No client startup error');
    assert.equal(await page.getByRole('dialog').count(), 0, 'Observation states have no open dialog');
    const search = page.getByRole('searchbox', { name: 'Search requests', exact: true });
    assert.equal(await search.isVisible(), true);
    assert.equal(await search.isEnabled(), true);
    assert.equal(await search.inputValue(), '', 'Search query must be empty');
    const filter = page.getByRole('combobox', { name: 'Status', exact: true });
    assert.equal(await filter.isVisible(), true);
    assert.equal(await filter.isEnabled(), true);
    assert.equal(await filter.inputValue(), 'All statuses');
    assert.deepEqual(await filter.locator('option').allTextContents(), [...dataset.statusFilters]);
    assert.equal(await filter.locator('option:disabled').count(), 0, 'All status choices must be enabled');
    assert.equal(await filter.locator('option:checked').textContent(), 'All statuses');
    assert.equal(await page.getByRole('button', { name: 'Reset workspace', exact: true }).isEnabled(), true);

    const grid = page.getByRole('grid', { name: 'Purchase requests', exact: true });
    assert.equal(await grid.count(), 1, 'Exactly one request grid');
    assert.equal(await grid.isVisible(), true);
    const headers = grid.getByRole('columnheader');
    assert.deepEqual((await headers.allTextContents()).map(text => text.trim()),
      ['Request', 'Supplier', 'Amount', 'Status', 'Owner']);
    assert.deepEqual(await headers.evaluateAll(elements => elements.map(element => element.getAttribute('aria-colindex'))),
      ['1', '2', '3', '4', '5'], 'Headers must expose ordered column associations');
    const rows = grid.getByRole('row').filter({ has: page.getByRole('gridcell') });
    assert.equal(await rows.count(), dataset.requests.length, 'Every seeded record must be rendered, with no extras');
    const bounds = await grid.boundingBox();
    assert.ok(bounds);
    const viewport = page.viewportSize();
    assert.ok(viewport);
    for (const [index, record] of dataset.requests.entries()) {
      const row = rows.nth(index);
      const cells = row.getByRole('gridcell');
      assert.deepEqual((await cells.allTextContents()).map(text => text.trim()),
        [record.id, record.supplier, record.amount, record.status, record.owner], `${record.id} facts and ordering`);
      assert.deepEqual(await cells.evaluateAll(elements => elements.map(element => element.getAttribute('aria-colindex'))),
        ['1', '2', '3', '4', '5'], `${record.id} cells must retain header associations`);
      assert.equal(await row.isVisible(), true);
      const rect = await row.boundingBox();
      assert.ok(rect);
      assert.ok(rect.y >= bounds.y && rect.y + rect.height <= bounds.y + bounds.height,
        `${record.id} must fit inside the grid without scrolling`);
      assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height,
        `${record.id} must be in the initial browser viewport`);
      const selected: boolean = stateId === 'target-actions-available' && record.id === 'RQ-1042';
      assert.equal(await row.getAttribute('aria-selected'), String(selected), `${record.id} explicit selection`);
    }

    if (stateId === 'browsing') {
      assert.equal(await grid.getByRole('row', { selected: true }).count(), 0);
      assert.equal(await page.getByRole('toolbar').count(), 0, 'No contextual toolbar without selection');
      assert.equal(await page.getByRole('button', { name: 'View request', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reassign owner', exact: true }).count(), 0);
      return;
    }
    assert.equal(await grid.getByRole('row', { selected: true }).count(), 1, 'Only RQ-1042 is selected');
    const toolbar = page.getByRole('toolbar', { name: 'Actions for RQ-1042', exact: true });
    assert.equal(await page.getByRole('toolbar').count(), 1);
    assert.equal(await toolbar.isVisible(), true);
    assert.match(await toolbar.innerText(), /RQ-1042\s+selected/);
    for (const name of ['View request', 'Reassign owner', 'Clear selection']) {
      const button = toolbar.getByRole('button', { name, exact: true });
      assert.equal(await button.isVisible(), true, `${name} must be visible and associated with the selected request`);
      assert.equal(await button.isEnabled(), true, `${name} must be enabled`);
    }
  },
};

export default recordsAdapter;
