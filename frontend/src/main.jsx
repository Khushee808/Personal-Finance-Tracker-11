import React, { useEffect, useState } from "react"; import { createRoot } from "react-dom/client"; import axios from "axios"; import "./style.css";
const API = "http://localhost:5000/api", CATS = ["Food", "Travel", "Shopping", "Bills", "Education", "Health", "Salary", "Other"];
const api = axios.create({ baseURL: API }); api.interceptors.request.use(c => { const t = localStorage.getItem("pft_token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c });
function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }) }
function App() { const [auth, setAuth] = useState(!!localStorage.getItem("pft_token")); return auth ? <Tracker logout={() => { localStorage.clear(); setAuth(false) }} /> : <Auth login={() => setAuth(true)} /> }
function Auth({ login }) {
    const [reg, setReg] = useState(false), [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
    async function go(e) { e.preventDefault(); try { const r = await api.post("/auth/" + (reg ? "register" : "login"), { name, email, password }); localStorage.setItem("pft_token", r.data.token); localStorage.setItem("pft_user", JSON.stringify(r.data.user)); login() } catch (e) { alert(e.response?.data?.message || "Error") } }
    return <div className="auth"><div className="authbox"><h1>🌿 Personal Finance Tracker</h1><h2>{reg ? "Create Account" : "Login"}</h2><form onSubmit={go}>{reg && <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />}<input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><button className="primary">{reg ? "Register" : "Login"}</button></form><button className="link" onClick={() => setReg(!reg)}>{reg ? "Already have an account? Login" : "New user? Create account"}</button></div></div>
}
function Tracker({ logout }) {
    const [page, setPage] = useState("dashboard"), [tx, setTx] = useState([]), [settings, setSettings] = useState({ monthlyBudget: 0, savingsGoal: 0, darkMode: false, categoryBudgets: {} }), [name] = useState(JSON.parse(localStorage.getItem("pft_user") || "{}").name || "User");
    async function load() { try { const [a, b] = await Promise.all([api.get("/transactions"), api.get("/settings")]); setTx(a.data); setSettings(b.data.settings || {}) } catch (e) { if (e.response?.status === 401) logout() } } useEffect(() => { load() }, []);
    const sum = tx.reduce((a, t) => { a[t.type] += +t.amount; return a }, { income: 0, expense: 0 }); const balance = sum.income - sum.expense;
    async function add(t) { await api.post("/transactions", t); load() } async function del(id) { await api.delete("/transactions/" + id); load() } async function saveSettings(s) { await api.put("/settings", s); setSettings(s) }
    return <div className={settings.darkMode ? "dark" : ""}><header><b>🌿 Personal Finance Tracker</b><nav>{["dashboard", "transactions", "reports", "settings"].map(p => <button className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p[0].toUpperCase() + p.slice(1)}</button>)}<button onClick={logout}>Logout</button></nav></header><main>
        {page === "dashboard" && <Dashboard name={name} tx={tx} sum={sum} balance={balance} settings={settings} add={add} setPage={setPage} />}
        {page === "transactions" && <Transactions tx={tx} del={del} />}
        {page === "reports" && <Reports tx={tx} />}
        {page === "settings" && <Settings settings={settings} save={saveSettings} load={load} reset={async () => { if (confirm("Delete all transactions?")) { for (const t of tx) await del(t._id) } }} />}
    </main></div>
}
function Dashboard({ name, tx, sum, balance, settings, add, setPage }) 
{
    const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", category: "Food", amount: "", type: "expense", recurring: false });
    const month = new Date().toISOString().slice(0, 7), monthExp = tx.filter(t => t.type === "expense" && t.date.startsWith(month)).reduce((a, t) => a + +t.amount, 0);
    async function submit(e) { e.preventDefault(); await add({ ...form, amount: +form.amount }); setForm({ ...form, description: "", amount: "" }) }
    const cats = {}; tx.filter(t => t.type === "expense").forEach(t => cats[t.category] = (cats[t.category] || 0) + +t.amount); return <><h1>Dashboard</h1><p>Welcome, {name}!</p><div className="cards">{[["Total Income", sum.income], ["Total Expense", sum.expense], ["Balance", balance], ["This Month Expense", monthExp]].map(x => <div className="card stat"><span>{x[0]}</span><strong>{money(x[1])}</strong></div>)}</div><div className="grid"><div className="card"><h2>Add Transaction</h2><form onSubmit={submit} className="form">{<><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /><input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(c => <option>{c}</option>)}</select><input type="number" min="0" step=".01" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select><label><input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} /> Recurring</label></>}<button className="primary">Add Transaction</button></form></div><div className="card"><h2>Budget & Savings</h2><Progress label="Monthly Budget" used={monthExp} total={settings.monthlyBudget} /><Progress label="Savings Goal" used={Math.max(0, balance)} total={settings.savingsGoal} /><p>Current Savings: <b>{money(balance)}</b></p></div></div><div className="grid"><div className="card"><h2>Income vs Expense</h2><div className="bars"><div style={{ height: Math.max(10, sum.income / Math.max(sum.income, sum.expense, 1) * 150) }}><b>{money(sum.income)}</b></div><div style={{ height: Math.max(10, sum.expense / Math.max(sum.income, sum.expense, 1) * 150) }}><b>{money(sum.expense)}</b></div></div></div><div className="card"><h2>Expense Categories</h2>{Object.entries(cats).map(([c, v]) => <p><b>{c}</b> — {money(v)}</p>) || <p>No expense data yet.</p>}</div></div><div className="grid"><div className="card"><h2>Category Budget Status</h2>{CATS.map(c => settings.categoryBudgets?.[c] ? <p>{c}: {money(cats[c] || 0)} / {money(settings.categoryBudgets[c])}</p> : null)}{!Object.keys(settings.categoryBudgets || {}).some(c => settings.categoryBudgets[c]) && <p>No category budgets set. Add them from Settings.</p>}</div><div className="card">
  <h2>Smart Insights</h2>

  <h3>Income Insight</h3>
  <p>Total Income: {money(sum.income)}</p>

  <h3>Expense Insight</h3>
  <p>Total Expenses: {money(sum.expense)}</p>
  <p>
    {Object.keys(cats).length > 0
      ? `Highest Expense Category: ${
          Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0]
        } (${money(
          Object.entries(cats).sort((a, b) => b[1] - a[1])[0][1]
        )})`
      : "No expenses recorded yet."}
  </p>

  <h3>Savings Insight</h3>
  <p>Current Savings: {money(balance)}</p>
  <p>
    {balance < 0
      ? "Your expenses are higher than your income. Try to reduce unnecessary expenses."
      : "Your income currently covers your expenses."}
  </p>
  <p>
    {settings.savingsGoal > 0
      ? balance >= settings.savingsGoal
        ? "Congratulations! You have reached your savings goal."
        : `Savings goal remaining: ${money(
            Math.max(0, settings.savingsGoal - balance)
          )}`
      : "Set a savings goal in Settings to track your progress."}
  </p>

  <h3>Budget Tips</h3>
  <p>
    {settings.monthlyBudget > 0
      ? monthExp > settings.monthlyBudget
        ? `Monthly budget exceeded by ${money(
            monthExp - settings.monthlyBudget
          )}. Reduce unnecessary spending.`
        : `Monthly budget remaining: ${money(
            settings.monthlyBudget - monthExp
          )}`
      : "Set a monthly budget in Settings to receive budget tips."}
  </p>

  {Object.entries(settings.categoryBudgets || {}).map(([category, limit]) =>
    Number(limit) > 0 && Number(cats[category] || 0) > Number(limit) ? (
      <p key={category}>
        Budget alert: {category} spending has exceeded its budget by{" "}
        {money(Number(cats[category]) - Number(limit))}.
      </p>
    ) : null
  )}
</div></div><div className="card"><div className="head"><h2>Recent Transactions</h2><button onClick={() => setPage("transactions")}>View All & Filter</button></div><Table tx={tx.slice(0, 7)} /></div></>
}
function Progress({ label, used, total }) { return <div className="progressBox"><div><b>{label}</b><span>{money(used)} / {money(total)}</span></div><div className="progress"><i style={{ width: total ? Math.min(100, used / total * 100) + "%" : "0%" }} /></div></div> }
function Table({ tx, del }) { return <div className="table"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th>{del && <th>Action</th>}</tr></thead><tbody>{tx.map(t => <tr><td>{t.date}</td><td>{t.type}</td><td>{t.category}</td><td>{t.description}</td><td>{money(t.amount)}</td>{del && <td><button onClick={() => del(t._id)}>Delete</button></td>}</tr>)}</tbody></table>{!tx.length && <p>No transactions yet.</p>}</div> }
function Transactions({ tx, del }) { const [q, setQ] = useState(""), [type, setType] = useState(""), [cat, setCat] = useState(""); let a = tx.filter(t => (!q || (t.description + t.category).toLowerCase().includes(q.toLowerCase())) && (!type || t.type === type) && (!cat || t.category === cat)); return <><h1>Transactions</h1><div className="card"><div className="filters"><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} /><select value={type} onChange={e => setType(e.target.value)}><option value="">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={cat} onChange={e => setCat(e.target.value)}><option value="">All Categories</option>{CATS.map(c => <option>{c}</option>)}</select></div><Table tx={a} del={del} /></div></> }
function Reports({ tx }) { const map = {}; tx.forEach(t => { const m = t.date.slice(0, 7); map[m] ??= { i: 0, e: 0 }; t.type === "income" ? map[m].i += +t.amount : map[m].e += +t.amount }); function csv() { const rows = [["Month", "Income", "Expense", "Savings"], ...Object.entries(map).map(([m, x]) => [m, x.i, x.e, x.i - x.e])]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\\n")], { type: "text/csv" })); a.download = "finance-report.csv"; a.click() } return <><h1>Reports</h1><button className="primary" onClick={() => print()}>Download / Print PDF</button> <button className="primary" onClick={csv}>Download CSV</button><div className="card"><h2>Monthly Summary</h2><TableReport map={map} /></div></> }
function TableReport({ map }) { return <div className="table"><table><thead><tr><th>Month</th><th>Income</th><th>Expense</th><th>Savings</th></tr></thead><tbody>{Object.entries(map).sort().reverse().map(([m, x]) => <tr><td>{m}</td><td>{money(x.i)}</td><td>{money(x.e)}</td><td>{money(x.i - x.e)}</td></tr>)}</tbody></table></div> }
function Settings({ settings, save, reset, load }) {
    const [s, setS] = useState(settings); useEffect(() => setS(settings), [settings]);
    function update(c, v) { setS({ ...s, [c]: v }) } function cat(c, v) { setS({ ...s, categoryBudgets: { ...s.categoryBudgets, [c]: +v || 0 } }) }
    async function backup() { try { const r = await api.get("/backup"); const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "personal-finance-backup.json"; a.click(); URL.revokeObjectURL(a.href) } catch (e) { alert(e.response?.data?.message || "Backup failed") } }
    function restore(e) { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.transactions)) throw new Error("Invalid backup file"); await api.post("/backup/restore", data); alert("Backup restored successfully"); await load() } catch (err) { alert(err.response?.data?.message || err.message || "Restore failed") } }; reader.readAsText(file); e.target.value = "" }
    return <><h1>Settings</h1><div className="card"><h2>Budget & Savings Goals</h2><div className="form"><input type="number" placeholder="Monthly Budget" value={s.monthlyBudget || 0} onChange={e => update("monthlyBudget", +e.target.value)} /><input type="number" placeholder="Savings Goal" value={s.savingsGoal || 0} onChange={e => update("savingsGoal", +e.target.value)} /></div><h2>Category Budgets</h2><div className="form">{CATS.map(c => <label key={c}>{c} Budget<input type="number" value={s.categoryBudgets?.[c] || 0} onChange={e => cat(c, e.target.value)} /></label>)}</div><h2>Appearance</h2><label><input type="checkbox" checked={s.darkMode || false} onChange={e => update("darkMode", e.target.checked)} /> Enable Dark Mode</label><br /><button className="primary" onClick={() => save(s)}>Save Settings</button> <button className="danger" onClick={reset}>Reset Transactions</button></div><div className="card"><h2>Backup & Restore</h2><p>Backup your MongoDB data to a JSON file and restore it later.</p><button className="primary" onClick={backup}>Download Backup</button> <label className="fileBtn">Restore Backup<input type="file" accept="application/json,.json" onChange={restore} /></label></div></>
}

export default App; createRoot(document.getElementById("root")).render(<App />);