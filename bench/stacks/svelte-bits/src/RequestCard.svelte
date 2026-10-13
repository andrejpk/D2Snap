<script lang="ts">
  import { Dialog, DropdownMenu } from "bits-ui";
  import RequestFacts from "./RequestFacts.svelte";
  import type { RequestRecord } from "./types";

  let { request, owners, onOwnerSave }: {
    request: RequestRecord;
    owners: readonly string[];
    onOwnerSave: (id: string, owner: string) => void;
  } = $props();
  let detailsOpen = $state(false);
  let reassignOpen = $state(false);
  let draftOwner = $state("");

  function startReassignment() {
    draftOwner = request.owner;
    reassignOpen = true;
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    onOwnerSave(request.id, draftOwner);
    reassignOpen = false;
  }
</script>

<section aria-labelledby={`title-${request.id}`} class="rounded-card border border-line bg-surface p-5">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h3 id={`title-${request.id}`} class="text-base font-semibold">Request {request.id}</h3>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="button" aria-label={`Actions for ${request.id}`}>
        Actions
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 6 4 4 4-4" /></svg>
      </DropdownMenu.Trigger>
      <!-- Bits Content is intentionally inline (no Portal), so the real menu stays inside its request region. -->
      <DropdownMenu.Content class="menu-panel" align="end" sideOffset={6}>
        <DropdownMenu.Item class="menu-item" onSelect={() => { detailsOpen = true; }}>View request</DropdownMenu.Item>
        <DropdownMenu.Item class="menu-item" onSelect={startReassignment}>Reassign owner</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
  <RequestFacts {request} />
</section>

<Dialog.Root bind:open={detailsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-panel">
      <Dialog.Title class="text-xl font-semibold">Request {request.id}</Dialog.Title>
      <Dialog.Description class="mb-6 mt-2 text-sm text-muted">Purchase request details and current ownership.</Dialog.Description>
      <RequestFacts {request} />
      <div class="mt-6 flex justify-end"><Dialog.Close class="button">Close details</Dialog.Close></div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={reassignOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-panel">
      <Dialog.Title class="text-xl font-semibold">Reassign owner for {request.id}</Dialog.Title>
      <Dialog.Description class="mb-6 mt-2 text-sm text-muted">Choose who manages this request. Changes apply only when you save.</Dialog.Description>
      <form onsubmit={save}>
        <p class="mb-4 text-sm text-muted">Current owner: <span class="font-semibold text-ink">{request.owner}</span></p>
        <label for={`owner-${request.id}`} class="mb-2 block text-sm font-semibold">New owner</label>
        <select id={`owner-${request.id}`} class="field" bind:value={draftOwner} required>
          {#each owners as owner}<option value={owner}>{owner}</option>{/each}
        </select>
        <div class="mt-6 flex justify-end gap-3">
          <Dialog.Close class="button" type="button">Cancel</Dialog.Close>
          <button class="button button-primary" type="submit">Save owner</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
