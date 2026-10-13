import { useMemo, useState } from "react";
import {
  Avatar, Badge, Button, DataGrid, DataGridBody, DataGridCell,
  DataGridHeader, DataGridHeaderCell, DataGridRow, Dialog, DialogActions,
  DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input,
  Select, TableCellLayout, Toolbar, ToolbarButton, ToolbarDivider,
  createTableColumn,
} from "@fluentui/react-components";
import type { TableRowId } from "@fluentui/react-components";
import { dataset } from "@perception-bench/scenarios";

type Request = { id: string; supplier: string; amount: string; status: string; owner: string };
type DialogKind = "view" | "reassign" | null;
const freshRequests = (): Request[] => dataset.requests.map(request => ({ ...request }));
const owners = [...new Set(dataset.requests.map(request => request.owner))];
const navigationTargets = ["#queue-overview", "#requests", "#queue-summary", "#handling-guide"];

function StatusBadge({ status }: { status: string }) {
  return <Badge appearance="tint" color={status === "Overdue" ? "danger" : status === "Approved" ? "success" : "warning"} shape="rounded">{status}</Badge>;
}

export function App() {
  const [requests, setRequests] = useState(freshRequests);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [selectedItems, setSelectedItems] = useState<Set<TableRowId>>(new Set());
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draftOwner, setDraftOwner] = useState<string>(owners[0]!);
  const [notice, setNotice] = useState("");
  const selected = requests.find(request => selectedItems.has(request.id));
  const visibleRequests = requests.filter(request =>
    (status === "All statuses" || request.status === status) &&
    Object.values(request).join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const columns = useMemo(() => [
    createTableColumn<Request>({ columnId: "request", renderHeaderCell: () => "Request", renderCell: item => <strong className="request-id">{item.id}</strong> }),
    createTableColumn<Request>({ columnId: "supplier", renderHeaderCell: () => "Supplier", renderCell: item => item.supplier }),
    createTableColumn<Request>({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: item => <span className="amount">{item.amount}</span> }),
    createTableColumn<Request>({ columnId: "status", renderHeaderCell: () => "Status", renderCell: item => <StatusBadge status={item.status} /> }),
    createTableColumn<Request>({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: item => (
      <TableCellLayout media={<Avatar name={item.owner} size={24} aria-hidden="true" color="neutral" />}>{item.owner}</TableCellLayout>
    ) }),
  ], []);

  function clearSelection() {
    setSelectedItems(new Set());
    setNotice("");
  }
  function filterStatus(next: string) {
    setStatus(next);
    clearSelection();
  }
  function reset() {
    setRequests(freshRequests());
    setQuery("");
    setStatus("All statuses");
    setDialog(null);
    setDraftOwner(owners[0]!);
    clearSelection();
  }
  function openDialog(kind: Exclude<DialogKind, null>) {
    if (!selected) return;
    setDraftOwner(selected.owner);
    setDialog(kind);
  }
  function saveOwner() {
    if (!selected) return;
    setRequests(current => current.map(request => request.id === selected.id ? { ...request, owner: draftOwner } : request));
    setNotice(`${selected.id} reassigned to ${draftOwner}. Changes apply to this session only.`);
    setDialog(null);
  }

  return (
    <div className="console">
      <a className="skip-link" href="#requests">Skip to purchase requests</a>
      <header className="app-header">
        <div className="product-mark" aria-hidden="true">P</div>
        <span className="product-name">{dataset.chrome.brand}</span>
        <span className="product-divider" aria-hidden="true" />
        <span>Request operations</span>
        <div className="header-profile"><Badge appearance="outline" color="informative">Local workspace</Badge><Avatar name="Operations team" size={28} aria-label="Operations team" /></div>
      </header>
      <nav className="module-nav" aria-label="Workspace">
        {dataset.chrome.navigation.map((label, index) => <Button as="a" key={label} href={navigationTargets[index]} appearance="subtle" aria-current={label === "Requests" ? "page" : undefined}>{label}</Button>)}
        <span className="module-caption">PROCUREMENT / CASE MANAGEMENT</span>
      </nav>
      <main>
        <div className="page-heading">
          <div><p className="eyebrow">Operations desk</p><h1>Purchase requests</h1><p className="muted">Triage the queue, inspect request details, and route work to an owner.</p></div>
          <Button onClick={reset}>Reset workspace</Button>
        </div>
        <section id="queue-overview" className="overview-strip" aria-label="Queue overview">
          <div><span className="metric-value">{requests.length}</span><span>Total requests</span></div>
          {dataset.statusFilters.slice(1).map(label => <div key={label}><span className={`metric-value ${label === "Overdue" ? "attention" : ""}`}>{requests.filter(request => request.status === label).length}</span><span>{label}</span></div>)}
          <p className="overview-note"><strong>Review sequence</strong><br />Intake <span aria-hidden="true">/</span> Triage <span aria-hidden="true">/</span> Owner review</p>
        </section>

        <div className="work-area">
          <section id="requests" className="queue-panel" aria-labelledby="queue-heading">
            <div className="panel-heading"><div><h2 id="queue-heading">Request queue</h2><p className="muted">All business units · Amounts in USD</p></div><Badge appearance="outline" color="brand">{visibleRequests.length} of {requests.length} requests</Badge></div>
            <div className="filters">
              <Field label="Search requests" className="search-field"><Input type="search" value={query} placeholder="Request, supplier, or owner" onChange={(_, data) => { setQuery(data.value); clearSelection(); }} /></Field>
              <Field label="Status"><Select value={status} onChange={(_, data) => filterStatus(data.value)}>{dataset.statusFilters.map(choice => <option key={choice} value={choice}>{choice}</option>)}</Select></Field>
              <Button appearance="subtle" onClick={reset}>Reset filters</Button>
            </div>
            <div className="command-slot">
              {selected ? <Toolbar aria-label={`Actions for ${selected.id}`} aria-controls="request-grid" size="small" className="request-toolbar">
                <span className="selection-cue">{selected.id} selected</span>
                <ToolbarDivider />
                <ToolbarButton onClick={() => openDialog("view")}>View request</ToolbarButton>
                <ToolbarButton onClick={() => openDialog("reassign")}>Reassign owner</ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton onClick={clearSelection}>Clear selection</ToolbarButton>
              </Toolbar> : <p className="selection-help">Select a request to view details or reassign its owner.</p>}
            </div>
            <div className="grid-scroll">
              <DataGrid id="request-grid" aria-label="Purchase requests" items={visibleRequests} columns={columns} getRowId={item => item.id} selectionMode="single" selectedItems={selectedItems} onSelectionChange={(_, data) => { setSelectedItems(new Set(data.selectedItems)); setNotice(""); }} focusMode="composite" size="small" className="requests-grid">
                <DataGridHeader><DataGridRow selectionCell={{ "aria-label": "Selection" }}>
                  {({ renderHeaderCell, columnId }) => <DataGridHeaderCell id={`column-${columnId}`}>{renderHeaderCell()}</DataGridHeaderCell>}
                </DataGridRow></DataGridHeader>
                <DataGridBody<Request>>{({ item, rowId }) => <DataGridRow<Request> key={rowId} aria-selected={selectedItems.has(rowId)} selectionCell={{ radioIndicator: { "aria-label": `Select ${item.id}` } }}>
                  {({ renderCell, columnId }) => <DataGridCell aria-describedby={`column-${columnId}`}>{renderCell(item)}</DataGridCell>}
                </DataGridRow>}</DataGridBody>
              </DataGrid>
            </div>
            {visibleRequests.length === 0 && <p className="empty-state">No matching requests. Change the search or reset filters to show the full queue.</p>}
            <div className="queue-footer"><span>{visibleRequests.length} requests shown · {selected ? "1 selected" : "None selected"}</span><span>Single-record actions</span></div>
            <p className="session-notice" role="status">{notice}</p>
          </section>

          <aside className="desk-sidebar" aria-label="Triage desk">
            <section className="side-panel"><p className="eyebrow">Work focus</p><h2>Keep the queue moving</h2><p>Review overdue requests first, then confirm ownership before the next approval step.</p><Button appearance="primary" onClick={() => { setQuery(""); filterStatus("Overdue"); }}>Show overdue requests</Button><div className="side-note">All changes stay in this workspace session. Reset restores the original queue.</div></section>
            <section className="side-panel" id="handling-guide"><h2>Handling guide</h2><ol className="handling-steps"><li><strong>Inspect the request</strong><span>Check supplier, amount and current status.</span></li><li><strong>Confirm accountability</strong><span>Use Reassign owner when another reviewer should take over.</span></li><li><strong>Continue review</strong><span>Close the detail dialog to return to the queue.</span></li></ol></section>
          </aside>
        </div>

        <section id="queue-summary" className="reference-panel" aria-labelledby="reference-heading">
          <h2 id="reference-heading">Procurement reference</h2>
          <div className="reference-columns">
            <div><h3>Owner directory</h3>{owners.map(owner => <div className="directory-entry" key={owner}><Avatar name={owner} size={24} aria-hidden="true" /><span>{owner}</span><span className="muted">{requests.filter(request => request.owner === owner).length} assigned</span></div>)}</div>
            <div><h3>Supplier directory</h3><ul>{dataset.suppliers.map(supplier => <li key={supplier}>{supplier}</li>)}</ul></div>
            <div><h3>Cost centers</h3><ul>{dataset.costCenters.map(center => <li key={center}>{center}</li>)}</ul></div>
            <div><h3>Policy bulletin</h3><p>{dataset.chrome.announcement}</p><a href="#handling-guide">Read the handling guide</a></div>
          </div>
        </section>
        <footer><span>{dataset.chrome.footer}</span><span>Synthetic procurement workspace · No backend connection</span></footer>
      </main>

      <Dialog open={dialog !== null && !!selected} onOpenChange={(_, data) => { if (!data.open) setDialog(null); }}>
        <DialogSurface className="request-dialog">
          {selected && <DialogBody>
            <DialogTitle>{dialog === "reassign" ? "Reassign owner" : "View request"} · {selected.id}</DialogTitle>
            <DialogContent>
              {dialog === "view" ? <><p className="dialog-intro">Request details from the current work queue.</p><dl className="request-facts"><dt>Request</dt><dd>{selected.id}</dd><dt>Supplier</dt><dd>{selected.supplier}</dd><dt>Amount</dt><dd>{selected.amount}</dd><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd><dt>Owner</dt><dd>{selected.owner}</dd></dl></> : <><p className="dialog-intro">Choose who is responsible for {selected.id} from {selected.supplier}.</p><p className="current-owner">Current owner: <strong>{selected.owner}</strong></p><Field label="New owner"><Select value={draftOwner} onChange={(_, data) => setDraftOwner(data.value)}>{owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}</Select></Field><p className="muted dialog-note">Saving updates the queue locally. Cancel leaves the current owner unchanged.</p></>}
            </DialogContent>
            <DialogActions>
              {dialog === "reassign" ? <><Button onClick={() => setDialog(null)}>Cancel</Button><Button appearance="primary" onClick={saveOwner}>Save owner</Button></> : <Button appearance="primary" onClick={() => setDialog(null)}>Close</Button>}
            </DialogActions>
          </DialogBody>}
        </DialogSurface>
      </Dialog>
    </div>
  );
}
