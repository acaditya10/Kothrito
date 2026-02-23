"use client";
import React, { useState, useEffect } from 'react';
import { LogIn, User, Bike, Utensils, ShoppingBasket, ChevronRight, Loader2, Phone, X, Sun, Moon, Star, Check } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useHaptics } from '@/hooks/useHaptics';
import useSound from 'use-sound';
import { successChimeSound, errorBeepSound } from '@/lib/sounds';
import Branding from '@/components/Branding';

// Firebase Imports
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, onSnapshot, query, where, updateDoc } from 'firebase/firestore';

// Dynamically import Map (Leaflet is client-side only)
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center font-bold">Loading Satellite Map...</div>
});

export default function Home() {
  // --- STATES ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [baseFare, setBaseFare] = useState(20);
  const [sysSettings, setSysSettings] = useState<any>({});

  const [showMap, setShowMap] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const { hapticLight, hapticMedium, hapticSuccess, hapticError } = useHaptics();
  const [playSuccess] = useSound(successChimeSound, { volume: 0.5 });
  const [playError] = useSound(errorBeepSound, { volume: 0.5 });

  // --- 1. AUTH & GLOBAL SETTINGS LISTENER ---
  useEffect(() => {
    const isDark = localStorage.getItem('kothrito-theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
          setShowOnboarding(false);
        } else {
          setProfile(null);
        }
      } else {
        try { await signInAnonymously(auth); } catch (e) { console.error("Anon Login Failed", e); }
      }
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsServiceActive(data.isServiceActive ?? true);
        setBaseFare(data.baseFare || 20);
        setSysSettings(data);
      }
    });

    return () => { unsubAuth(); unsubSettings(); };
  }, []);

  // --- 2. ACTIVE ORDER LISTENER (Student's Current Ride) ---
  useEffect(() => {
    if (!user) {
      setActiveOrder(null);
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      where("status", "in", ["pending", "accepted", "completed"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      const active = docs.find((d: any) => d.status === "pending" || d.status === "accepted" || (d.status === "completed" && !d.rated));
      setActiveOrder(active || null);
    });

    return () => unsub();
  }, [user]);

  // --- HANDLERS ---
  const handleAuthAction = () => {
    if (!profile) setShowOnboarding(true);
    else setShowLogout(!showLogout);
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('kothrito-theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('kothrito-theme', 'light'); }
  };

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const saveProfile = async () => {
    // Basic validation: strip all non-digits
    const digits = phone.replace(/\D/g, '');
    let finalPhone = phone;
    if (digits.length === 10) {
      finalPhone = '+91' + digits;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      finalPhone = '+' + digits;
    } else {
      return alert("Please enter a valid 10-digit mobile number.");
    }

    if (!user || finalPhone.length < 13) return alert("Enter a valid phone number");
    setIsSaving(true);
    const data = { name, phone: finalPhone, uid: user.uid, updatedAt: new Date() };
    await setDoc(doc(db, "users", user.uid), data);
    setProfile(data);
    setShowOnboarding(false);
    setIsSaving(false);

    if (pendingOrder) {
      handleOrderSubmission(pendingOrder.pickup, pendingOrder.drop, pendingOrder.pAddr, pendingOrder.dAddr, pendingOrder.exactPrice, data.name, data.phone);
      setPendingOrder(null);
    }
    setIsSaving(false);
  };

  const submitRating = async () => {
    if (!activeOrder) return;
    try {
      await updateDoc(doc(db, "orders", activeOrder.id), {
        rating: ratingVal,
        review: reviewText,
        rated: true
      });
      setRatingVal(5);
      setReviewText("");
    } catch { }
  };

  const handleOrderSubmission = async (pickup: any, drop: any, pAddr: string, dAddr: string, exactPrice: number, overrideName?: string, overridePhone?: string) => {
    if (!user || !selectedService) return;

    if (!profile && !overrideName) {
      setPendingOrder({ pickup, drop, pAddr, dAddr, exactPrice });
      setShowOnboarding(true);
      return;
    }

    hapticMedium();

    try {
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userName: overrideName || profile.name,
        userPhone: overridePhone || profile.phone,
        status: "pending",
        serviceType: selectedService.id,
        price: exactPrice,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pAddr },
        drop: { lat: drop.lat, lng: drop.lng, address: dAddr },
        createdAt: serverTimestamp(),
      });
      setShowMap(false);
      setSelectedService(null);
      hapticSuccess();
      playSuccess();
    } catch (e) {
      hapticError();
      playError();
      alert("Error placing order");
    }
  };

  // --- CONDITIONAL RENDERING ---
  const services = [
    { id: 'ride', title: 'Ride', icon: <Bike className="w-6 h-6" />, color: "bg-blue-100 text-blue-600" },
    { id: 'food', title: 'Food', icon: <Utensils className="w-6 h-6" />, color: "bg-orange-100 text-orange-600" },
    { id: 'grocery', title: 'Groceries', icon: <ShoppingBasket className="w-6 h-6" />, color: "bg-green-100 text-green-600" },
  ];

  if (loading) return <div className="h-[100dvh] w-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (!isServiceActive) return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-10 text-center bg-white border-x dark:border-slate-800">
      <Image src="/logo.png" alt="Logo" width={140} height={40} className="mb-12 object-contain" />
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 text-4xl">🌙</div>
      <h1 className="text-2xl font-black text-slate-800 mb-2">Service is Resting</h1>
      <p className="text-slate-500 font-medium leading-relaxed">We are currently closed for the night. <br /> See you in the morning!</p>
      <button onClick={() => window.location.reload()} className="mt-10 text-orange-600 font-black text-sm uppercase border-b-2 border-orange-600 pb-1 tracking-widest">Refresh Status</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <main className="flex flex-col h-[100dvh] md:h-[850px] md:rounded-[3rem] md:shadow-2xl w-full max-w-md mx-auto bg-white dark:bg-slate-950 overflow-hidden relative transition-colors duration-500 border border-transparent md:border-slate-200 dark:md:border-slate-800">

        {/* 1. HEADER */}
        <header className="flex items-center justify-between px-6 h-[10%] shrink-0">
          <Branding onClick={() => window.location.reload()} />

          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-orange-400">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user && showLogout && (
              <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black animate-in fade-in zoom-in duration-200 shadow-lg cursor-pointer z-50">LOGOUT?</button>
            )}
            <button onClick={handleAuthAction} className={`flex items-center gap-2 px-3 py-1.5 rounded-full active:scale-95 transition-all border ${showLogout ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
              {profile ? (
                <><div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${showLogout ? 'bg-white text-black' : 'bg-orange-500 text-white'}`}>{profile.name?.[0]}</div><span className="text-xs font-bold">{profile.name?.split(' ')[0]}</span></>
              ) : (
                <><User size={14} /><span className="text-xs font-bold">Profile</span></>
              )}
            </button>
          </div>
        </header>

        {/* 2. HERO SECTION & FLOATING CARDS */}
        <section className="shrink-0 h-[35%] mx-4 mt-2 rounded-[2.5rem] bg-gradient-to-br from-[#f3934e] to-[#f8b55d] pt-8 px-8 pb-10 flex flex-col justify-center relative shadow-xl shadow-orange-200/50 overflow-hidden">
          <div className="relative z-10 mb-2">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-2">Fast.<br />Local.<br />Reliable.</h1>
            <p className="text-orange-50 text-sm font-medium opacity-90 leading-relaxed">Explore Kothri.<br /> Order anything. Ride anywhere.</p>
          </div>
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl flex-shrink-0"></div>
        </section>

        <div className="px-6 mt-6 shrink-0 z-20 flex justify-between gap-3">
          {services.map((s) => (
            <div key={s.id} onClick={() => { hapticLight(); setSelectedService(s); setShowMap(true); }} className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-orange-100 dark:hover:border-slate-700 rounded-[1.5rem] py-5 flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition-all cursor-pointer shadow-sm">
              <div className={`${s.color} p-3 rounded-[1rem] shadow-sm mb-1`}>{s.icon}</div>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none mb-1">{s.title}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* 3. ACTIVE STATUS SECTION */}
        <section className="flex-1 px-6 flex flex-col justify-end pb-8 pt-16">

          {/* --- DYNAMIC STATUS BANNER --- */}
          {activeOrder ? (
            <div className={`p-5 rounded-3xl animate-in slide-in-from-bottom duration-500 border ${activeOrder.status === 'accepted' ? 'bg-orange-600 text-white border-orange-400 shadow-[0_0_20px_rgba(234,88,12,0.3)]' : 'bg-slate-900 text-white border-slate-800 shadow-xl'
              }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeOrder.status === 'accepted' ? 'bg-orange-300' : 'bg-orange-500'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${activeOrder.status === 'accepted' ? 'bg-orange-100' : 'bg-orange-500'}`}></span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">
                      {activeOrder.status === 'accepted' ? (activeOrder.serviceType === 'food' ? 'Food Arriving' : activeOrder.serviceType === 'grocery' ? 'Groceries Arriving' : 'Rider Assigned') : 'Order Received'}
                    </p>
                    <p className="text-sm font-bold">
                      {activeOrder.status === 'accepted' ? `${activeOrder.riderName} is coming` : 'Finding a rider nearby...'}
                    </p>
                  </div>
                </div>
                {activeOrder.status === 'accepted' ? (
                  <a href={`tel:${activeOrder.riderPhone}`} className="bg-white text-orange-600 p-3 rounded-2xl active:scale-90 transition-transform shadow-lg cursor-pointer">
                    <Phone size={18} />
                  </a>
                ) : (
                  <div className="bg-white/10 p-3 rounded-2xl">
                    <Loader2 size={18} className="animate-spin text-white/80" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div onClick={() => { if (!profile) handleAuthAction(); }} className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer border border-slate-100 dark:border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-200">Ready to Order</span>
              </div>
              <div className="bg-white dark:bg-slate-800 shadow-sm p-3 rounded-2xl"><ChevronRight size={18} className="text-slate-400" /></div>
            </div>
          )}
        </section>

        {/* MODALS & OVERLAYS */}
        {showOnboarding && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 pb-12 animate-in slide-in-from-bottom duration-500">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Welcome!</h2>
              <p className="text-slate-500 text-sm mb-8 font-medium">Please provide your details to continue.</p>
              <div className="space-y-6">
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="Display Name" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="WhatsApp Number" type="tel" />
                <button onClick={saveProfile} disabled={isSaving} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center">{isSaving ? <Loader2 className="animate-spin" size={20} /> : "Complete Setup"}</button>
              </div>
            </div>
          </div>
        )}

        {showServicePicker && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[3rem] p-8 pb-12 animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white">What do you need?</h2>
                <button onClick={() => setShowServicePicker(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full dark:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                {services.map((s) => (
                  <div key={s.id} onClick={() => { setSelectedService(s); setShowServicePicker(false); setShowMap(true); }} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform cursor-pointer">
                    <div className={`${s.color} p-4 rounded-2xl shadow-sm`}>{s.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-black text-lg text-slate-800 dark:text-white">{s.title}</h4>
                      <span className="text-xs font-bold text-slate-400">{s.id === 'ride' ? 'A quick ride anywhere.' : s.id === 'food' ? 'Your favorite meals.' : 'Daily essentials & more.'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showMap && (
          <MapPicker
            onClose={() => setShowMap(false)}
            onConfirm={handleOrderSubmission}
            baseFare={selectedService?.id === 'food' ? baseFare + 10 : selectedService?.id === 'grocery' ? baseFare + 5 : baseFare}
            perKmRate={sysSettings.perKmRate || 10}
            surgeMultiplier={sysSettings.surgeMultiplier || 1.0}
          />
        )}

        {activeOrder?.status === 'completed' && !activeOrder?.rated && (
          <div className="fixed inset-0 z-[200] bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 text-center leading-tight">Order Complete!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 text-center">How was your experience with {activeOrder.riderName || 'your rider'}?</p>

            <div className="flex gap-2 mb-8">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  size={40}
                  onClick={() => setRatingVal(star)}
                  className={`cursor-pointer transition-all active:scale-90 ${star <= ratingVal ? 'fill-orange-400 text-orange-400 stroke-[1.5]' : 'text-slate-200 dark:text-slate-800 stroke-[1.5]'}`}
                />
              ))}
            </div>

            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Add a note or say thanks..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 text-sm font-bold outline-none mb-6 resize-none h-32 dark:text-white focus:ring-2 focus:ring-orange-500/50"
            />

            <button onClick={submitRating} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-orange-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest mb-4">
              Submit Feedback
            </button>
            <button onClick={submitRating} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
              Skip
            </button>
          </div>
        )}
      </main>
    </div>
  );
}