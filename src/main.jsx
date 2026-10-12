import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createCustomer, createReading, firebaseConfigured, logOut, readCollection, signIn, watchAuth } from './firebase'
import './styles.css'

const seedCustomers = [
  { id: 'CUST-0001', name: 'Samuel Owusu', account: 'ACC-10025', meter: 'MTR-4521', area: 'Adenta', type: 'Residential', phone: '0244 598 296', balance: 126 },
  { id: 'CUST-0002', name: 'Ama Mensah', account: 'ACC-10026', meter: 'MTR-4522', area: 'Adenta', type: 'Residential', phone: '0208 399 932', balance: 0 },
  { id: 'CUST-0003', name: 'Korkor Foods Ltd', account: 'ACC-10027', meter: 'MTR-4523', area: 'Madina', type: 'Commercial', phone: '0244 111 222', balance: 340 },
  { id: 'CUST-0004', name: 'Kojo Properties', account: 'ACC-10028', meter: 'MTR-4524', area: 'Legon', type: 'Compound', phone: '0501 333 444', balance: 84 },
  { id: 'CUST-0005', name: 'Nana Yaw', account: 'ACC-10029', meter: 'MTR-4525', area: 'Madina', type: 'Residential', phone: '0277 555 666', balance: 0 },
]

const seedReadings = [
  { id: 1, customerId: 'CUST-0001', date: '2026-10-01', previous: 96, present: 105, rate: 6 },
  { id: 2, customerId: 'CUST-0002', date: '2026-10-01', previous: 143, present: 151, rate: 6 },
  { id: 3, customerId: 'CUST-0003', date: '2026-10-02', previous: 230, present: 246, rate: 10 },
  { id: 4, customerId: 'CUST-0004', date: '2026-10-03', previous: 61, present: 68, rate: 7 },
]

const money = (amount) => `GHS ${Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const getStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function App() {
  const [customers, setCustomers] = useState(() => getStored('water-customers', seedCustomers))
  const [readings, setReadings] = useState(() => getStored('water-readings', seedReadings))
  const [activePage, setActivePage] = useState('Overview')
  const [search, setSearch] = useState('')
  const [showReadingForm, setShowReadingForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [dataSource, setDataSource] = useState(firebaseConfigured ? 'Connecting to Firebase…' : 'Demo mode')
  const [user, setUser] = useState(firebaseConfigured ? undefined : { displayName: 'Administrator' })
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  useEffect(() => localStorage.setItem('water-customers', JSON.stringify(customers)), [customers])
  useEffect(() => localStorage.setItem('water-readings', JSON.stringify(readings)), [readings])
  useEffect(() => watchAuth(setUser), [])
  useEffect(() => {
    if (!firebaseConfigured || !user) return
    Promise.all([readCollection('customers'), readCollection('readings')])
      .then(([remoteCustomers, remoteReadings]) => {
        setCustomers(remoteCustomers)
        setReadings(remoteReadings)
        setDataSource('Firebase connected')
      })
      .catch((error) => {
        console.error(error)
        setDataSource('Firebase connection error')
        setNotice('Could not load Firebase data. Check your project configuration and Firestore rules.')
      })
  }, [user])

  const readingRows = useMemo(() => readings.map((reading) => ({
    ...reading,
    customer: customers.find((customer) => customer.id === reading.customerId),
    usage: reading.present - reading.previous,
    amount: (reading.present - reading.previous) * reading.rate,
  })), [readings, customers])

  const totals = useMemo(() => ({
    billed: readingRows.reduce((sum, row) => sum + row.amount, 0) + 42800,
    collected: 36250,
    customers: customers.length,
    read: readings.length,
  }), [customers, readings, readingRows])

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.account} ${customer.meter} ${customer.area}`.toLowerCase().includes(search.toLowerCase()))

  const addReading = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const customerId = data.get('customerId')
    const previous = Number(data.get('previous'))
    const present = Number(data.get('present'))
    const rate = Number(data.get('rate'))
    if (present < previous) {
      setNotice('Present reading cannot be lower than the previous reading.')
      return
    }
    const reading = { customerId, date: data.get('date'), previous, present, rate }
    const save = firebaseConfigured ? createReading(reading) : Promise.resolve({ id: Date.now(), ...reading })
    save.then((savedReading) => {
      setReadings((current) => [...current, savedReading])
      setShowReadingForm(false)
      setNotice(firebaseConfigured ? 'Meter reading saved to Firebase and bill calculated.' : 'Meter reading saved in demo mode. Connect Firebase to persist it.')
      event.currentTarget.reset()
    }).catch((error) => {
      console.error(error)
      setNotice('The meter reading could not be saved. Please try again.')
    })
  }

  const navigate = (page) => {
    setActivePage(page)
    setSearch('')
  }

  return user === undefined ? <div className="auth-loading">Loading admin portal…</div> : user === null ? <Login /> : (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W</div><div><strong>Waterflow</strong><span>ADMIN PORTAL</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {[
            ['Overview', '⌂'], ['Customers', '♙'], ['Meter readings', '⌁'], ['Billing', '▣'], ['Payments', '₵'],
          ].map(([label, icon]) => <button className={activePage === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => navigate(label)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="workspace-label settings-label">MANAGE</div>
        <nav>
          {['Rate plans', 'Reports'].map((label) => <button className={activePage === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => navigate(label)}><span>{label === 'Reports' ? '▤' : '◎'}</span>{label}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">?</div><strong>Need a hand?</strong><small>View the admin guide</small></div><div className="user-chip"><div className="avatar">AD</div><div><strong>{user.displayName || user.email || 'Administrator'}</strong><small>System admin</small></div><button className="logout-button" onClick={() => logOut()}>↪</button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♢<i /></button><div className="date-pill">October 2026 <span>⌄</span></div></div></header>
        <div className="page-content">
          <div className={dataSource === 'Firebase connected' ? 'connection-pill connected' : 'connection-pill'}><i />{dataSource}</div>
          {notice && <div className="notice"><span>✓</span>{notice}<button onClick={() => setNotice('')}>×</button></div>}
          {activePage === 'Overview' && <Overview totals={totals} readingRows={readingRows} customers={customers} onAdd={() => setShowReadingForm(true)} onNavigate={navigate} />}
          {activePage === 'Customers' && <Customers customers={filteredCustomers} search={search} setSearch={setSearch} onAdd={() => setShowCustomerForm(true)} />}
          {activePage === 'Meter readings' && <Readings rows={readingRows} onAdd={() => setShowReadingForm(true)} />}
          {activePage === 'Billing' && <Billing rows={readingRows} customers={customers} />}
          {activePage === 'Payments' && <Payments customers={customers} onNotice={setNotice} />}
          {activePage === 'Rate plans' && <Rates onNotice={setNotice} />}
          {activePage === 'Reports' && <Reports rows={readingRows} customers={customers} />}
        </div>
      </main>
      {showReadingForm && <ReadingModal customers={customers} onClose={() => setShowReadingForm(false)} onSubmit={addReading} />}
      {showCustomerForm && <CustomerModal onClose={() => setShowCustomerForm(false)} onSubmit={(customer) => {
        const save = firebaseConfigured ? createCustomer(customer) : Promise.resolve({ id: `CUST-${String(customers.length + 1).padStart(4, '0')}`, ...customer, balance: 0 })
        save.then((savedCustomer) => {
          setCustomers((current) => [...current, savedCustomer])
          setShowCustomerForm(false)
          setNotice(firebaseConfigured ? 'Customer saved to Firebase.' : 'Customer saved in demo mode.')
        }).catch((error) => {
          console.error(error)
          setNotice('The customer could not be saved. Please try again.')
        })
      }} />}
    </div>
  )
}

function Login() {
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    signIn(data.get('email'), data.get('password')).catch((reason) => {
      console.error(reason)
      setError('Sign in failed. Check the email and password, then try again.')
    })
  }
  return <div className="login-page"><div className="login-card"><div className="brand login-brand"><div className="brand-mark">W</div><div><strong>Waterflow</strong><span>ADMIN PORTAL</span></div></div><p className="eyebrow">SECURE ADMIN ACCESS</p><h1>Welcome back</h1><p className="muted">Sign in to manage readings, billing and customer accounts.</p><form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="admin@example.com" /></label><label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button" type="submit">Sign in to admin portal</button></form></div></div>
}

function Overview({ totals, readingRows, customers, onAdd, onNavigate }) {
  const overdue = customers.filter((customer) => customer.balance > 0)
  return <><div className="page-heading"><div><p className="eyebrow">MONDAY, 12 OCTOBER 2026</p><h1>Good morning, Administrator <span>✦</span></h1><p className="muted">Here is what is happening with your water service today.</p></div><button className="primary-button" onClick={onAdd}>＋ Record meter reading</button></div>
    <section className="stats-grid"><Stat label="Total billed" value={money(totals.billed)} change="+8.4%" tone="green" icon="₵" /><Stat label="Collected this month" value={money(totals.collected)} change="+12.2%" tone="blue" icon="↗" /><Stat label="Outstanding balance" value={money(6430)} change="51 accounts" tone="orange" icon="!" /><Stat label="Active customers" value={totals.customers} change={`${totals.read} read this month`} tone="purple" icon="♙" /></section>
    <div className="section-grid"><section className="panel"><div className="panel-heading"><div><h2>Billing overview</h2><p>Monthly collection performance</p></div><select><option>Last 6 months</option></select></div><div className="chart"><div className="chart-y"><span>60k</span><span>45k</span><span>30k</span><span>15k</span><span>0</span></div><div className="chart-area"><div className="grid-lines" /><div className="bars">{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month, index) => <div className="bar-column" key={month}><div className="bar billed" style={{ height: `${[48, 62, 56, 72, 68, 84][index]}%` }} /><div className="bar collected" style={{ height: `${[34, 50, 44, 58, 52, 67][index]}%` }} /><small>{month}</small></div>)}</div></div></div><div className="legend"><span><i className="legend-billed" /> Billed</span><span><i className="legend-collected" /> Collected</span></div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Collection status</h2><p>Current month</p></div><button className="text-button" onClick={() => onNavigate('Reports')}>View report →</button></div><div className="donut-wrap"><div className="donut"><div><strong>84.8%</strong><small>collected</small></div></div><div className="status-list"><StatusLine label="Collected" value={money(36250)} color="teal" /><StatusLine label="Outstanding" value={money(6430)} color="orange" /><StatusLine label="Not yet billed" value={money(0)} color="gray" /></div></div><div className="progress"><span style={{ width: '84.8%' }} /></div><p className="progress-caption">GHS 42,680 total billed this month</p></section></div>
    <div className="section-grid lower"><section className="panel"><div className="panel-heading"><div><h2>Recent meter readings</h2><p>Latest entries from your team</p></div><button className="text-button" onClick={() => onNavigate('Meter readings')}>View all →</button></div><ReadingTable rows={readingRows.slice(-4)} /></section><section className="panel"><div className="panel-heading"><div><h2>Accounts needing attention</h2><p>Customers with an outstanding balance</p></div><button className="text-button" onClick={() => onNavigate('Customers')}>View all →</button></div><div className="attention-list">{overdue.slice(0, 4).map((customer) => <div className="attention-row" key={customer.id}><div className="avatar soft">{customer.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div><div className="attention-name"><strong>{customer.name}</strong><small>{customer.account} · {customer.area}</small></div><div className="attention-amount">{money(customer.balance)}<small>Outstanding</small></div></div>)}</div></section></div>
  </>
}

function Stat({ label, value, change, tone, icon }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><strong>{value}</strong><small className={tone === 'orange' ? 'warning' : 'positive'}>{tone !== 'orange' && '↗ '}{change}</small></div> }
function StatusLine({ label, value, color }) { return <div className="status-line"><span><i className={color} />{label}</span><strong>{value}</strong></div> }

function Customers({ customers, search, setSearch, onAdd }) { return <><PageTitle title="Customers" subtitle="Manage accounts, meters and customer information." action="＋ Add customer" onAction={onAdd} /><div className="toolbar"><div className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers, accounts or meters..." /></div><select><option>All areas</option><option>Adenta</option><option>Madina</option><option>Legon</option></select><select><option>All statuses</option><option>Outstanding</option><option>Paid</option></select></div><section className="panel table-panel"><table><thead><tr><th>Customer</th><th>Account / Meter</th><th>Area</th><th>Type</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="table-person"><div className="avatar soft">{customer.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div><div><strong>{customer.name}</strong><small>{customer.phone}</small></div></div></td><td><strong>{customer.account}</strong><small>{customer.meter}</small></td><td>{customer.area}</td><td><span className="tag">{customer.type}</span></td><td><strong>{money(customer.balance)}</strong></td><td><span className={customer.balance ? 'status overdue' : 'status paid'}>{customer.balance ? 'Outstanding' : 'Paid up'}</span></td><td className="more">⋮</td></tr>)}</tbody></table></section></> }

function Readings({ rows, onAdd }) { return <><PageTitle title="Meter readings" subtitle="Capture and review monthly readings for every meter." action="＋ Record reading" onAction={onAdd} /><div className="reading-summary"><div><span>Read this month</span><strong>{rows.length} <small>/ {rows.length + 1} customers</small></strong></div><div><span>Total consumption</span><strong>{rows.reduce((sum, row) => sum + row.usage, 0)} <small>units</small></strong></div><div><span>Estimated billing</span><strong>{money(rows.reduce((sum, row) => sum + row.amount, 0))}</strong></div></div><section className="panel table-panel"><ReadingTable rows={rows} full /></section></> }
function ReadingTable({ rows, full }) { return <table><thead><tr><th>Date</th><th>Customer</th><th>Previous</th><th>Present</th><th>Consumption</th><th>Rate</th><th>Amount</th>{full && <th>Status</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td><td><strong>{row.customer?.name}</strong><small>{row.customer?.meter}</small></td><td>{row.previous}</td><td><strong>{row.present}</strong></td><td><span className="usage">{row.usage} units</span></td><td>{money(row.rate)}</td><td><strong>{money(row.amount)}</strong></td>{full && <td><span className="status calculated">Calculated</span></td>}</tr>)}</tbody></table> }

function Billing({ rows, customers }) { return <><PageTitle title="Billing" subtitle="Review generated bills and customer balances." action="Generate bills" onAction={() => {}} /><div className="stats-grid compact"><Stat label="Bills this month" value={rows.length} change="October 2026" tone="blue" icon="▣" /><Stat label="Total billed" value={money(rows.reduce((sum, row) => sum + row.amount, 0))} change="From readings" tone="green" icon="₵" /><Stat label="Overdue accounts" value={customers.filter((customer) => customer.balance > 0).length} change="Needs follow-up" tone="orange" icon="!" /></div><section className="panel table-panel"><div className="panel-heading"><div><h2>October 2026 bills</h2><p>Automatically calculated from meter readings</p></div><button className="secondary-button">Export CSV</button></div><ReadingTable rows={rows} full /></section></> }
function Payments({ customers, onNotice }) { return <><PageTitle title="Payments" subtitle="Record collections and track outstanding balances." action="＋ Record payment" onAction={() => onNotice('Payment entry will be added next.')} /><section className="panel empty-panel"><div className="empty-icon">₵</div><h2>Payment tracking is ready for setup</h2><p>Payments will be linked to customer accounts, receipts and balances in the next step.</p><button className="primary-button" onClick={() => onNotice(`${customers.length} customer accounts are available for payments.`)}>View customer accounts</button></section></> }
function Rates({ onNotice }) { return <><PageTitle title="Rate plans" subtitle="Configure how water usage is priced for each customer group." action="＋ Add rate plan" onAction={() => onNotice('Rate plan creation will be added next.')} /><div className="rate-grid"><div className="rate-card featured"><div className="rate-top"><span className="tag">Default</span><span className="more">⋮</span></div><h2>Residential</h2><p>Standard household water rate</p><strong>GHS 6.00 <small>/ unit</small></strong><div className="rate-detail"><span>Service charge</span><b>GHS 0.00</b></div><div className="rate-detail"><span>Status</span><b className="active-text">Active</b></div></div><div className="rate-card"><div className="rate-top"><span className="tag purple-tag">Commercial</span><span className="more">⋮</span></div><h2>Commercial</h2><p>Businesses and larger users</p><strong>GHS 10.00 <small>/ unit</small></strong><div className="rate-detail"><span>Service charge</span><b>GHS 25.00</b></div><div className="rate-detail"><span>Status</span><b className="active-text">Active</b></div></div><div className="rate-card add-rate" onClick={() => onNotice('Create a rate plan from the button above.')}><span>＋</span><strong>Add another plan</strong><small>For compounds, schools or other groups</small></div></div></> }
function Reports({ rows, customers }) { return <><PageTitle title="Reports" subtitle="Understand usage, revenue and collection performance." action="Export report" onAction={() => {}} /><div className="report-grid"><div className="report-card"><span className="stat-icon green">₵</span><small>Total billed</small><strong>{money(rows.reduce((sum, row) => sum + row.amount, 0))}</strong><p>Based on current readings</p></div><div className="report-card"><span className="stat-icon blue">⌁</span><small>Total usage</small><strong>{rows.reduce((sum, row) => sum + row.usage, 0)} units</strong><p>Across all recorded meters</p></div><div className="report-card"><span className="stat-icon orange">!</span><small>Outstanding</small><strong>{customers.filter((customer) => customer.balance > 0).length} accounts</strong><p>Require collection follow-up</p></div></div><section className="panel report-table"><h2>Area performance</h2><p className="muted">Usage and account status by service area.</p>{['Adenta', 'Madina', 'Legon'].map((area) => { const areaCustomers = customers.filter((customer) => customer.area === area); return <div className="area-row" key={area}><strong>{area}</strong><span>{areaCustomers.length} customers</span><div className="area-bar"><i style={{ width: `${Math.max(areaCustomers.length * 18, 18)}%` }} /></div><b>{money(areaCustomers.reduce((sum, customer) => sum + customer.balance, 0))}</b></div> })}</section></> }
function PageTitle({ title, subtitle, action, onAction }) { return <div className="page-heading compact-heading"><div><h1>{title}</h1><p className="muted">{subtitle}</p></div>{action && <button className="primary-button" onClick={onAction}>{action}</button>}</div> }
function ReadingModal({ customers, onClose, onSubmit }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><p className="eyebrow">NEW ENTRY</p><h2>Record meter reading</h2><p className="muted">The bill will be calculated automatically.</p></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={onSubmit}><label>Customer<select name="customerId" required>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.meter}</option>)}</select></label><div className="form-grid"><label>Reading date<input name="date" type="date" defaultValue="2026-10-12" required /></label><label>Rate per unit<input name="rate" type="number" min="0" step="0.01" defaultValue="6" required /></label><label>Previous reading<input name="previous" type="number" min="0" defaultValue="0" required /></label><label>Present reading<input name="present" type="number" min="0" defaultValue="0" required /></label></div><div className="form-hint">Consumption and amount due will be calculated from the values above.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save reading</button></div></form></div></div> }
function CustomerModal({ onClose, onSubmit }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><p className="eyebrow">NEW ACCOUNT</p><h2>Add customer</h2><p className="muted">Create a customer account and assign a meter.</p></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: data.get('name'), account: data.get('account'), meter: data.get('meter'), area: data.get('area'), type: data.get('type'), phone: data.get('phone') }) }}><div className="form-grid"><label>Customer name<input name="name" required placeholder="Full name or business" /></label><label>Phone number<input name="phone" required placeholder="0244 000 000" /></label><label>Account number<input name="account" required placeholder="ACC-10030" /></label><label>Meter number<input name="meter" required placeholder="MTR-4530" /></label><label>Area<input name="area" required placeholder="Adenta" /></label><label>Customer type<select name="type" defaultValue="Residential"><option>Residential</option><option>Commercial</option><option>Compound</option><option>Institutional</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save customer</button></div></form></div></div> }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
