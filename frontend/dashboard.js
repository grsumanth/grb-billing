const API = '';  // same origin — backend serves frontend

let products  = [];
let customers = [];
let currentBill = [];

// ── PAGE NAV ──────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-' + page).classList.add('active');
  const titles = { billing:'Billing', customers:'Customers', products:'Products', reports:'Reports & Analytics' };
  document.getElementById('pageTitle').textContent = titles[page];
  if (page === 'products')  loadProducts();
  if (page === 'customers') loadCustomers();
  if (page === 'reports')   loadReports();
}

// ── PRODUCTS ──────────────────────────────────────
async function loadProducts(search = '') {
  try {
    const url = search ? `/api/products?search=${encodeURIComponent(search)}` : '/api/products';
    const res  = await fetch(url);
    products   = await res.json();
    renderProductTable();
    populateProductDropdown();
  } catch (err) {
    console.error('Failed to load products', err);
  }
}

function openProductModal(id = null) {
  document.getElementById('productEditId').value = id || '';
  document.getElementById('productModalTitle').textContent = id ? 'Edit Product' : 'Add Product';
  if (id) {
    const p = products.find(x => x.id === id);
    document.getElementById('prodName').value  = p.name;
    document.getElementById('prodType').value  = p.type;
    document.getElementById('prodPrice').value = p.price;
  } else {
    document.getElementById('prodName').value  = '';
    document.getElementById('prodType').value  = 'Piece';
    document.getElementById('prodPrice').value = '';
  }
  document.getElementById('productModal').classList.remove('hidden');
}

async function saveProduct() {
  const name  = document.getElementById('prodName').value.trim();
  const type  = document.getElementById('prodType').value;
  const price = parseFloat(document.getElementById('prodPrice').value);
  if (!name || isNaN(price) || price < 0) { alert('Please fill in all required fields correctly.'); return; }

  const editId = document.getElementById('productEditId').value;
  const method = editId ? 'PUT' : 'POST';
  const url    = editId ? `/api/products/${editId}` : '/api/products';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, price })
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    await loadProducts();
    closeModal('productModal');
  } catch (err) {
    alert('Failed to save product.');
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await loadProducts();
  } catch (err) {
    alert('Failed to delete product.');
  }
}

function renderProductTable() {
  const tbody = document.getElementById('productBody');
  const empty = document.getElementById('productEmpty');
  tbody.innerHTML = '';
  if (!products.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  products.forEach((p, i) => {
    tbody.innerHTML += `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(p.name)}</strong></td>
      <td><span style="background:#fff0e8;color:#780116;padding:.2rem .6rem;border-radius:6px;font-size:.78rem;font-weight:700">${esc(p.type)}</span></td>
      <td><strong>₹${parseFloat(p.price).toFixed(2)}</strong></td>
      <td>
        <button class="btn-edit" onclick="openProductModal('${p.id}')">✏ Edit</button>
        <button class="btn-del" onclick="deleteProduct('${p.id}')">🗑</button>
      </td></tr>`;
  });
}

function searchProductTable(q) {
  loadProducts(q);
}

function populateProductDropdown() {
  const sel = document.getElementById('productSelect');
  const val = sel.value;
  sel.innerHTML = '<option value="">-- Select Product --</option>';
  products.forEach(p => {
    sel.innerHTML += `<option value="${p.id}">${esc(p.name)} (${p.type}) — ₹${p.price}</option>`;
  });
  if (val) sel.value = val;
}

function onProductSelect() {
  const id = document.getElementById('productSelect').value;
  const p  = products.find(x => x.id === id);
  document.getElementById('billPrice').value = p ? p.price : '';
}

// ── CUSTOMERS ─────────────────────────────────────
async function loadCustomers(search = '') {
  try {
    const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : '/api/customers';
    const res  = await fetch(url);
    customers  = await res.json();
    renderCustomerTable();
  } catch (err) {
    console.error('Failed to load customers', err);
  }
}

function openCustomerModal(id = null) {
  document.getElementById('customerEditId').value = id || '';
  document.getElementById('customerModalTitle').textContent = id ? 'Edit Customer' : 'Add Customer';
  if (id) {
    const c = customers.find(x => x.id === id);
    document.getElementById('custName').value    = c.name;
    document.getElementById('custPhone').value   = c.phone;
    document.getElementById('custAddress').value = c.address || '';
    document.getElementById('custNotes').value   = c.notes || '';
  } else {
    ['custName','custPhone','custAddress','custNotes'].forEach(f => document.getElementById(f).value = '');
  }
  document.getElementById('customerModal').classList.remove('hidden');
}

async function saveCustomer() {
  const name    = document.getElementById('custName').value.trim();
  const phone   = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const notes   = document.getElementById('custNotes').value.trim();
  if (!name || !phone) { alert('Name and Phone are required.'); return; }

  const editId = document.getElementById('customerEditId').value;
  const method = editId ? 'PUT' : 'POST';
  const url    = editId ? `/api/customers/${editId}` : '/api/customers';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, notes })
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    await loadCustomers();
    closeModal('customerModal');
  } catch (err) {
    alert('Failed to save customer.');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    await loadCustomers();
  } catch (err) {
    alert('Failed to delete customer.');
  }
}

function renderCustomerTable() {
  const tbody = document.getElementById('customerBody');
  const empty = document.getElementById('customerEmpty');
  tbody.innerHTML = '';
  if (!customers.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  customers.forEach((c, i) => {
    tbody.innerHTML += `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(c.name)}</strong></td>
      <td>${esc(c.phone)}</td>
      <td style="font-size:.83rem">${esc(c.address)||'—'}</td>
      <td style="font-size:.78rem;color:#7A4050;max-width:150px">${esc(c.notes)||'—'}</td>
      <td>
        <button class="btn-edit" onclick="openCustomerModal('${c.id}')">✏ Edit</button>
        <button class="btn-del" onclick="deleteCustomer('${c.id}')">🗑</button>
      </td></tr>`;
  });
}

function searchCustomerTable(q) {
  loadCustomers(q);
}

async function searchCustomer(val) {
  const box = document.getElementById('customerSuggestions');
  if (!val.trim()) { box.classList.add('hidden'); return; }
  try {
    const res     = await fetch(`/api/customers?search=${encodeURIComponent(val)}`);
    const matches = await res.json();
    if (!matches.length) { box.classList.add('hidden'); return; }
    box.innerHTML = matches.map(c =>
      `<div class="suggestion-item" onclick="selectCustomer('${c.id}')">
        <strong>${esc(c.name)}</strong> &nbsp;·&nbsp; ${esc(c.phone)}
      </div>`
    ).join('');
    box.classList.remove('hidden');
  } catch (err) {
    box.classList.add('hidden');
  }
}

function selectCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const el = document.getElementById('billCustomerName');
  el.value = c.name;
  el.dataset.customerId = id;
  document.getElementById('customerSuggestions').classList.add('hidden');
}

async function openCustomerPicker() {
  document.getElementById('pickerSearch').value = '';
  await filterPicker('');
  document.getElementById('customerPickerModal').classList.remove('hidden');
}

async function filterPicker(q) {
  const list = document.getElementById('pickerList');
  try {
    const url     = q ? `/api/customers?search=${encodeURIComponent(q)}` : '/api/customers';
    const res     = await fetch(url);
    const matches = await res.json();
    if (!matches.length) {
      list.innerHTML = '<div style="padding:1rem;text-align:center;color:#7A4050;font-size:.85rem">No customers found</div>';
      return;
    }
    list.innerHTML = matches.map(c =>
      `<div class="picker-item" onclick="pickCustomer('${c.id}','${esc(c.name)}')">
        <div class="picker-item-name">${esc(c.name)}</div>
        <div class="picker-item-detail">${esc(c.phone)}${c.address ? ' · ' + esc(c.address.substring(0,40)) : ''}</div>
      </div>`
    ).join('');
  } catch (err) {
    list.innerHTML = '<div style="padding:1rem;text-align:center;color:#c00;font-size:.85rem">Failed to load customers</div>';
  }
}

function pickCustomer(id, name) {
  const el = document.getElementById('billCustomerName');
  el.value = name;
  el.dataset.customerId = id;
  closeModal('customerPickerModal');
}

// ── BILLING ───────────────────────────────────────
function addItem() {
  const productId = document.getElementById('productSelect').value;
  const qty   = parseInt(document.getElementById('billQty').value);
  const price = parseFloat(document.getElementById('billPrice').value);
  if (!productId) { alert('Please select a product.'); return; }
  if (!qty || qty < 1) { alert('Please enter a valid quantity.'); return; }
  const product = products.find(p => p.id === productId);
  currentBill.push({ productId, name: product.name, type: product.type, qty, price, total: price * qty });
  renderBillTable(); recalculate();
  document.getElementById('productSelect').value = '';
  document.getElementById('billQty').value = 1;
  document.getElementById('billPrice').value = '';
}

function removeItem(idx) { currentBill.splice(idx, 1); renderBillTable(); recalculate(); }

function renderBillTable() {
  const tbody = document.getElementById('billBody');
  const empty = document.getElementById('billEmpty');
  tbody.innerHTML = '';
  if (!currentBill.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  currentBill.forEach((item, i) => {
    tbody.innerHTML += `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(item.name)}</strong></td>
      <td><span style="background:#fff0e8;color:#780116;padding:.2rem .5rem;border-radius:5px;font-size:.76rem;font-weight:700">${esc(item.type)}</span></td>
      <td>${item.qty}</td>
      <td>₹${item.price.toFixed(2)}</td>
      <td><strong style="color:#780116">₹${item.total.toFixed(2)}</strong></td>
      <td><button class="btn-del" onclick="removeItem(${i})">✕</button></td>
    </tr>`;
  });
}

function recalculate() {
  const subtotal   = currentBill.reduce((s, i) => s + i.total, 0);
  const gstEnabled = document.getElementById('gstToggle').checked;
  const gst        = gstEnabled ? subtotal * 0.05 : 0;
  const grand      = subtotal + gst;
  document.getElementById('subtotal').textContent   = '₹' + subtotal.toFixed(2);
  document.getElementById('gstAmt').textContent     = '₹' + gst.toFixed(2);
  document.getElementById('grandTotal').textContent = '₹' + grand.toFixed(2);
  document.getElementById('gstRow').classList.toggle('hidden', !gstEnabled);
}

function clearBill() {
  if (currentBill.length && !confirm('Clear the current bill?')) return;
  currentBill = [];
  document.getElementById('billCustomerName').value = '';
  document.getElementById('billCustomerName').dataset.customerId = '';
  document.getElementById('gstToggle').checked = false;
  renderBillTable(); recalculate();
}

async function printBill() {
  const customerName = document.getElementById('billCustomerName').value.trim();
  if (!customerName) { alert('Please enter a customer name.'); return; }
  if (!currentBill.length) { alert('Please add at least one item.'); return; }

  const subtotal   = currentBill.reduce((s, i) => s + i.total, 0);
  const gstEnabled = document.getElementById('gstToggle').checked;
  const gst        = gstEnabled ? subtotal * 0.05 : 0;
  const grand      = subtotal + gst;
  const custId     = document.getElementById('billCustomerName').dataset.customerId;

  // Save bill to backend
  try {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        customer_id:   custId || null,
        gst_percent:   gstEnabled ? 5 : 0,
        items: currentBill.map(i => ({
          product_id:   i.productId,
          product_name: i.name,
          type:         i.type,
          quantity:     i.qty,
          price:        i.price
        }))
      })
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    const bill = await res.json();

    // Print
    printBillHtml(bill, customerName, gstEnabled, gst, grand, subtotal);

    // Refresh today summary
    await loadTodaySummary();
    clearBill();
  } catch (err) {
    alert('Failed to save bill. Please try again.');
  }
}

function printBillHtml(bill, customerName, gstEnabled, gst, grand, subtotal) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const billNo  = bill.id;

  const rows = currentBill.map((item, i) => `
    <tr>
      <td style="padding:6px 8px">${i+1}</td>
      <td style="padding:6px 8px">${item.name}</td>
      <td style="padding:6px 8px">${item.type}</td>
      <td style="padding:6px 8px;text-align:center">${item.qty}</td>
      <td style="padding:6px 8px;text-align:right">₹${item.price.toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700">₹${item.total.toFixed(2)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>${billNo}</title>
  <style>
    body{font-family:Georgia,serif;max-width:80mm;margin:0 auto;padding:12px;font-size:13px;color:#1A0005;}
    .header{text-align:center;padding-bottom:10px;margin-bottom:10px;border-bottom:2px solid #780116;}
    .shop-name{font-size:20px;font-weight:900;color:#780116;letter-spacing:1px;}
    .shop-sub{font-size:11px;color:#C9A84C;margin-top:3px;letter-spacing:1.5px;text-transform:uppercase;}
    .bill-meta{font-size:10px;color:#888;margin-top:6px;}
    .customer-block{margin:8px 0;padding:8px 0;border-bottom:1px dashed #C9A84C;font-size:12px;}
    table{width:100%;border-collapse:collapse;margin:8px 0;}
    th{background:#780116;color:white;padding:6px 8px;text-align:left;font-size:11px;letter-spacing:.5px;}
    tr:nth-child(even) td{background:#fff8f0;}
    .totals{margin-top:8px;padding-top:6px;border-top:1px dashed #C9A84C;}
    .trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;}
    .grand-row{font-size:16px;font-weight:900;color:#780116;border-top:2px solid #780116;padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;}
    .footer{text-align:center;margin-top:14px;font-size:10px;color:#9B0A20;padding-top:8px;border-top:1px dashed #C9A84C;letter-spacing:.5px;}
    .gold-line{height:2px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin:6px 0;}
  </style></head><body>
  <div class="header">
    <div class="shop-name">GRB POOJA ITEMS</div>
    <div class="shop-sub">Sacred Supplies · Trusted Quality</div>
    <div class="gold-line"></div>
    <div class="bill-meta">Bill No: <strong>${billNo}</strong> &nbsp;|&nbsp; ${dateStr} ${timeStr}</div>
  </div>
  <div class="customer-block"><strong>Customer:</strong> ${customerName}</div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Type</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="trow"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    ${gstEnabled ? `<div class="trow"><span>GST (5%)</span><span>₹${gst.toFixed(2)}</span></div>` : ''}
    <div class="grand-row"><span>TOTAL AMOUNT</span><span>₹${grand.toFixed(2)}</span></div>
  </div>
  <div class="footer">✦ Thank you for your purchase ✦<br/>Visit us again &nbsp;🙏&nbsp; GRB Pooja Items</div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=420,height=620');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── TODAY SUMMARY ─────────────────────────────────
async function loadTodaySummary() {
  try {
    const res  = await fetch('/api/reports/summary');
    const data = await res.json();

    document.getElementById('statBills').textContent = data.today.bills_today;
    document.getElementById('statSales').textContent = '₹' + parseFloat(data.today.sales_today).toFixed(0);
    document.getElementById('statGst').textContent   = '₹' + parseFloat(data.today.gst_today).toFixed(0);

    const res2   = await fetch('/api/reports/recent-bills?limit=5');
    const recent = await res2.json();
    const div    = document.getElementById('recentBills');

    if (!recent.length) { div.innerHTML = '<div class="no-data">No bills yet today</div>'; return; }
    div.innerHTML = recent.map(b => {
      const t = new Date(b.created_at);
      return `<div class="recent-bill-item">
        <span class="recent-bill-name">${esc(b.customer_name)}</span>
        <span class="recent-bill-amt">₹${parseFloat(b.total).toFixed(0)}</span>
        <br/><span class="recent-bill-time">${t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load today summary', err);
  }
}

// ── REPORTS ───────────────────────────────────────
async function loadReports() {
  try {
    const [summaryRes, historyRes] = await Promise.all([
      fetch('/api/reports/summary'),
      fetch('/api/bills')
    ]);
    const summary = await summaryRes.json();
    const history = await historyRes.json();

    document.getElementById('rptDailySales').textContent = '₹' + parseFloat(summary.today.sales_today).toFixed(0);
    document.getElementById('rptTotalBills').textContent = summary.allTime.total_bills;
    document.getElementById('rptTotalRev').textContent   = '₹' + parseFloat(summary.allTime.total_revenue).toFixed(0);
    document.getElementById('rptGst').textContent        = '₹' + parseFloat(summary.allTime.total_gst).toFixed(0);

    const tbody = document.getElementById('historyBody');
    const empty = document.getElementById('historyEmpty');
    tbody.innerHTML = '';
    if (!history.length) { empty.style.display = ''; return; }
    empty.style.display = 'none';
    history.forEach(b => {
      const d = new Date(b.created_at);
      tbody.innerHTML += `<tr>
        <td><code style="font-size:.78rem;background:#fff0e8;color:#780116;padding:.15rem .5rem;border-radius:5px">${b.id}</code></td>
        <td>${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
        <td><strong>${esc(b.customer_name)}</strong></td>
        <td>—</td>
        <td>${parseFloat(b.gst_amount) > 0 ? '₹'+parseFloat(b.gst_amount).toFixed(2) : '—'}</td>
        <td><strong style="color:#780116">₹${parseFloat(b.total).toFixed(2)}</strong></td>
      </tr>`;
    });
  } catch (err) {
    console.error('Failed to load reports', err);
  }
}

// ── UTILS ─────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.form-group'))
    document.getElementById('customerSuggestions').classList.add('hidden');
});

// ── INIT ──────────────────────────────────────────
(async () => {
  await loadProducts();
  await loadTodaySummary();
})();