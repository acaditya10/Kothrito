"use client";
import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, Timestamp, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Phone, Check, X, Bike, Power, TrendingUp, Users, Clock, Loader2, ShieldCheck, UserMinus, Edit3, Save, UserPlus, Trash2, Sun, Moon, Download, ChevronRight, Activity, IndianRupee, MapPin, ReceiptText, ChevronLeft, Map, Utensils, ShoppingBasket, Star, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Branding from '@/components/Branding';
import { useHaptics } from '@/hooks/useHaptics';
import useSound from 'use-sound';
import { successChimeSound, errorBeepSound } from '@/lib/sounds';

interface Order { id: string; status: string; userName: string; userPhone: string; serviceType: string; price?: number; pickup: any; drop: any; createdAt: any; userId?: string; }
interface Rider { id: string; name: string; phone: string; email: string; riderStatus: boolean; role: string; }
interface UserData { id: string; name: string; phone: string; email: string; createdAt: any; }

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<any>(null);

  const { hapticSuccess, hapticError } = useHaptics();
  const [playSuccess] = useSound(successChimeSound, { volume: 0.5 });
  const [playError] = useSound(errorBeepSound, { volume: 0.5 });

  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState({ revenueToday: 0, totalToday: 0, pending: 0, historyAll: [] as Order[] });

  const [sysSettings, setSysSettings] = useState({ isServiceActive: true, baseFare: 50, perKmRate: 15, surgeMultiplier: 1.0 });
  const [editingPricing, setEditingPricing] = useState(false);
  const [newPricing, setNewPricing] = useState({ baseFare: 50, perKmRate: 15, surgeMultiplier: 1.0 });

  const [showAddRider, setShowAddRider] = useState(false);
  const [newRider, setNewRider] = useState({ name: "", email: "", phone: "" });

  const [activeModal, setActiveModal] = useState<"revenue" | "rides" | "fleet" | "pricing" | "users" | "feedback" | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [ridesPage, setRidesPage] = useState(1);

  const getServiceBadge = (type: string) => {
    if (type === 'food') return <span className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-fit"><Utensils size={12} /> Food</span>;
    if (type === 'grocery') return <span className="flex items-center gap-1.5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-fit"><ShoppingBasket size={12} /> Grocery</span>;
    return <span className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-fit"><Bike size={12} /> Ride</span>;
  };

  const ADMIN_EMAIL = "acadityachandra@gmail.com";

  useEffect(() => {
    const isDark = localStorage.getItem('kothrito-theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email === ADMIN_EMAIL) setIsAdmin(true);
      else setIsAdmin(false);
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

    // Track previous length to ring bell on new inbound orders
    let previousOrderCount = 0;

    // Active orders query: Fixed index issue by removing orderBy and sorting locally
    onSnapshot(query(collection(db, "orders"), where("status", "in", ["pending", "accepted"])), (snap: any) => {
      const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Order));
      docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      // Ping Admin!
      if (docs.length > previousOrderCount) {
        hapticSuccess();
        playSuccess();
      }
      previousOrderCount = docs.length;

      setOrders(docs);
    });

    // Complete history query for all analytics
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap: any) => {
      const allDocs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Order));
      const t = new Date(); t.setHours(0, 0, 0, 0);
      const todayDocs = allDocs.filter((d: any) => d.createdAt && d.createdAt.seconds * 1000 >= t.getTime());

      setHistory(allDocs);
      setStats((p: any) => ({
        ...p,
        historyAll: allDocs,
        totalToday: todayDocs.length,
        revenueToday: todayDocs.filter((d: any) => d.status === 'completed').reduce((sum: any, d: any) => sum + (d.price || 20), 0)
      }));
    });

    onSnapshot(collection(db, "riders"), (snap: any) => setRiders(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Rider))));
    onSnapshot(collection(db, "users"), (snap: any) => setActiveUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as UserData))));

    onSnapshot(doc(db, "settings", "global"), (d: any) => {
      if (d.exists()) {
        const data = d.data();
        setSysSettings({
          isServiceActive: data.isServiceActive ?? true,
          baseFare: data.baseFare ?? 50,
          perKmRate: data.perKmRate ?? 15,
          surgeMultiplier: data.surgeMultiplier ?? 1.0
        });
        setNewPricing({
          baseFare: data.baseFare ?? 50,
          perKmRate: data.perKmRate ?? 15,
          surgeMultiplier: data.surgeMultiplier ?? 1.0
        });
      }
    });
  }, [isAdmin]);

  const handleAddRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRider.name || !newRider.email) return;
    await setDoc(doc(db, "riders", newRider.email.toLowerCase()), {
      name: newRider.name,
      email: newRider.email,
      phone: newRider.phone,
      role: 'rider',
      riderStatus: false,
      createdAt: serverTimestamp()
    });
    setShowAddRider(false);
    setNewRider({ name: "", email: "", phone: "" });
  };

  const downloadCSV = () => {
    const headers = ["ID", "Status", "User", "Phone", "Service", "Price", "Pickup", "Drop", "Date"];
    const rows = history.map((o: any) => [
      o.id, o.status, o.userName, o.userPhone, o.serviceType, o.price || 20,
      `"${o.pickup?.address}"`, `"${o.drop?.address}"`, o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString() : ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kothrito_rides_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAuthAction = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) { console.error("Login failed", error); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-950"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Branding role="Admin" />
        <p className="text-slate-500 font-bold text-sm mt-4 mb-8">Authenticate to access the Master Control Panel</p>
        <button onClick={handleAuthAction} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-8 py-4 rounded-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 active:scale-95 transition-all">
          <Image src="https://authjs.dev/img/providers/google.svg" width={24} height={24} alt="Google" />
          Login with Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
        <Branding role="Admin" />
        <p className="text-red-500 font-black tracking-widest uppercase mt-8 mb-2">Access Denied</p>
        <p className="text-sm font-bold text-slate-500 mb-8 max-w-xs leading-relaxed">Your profile lacks Master Admin Database privileges.</p>
        <button onClick={() => auth.signOut()} className="text-slate-400 font-bold text-xs uppercase tracking-widest underline decoration-2 underline-offset-4">Change Account</button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-0 mx-auto transition-colors duration-500 flex flex-col md:flex-row max-w-[1600px]">

      {/* --- RESPONSIVE SIDEBAR / HEADER --- */}
      <aside className="bg-white dark:bg-slate-900 md:bg-transparent md:dark:bg-transparent p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 sticky top-0 z-40 md:h-screen md:w-[320px] shrink-0 flex flex-col shadow-sm md:shadow-none">
        <div className="flex justify-between items-center mb-8">
          <Branding role="Admin" />
          <button onClick={toggleDarkMode} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-orange-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* 2x3 Grid -> Modern Stacked/Grid Layout */}
        <div className="grid grid-cols-3 md:grid-cols-2 gap-3 mb-6 md:mb-auto">
          {/* Revenue */}
          <div onClick={() => setActiveModal('revenue')} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 p-4 rounded-[1.5rem] md:rounded-2xl shadow-sm border border-transparent md:border-slate-100 md:dark:border-slate-800 cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3">
            <div className="bg-orange-50 dark:bg-orange-500/10 p-2.5 rounded-xl text-orange-500"><TrendingUp size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Rev Today</p>
              <p className="text-xl font-black dark:text-white leading-none">₹{stats.revenueToday}</p>
            </div>
          </div>
          {/* Rides */}
          <div onClick={() => { setActiveModal('rides'); setRidesPage(1); }} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 p-4 rounded-[1.5rem] md:rounded-2xl shadow-sm border border-transparent md:border-slate-100 md:dark:border-slate-800 cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3">
            <div className="bg-blue-50 dark:bg-blue-500/10 p-2.5 rounded-xl text-blue-500"><Map size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">All Rides</p>
              <p className="text-xl font-black dark:text-white leading-none">{stats.historyAll.length}</p>
            </div>
          </div>
          {/* Fleet */}
          <div onClick={() => setActiveModal('fleet')} className="bg-slate-900 dark:bg-orange-600 hover:bg-black dark:hover:bg-orange-500 p-4 rounded-[1.5rem] md:rounded-2xl shadow-lg md:shadow-orange-500/20 text-white cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl text-orange-400 md:text-white"><Bike size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 md:text-orange-100 uppercase tracking-widest leading-none mb-1">Fleet</p>
              <p className="text-xl font-black leading-none">{riders.filter(r => r.role === 'rider').length}</p>
            </div>
          </div>
          {/* Pricing */}
          <div onClick={() => setActiveModal('pricing')} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 p-4 rounded-[1.5rem] md:rounded-2xl shadow-sm border border-transparent md:border-slate-100 md:dark:border-slate-800 cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-500"><IndianRupee size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pricing</p>
              <p className="text-xl font-black dark:text-white leading-none">₹{sysSettings.baseFare}</p>
            </div>
          </div>
          {/* Users */}
          <div onClick={() => setActiveModal('users')} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 p-4 rounded-[1.5rem] md:rounded-2xl shadow-sm border border-transparent md:border-slate-100 md:dark:border-slate-800 cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3">
            <div className="bg-purple-50 dark:bg-purple-500/10 p-2.5 rounded-xl text-purple-500"><Users size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Users</p>
              <p className="text-xl font-black dark:text-white leading-none">{activeUsers.length}</p>
            </div>
          </div>
          {/* System */}
          <div onClick={() => updateDoc(doc(db, "settings", "global"), { isServiceActive: !sysSettings.isServiceActive })} className={`p-4 rounded-[1.5rem] md:rounded-2xl shadow-sm cursor-pointer active:scale-95 transition-all flex flex-col items-start gap-3 ${sysSettings.isServiceActive ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-red-500 text-white shadow-red-500/30'}`}>
            <div className="bg-white/20 p-2.5 rounded-xl text-white"><Power size={16} /></div>
            <div>
              <p className="text-[10px] font-black text-green-100 opacity-90 uppercase tracking-widest leading-none mb-1">System</p>
              <p className="text-[17px] font-black uppercase tracking-widest leading-none">{sysSettings.isServiceActive ? "LIVE" : "OFF"}</p>
            </div>
          </div>
        </div>

        {/* Feedback Button (Moved to Sidebar on Desktop) */}
        <button onClick={() => setActiveModal('feedback')} className="hidden md:flex w-full mt-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 p-4 rounded-3xl items-center justify-between transition-colors">
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student Satisfaction</span>
            <span className="text-sm font-black dark:text-white flex items-center gap-2"><Star size={16} className="fill-orange-400 text-orange-400" /> Reviews</span>
          </div>
          <ChevronRight size={20} className="text-slate-400" />
        </button>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 w-full max-w-4xl mx-auto">

        <div className="p-6 space-y-10">
          <section>
            <button onClick={() => setActiveModal('feedback')} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-sm active:scale-95 transition-transform mb-10">
              <div className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Student Satisfaction</span>
                <span className="text-xl font-black dark:text-white flex items-center gap-2"><Star size={20} className="fill-orange-400 text-orange-400" /> Feedback & Reviews</span>
              </div>
              <ChevronRight className="text-slate-300 dark:text-slate-600" />
            </button>

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Activity size={14} className="text-orange-500" /> Live Watchlist</h3>
              <span className="text-[10px] font-bold text-slate-400">{orders.length} ACTIVE</span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <p className="text-xs font-bold text-slate-400 uppercase">No active operations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(o => (
                  <div key={o.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${o.status === 'accepted' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {o.status}
                      </span>
                      {getServiceBadge(o.serviceType)}
                    </div>
                    <p className="text-sm font-bold dark:text-white mb-1">{o.userName} <span className="text-slate-400 text-xs ml-2">₹{o.price || 20}</span></p>
                    <p className="text-xs text-slate-500 truncate mb-4">📍 {o.pickup.address} → {o.drop.address}</p>

                    {o.status === "accepted" && (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-slate-700">
                        <Bike size={14} className="text-blue-500" />
                        <span className="text-xs font-bold dark:text-white truncate">Assigned to: {(o as any).riderName || 'Unknown'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {activeModal && (
          <>
            <div className="fixed inset-0 z-[190] bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setActiveModal(null)}></div>
            <div className="fixed inset-y-0 right-0 z-[200] w-full md:w-[480px] bg-white dark:bg-slate-950 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 md:border-l dark:border-slate-800">
              <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md z-10">
                <h2 className="text-xl font-black dark:text-white uppercase tracking-wider">
                  {activeModal === 'revenue' && 'Detailed Analytics'}
                  {activeModal === 'rides' && 'Rides Logs'}
                  {activeModal === 'fleet' && 'Fleet Management'}
                  {activeModal === 'pricing' && 'Pricing Settings'}
                  {activeModal === 'users' && 'User Directory'}
                  {activeModal === 'feedback' && 'Feedback & Reviews'}
                </h2>
                <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full dark:text-white"><X size={20} /></button>
              </div>

              <div className="p-6 overflow-y-auto pb-32">
                {activeModal === 'revenue' && (
                  <div className="space-y-6">
                    <button onClick={downloadCSV} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-orange-600 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform">
                      <Download size={16} /> Export Complete CSV History
                    </button>

                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Revenue Breakdown</h3>
                      {(() => {
                        const now = new Date();
                        const tToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        const tWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
                        const tMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                        const tYear = new Date(now.getFullYear(), 0, 1).getTime();

                        let revs = { d: 0, w: 0, m: 0, y: 0, a: 0 };
                        history.forEach((o: any) => {
                          if (o.status !== 'completed' || !o.createdAt) return;
                          const t = o.createdAt.seconds * 1000;
                          const p = o.price || 20;
                          revs.a += p;
                          if (t >= tToday) revs.d += p;
                          if (t >= tWeek) revs.w += p;
                          if (t >= tMonth) revs.m += p;
                          if (t >= tYear) revs.y += p;
                        });

                        return (
                          <div className="space-y-4">
                            {[
                              { l: "Today", v: revs.d }, { l: "This Week", v: revs.w },
                              { l: "This Month", v: revs.m }, { l: "This Year", v: revs.y },
                              { l: "All Time", v: revs.a }
                            ].map(x => (
                              <div key={x.l} className="flex justify-between items-center border-b dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                                <span className="font-bold dark:text-slate-300">{x.l}</span>
                                <span className="font-black text-orange-500">₹{x.v}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeModal === 'fleet' && !selectedRider && (
                  <div className="space-y-4">
                    <button onClick={() => setShowAddRider(true)} className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform mb-6">
                      <UserPlus size={16} /> Add New Rider
                    </button>

                    {riders.map((r: any) => (
                      <div key={r.id} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-[2rem] flex justify-between items-center cursor-pointer active:scale-95 transition-transform" onClick={() => setSelectedRider(r)}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex justify-center items-center text-white font-black text-xl shadow-lg ${r.riderStatus ? 'bg-green-500' : 'bg-slate-400'}`}>
                            {r.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-black text-lg dark:text-white leading-tight">{r.name}</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{r.role}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, "riders", r.id), { role: r.role === 'rider' ? 'inactive' : 'rider' }); }} className="bg-white dark:bg-slate-800 p-2 rounded-xl text-slate-500 dark:text-white shadow-sm border dark:border-slate-700">
                            <ShieldCheck size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "riders", r.id)); }} className="bg-white dark:bg-slate-800 p-2 rounded-xl text-red-500 shadow-sm border dark:border-slate-700">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeModal === 'fleet' && selectedRider && (
                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-200">
                    <button onClick={() => setSelectedRider(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 active:scale-95 transition-transform">
                      <ChevronRight className="rotate-180" size={16} /> Back to Fleet
                    </button>

                    <div className={`p-6 rounded-[2rem] text-white shadow-lg ${selectedRider.riderStatus ? 'bg-green-500 shadow-green-500/20' : 'bg-slate-500 shadow-slate-500/20'}`}>
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-2xl mb-1">{selectedRider.name}</h3>
                        <span className="text-[10px] bg-white/20 px-2 py-1 rounded-md font-black uppercase tracking-widest">{selectedRider.role}</span>
                      </div>
                      <p className="font-mono text-sm opacity-90 mb-4">{selectedRider.phone} • {selectedRider.email}</p>
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-80 border-t border-white/20 pt-4 mt-2">
                        Status: {selectedRider.riderStatus ? "Online" : "Offline"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Rider Work History</h4>
                      {(() => {
                        const riderOrders = stats.historyAll.filter((o: any) => o.riderId === selectedRider.id || (o as any).riderPhone === selectedRider.phone).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                        if (riderOrders.length === 0) return <p className="text-center font-bold text-slate-400 p-8 border border-dashed rounded-3xl dark:border-slate-800">No jobs completed yet.</p>;
                        return riderOrders.map((o: any) => (
                          <div key={o.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-black uppercase text-slate-500">{new Date(o.createdAt?.seconds * 1000).toLocaleString()}</span>
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${o.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{o.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              {getServiceBadge(o.serviceType)}
                              <span className="text-orange-500 font-black text-sm pr-2">Earned: ₹{o.price || 20}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 mb-2">Student: {o.userName}</p>
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate"><span className="text-slate-400 mr-1">P:</span> {o.pickup.address}</p>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate"><span className="text-slate-400 mr-1">D:</span> {o.drop.address}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {activeModal === 'rides' && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex justify-between items-center">
                      <span>Complete Rides Database</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-[9px]">{stats.historyAll.length} Total</span>
                    </h3>

                    {(() => {
                      const totalPages = Math.ceil(stats.historyAll.length / 10);
                      const currentRides = stats.historyAll.slice((ridesPage - 1) * 10, ridesPage * 10);

                      return (
                        <>
                          {currentRides.map((o: any) => (
                            <div key={o.id} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-[2rem] mb-4">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase">{o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString() : 'Just now'}</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${o.status === 'completed' ? 'bg-green-500 text-white' : o.status === 'accepted' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
                                  {o.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">Student</p>
                                  <h4 className="font-black text-lg dark:text-white leading-tight">{o.userName}</h4>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold uppercase text-slate-400">Rider</p>
                                  <h4 className="font-black text-lg dark:text-white leading-tight">{(o as any).riderName || 'Pending'}</h4>
                                </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl space-y-3 shadow-inner">
                                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> <p className="text-xs font-bold dark:text-slate-300 truncate">P: {o.pickup.address}</p></div>
                                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> <p className="text-xs font-bold dark:text-slate-300 truncate">D: {o.drop.address}</p></div>
                              </div>
                              <div className="border-t dark:border-slate-800 pt-4 flex justify-between items-center">
                                {getServiceBadge(o.serviceType)}
                                <span className="text-lg font-black text-orange-500">Paid: ₹{o.price || 20}</span>
                              </div>
                            </div>
                          ))}

                          {stats.historyAll.length > 10 && (
                            <div className="flex justify-between items-center mt-8 bg-slate-50 dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800">
                              <button disabled={ridesPage === 1} onClick={() => setRidesPage(p => p - 1)} className="p-3 bg-white dark:bg-slate-800 rounded-xl disabled:opacity-30 dark:text-white shadow-sm active:scale-95 transition-transform"><ChevronLeft size={18} /></button>
                              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Page {ridesPage} of {totalPages}</span>
                              <button disabled={ridesPage === totalPages} onClick={() => setRidesPage(p => p + 1)} className="p-3 bg-white dark:bg-slate-800 rounded-xl disabled:opacity-30 dark:text-white shadow-sm active:scale-95 transition-transform"><ChevronRight size={18} /></button>
                            </div>
                          )}

                          {stats.historyAll.length === 0 && <p className="text-center text-slate-400 font-bold p-10">No rides in database.</p>}
                        </>
                      );
                    })()}
                  </div>
                )}

                {activeModal === 'pricing' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-[2rem] shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-xs">Current Engine</h3>
                        {!editingPricing && (
                          <button onClick={() => setEditingPricing(true)} className="text-orange-500 p-2 bg-orange-50 dark:bg-slate-800 rounded-xl"><Edit3 size={16} /></button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-800 pb-4">
                          <span className="font-bold text-sm dark:text-slate-300">Base Fare (₹)</span>
                          {editingPricing ? (
                            <input type="number" value={newPricing.baseFare} onChange={e => setNewPricing({ ...newPricing, baseFare: Number(e.target.value) })} className="w-20 text-right bg-slate-100 dark:bg-slate-950 p-2 rounded-lg font-black outline-none dark:text-white border dark:border-slate-700 focus:border-orange-500 transition-colors" />
                          ) : (
                            <span className="font-black text-lg dark:text-white">₹{sysSettings.baseFare}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center border-b dark:border-slate-800 pb-4">
                          <span className="font-bold text-sm dark:text-slate-300">Per-KM Rate (₹)</span>
                          {editingPricing ? (
                            <input type="number" step="0.1" value={newPricing.perKmRate} onChange={e => setNewPricing({ ...newPricing, perKmRate: Number(e.target.value) })} className="w-20 text-right bg-slate-100 dark:bg-slate-950 p-2 rounded-lg font-black outline-none dark:text-white border dark:border-slate-700 focus:border-orange-500 transition-colors" />
                          ) : (
                            <span className="font-black text-lg dark:text-white">₹{sysSettings.perKmRate}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <div>
                            <span className="font-bold text-sm block dark:text-slate-300">Surge Multiplier</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">1.0x = Normal, 1.5x = +50%</span>
                          </div>
                          {editingPricing ? (
                            <input type="number" step="0.1" min="1" max="5" value={newPricing.surgeMultiplier} onChange={e => setNewPricing({ ...newPricing, surgeMultiplier: Number(e.target.value) })} className="w-20 text-right bg-orange-50 dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50 p-2 rounded-lg font-black outline-none text-orange-600 focus:border-orange-500 transition-colors" />
                          ) : (
                            <span className={`font-black text-lg ${sysSettings.surgeMultiplier > 1 ? 'text-red-500' : 'dark:text-white'}`}>{sysSettings.surgeMultiplier}x</span>
                          )}
                        </div>
                      </div>

                      {editingPricing && (
                        <div className="flex gap-3 mt-8">
                          <button onClick={() => { setEditingPricing(false); setNewPricing(sysSettings); }} className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 uppercase tracking-wider text-xs">Cancel</button>
                          <button onClick={() => { updateDoc(doc(db, "settings", "global"), newPricing); setEditingPricing(false); }} className="flex-1 py-3 rounded-xl font-black text-white bg-green-500 uppercase tracking-wider text-xs shadow-lg shadow-green-500/20">Save</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeModal === 'users' && !selectedUser && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center mb-6">
                      <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Total Registered</span>
                      <span className="font-black text-lg dark:text-white bg-white dark:bg-slate-800 px-4 py-1 rounded-lg border dark:border-slate-700">{activeUsers.length}</span>
                    </div>

                    {activeUsers.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((u: any) => {
                      const userOrders = stats.historyAll.filter((o: any) => o.userId === u.id || o.userPhone === u.phone);
                      return (
                        <div key={u.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-[2rem] shadow-sm active:scale-95 transition-transform" onClick={() => setSelectedUser(u)}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-lg dark:text-white leading-tight">{u.name || "Unnamed Student"}</h4>
                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              <ReceiptText size={12} className="text-blue-500" />
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{userOrders.length}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold font-mono tracking-tight mb-3 opacity-80">{u.email}</p>
                          <div className="flex justify-between items-center pt-3 border-t dark:border-slate-800 border-dashed">
                            <span className="text-xs font-bold text-slate-400">{u.phone || "No Phone"}</span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600 font-black tracking-wider uppercase">
                              {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeModal === 'users' && selectedUser && (
                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-200">
                    <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 active:scale-95 transition-transform">
                      <ChevronRight className="rotate-180" size={16} /> Back to Directory
                    </button>

                    <div className="bg-orange-500 p-6 rounded-[2rem] text-white shadow-lg shadow-orange-500/20">
                      <h3 className="font-black text-2xl mb-1">{selectedUser.name}</h3>
                      <p className="font-mono text-sm opacity-90 mb-4">{selectedUser.phone} • {selectedUser.email}</p>
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-80 border-t border-white/20 pt-4 mt-2">
                        Joined {selectedUser.createdAt ? new Date(selectedUser.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Complete Order History</h4>
                      {(() => {
                        const userOrders = stats.historyAll.filter((o: any) => o.userId === selectedUser.id || o.userPhone === selectedUser.phone).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                        if (userOrders.length === 0) return <p className="text-center font-bold text-slate-400 p-8 border border-dashed rounded-3xl dark:border-slate-800">No orders placed yet.</p>;
                        return userOrders.map((o: any) => (
                          <div key={o.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-black uppercase text-slate-500">{new Date(o.createdAt?.seconds * 1000).toLocaleString()}</span>
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${o.status === 'completed' ? 'bg-green-100 text-green-600' : o.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{o.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              {getServiceBadge(o.serviceType)}
                              <span className="text-orange-500 font-black text-sm pr-2">Paid: ₹{o.price || 20}</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate"><span className="text-slate-400 mr-1">P:</span> {o.pickup.address}</p>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate"><span className="text-slate-400 mr-1">D:</span> {o.drop.address}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {activeModal === 'feedback' && (
                  <div className="space-y-6">
                    {(() => {
                      const feedbackList = stats.historyAll.filter((o: any) => o.rated && o.rating > 0).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                      if (feedbackList.length === 0) {
                        return (
                          <div className="text-center p-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                            <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Feedback Received Yet</p>
                          </div>
                        );
                      }

                      return feedbackList.map((f: any) => (
                        <div key={f.id} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-[2rem] shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} size={16} className={star <= f.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200 dark:text-slate-800'} />
                              ))}
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-400">{new Date(f.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                          </div>

                          {f.review && <p className="text-sm font-bold dark:text-white italic mb-4">"{f.review}"</p>}

                          <div className="bg-white dark:bg-slate-950 p-4 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Student</p>
                              <p className="text-xs font-black dark:text-white">{f.userName}</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Rider</p>
                              <p className="text-xs font-black dark:text-white">{f.riderName || 'Unknown'}</p>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div> {/* CLOSING MAIN CONTENT DIV */}

      {/* --- ADD RIDER MODAL --- */}
      {showAddRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black dark:text-white">New Rider</h3>
              <button onClick={() => setShowAddRider(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddRider} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                <input required type="text" value={newRider.name} onChange={e => setNewRider({ ...newRider, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                <input required type="email" value={newRider.email} onChange={e => setNewRider({ ...newRider, email: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" placeholder="rider@kothrito.com" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                <input required type="tel" value={newRider.phone} onChange={e => setNewRider({ ...newRider, phone: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" placeholder="+91 9876543210" />
              </div>
              <button type="submit" className="w-full bg-orange-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl mt-2 active:scale-95 transition-transform">
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}