"use client";
import React, { useState, useEffect } from 'react';
import { LogIn, User, Bike, Utensils, ShoppingBasket, ChevronRight, Loader2, Phone, X, Sun, Moon } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Branding from '@/components/Branding';

// Firebase Imports
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';

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

  const [showMap, setShowMap] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const services = [
    { id: 'ride', title: 'Ride', price: '₹20', icon: <Bike className="w-5 h-5" />, color: "bg-blue-100 text-blue-600" },
    { id: 'food', title: 'Food', price: '₹30', icon: <Utensils className="w-5 h-5" />, color: "bg-orange-100 text-orange-600" },
    { id: 'grocery', title: 'Groceries', price: '₹25', icon: <ShoppingBasket className="w-5 h-5" />, color: "bg-green-100 text-green-600" },
  ];

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
          setName(u.displayName || "");
          setShowOnboarding(true);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setIsServiceActive(docSnap.data().isServiceActive);
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
      where("status", "in", ["pending", "accepted"])
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveOrder(null);
      }
    });

    return () => unsub();
  }, [user]);

  // --- HANDLERS ---
  const handleAuthAction = async () => {
    if (!user) {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) { console.error(error); }
    } else {
      setShowLogout(!showLogout);
    }
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
    if (!user || phone.length < 10) return alert("Enter a valid phone number");
    setIsSaving(true);
    const data = { name, phone, email: user.email, uid: user.uid, updatedAt: new Date() };
    await setDoc(doc(db, "users", user.uid), data);
    setProfile(data);
    setShowOnboarding(false);
    setIsSaving(false);
  };

  const handleOrderSubmission = async (pickup: any, drop: any, pAddr: string, dAddr: string) => {
    if (!user || !profile || !selectedService) return;
    try {
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userName: profile.name,
        userPhone: profile.phone,
        status: "pending",
        serviceType: selectedService.id,
        price: parseInt(selectedService.price.replace('₹', '')),
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pAddr },
        drop: { lat: drop.lat, lng: drop.lng, address: dAddr },
        createdAt: serverTimestamp(),
      });
      setShowMap(false);
      setSelectedService(null);
    } catch (e) { alert("Error placing order"); }
  };

  // --- CONDITIONAL RENDERING ---
  if (loading) return <div className="h-[100dvh] w-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (!isServiceActive) return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-10 text-center bg-white">
      <Image src="/logo.png" alt="Logo" width={140} height={40} className="mb-12 object-contain" />
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 text-4xl">🌙</div>
      <h1 className="text-2xl font-black text-slate-800 mb-2">Service is Resting</h1>
      <p className="text-slate-500 font-medium leading-relaxed">We are currently closed for the night. <br /> See you in the morning!</p>
      <button onClick={() => window.location.reload()} className="mt-10 text-orange-600 font-black text-sm uppercase border-b-2 border-orange-600 pb-1 tracking-widest">Refresh Status</button>
    </div>
  );

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-white dark:bg-slate-950 overflow-hidden relative transition-colors duration-500">

      {/* 1. HEADER */}
      <header className="flex items-center justify-between px-6 h-[10%] shrink-0">
        <Branding onClick={() => window.location.reload()} />

        <div className="flex items-center gap-2">
          <button onClick={toggleDarkMode} className="p-2 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-orange-400">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user && showLogout && (
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black animate-in fade-in zoom-in duration-200 shadow-lg">LOGOUT?</button>
          )}
          <button onClick={handleAuthAction} className={`flex items-center gap-2 px-3 py-1.5 rounded-full active:scale-95 transition-all border ${showLogout ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
            {user ? (
              <><div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${showLogout ? 'bg-white text-black' : 'bg-orange-500 text-white'}`}>{user.displayName?.[0]}</div><span className="text-xs font-bold">{user.displayName?.split(' ')[0]}</span></>
            ) : (
              <><LogIn size={14} /><span className="text-xs font-bold">Login</span></>
            )}
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="h-[45%] mx-4 rounded-[2.5rem] bg-gradient-to-br from-[#f3934e] to-[#f8b55d] p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl shadow-orange-200">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-2">Fast.<br />Local.<br />Reliable.</h1>
          <p className="text-orange-50 text-sm font-medium opacity-90 leading-relaxed mb-6">Get anything on campus,<br /> delivered in minutes.</p>
          <div className="flex gap-2">
            <button onClick={() => { if (user) { setSelectedService(services[0]); setShowMap(true); } else handleAuthAction(); }} className="bg-white text-orange-600 px-5 py-2.5 rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all">Book Now</button>
            <button className="bg-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-white/20">Details</button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      </section>

      {/* 3. SERVICES & ACTIVE STATUS SECTION */}
      <section className="h-[45%] px-6 flex flex-col justify-center gap-4">

        {/* --- DYNAMIC STATUS BANNER --- */}
        {activeOrder && (
          <div className={`p-4 rounded-2xl animate-in slide-in-from-top duration-500 border ${activeOrder.status === 'accepted' ? 'bg-orange-600 text-white border-orange-400 shadow-xl' : 'bg-slate-50 text-slate-500 border-slate-100'
            }`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">
                  {activeOrder.status === 'accepted' ? 'Rider Assigned' : 'Order Received'}
                </p>
                <p className="text-xs font-bold">
                  {activeOrder.status === 'accepted' ? `${activeOrder.riderName} is coming` : 'Finding a rider nearby...'}
                </p>
              </div>
              {activeOrder.status === 'accepted' && (
                <a href={`tel:${activeOrder.riderPhone}`} className="bg-white text-orange-600 p-2 rounded-xl active:scale-90 transition-transform">
                  <Phone size={16} />
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Services</h3><div className="h-[1px] flex-1 bg-slate-100 ml-4"></div></div>

        <div className="grid grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s.id} onClick={() => { if (user) { setSelectedService(s); setShowMap(true); } else handleAuthAction(); }} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center text-center gap-2 active:bg-orange-50 dark:active:bg-slate-800 transition-colors cursor-pointer">
              <div className={`${s.color} p-3 rounded-2xl shadow-sm`}>{s.icon}</div>
              <div><h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-none">{s.title}</h4><span className="text-[9px] font-bold text-slate-400">{s.price}</span></div>
            </div>
          ))}
        </div>

        <div className="mt-2 bg-slate-900 rounded-2xl p-4 flex items-center justify-between text-white active:scale-[0.98] transition-transform cursor-pointer">
          <div className="flex flex-col"><span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Order Update</span><span className="text-xs font-bold">{activeOrder ? "Order in Progress" : "No Active Orders"}</span></div>
          <div className="bg-white/10 p-2 rounded-lg"><ChevronRight size={16} /></div>
        </div>
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

      {showMap && <MapPicker onClose={() => setShowMap(false)} onConfirm={handleOrderSubmission} />}
    </main>
  );
}