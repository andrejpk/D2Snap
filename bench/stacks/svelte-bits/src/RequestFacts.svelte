<script lang="ts">
  import type { RequestRecord } from "./types";
  let { request }: { request: RequestRecord } = $props();
</script>

<div class="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
  <dl><dt class="fact-label">Supplier</dt><dd class="fact-value">{request.supplier}</dd></dl>
  <dl><dt class="fact-label">Amount</dt><dd class="fact-value tabular-nums">{request.amount}</dd></dl>
  <dl>
    <dt class="fact-label">Status</dt>
    <dd class="fact-value"><span class="inline-block rounded-md bg-soft px-2 py-0.5">{request.status}</span></dd>
  </dl>
  <dl><dt class="fact-label">Owner</dt><dd class="fact-value">{request.owner}</dd></dl>
</div>
