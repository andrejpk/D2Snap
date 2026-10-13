<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import FloatLabel from "primevue/floatlabel";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Panel from "primevue/panel";
import Tag from "primevue/tag";
import Toolbar from "primevue/toolbar";
import { dataset } from "@perception-bench/scenarios";
import RowActions from "./components/RowActions.vue";
import { freshRequests, type RequestRecord } from "./records";

const requests = ref(freshRequests());
const query = ref("");
const status = ref<string>("All statuses");
const selected = ref<RequestRecord | null>(null);
const detailOpen = ref(false);
const reassignOpen = ref(false);
const draftOwner = ref("");
const feedback = ref("");
const resetGeneration = ref(0);
const owners = [...new Set(dataset.requests.map(record => record.owner))];
const filteredRequests = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase("en-US");
  return requests.value.filter(record =>
    (status.value === "All statuses" || record.status === status.value) &&
    Object.values(record).some(value => value.toLocaleLowerCase("en-US").includes(needle)),
  );
});
const countStatus = (value: string) => requests.value.filter(record => record.status === value).length;
const totalAmount = computed(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  .format(requests.value.reduce((total, record) => total + Number(record.amount.replace(/[$,]/g, "")), 0)));

function resetFilters() {
  query.value = "";
  status.value = "All statuses";
}
function restoreWorkspace() {
  detailOpen.value = false;
  reassignOpen.value = false;
  selected.value = null;
  requests.value = freshRequests();
  draftOwner.value = "";
  feedback.value = "";
  resetFilters();
  resetGeneration.value += 1;
}
function viewRequest(record: RequestRecord) {
  selected.value = record;
  detailOpen.value = true;
}
function reassignOwner(record: RequestRecord) {
  selected.value = record;
  draftOwner.value = record.owner;
  detailOpen.value = false;
  reassignOpen.value = true;
}
function cancelReassignment() {
  reassignOpen.value = false;
  draftOwner.value = "";
}
function saveOwner() {
  if (!selected.value || !owners.some(owner => owner === draftOwner.value)) return;
  selected.value.owner = draftOwner.value;
  feedback.value = `${selected.value.id} is now assigned to ${draftOwner.value}.`;
  reassignOpen.value = false;
}
const dialogPt = {
  transition: { css: false },
  root: { class: "workspace-dialog" },
  header: { class: "dialog-header" },
  title: { class: "dialog-title" },
  headerActions: { class: "dialog-header-actions" },
  pcCloseButton: { root: { class: "dialog-close" } },
  content: { class: "dialog-content" },
  footer: { class: "dialog-footer" },
  mask: { class: "dialog-mask" },
};
const panelPt = {
  header: { class: "panel-header" },
  title: { class: "panel-title" },
  content: { class: "panel-content" },
};
</script>

<template>
  <div class="workspace">
    <a class="skip-link" href="#requests">Skip to purchase requests</a>
    <header class="masthead">
      <div class="brand"><span class="brand-mark" aria-hidden="true">P</span>{{ dataset.chrome.brand }}</div>
      <div class="workspace-context"><span>Operations / Purchasing</span><span class="environment">Local workspace</span></div>
      <div class="account"><span class="avatar" aria-hidden="true">OP</span><span>Operations team<small>Request administration</small></span></div>
    </header>
    <nav class="section-nav" aria-label="Workspace navigation">
      <a href="#overview">{{ dataset.chrome.navigation[0] }}</a>
      <a href="#requests" aria-current="page">{{ dataset.chrome.navigation[1] }}</a>
      <a href="#reports">{{ dataset.chrome.navigation[2] }}</a>
      <a href="#help">{{ dataset.chrome.navigation[3] }}</a>
      <span>Procurement / Request register</span>
    </nav>
    <main>
      <section id="overview" class="page-heading" aria-label="Workspace overview">
        <div><p class="eyebrow">Procurement operations</p><h1 id="requests">Purchase requests</h1><p>Review the queue, inspect requests, and keep ownership up to date.</p></div>
        <Button label="Restore workspace" class="secondary-button" @click="restoreWorkspace" />
      </section>
      <section class="summary-strip" aria-label="Request summary">
        <div><span>Total requests</span><strong>{{ requests.length }}</strong><small>Shared request register</small></div>
        <div><span>Overdue</span><strong>{{ countStatus('Overdue') }}</strong><small>Needs owner follow-up</small></div>
        <div><span>Pending</span><strong>{{ countStatus('Pending') }}</strong><small>Awaiting review</small></div>
        <div><span>Total requested</span><strong>{{ totalAmount }}</strong><small>Across all statuses</small></div>
      </section>
      <div class="content-grid">
        <section class="register" aria-label="Request register">
          <div class="register-heading"><h2>Request register</h2><Tag value="Team queue" class="neutral-tag" /></div>
          <Toolbar class="filter-toolbar" aria-label="Request filters">
            <template #start>
              <div class="filter-start">
                <div class="search-field">
                  <label for="request-search">Search requests</label>
                  <IconField class="search-input-wrap">
                    <InputIcon class="search-icon"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg></InputIcon>
                    <InputText id="request-search" v-model="query" type="search" placeholder="Request, supplier, or owner" class="text-input search-input" />
                  </IconField>
                </div>
                <FloatLabel variant="on" class="status-field">
                  <select id="status-filter" v-model="status" class="native-select">
                    <option v-for="choice in dataset.statusFilters" :key="choice" :value="choice">{{ choice }}</option>
                  </select>
                  <label for="status-filter">Status</label>
                </FloatLabel>
              </div>
            </template>
            <template #end><Button label="Reset filters" class="text-button" @click="resetFilters" /></template>
          </Toolbar>
          <DataTable
            :key="resetGeneration"
            :value="filteredRequests"
            data-key="id"
            :table-props="{ 'aria-label': 'Purchase requests' }"
            :pt="{ root: { class: 'request-datatable' }, table: { class: 'request-table' }, tableContainer: { class: 'table-container' } }"
          >
            <Column field="id" header="Request" />
            <Column field="supplier" header="Supplier" />
            <Column field="amount" header="Amount" body-class="amount-cell" />
            <Column field="status" header="Status">
              <template #body="{ data }"><Tag :value="data.status" class="status-tag" :class="`status-${data.status.toLowerCase()}`" /></template>
            </Column>
            <Column field="owner" header="Owner" />
            <Column header="Actions">
              <template #body="{ data }"><RowActions :record="data" @view="viewRequest" @reassign="reassignOwner" /></template>
            </Column>
            <template #empty><div class="empty-state">No requests match these filters. Try another search or reset filters.</div></template>
          </DataTable>
          <div class="register-footer"><span>{{ filteredRequests.length }} of {{ requests.length }} requests</span><span>All amounts in USD · All rows shown</span></div>
          <p v-if="feedback" role="status" class="feedback">{{ feedback }}</p>
        </section>
        <aside class="operations-rail" aria-label="Operations guidance">
          <Panel header="Queue guide" class="rail-panel" :pt="panelPt">
            <ol class="queue-guide"><li><strong>Review status</strong><span>Use the status filter to narrow the register.</span></li><li><strong>Inspect a request</strong><span>Open its row menu for details.</span></li><li><strong>Confirm ownership</strong><span>Reassign locally when responsibility changes.</span></li></ol>
          </Panel>
          <Panel id="reports" header="Register snapshot" class="rail-panel" :pt="panelPt">
            <dl class="snapshot"><div><dt>Approved</dt><dd>{{ countStatus('Approved') }}</dd></div><div><dt>Suppliers in register</dt><dd>{{ new Set(requests.map(record => record.supplier)).size }}</dd></div><div><dt>Storage</dt><dd>This session only</dd></div></dl>
          </Panel>
        </aside>
      </div>
      <section id="help" class="help-section" aria-label="Help center">
        <details><summary>Help center · Procurement policy</summary><p>{{ dataset.chrome.announcement }}</p><p>Row menus offer request details and owner reassignment. Save applies an owner change to this local session; Cancel leaves the record unchanged. Restore workspace reloads the original records.</p></details>
      </section>
    </main>
    <footer class="page-footer"><span>{{ dataset.chrome.footer }}</span><span>Procurement administration · Local data only</span></footer>

    <Dialog v-model:visible="detailOpen" modal :header="`Request ${selected?.id ?? ''}`" :pt="dialogPt" :draggable="false">
      <template v-if="selected">
        <p class="dialog-intro">Purchase request details</p>
        <dl class="request-facts"><div><dt>Request</dt><dd>{{ selected.id }}</dd></div><div><dt>Supplier</dt><dd>{{ selected.supplier }}</dd></div><div><dt>Amount</dt><dd>{{ selected.amount }}</dd></div><div><dt>Status</dt><dd>{{ selected.status }}</dd></div><div><dt>Owner</dt><dd>{{ selected.owner }}</dd></div></dl>
      </template>
      <template #footer><Button label="Close" class="secondary-button" @click="detailOpen = false" /><Button v-if="selected" label="Reassign owner" class="primary-button" @click="reassignOwner(selected)" /></template>
    </Dialog>
    <Dialog v-model:visible="reassignOpen" modal :header="`Reassign owner · ${selected?.id ?? ''}`" :pt="dialogPt" :draggable="false">
      <form id="owner-form" @submit.prevent="saveOwner">
        <p class="dialog-intro">Change the responsible owner for {{ selected?.id }}.</p>
        <p class="current-owner">Current owner: <strong>{{ selected?.owner }}</strong></p>
        <label for="owner-choice">New owner</label>
        <select id="owner-choice" v-model="draftOwner" class="native-select" required><option v-for="owner in owners" :key="owner" :value="owner">{{ owner }}</option></select>
        <p class="field-help">This change is local. Other request facts remain unchanged.</p>
      </form>
      <template #footer><Button label="Cancel" class="secondary-button" @click="cancelReassignment" /><Button label="Save owner" type="submit" form="owner-form" class="primary-button" /></template>
    </Dialog>
  </div>
</template>
