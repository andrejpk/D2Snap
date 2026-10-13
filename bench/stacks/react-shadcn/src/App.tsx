import { useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import * as Toolbar from "@radix-ui/react-toolbar";
import * as Dialog from "@radix-ui/react-dialog";
import { dataset } from "@perception-bench/scenarios";
import {
  ArrowUpRight, Bell, Building2, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, Eye, FileText, LayoutDashboard, Search,
  ShieldCheck, SlidersHorizontal, UserRoundCog, Wallet, X,
} from "lucide-react";
import {
  Table, TableBody, TableCaption, TableCell, TableHead,
  TableHeader, TableRow,
} from "./components/ui/table";

type RequestRecord = Omit<(typeof dataset.requests)[number], "owner"> & { owner: string };
type Info = { kind: "info"; title: string; content: ReactNode };
type Panel = Info | { kind: "details" | "owner"; id: string } | null;
const owners = [...new Set(dataset.requests.map(request => request.owner))];
const formatMoney = (amount: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(amount);
const totalAmount = (records: RequestRecord[]) => records.reduce(
  (sum, record) => sum + Number(record.amount.replace(/[$,]/g, "")), 0,
);

export function App() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case") ?? "records";
  const variant = params.get("variant") ?? "icon-toolbar";
  if (caseId !== "records" || variant !== "icon-toolbar") {
    const recoveryParams = new URLSearchParams(params);
    recoveryParams.set("case", "records");
    recoveryParams.set("variant", "icon-toolbar");
    return <main className="unsupported" role="alert">
      <h1>Unsupported workspace view</h1>
      <p>This fixture supports records / icon-toolbar only.</p>
      <a href={`?${recoveryParams.toString()}`}>Open purchase requests</a>
    </main>;
  }
  return <RecordsWorkspace />;
}

function RecordsWorkspace() {
  const [records, setRecords] = useState<RequestRecord[]>(() => dataset.requests.map(row => ({ ...row })));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("All statuses");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [nextOwner, setNextOwner] = useState("");
  const [notice, setNotice] = useState("");
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const visibleRecords = records.filter(record => (
    (status === "All statuses" || record.status === status)
    && [record.id, record.supplier, record.owner, record.status, record.amount]
      .some(value => value.toLowerCase().includes(query.trim().toLowerCase()))
  ));
  const selected = records.find(record => record.id === selectedId);
  const panelRecord = panel && panel.kind !== "info"
    ? records.find(record => record.id === panel.id) : undefined;

  function resetFilters() {
    setQuery("");
    setStatus("All statuses");
    setSelectedId(null);
    setNotice("");
  }

  function openPanel(event: MouseEvent<HTMLButtonElement>, next: Exclude<Panel, null>) {
    returnFocus.current = event.currentTarget;
    if (next.kind === "owner") {
      const record = records.find(row => row.id === next.id);
      if (!record) throw new Error("Cannot reassign a request that is not in this workspace.");
      setNextOwner(record.owner);
    }
    setPanel(next);
  }

  const policy: Info = {
    kind: "info", title: "Procurement help center",
    content: <><p>Keep supplier details and ownership up to date before a request moves to approval.</p>
      <h3>Working with requests</h3><p>Search by request number, supplier, status, amount, or owner.
      Select a row to view its details or reassign responsibility. Use the arrow keys to move between toolbar actions.</p>
      <h3>Approved suppliers</h3><ul>{dataset.suppliers.map(supplier => <li key={supplier}>{supplier}</li>)}</ul>
      <p>Contact your procurement team for policy exceptions. Changes in this preview stay in this browser session and reset on reload.</p></>,
  };

  return (
    <div className="workspace">
      <a className="skip-link" href="#requests">Skip to requests</a>
      <header className="topbar">
        <a className="brand" href="#requests"><span className="brand-mark"><Building2 aria-hidden="true" size={22} /></span>
          <span>{dataset.chrome.brand}<small>OPERATIONS / NORTH AMERICA</small></span></a>
        <div className="topbar-right"><span className="environment"><span className="service-dot" />Workspace preview</span>
          <button className="icon-button" aria-label="Notifications" title="Notifications" onClick={event => openPanel(event, {
            kind: "info", title: "Notifications", content: <p>You’re all caught up. Request status changes will appear here.</p>,
          })}><Bell aria-hidden="true" size={19} /></button>
          <span className="profile"><span className="avatar">AL</span><span>Alex Lawson<small>Procurement team</small></span></span>
        </div>
      </header>

      <aside className="sidebar">
        <div><p className="eyebrow sidebar-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {dataset.chrome.navigation.map((name, index) => {
              const NavIcon = [LayoutDashboard, FileText, Wallet, CircleHelp][index] ?? FileText;
              return name === "Help"
                ? <button key={name} onClick={event => openPanel(event, policy)}><NavIcon size={18} aria-hidden="true" />{name}</button>
                : <a key={name} href={name === "Overview" ? "#overview" : name === "Reports" ? "#spend-summary" : "#requests"}
                  aria-current={name === "Requests" ? "page" : undefined}>
                  <NavIcon size={18} aria-hidden="true" />{name}{name === "Requests" && <span className="nav-count">{records.length}</span>}
                </a>;
            })}
          </nav>
          <div className="sidebar-group"><p className="eyebrow">COST CENTERS</p>
            {dataset.costCenters.map(center => <div className="cost-center" key={center}><span className="small-square" />{center}</div>)}
          </div>
        </div>
        <div className="sidebar-note"><ShieldCheck size={23} aria-hidden="true" /><strong>Good records. Clear decisions.</strong>
          <p>Keep ownership current so requests reach the right people.</p>
          <button className="text-button" onClick={event => openPanel(event, policy)}>Workspace guide <ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
      </aside>

      <main className="main-content">
        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><span>Requests</span></div>
        <section className="page-heading" aria-labelledby="page-title">
          <div><p className="eyebrow">PURCHASING OPERATIONS</p><h1 id="page-title">Purchase requests</h1>
            <p>Track spend, review progress, and keep every request moving.</p></div>
          <span className="date-label"><Clock3 size={15} aria-hidden="true" />15 June 2026</span>
        </section>

        <section className="summary-grid" id="overview" aria-label="Request overview">
          <Summary label="Total requested" value={formatMoney(totalAmount(records))} detail={`${records.length} requests across your workspace`} icon={<Wallet />} />
          <Summary label="Awaiting resolution" value={String(records.filter(row => row.status !== "Approved").length)}
            detail="Pending or overdue requests" icon={<Clock3 />} />
          <Summary label="Approved spend" value={formatMoney(totalAmount(records.filter(row => row.status === "Approved")))}
            detail={`${records.filter(row => row.status === "Approved").length} approved request`} icon={<CheckCircle2 />} />
        </section>

        <section className="request-card" id="requests" aria-labelledby="requests-title">
          <div className="card-heading"><div className="heading-inline"><h2 id="requests-title">All requests</h2><span className="count-badge">{records.length}</span></div>
            <span className="muted">Shared procurement queue</span></div>
          <div className="filters">
            <div className="search-field"><Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Search requests" placeholder="Search requests…" value={query}
                onChange={event => { setQuery(event.target.value); setSelectedId(null); }} />
            </div>
            <div className="status-field"><SlidersHorizontal size={16} aria-hidden="true" /><label htmlFor="status-filter">Status</label>
              <select id="status-filter" value={status} onChange={event => { setStatus(event.target.value); setSelectedId(null); }}>
                {dataset.statusFilters.map(filter => <option key={filter} value={filter}>{filter}</option>)}
              </select>
            </div>
            <button className="button secondary" onClick={resetFilters} disabled={query === "" && status === "All statuses" && !selectedId}>Reset</button>
          </div>

          <div className={`selection-strip ${selected ? "has-selection" : ""}`}>
            {selected ? <><span><strong>1 request selected</strong><span className="selection-id">{selected.id}</span></span>
              <Toolbar.Root className="action-toolbar" aria-label="Request actions" aria-controls="requests-table" loop>
                <Toolbar.Button className="icon-button" aria-label="View request" title="View request"
                  onClick={event => openPanel(event, { kind: "details", id: selected.id })}><Eye size={19} aria-hidden="true" /></Toolbar.Button>
                <Toolbar.Button className="icon-button" aria-label="Reassign owner" title="Reassign owner"
                  onClick={event => openPanel(event, { kind: "owner", id: selected.id })}><UserRoundCog size={19} aria-hidden="true" /></Toolbar.Button>
                <Toolbar.Separator className="toolbar-separator" />
                <Toolbar.Button className="icon-button" aria-label="Clear selection" title="Clear selection"
                  onClick={() => setSelectedId(null)}><X size={18} aria-hidden="true" /></Toolbar.Button>
              </Toolbar.Root>
            </> : <span>Select a request to view details or change its owner.</span>}
          </div>

          <Table id="requests-table">
            <TableCaption>Purchase requests · {visibleRecords.length} of {records.length} shown</TableCaption>
            <TableHeader><TableRow>
              <TableHead scope="col" className="selection-cell"><span className="sr-only">Select</span></TableHead>
              <TableHead scope="col">Request</TableHead><TableHead scope="col">Supplier</TableHead>
              <TableHead scope="col" className="amount">Amount</TableHead><TableHead scope="col">Status</TableHead><TableHead scope="col">Owner</TableHead>
            </TableRow></TableHeader>
            <TableBody>{visibleRecords.map(record => <TableRow key={record.id} aria-selected={selectedId === record.id}
              onClick={() => setSelectedId(current => current === record.id ? null : record.id)}>
              <TableCell className="selection-cell"><input type="checkbox" aria-label={`Select ${record.id}`} checked={selectedId === record.id}
                onClick={event => event.stopPropagation()} onChange={event => setSelectedId(event.target.checked ? record.id : null)} /></TableCell>
              <TableCell><span className="request-id">{record.id}</span></TableCell>
              <TableCell><span className="supplier-name">{record.supplier}</span></TableCell>
              <TableCell className="amount">{record.amount}</TableCell>
              <TableCell><span className={`status-badge status-${record.status.toLowerCase()}`}><span className="status-dot" />{record.status}</span></TableCell>
              <TableCell><span className="owner"><span className="avatar small" aria-hidden="true">{record.owner.split(" ").map(part => part[0]).join("")}</span>{record.owner}</span></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {visibleRecords.length === 0 && <div className="empty-state"><Search size={24} aria-hidden="true" /><h3>No requests found</h3>
            <p>Try another search or reset your filters.</p><button className="button secondary" onClick={resetFilters}>Show all requests</button></div>}
          <div className="table-bottom"><span>{visibleRecords.length} request{visibleRecords.length === 1 ? "" : "s"} in view</span><span>All amounts in USD</span></div>
        </section>

        <div className="below-grid">
          <section className="support-card" id="spend-summary" aria-labelledby="spend-title">
            <div className="card-heading"><h2 id="spend-title">Spend by status</h2><span className="muted">Workspace total</span></div>
            <div className="spend-list">{dataset.statusFilters.filter(filter => filter !== "All statuses").map(filter => {
              const matching = records.filter(record => record.status === filter);
              return <div key={filter} className="spend-row"><span>{filter}</span><span className="spend-track"><span
                style={{ width: `${totalAmount(matching) / totalAmount(records) * 100}%` }} /></span>
                <strong>{formatMoney(totalAmount(matching))}</strong></div>;
            })}</div>
          </section>
          <section className="support-card policy-card" aria-labelledby="policy-title"><span className="policy-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
            <div><p className="eyebrow">POLICY & GUIDANCE</p><h2 id="policy-title">A little clarity goes a long way.</h2>
              <p>{dataset.chrome.announcement}</p><button className="text-button" onClick={event => openPanel(event, policy)}>Visit help center <ArrowUpRight size={15} aria-hidden="true" /></button></div>
          </section>
        </div>
        <p className="notice" role="status">{notice}</p>
        <footer><span>Procurement workspace · Internal preview</span><div>
          {dataset.chrome.footer.split(" | ").map(label => <button key={label} className="text-button" onClick={event => openPanel(event, {
            kind: "info", title: label, content: <p>{label === "Terms"
              ? "This local workspace is a demonstration, not a purchasing system. No purchase orders are submitted."
              : label === "Privacy" ? "The workspace uses synthetic records only. Edits stay in memory and are cleared on reload."
                : "The local workspace is available. No external procurement services are connected."}</p>,
          })}>{label}</button>)}
        </div></footer>
      </main>

      <Dialog.Root open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content"
          onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
          <Dialog.Title>{panel?.kind === "info" ? panel.title : panel?.kind === "owner" ? `Reassign owner · ${panel.id}` : `Request ${panel?.id ?? ""}`}</Dialog.Title>
          <Dialog.Description>{panel?.kind === "info" ? "Procurement workspace information" : panel?.kind === "owner"
            ? "Choose the person responsible for this request. Changes are local to this workspace preview."
            : "Purchase request details from the shared procurement queue."}</Dialog.Description>
          {panel?.kind === "info" ? <div className="dialog-body">{panel.content}</div> : panelRecord && <>
            <dl className="request-facts">{([
              ["Request", panelRecord.id], ["Supplier", panelRecord.supplier], ["Amount", panelRecord.amount],
              ["Status", panelRecord.status], ["Owner", panelRecord.owner],
            ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {panel?.kind === "owner" && <form onSubmit={event => {
              event.preventDefault();
              if (!owners.some(owner => owner === nextOwner)) throw new Error("Choose an available owner.");
              setRecords(current => current.map(record => record.id === panelRecord.id ? { ...record, owner: nextOwner } : record));
              setNotice(`${panelRecord.id} is now assigned to ${nextOwner}.`);
              setPanel(null);
            }}><label className="form-label" htmlFor="new-owner">New owner</label>
              <select id="new-owner" value={nextOwner} onChange={event => setNextOwner(event.target.value)} required>
                {owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
              </select><div className="dialog-actions"><Dialog.Close asChild><button type="button" className="button secondary">Cancel</button></Dialog.Close>
                <button type="submit" className="button primary" disabled={nextOwner === panelRecord.owner}><Check size={16} aria-hidden="true" />Save owner</button></div>
            </form>}
          </>}
          {panel?.kind !== "owner" && <div className="dialog-actions"><Dialog.Close asChild><button className="button secondary">Done</button></Dialog.Close></div>}
          <Dialog.Close asChild><button className="icon-button dialog-close" aria-label="Close dialog"><X size={19} aria-hidden="true" /></button></Dialog.Close>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Summary({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="summary-card"><div className="summary-label"><span>{label}</span><span className="summary-icon" aria-hidden="true">{icon}</span></div>
    <strong className="summary-value">{value}</strong><p>{detail}</p></article>;
}
