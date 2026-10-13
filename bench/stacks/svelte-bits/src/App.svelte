<script lang="ts">
  import { dataset } from "@perception-bench/scenarios";
  import RequestCard from "./RequestCard.svelte";
  import type { RequestRecord } from "./types";

  const freshRequests = (): RequestRecord[] => dataset.requests.map(request => ({ ...request }));
  let requests = $state<RequestRecord[]>(freshRequests());
  let query = $state("");
  let status = $state<string>("All statuses");
  let notice = $state("");
  let resetVersion = $state(0);
  const owners = [...new Set(dataset.requests.map(request => request.owner))];
  const visibleRequests = $derived(requests.filter(request => {
    const matchesQuery = [request.id, request.supplier, request.amount, request.status, request.owner]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (status === "All statuses" || request.status === status);
  }));

  function saveOwner(id: string, owner: string) {
    requests = requests.map(request => request.id === id ? { ...request, owner } : request);
    notice = `Owner updated for ${id}: ${owner}.`;
  }

  function resetWorkspace() {
    query = "";
    status = "All statuses";
    requests = freshRequests();
    resetVersion += 1;
    notice = "Workspace reset. All seeded requests restored.";
  }
</script>

<svelte:head><meta name="description" content="Browse and manage purchase requests in a local procurement workspace." /></svelte:head>

<div class="min-h-screen">
  <header class="border-b border-line bg-surface">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-accent" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4H5v17h14V4h-3M9 3h6v4H9zM8 12h8M8 16h5" /></svg>
        </span>
        <div>
          <p class="text-sm font-semibold">{dataset.chrome.brand}</p>
          <p class="mt-0.5 text-xs text-muted">Purchasing / Requests</p>
        </div>
      </div>
      <span class="rounded-full border border-line px-3 py-1 text-xs text-muted">Local workspace</span>
    </div>
  </header>

  <main class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Request inbox</p>
        <h1 class="text-3xl font-semibold tracking-tight">Purchase requests</h1>
        <p class="mt-2 text-sm text-muted">Review suppliers, track status, and keep ownership up to date.</p>
      </div>
      <button class="button" onclick={resetWorkspace}>Reset workspace</button>
    </div>

    <section aria-label="Request summary" class="mb-6 grid grid-cols-3 gap-3">
      {#each ["Pending", "Overdue", "Approved"] as label}
        <div class="rounded-card border border-line bg-elevated px-4 py-3">
          <p class="text-xs text-muted">{label}</p>
          <p class="mt-1 text-2xl font-semibold">{requests.filter(request => request.status === label).length}</p>
        </div>
      {/each}
    </section>

    <section aria-label="Request filters" class="mb-6 flex flex-wrap items-end gap-4 rounded-card border border-line bg-surface p-4">
      <div class="min-w-52 flex-1">
        <label for="request-query" class="mb-2 block text-sm font-semibold">Search requests</label>
        <input id="request-query" type="search" class="field" placeholder="Request, supplier, or owner" bind:value={query} />
      </div>
      <div class="w-full sm:w-52">
        <label for="request-status" class="mb-2 block text-sm font-semibold">Status</label>
        <select id="request-status" class="field" bind:value={status}>
          {#each dataset.statusFilters as choice}<option value={choice}>{choice}</option>{/each}
        </select>
      </div>
      <button class="button min-h-11" onclick={() => { query = ""; status = "All statuses"; }}>Clear filters</button>
    </section>

    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold">Requests</h2>
      <p class="text-xs text-muted" aria-live="polite">{visibleRequests.length} of {requests.length} requests</p>
    </div>
    <div class="grid gap-4">
      {#key resetVersion}
        {#each visibleRequests as request (request.id)}
          <RequestCard {request} {owners} onOwnerSave={saveOwner} />
        {/each}
      {/key}
      {#if visibleRequests.length === 0}
        <div class="rounded-card border border-line bg-surface p-8 text-center">
          <h3 class="font-semibold">No matching requests</h3>
          <p class="mt-2 text-sm text-muted">Try a different query or clear your status filter.</p>
        </div>
      {/if}
    </div>
    <p role="status" class="mt-4 min-h-5 text-sm text-muted">{notice}</p>
    <aside class="mt-6 border-t border-line pt-4 text-xs text-muted">{dataset.chrome.announcement}</aside>
  </main>
  <footer class="mx-auto max-w-6xl px-6 pb-6 text-xs text-muted">{dataset.chrome.footer}</footer>
</div>
