// Independent representations of the same goals, never generated from the oracle.
const chrome = `<nav>Overview Reports Help</nav>
  <aside>Read the latest procurement policy.</aside><footer>Terms Privacy Status</footer>`;

function table(mode: "browsing" | "overflow" | "inline" | "toolbar" | "popup"): string {
  return `${chrome}
    <label>Search requests <input value=""></label>
    <label>Status <select><option selected>All statuses</option><option>Overdue</option><option>Pending</option><option>Approved</option></select></label>
    <table id="requests">
      <thead><tr><th>Request</th><th>Supplier</th><th>Amount</th><th>Status</th><th>Owner</th><th>Actions</th></tr></thead>
      <tbody>
        <tr><td>RQ-1041</td><td>Acme Supplies</td><td>$2,400.00</td><td>Approved</td><td>Jamie Chen</td><td><button>Actions</button></td></tr>
        <tr ${mode === "toolbar" ? 'aria-selected="true"' : ""}><td>RQ-1042</td><td>Acme Supplies</td><td>$1,200.00</td><td>Overdue</td><td>Morgan Lee</td>
          <td>${mode === "inline"
            ? '<a href="/request/RQ-1042">View details</a><button>Change owner</button>'
            : mode === "popup"
              ? '<button aria-expanded="true" aria-controls="row-menu">Actions</button>'
              : '<button>Actions</button>'}</td></tr>
        <tr><td>RQ-1043</td><td>Northwind Services</td><td>$1,200.00</td><td>Pending</td><td>Jamie Chen</td><td><button>Actions</button></td></tr>
      </tbody>
    </table>
    ${mode === "overflow" ? `<section aria-label="Actions for RQ-1042">
      <div role="menu"><button role="menuitem">View request</button><button role="menuitem">Reassign owner</button></div>
    </section>` : ""}
    ${mode === "toolbar" ? `<div role="toolbar" aria-label="Selected request actions" aria-controls="requests">
      <button><img src="view.svg" alt="Open request"></button>
      <button aria-label="Change owner"><svg></svg></button>
    </div>` : ""}
    ${mode === "popup" ? `<div role="menu" id="row-menu">
      <div role="menuitem" tabindex="0">View request</div><div role="menuitem" tabindex="0">Reassign owner</div>
    </div>` : ""}`;
}

function form(invalid: boolean, choices = false): string {
  return `${chrome}<form>
    ${choices
      ? '<section aria-label="Supplier"><p>Required</p><button>Choose supplier</button></section>'
      : '<label>Supplier <select required><option selected>Select supplier</option><option>Acme Supplies</option></select></label>'}
    ${choices
      ? '<section aria-label="Cost center"><label><input type="radio" name="cost" checked>Operations</label><label><input type="radio" name="cost">Finance</label></section>'
      : '<label>Cost center <select><option selected>Operations</option><option>Finance</option></select></label>'}
    <label>Amount <input type="${choices ? "text" : "number"}" required value="${invalid ? "0" : ""}"
      ${invalid ? 'aria-invalid="true" aria-describedby="amount-error"' : ""}></label>
    ${invalid ? '<p id="amount-error">Amount must be greater than zero.</p><p>Please correct the highlighted fields.</p>' : ""}
    <label>Requested delivery <input type="text" value="2026-06-30"></label>
    <label>Justification <textarea></textarea></label>
    ${choices ? '<button aria-label="Send request"><img alt="" src="send.svg"></button>' : '<button>Submit request</button>'}
  </form>`;
}

const summary = `${chrome}
  <div role="tablist"><button role="tab" aria-selected="true">Summary</button><button role="tab" aria-selected="false">History</button></div>
  <section aria-label="Request summary">
    <h2>Request RQ-1042</h2>
    <p>Supplier: Acme Supplies</p><p>Amount: $1,200.00</p><p>Status: Overdue</p>
    <button>Approve request</button>
  </section>`;

const detailsWithoutTabs = `${chrome}
  <a href="/request/RQ-1042/activity">Activity</a>
  <section aria-label="Request details"><h2>Request RQ-1042</h2>
    <dl><dt>Supplier</dt><dd>Acme Supplies</dd><dt>Amount</dt><dd>$1,200.00</dd><dt>Status</dt><dd>Overdue</dd></dl>
  </section>
  <div role="toolbar" aria-label="Actions for RQ-1042">
    <button aria-label="Review approval"><img src="approve.svg" alt=""></button>
  </div>`;

const inlineReview = `${chrome}<section aria-label="Review approval">
  <h2>Review approval</h2>
  <dl><dt>Request</dt><dd>RQ-1042</dd><dt>Supplier</dt><dd>Acme Supplies</dd><dt>Amount</dt><dd>$1,200.00</dd></dl>
  <button aria-label="Approve"><img src="approve.svg" alt=""></button><a href="/requests">Go back</a>
</section>`;

const cards = `${chrome}
  <label>Find requests <input type="search" value=""></label>
  <section aria-label="Filter by status">
    <label><input type="radio" name="status" checked>All statuses</label>
    <label><input type="radio" name="status">Overdue</label>
    <label><input type="radio" name="status">Pending</label>
    <label><input type="radio" name="status">Approved</label>
  </section>
  <section aria-label="Request RQ-1041"><p>Amount: $2,400.00</p><button>View details</button></section>
  <section aria-label="Request RQ-1042">
    <h2>Request RQ-1042</h2><dl><dt>Supplier</dt><dd>Acme Supplies</dd><dt>Amount</dt><dd>$1,200.00</dd>
      <dt>Status</dt><dd>Overdue</dd><dt>Owner</dt><dd>Morgan Lee</dd></dl>
    <a href="/request/RQ-1042">View details</a><button>Change owner</button>
  </section>`;

export const positiveControls: Record<string, string> = {
  "records/browsing": table("browsing"),
  "records/target-actions-available": table("overflow"),
  "request-form/initialized": form(false),
  "request-form/validation-errors": form(true),
  "request-detail/details-available": summary,
  "request-detail/approval-review": `<div aria-hidden="true">${summary}</div>
    <div role="dialog" aria-label="Approve request RQ-1042">
      <p>Approve RQ-1042 for Acme Supplies, amount $1,200.00?</p>
      <button>Confirm approval</button><button>Cancel</button>
    </div>`,
};

export const equivalentControls: Record<string, string[]> = {
  "records/browsing": [cards],
  "records/target-actions-available": [table("inline"), table("toolbar"), table("popup"), cards],
  "request-form/initialized": [form(false, true)],
  "request-form/validation-errors": [form(true, true)],
  "request-detail/details-available": [detailsWithoutTabs],
  "request-detail/approval-review": [inlineReview],
};

export const negativeControls: Record<string, { output: string; missingItem: string }> = {
  "records/browsing": {
    output: table("browsing").replace("<td>Morgan Lee</td>", "<td>Jamie Chen</td>"),
    missingItem: "request-facts",
  },
  "records/target-actions-available": {
    output: table("overflow").replace('aria-label="Actions for RQ-1042"', 'aria-label="Actions for RQ-1043"'),
    missingItem: "view-request",
  },
  "request-form/initialized": {
    output: form(false).replace("<button>Submit request</button>", "<span>Submit request</span>"),
    missingItem: "submit",
  },
  "request-form/validation-errors": {
    output: form(true).replace('aria-describedby="amount-error"', ""),
    missingItem: "amount",
  },
  "request-detail/details-available": {
    output: summary.replace("<button>Approve request</button>", "<span>Approve request</span>"),
    missingItem: "approve",
  },
  "request-detail/approval-review": {
    output: positiveControls["request-detail/approval-review"]!.replace(
      "<button>Confirm approval</button>", "<button disabled>Confirm approval</button>",
    ),
    missingItem: "confirm",
  },
};

export const wrongActionAssociations = [
  table("toolbar").replace('aria-selected="true"', 'aria-selected="false"'),
  table("toolbar").replace('aria-controls="requests"', ""),
  table("toolbar").replace('aria-controls="requests"', 'aria-controls="missing"'),
  table("toolbar").replace("<tr><td>RQ-1043</td>", '<tr aria-selected="true"><td>RQ-1043</td>'),
  table("toolbar").replace('aria-selected="true"', "").replace("<tr><td>RQ-1043</td>", '<tr aria-selected="true"><td>RQ-1043</td>'),
  table("toolbar").replace('<img src="view.svg" alt="Open request">', '<img src="view.svg" alt="">'),
  table("popup").replace('aria-controls="row-menu"', 'aria-controls="missing"'),
  table("popup").replace('aria-expanded="true"', 'aria-expanded="false"'),
  table("popup").replace('id="row-menu"', 'hidden id="row-menu"'),
  table("popup").replace('<div role="menuitem" tabindex="0">View request</div>', '<div role="menuitem" tabindex="0" aria-disabled="true">View request</div>'),
];
