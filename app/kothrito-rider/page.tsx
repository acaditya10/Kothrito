"use client";
import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { Map, Phone, CheckCircle, Power, Bike, Loader2, TrendingUp, Calendar, Award, Sun, Moon, Utensils, ShoppingBasket, Star, MessageSquare, MapPin } from 'lucide-react';
import Image from 'next/image';
import Branding from '@/components/Branding';
import { useHaptics } from '@/hooks/useHaptics';
import useSound from 'use-sound';
import { successChimeSound, errorBeepSound } from '@/lib/sounds';

export default function RiderDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi'>('en'); // <-- Language State
  const [isAccepting, setIsAccepting] = useState<string | null>(null);

  const { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticError } = useHaptics();
  const [playSuccess] = useSound(successChimeSound, { volume: 0.5 });
  const [playError] = useSound(errorBeepSound, { volume: 0.5 });
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, lifetime: 0 });
  const [reviews, setReviews] = useState<any[]>([]);

  // --- TRANSLATION DICTIONARY ---
  const dict = {
    en: {
      onDuty: "ON DUTY", offDuty: "OFF DUTY", today: "Today", week: "Week", total: "Total",
      avail: "Available Jobs", accept: "ACCEPT JOB", finish: "FINISH RIDE", call: "CALL", map: "MAPS",
      access: "Access Denied", reviews: "Recent Reviews", errAccept: "Failed to accept job."
    },
    hi: {
      onDuty: "ड्यूटी पर", offDuty: "ड्यूटी बंद", today: "आज", week: "सप्ताह", total: "कुल",
      avail: "उपलब्ध काम", accept: "स्वीकार करें", finish: "सवारी पूरी करें", call: "कॉल करें", map: "नक्शा",
      access: "पहुंच अस्वीकृत", reviews: "हाल की समीक्षाएं", errAccept: "काम स्वीकार करने में विफल।"
    }
  };
  const t = dict[lang];

  // --- THEME LOGIC ---
  useEffect(() => {
    const isDark = localStorage.getItem('kothrito-theme') === 'dark';
    const initLang = localStorage.getItem('kothrito-lang') as 'en' | 'hi' || 'en';
    setDarkMode(isDark);
    setLang(initLang);
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

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'hi' : 'en';
    setLang(newLang);
    localStorage.setItem('kothrito-lang', newLang);
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

      const r_list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => o.rated && o.rating > 0).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReviews(r_list);
    });
  }, [isAuthorized, user?.uid]);

  const handleAcceptJob = async (orderId: string) => {
    if (!user?.riderStatus) return alert(t.onDuty);

    hapticMedium();
    setIsAccepting(orderId);

    const orderRef = doc(db, "orders", orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists() || orderDoc.data().status !== "pending") {
          throw new Error("Already Claimed");
        }
        transaction.update(orderRef, {
          status: "accepted",
          riderId: user.uid,
          riderName: user.name,
          riderPhone: user.phone
        });
      });
      hapticSuccess();
      playSuccess();
    } catch (error: any) {
      hapticError();
      playError();
      alert(error.message === "Already Claimed" ? "Too slow! Another rider just claimed this trip." : t.errAccept);
    } finally {
      setIsAccepting(null);
    }
  };

  const getServiceBadge = (type: string) => {
    if (type === 'food') return <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Utensils size={14} /> Food</div>;
    if (type === 'grocery') return <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><ShoppingBasket size={14} /> Grocery</div>;
    return <div className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Bike size={14} /> Ride</div>;
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
        <Branding role="Rider" />
        <p className="text-slate-500 font-bold text-sm mt-4 mb-8">Authenticate to access the Rider Dashboard</p>
        <button onClick={handleAuthAction} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-8 py-4 rounded-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 active:scale-95 transition-all">
          <Image src="https://authjs.dev/img/providers/google.svg" width={24} height={24} alt="Google" />
          Login with Google
        </button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
        <Branding role="Rider" />
        <p className="text-orange-600 font-black tracking-widest uppercase mt-8 mb-2">Access Denied</p>
        <p className="text-sm font-bold text-slate-500 mb-8 max-w-xs leading-relaxed">Your profile lacks Rider Fleet routing privileges.</p>
        <button onClick={() => auth.signOut()} className="text-slate-400 font-bold text-xs uppercase tracking-widest underline decoration-2 underline-offset-4">Change Account</button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-md mx-auto transition-colors duration-500 mb-20">
      <header className="flex justify-between items-center mb-10">
        <Branding role="Rider" onClick={() => window.location.reload()} />
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className={`px-3 py-2 rounded-xl text-[10px] font-black shadow-sm border transition-colors ${lang === 'hi' ? 'bg-orange-100 dark:bg-orange-900 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
            अ
          </button>
          <button onClick={toggleDarkMode} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-orange-400 shadow-sm border border-slate-200 dark:border-slate-800">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => updateDoc(doc(db, "riders", user.email.toLowerCase()), { riderStatus: !user.riderStatus })} className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-md border ${user?.riderStatus ? 'bg-green-500 border-green-500 text-white shadow-green-200 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
            {user?.riderStatus ? t.onDuty : t.offDuty}
          </button>
        </div>
      </header>

      {!activeOrder && (
        <section className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: t.today, val: earnings.today, icon: <TrendingUp size={16} />, col: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
            { label: t.week, val: earnings.week, icon: <Calendar size={16} />, col: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: t.total, val: earnings.lifetime, icon: <Award size={16} />, col: 'text-slate-800 dark:text-white', bg: 'bg-slate-200 dark:bg-slate-800' }
          ].map((card, i) => (
            <div key={i} className={`rounded-[2rem] p-5 flex flex-col items-center shadow-sm ${card.bg}`}>
              <div className={`${card.col} mb-2 bg-white/50 dark:bg-black/20 p-2 rounded-full`}>{card.icon}</div>
              <h4 className={`text-[9px] font-black uppercase mb-1 opacity-70 ${card.col}`}>{card.label}</h4>
              <p className={`text-base font-black ${card.col}`}>₹{card.val}</p>
            </div>
          ))}
        </section>
      )}

      {activeOrder ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800">
          <div className="bg-orange-500 p-6 flex justify-between items-center text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-200 mb-1">Passenger</p>
              <h2 className="text-3xl font-black leading-none">{activeOrder.userName}</h2>
            </div>
            {getServiceBadge(activeOrder.serviceType)}
          </div>

          <div className="p-6 space-y-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex gap-4 items-start">
              <div className="bg-green-100 dark:bg-green-500/20 p-2.5 rounded-full shrink-0"><MapPin size={24} className="text-green-600 dark:text-green-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pickup</p>
                <p className="text-xl font-bold dark:text-white leading-tight">{activeOrder.pickup.address}</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="bg-red-100 dark:bg-red-500/20 p-2.5 rounded-full shrink-0"><MapPin size={24} className="text-red-600 dark:text-red-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Drop</p>
                <p className="text-xl font-bold dark:text-white leading-tight">{activeOrder.drop.address}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-slate-50 dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-4">
              <a href={`tel:${activeOrder.userPhone}`} className="flex flex-col items-center justify-center bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 border border-blue-200 dark:border-blue-500/30 p-5 rounded-3xl transition-colors active:scale-95 shadow-sm">
                <Phone size={28} className="mb-2 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">{t.call}</span>
              </a>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.pickup.lat},${activeOrder.pickup.lng}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 border border-emerald-200 dark:border-emerald-500/30 p-5 rounded-3xl transition-colors active:scale-95 shadow-sm">
                <Map size={28} className="mb-2 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">{t.map}</span>
              </a>
            </div>

            <button onClick={() => updateDoc(doc(db, "orders", activeOrder.id), { status: "completed" })} className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-black text-white py-6 rounded-3xl font-black text-xl tracking-widest uppercase shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_0_40px_rgba(234,88,12,0.3)] active:scale-95 transition-all mt-4">
              <div className="flex items-center justify-center gap-3">
                <CheckCircle size={28} /> {t.finish}
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t.avail} ({availableOrders.length})</h3>
          {availableOrders.map(o => (
            <div key={o.id} className={`bg-white dark:bg-slate-900 overflow-hidden rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl mb-6 ${!user?.riderStatus ? 'opacity-40 grayscale' : ''}`}>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                {getServiceBadge(o.serviceType)}
                <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full font-black text-xl tracking-tight">₹{o.price || 20}</span>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-green-100 dark:bg-green-500/20 p-2.5 rounded-full shrink-0"><MapPin size={24} className="text-green-600 dark:text-green-400" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pickup</p>
                    <p className="text-lg font-bold dark:text-white leading-tight">{o.pickup.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-red-100 dark:bg-red-500/20 p-2.5 rounded-full shrink-0"><MapPin size={24} className="text-red-600 dark:text-red-400" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Drop</p>
                    <p className="text-lg font-bold dark:text-white leading-tight">{o.drop.address}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
                <button disabled={isAccepting !== null} onClick={() => handleAcceptJob(o.id)} className={`w-full text-white py-5 rounded-2xl font-black text-lg shadow-lg uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isAccepting === o.id ? 'bg-orange-800 scale-95 shadow-none' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20 active:scale-95 disabled:opacity-50'}`}>
                  {isAccepting === o.id ? <><Loader2 size={24} className="animate-spin" /> {lang === 'hi' ? 'स्वीकार किया जा रहा है...' : 'CLAIMING...'}</> : t.accept}
                </button>
              </div>
            </div>
          ))}

          {reviews.length > 0 && (
            <div className="mt-12 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Star size={14} className="text-orange-400" /> {t.reviews} ({reviews.length})
              </h3>
              {reviews.map(r => (
                <div key={r.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <MessageSquare size={80} className="text-orange-500" />
                  </div>
                  <div className="flex justify-between items-center mb-3 relative z-10">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} size={14} className={star <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200 dark:text-slate-800'} />
                      ))}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{new Date(r.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                  </div>
                  {r.review && <p className="text-sm font-bold dark:text-gray-300 italic mb-3 relative z-10">"{r.review}"</p>}
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 relative z-10">— {r.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )
      }
    </main >
  );
}