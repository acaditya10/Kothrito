"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, Timestamp, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Phone, Check, X, Bike, Power, TrendingUp, Users, Clock, Loader2, ShieldCheck, UserMinus, Edit3, Save, UserPlus, Trash2, Sun, Moon } from 'lucide-react';
import Image from 'next/image';
import Branding from '@/components/Branding';

interface Order { id: string; status: string; userName: string; userPhone: string; serviceType: string; price?: number; pickup: any; drop: any; createdAt: any; }
interface Rider { id: string; name: string; phone: string; email: string; riderStatus: boolean; role: string; }

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [stats, setStats] = useState({ revenue: 0, total: 0, pending: 0 });
  const [serviceStatus, setServiceStatus] = useState(true);
  const [showAddRider, setShowAddRider] = useState(false);
  const [newRider, setNewRider] = useState({ name: "", email: "", phone: "" });

  const ADMIN_EMAIL = "acadityachandra@gmail.com";

  useEffect(() => {
    const isDark = localStorage.getItem('kothrito-theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === ADMIN_EMAIL) setIsAdmin(true);
      else if (u) window.location.href = "/";
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('kothrito-theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('kothrito-theme', 'light'); }
  };

  useEffect(() => {
    if (!isAdmin) return;
    onSnapshot(query(collection(db, "orders"), where("status", "in", ["pending", "accepted"]), orderBy("createdAt", "desc")), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(docs); setStats(p => ({ ...p, pending: docs.length }));
    });
    const t = new Date(); t.setHours(0, 0, 0, 0);
    onSnapshot(query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(t)), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setHistory(docs); setStats(p => ({ ...p, total: docs.length, revenue: docs.filter(d => d.status === 'completed').reduce((sum, d: any) => sum + (d.price || 20), 0) }));
    });
    onSnapshot(collection(db, "riders"), (snap) => setRiders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rider))));
    onSnapshot(doc(db, "settings", "global"), (d) => { if (d.exists()) setServiceStatus(d.data().isServiceActive); });
  }, [isAdmin]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-orange-500" /></div>;
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 max-w-lg mx-auto border-x dark:border-slate-800 transition-colors duration-500">
      <header className="bg-white dark:bg-slate-900 p-6 border-b dark:border-slate-800 sticky top-0 z-50">
        <div className="flex justify-between items-center mb-6">
          <Branding role="Admin" />
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-orange-400">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => updateDoc(doc(db, "settings", "global"), { isServiceActive: !serviceStatus })} className={`px-4 py-2 rounded-2xl font-black text-[10px] text-white ${serviceStatus ? 'bg-green-500' : 'bg-red-500'}`}>
              {serviceStatus ? "SYSTEM LIVE" : "SYSTEM OFF"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border dark:border-slate-700 shadow-sm text-center">
            <TrendingUp size={14} className="text-orange-500 mx-auto mb-1" />
            <p className="text-[9px] font-black text-slate-400 uppercase">Revenue</p>
            <p className="text-lg font-black dark:text-white">₹{stats.revenue}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border dark:border-slate-700 shadow-sm text-center">
            <Clock size={14} className="text-blue-500 mx-auto mb-1" />
            <p className="text-[9px] font-black text-slate-400 uppercase">Active</p>
            <p className="text-lg font-black dark:text-white">{stats.pending}</p>
          </div>
          <div className="bg-slate-900 dark:bg-orange-600 p-4 rounded-3xl shadow-lg text-center text-white">
            <Users size={14} className="text-orange-400 mx-auto mb-1" />
            <p className="text-[9px] font-black text-slate-500 dark:text-orange-100 uppercase">Fleet</p>
            <p className="text-lg font-black">{riders.filter(r => r.role === 'rider').length}</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-10">
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Fleet Management</h3>
            <button onClick={() => setShowAddRider(true)} className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase"><UserPlus size={12} /> Add</button>
          </div>
          {riders.map(r => (
            <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border dark:border-slate-800 mb-4 shadow-sm flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${r.riderStatus ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-slate-300'}`} />
                <div><h4 className="font-black text-sm dark:text-white">{r.name}</h4><p className="text-[10px] text-slate-400 uppercase font-bold">{r.role}</p></div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => updateDoc(doc(db, "riders", r.id), { role: r.role === 'rider' ? 'inactive' : 'rider' })} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl dark:text-white"><ShieldCheck size={16} /></button>
                <button onClick={() => deleteDoc(doc(db, "riders", r.id))} className="p-2 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </section>
      </div>

      {showAddRider && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
          <form onSubmit={(e: any) => { e.preventDefault(); setDoc(doc(db, "riders", newRider.email.toLowerCase()), { ...newRider, role: "rider", riderStatus: false, addedAt: serverTimestamp() }); setShowAddRider(false); }} className="bg-white dark:bg-slate-900 w-full rounded-[3rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 dark:text-white">New Rider</h2>
            <div className="space-y-4">
              <input placeholder="Name" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl dark:text-white outline-none" onChange={e => setNewRider({ ...newRider, name: e.target.value })} />
              <input placeholder="Email" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl dark:text-white outline-none" onChange={e => setNewRider({ ...newRider, email: e.target.value })} />
              <input placeholder="Phone" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl dark:text-white outline-none" onChange={e => setNewRider({ ...newRider, phone: e.target.value })} />
              <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Authorize</button>
              <button type="button" onClick={() => setShowAddRider(false)} className="w-full text-slate-400 font-bold text-xs uppercase">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}