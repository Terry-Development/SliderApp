import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import AuthWrapper from '@/components/AuthWrapper';
import { API_URL } from '@/utils/api';

const EXPENSE_CATEGORIES = ['Food','Transport','Shopping','Bills','Entertainment','Health','Education','Travel','Subscriptions','Other'];
const DEPOSIT_CATEGORIES = ['Salary','Allowance','Refund','Transfer','Gift','Other'];
const CURRENCIES = ['MYR','USD','SGD','GBP','EUR'];
const pad = n => String(n).padStart(2,'0');
const monthString = (d=new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const dateString = (d=new Date()) => `${monthString(d)}-${pad(d.getDate())}`;
const monthLabel = m => {
  const [y,mo] = m.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(y,mo-1,1));
};
const shiftMonth = (m,n) => {
  const [y,mo]=m.split('-').map(Number);
  return monthString(new Date(y,mo-1+n,1));
};
const headers = () => ({'Content-Type':'application/json','x-admin-password':localStorage.getItem('admin_password')||''});

export default function ExpensesPage(){
  const [selectedMonth,setSelectedMonth]=useState(monthString());
  const [entries,setEntries]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [currency,setCurrency]=useState('MYR');
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({type:'expense',amount:'',category:'Food',date:dateString(),description:''});

  useEffect(()=>{
    const saved=localStorage.getItem('expense_currency');
    if(CURRENCIES.includes(saved)) setCurrency(saved);
  },[]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await fetch(`${API_URL}/expenses?month=${encodeURIComponent(selectedMonth)}`,{headers:{'x-admin-password':localStorage.getItem('admin_password')||''},cache:'no-store'});
      if(!r.ok) throw new Error('Could not load this month');
      const data=await r.json();
      setEntries(Array.isArray(data)?data:[]);
      setError('');
    }catch(e){ setError(e.message||'Could not load expenses'); }
    finally{ setLoading(false); }
  },[selectedMonth]);

  useEffect(()=>{load();},[load]);

  const money=useCallback(v=>new Intl.NumberFormat(undefined,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0)),[currency]);

  const summary=useMemo(()=>{
    const deposits=entries.filter(e=>e.type==='deposit').reduce((s,e)=>s+Number(e.amount||0),0);
    const expenses=entries.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount||0),0);
    const map={};
    entries.filter(e=>e.type==='expense').forEach(e=>map[e.category]=(map[e.category]||0)+Number(e.amount||0));
    return {deposits,expenses,balance:deposits-expenses,categories:Object.entries(map).sort((a,b)=>b[1]-a[1])};
  },[entries]);

  const categories=form.type==='expense'?EXPENSE_CATEGORIES:DEPOSIT_CATEGORIES;
  const reset=()=>{setEditingId(null);setForm({type:'expense',amount:'',category:'Food',date:selectedMonth===monthString()?dateString():`${selectedMonth}-01`,description:''});};

  const save=async e=>{
    e.preventDefault();
    if(!form.amount||Number(form.amount)<=0)return;
    setSaving(true);
    try{
      const r=await fetch(editingId?`${API_URL}/expenses/${editingId}`:`${API_URL}/expenses`,{
        method:editingId?'PATCH':'POST',headers:headers(),body:JSON.stringify({...form,amount:Number(form.amount)})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Could not save transaction');
      if(data.month&&data.month!==selectedMonth) setSelectedMonth(data.month); else await load();
      reset(); setError('');
    }catch(e){setError(e.message||'Could not save transaction');}
    finally{setSaving(false);}
  };

  const edit=e=>{setEditingId(e.id);setForm({type:e.type,amount:String(e.amount),category:e.category,date:e.date,description:e.description||''});window.scrollTo({top:0,behavior:'smooth'});};
  const remove=async e=>{
    if(!window.confirm(`Delete ${e.description||e.category} (${money(e.amount)})?`)) return;
    try{
      const r=await fetch(`${API_URL}/expenses/${e.id}`,{method:'DELETE',headers:{'x-admin-password':localStorage.getItem('admin_password')||''}});
      if(!r.ok) throw new Error();
      setEntries(x=>x.filter(v=>v.id!==e.id));
    }catch{setError('Could not delete transaction');}
  };
  const maxCategory=summary.categories[0]?.[1]||1;

  return <AuthWrapper>
    <Head><title>Monthly Expenses | SliderApp</title></Head>
    <Navbar/>
    <main className="min-h-screen pt-24 pb-14 px-4 bg-dark-bg">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div>
            <div className="text-primary-light text-sm font-medium mb-2">Personal finance</div>
            <h1 className="text-3xl md:text-4xl font-bold">Monthly Expenses</h1>
            <p className="text-slate-400 mt-2">Track deposits and spending so you always know where your money went.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={currency} onChange={e=>{setCurrency(e.target.value);localStorage.setItem('expense_currency',e.target.value);}} className="bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 text-sm">
              {CURRENCIES.map(c=><option key={c}>{c}</option>)}
            </select>
            <div className="card-dark flex items-center overflow-hidden">
              <button onClick={()=>setSelectedMonth(shiftMonth(selectedMonth,-1))} className="p-2.5 hover:bg-white/5">←</button>
              <input type="month" value={selectedMonth} onChange={e=>e.target.value&&setSelectedMonth(e.target.value)} className="bg-transparent px-2 py-2 text-sm [color-scheme:dark]"/>
              <button onClick={()=>setSelectedMonth(shiftMonth(selectedMonth,1))} className="p-2.5 hover:bg-white/5">→</button>
            </div>
          </div>
        </div>

        {error&&<div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{error}</div>}

        <section className="grid sm:grid-cols-3 gap-4 mb-6">
          {[['Deposits',summary.deposits,'text-emerald-400'],['Expenses',summary.expenses,'text-rose-400'],['Net balance',summary.balance,summary.balance>=0?'text-white':'text-rose-400']].map(([label,value,cls])=>
            <div key={label} className="card-dark p-5"><div className="text-sm text-slate-400 mb-3">{label}</div><div className={`text-2xl font-bold ${cls}`}>{money(value)}</div><div className="text-xs text-slate-500 mt-1">{monthLabel(selectedMonth)}</div></div>
          )}
        </section>

        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
          <form onSubmit={save} className="card-dark p-5 lg:sticky lg:top-24">
            <div className="flex justify-between mb-5"><h2 className="font-semibold text-lg">{editingId?'Edit transaction':'Add transaction'}</h2>{editingId&&<button type="button" onClick={reset} className="text-xs text-slate-400">Cancel</button>}</div>
            <div className="grid grid-cols-2 p-1 bg-dark-bg border border-dark-border rounded-xl mb-4">
              {['expense','deposit'].map(t=><button key={t} type="button" onClick={()=>setForm(f=>({...f,type:t,category:(t==='expense'?EXPENSE_CATEGORIES:DEPOSIT_CATEGORIES)[0]}))} className={`py-2.5 rounded-lg text-sm font-medium ${form.type===t?(t==='expense'?'bg-rose-500/15 text-rose-300':'bg-emerald-500/15 text-emerald-300'):'text-slate-500'}`}>{t==='expense'?'Expense':'Deposit'}</button>)}
            </div>
            <label className="block mb-4"><span className="text-sm text-slate-400 block mb-1.5">Amount</span><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00" className="input-dark text-xl font-semibold"/></label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label><span className="text-sm text-slate-400 block mb-1.5">Category</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="input-dark !px-3 [color-scheme:dark]">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
              <label><span className="text-sm text-slate-400 block mb-1.5">Date</span><input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="input-dark !px-3 [color-scheme:dark]"/></label>
            </div>
            <label className="block mb-5"><span className="text-sm text-slate-400 block mb-1.5">Description</span><input value={form.description} onChange={e=>setForm({...form,description:e.target.value.slice(0,240)})} placeholder="What was it for?" className="input-dark"/></label>
            <button disabled={saving} className="btn-gradient w-full disabled:opacity-50">{saving?'Saving…':editingId?'Save changes':`Add ${form.type}`}</button>
          </form>

          <div className="space-y-6 min-w-0">
            <section className="card-dark p-5">
              <h2 className="font-semibold text-lg">Where your money went</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">Expense breakdown for {monthLabel(selectedMonth)}</p>
              {summary.categories.length===0?<div className="py-10 text-center text-slate-500 text-sm">No expenses recorded yet.</div>:
                <div className="space-y-4">{summary.categories.map(([cat,amt])=><div key={cat}><div className="flex justify-between text-sm mb-1.5"><span>{cat}</span><span>{money(amt)}</span></div><div className="h-2 rounded-full bg-dark-bg overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent-purple" style={{width:`${Math.max((amt/maxCategory)*100,3)}%`}}/></div><div className="text-[10px] text-slate-600 mt-1">{summary.expenses?((amt/summary.expenses)*100).toFixed(1):'0.0'}% of spending</div></div>)}</div>}
            </section>
            <section className="card-dark overflow-hidden">
              <div className="px-5 py-4 border-b border-dark-border"><h2 className="font-semibold">Transactions</h2><p className="text-xs text-slate-500 mt-0.5">{entries.length} items in {monthLabel(selectedMonth)}</p></div>
              {loading?<div className="py-16 text-center text-slate-500">Loading…</div>:entries.length===0?<div className="py-16 text-center text-slate-500">Nothing recorded yet.</div>:
                <div className="divide-y divide-dark-border">{entries.map(e=><div key={e.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center ${e.type==='deposit'?'bg-emerald-500/10 text-emerald-400':'bg-rose-500/10 text-rose-400'}`}>{e.type==='deposit'?'↓':'↑'}</div>
                  <div className="min-w-0 flex-1"><div className="font-medium truncate">{e.description||e.category}</div><div className="text-xs text-slate-500 mt-1">{e.category} · {new Date(`${e.date}T00:00:00`).toLocaleDateString()}</div></div>
                  <div className="text-right"><div className={`font-semibold ${e.type==='deposit'?'text-emerald-400':'text-white'}`}>{e.type==='deposit'?'+':'-'}{money(e.amount)}</div><div className="flex gap-2 justify-end mt-1"><button onClick={()=>edit(e)} className="text-[11px] text-slate-500 hover:text-primary-light">Edit</button><button onClick={()=>remove(e)} className="text-[11px] text-slate-500 hover:text-rose-400">Delete</button></div></div>
                </div>)}</div>}
            </section>
          </div>
        </div>
      </div>
    </main>
  </AuthWrapper>;
}
