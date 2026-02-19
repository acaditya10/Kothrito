"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { Map, Phone, CheckCircle, Power, Bike, Loader2, TrendingUp, Calendar, Award, Sun, Moon } from 'lucide-react';
import Image from 'next/image';
import Branding from '@/components/Branding';

export default function RiderDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, lifetime: 0 });

  // --- THEME LOGIC ---
  useEffect(() => {
    const isDark = localStorage.getItem('kothrito-theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kothrito-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kothrito-theme', 'light');
    }
  };

  // --- AUTH & DATA ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        const riderRef = doc(db, "riders", u.email.toLowerCase());
        const unsubProfile = onSnapshot(riderRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().role === "rider") {
            const data = docSnap.data();
            if (!data.uid) updateDoc(riderRef, { uid: u.uid });
            setUser({ ...u, ...data, uid: u.uid });
            setIsAuthorized(true);
          } else { setIsAuthorized(false); }
          setLoading(false);
        });
        return () => unsubProfile();
      } else { setIsAuthorized(false); setLoading(false); }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthorized || !user) return;
    onSnapshot(query(collection(db, "orders"), where("status", "==", "pending")), (snap) => {
      setAvailableOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    onSnapshot(query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "accepted")), (snap) => {
      setActiveOrder(!snap.empty ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
    });
    onSnapshot(query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "completed")), (snap) => {
      const now = new Date();
      const sToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
      let t = 0, w = 0, l = 0;
      snap.docs.forEach(d => {
        const amt = d.data().price || 20; const time = d.data().createdAt?.seconds * 1000;
        l += amt; if (time >= sToday) t += amt; if (time >= sWeek) w += amt;
      });
      setEarnings({ today: t, week: w, lifetime: l });
    });
  }, [isAuthorized, user?.uid]);

  const handleAcceptJob = async (orderId: string) => {
    if (!user?.riderStatus) return alert("Go On Duty!");
    const orderRef = doc(db, "orders", orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists() || orderDoc.data().status !== "pending") {
          throw new Error("Job is no longer available. Another rider might have accepted it.");
        }
        transaction.update(orderRef, {
          status: "accepted",
          riderId: user.uid,
          riderName: user.name,
          riderPhone: user.phone
        });
      });
    } catch (error: any) {
      alert(error.message || "Failed to accept job.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-950"><Loader2 className="animate-spin text-orange-500" /></div>;
  if (!isAuthorized) return <div className="p-20 text-center font-bold dark:text-white">Access Denied</div>;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-md mx-auto transition-colors duration-500">
      <header className="flex justify-between items-center mb-8">
        <Branding role="Rider" />
        <div className="flex items-center gap-2">
          <button onClick={toggleDarkMode} className="p-2 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-orange-400 shadow-sm border dark:border-slate-800">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => updateDoc(doc(db, "riders", user.email.toLowerCase()), { riderStatus: !user.riderStatus })} className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-md ${user?.riderStatus ? 'bg-green-500 text-white shadow-green-100' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {user?.riderStatus ? "ON DUTY" : "OFF DUTY"}
          </button>
        </div>
      </header>

      {!activeOrder && (
        <section className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: 'Today', val: earnings.today, icon: <TrendingUp size={16} />, col: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Week', val: earnings.week, icon: <Calendar size={16} />, col: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Total', val: earnings.lifetime, icon: <Award size={16} />, col: 'text-white', bg: 'bg-slate-900 dark:bg-orange-600' }
          ].map((card, i) => (
            <div key={i} className={`${i === 2 ? card.bg : 'bg-white dark:bg-slate-900 border dark:border-slate-800'} rounded-3xl p-4 flex flex-col items-center shadow-sm`}>
              <div className={`${i === 2 ? 'text-white' : card.col} mb-2`}>{card.icon}</div>
              <h4 className={`text-[9px] font-black uppercase mb-1 ${i === 2 ? 'text-slate-400 dark:text-orange-100' : 'text-slate-400'}`}>{card.label}</h4>
              <p className={`text-sm font-black ${i === 2 ? 'text-white' : 'dark:text-white'}`}>₹{card.val}</p>
            </div>
          ))}
        </section>
      )}

      {activeOrder ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border-t-8 border-orange-500">
          <h2 className="text-2xl font-black dark:text-white mb-6 leading-tight">{activeOrder.userName}</h2>
          <div className="space-y-4 mb-8">
            <div className="flex gap-3"><div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" /><p className="text-sm font-bold dark:text-slate-300">P: {activeOrder.pickup.address}</p></div>
            <div className="flex gap-3"><div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" /><p className="text-sm font-bold dark:text-slate-300">D: {activeOrder.drop.address}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <a href={`tel:${activeOrder.userPhone}`} className="flex flex-col items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl dark:text-white"><Phone size={20} className="mb-1 text-orange-500" /> CALL</a>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.pickup.lat},${activeOrder.pickup.lng}`} className="flex flex-col items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl dark:text-white"><Map size={20} className="mb-1 text-blue-500" /> MAPS</a>
          </div>
          <button onClick={() => updateDoc(doc(db, "orders", activeOrder.id), { status: "completed" })} className="w-full bg-slate-900 dark:bg-orange-600 text-white py-4 rounded-2xl font-black">FINISH RIDE</button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Available Jobs ({availableOrders.length})</h3>
          {availableOrders.map(o => (
            <div key={o.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800 shadow-sm ${!user?.riderStatus ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-400 uppercase italic">{o.serviceType}</span><span className="text-orange-500 font-black">₹{o.price || 20}</span></div>
              <p className="text-sm font-bold dark:text-white mb-6 truncate leading-relaxed">📍 {o.pickup.address} → {o.drop.address}</p>
              <button onClick={() => handleAcceptJob(o.id)} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Accept Job</button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}