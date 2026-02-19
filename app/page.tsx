"use client";
import React, { useState, useEffect } from 'react';
import { LogIn, User, Bike, Utensils, ShoppingBasket, ChevronRight, Loader2 } from 'lucide-react';
import Image from 'next/image';

// Firebase Imports
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <p>Loading Map...</p>
});

export default function Home() {
  // --- STATE ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  // Onboarding Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const services = [
    { id: 'ride', title: 'Ride', price: '₹20', icon: <Bike className="w-5 h-5" />, color: "bg-blue-100 text-blue-600" },
    { id: 'food', title: 'Food', price: '₹30', icon: <Utensils className="w-5 h-5" />, color: "bg-orange-100 text-orange-600" },
    { id: 'grocery', title: 'Groceries', price: '₹25', icon: <ShoppingBasket className="w-5 h-5" />, color: "bg-green-100 text-green-600" },
  ];
  // Inside Home component in app/page.tsx

  const [showMap, setShowMap] = useState(false);

  const handleBookingRequest = () => {
    if (!user) {
      handleAuthAction(); // Prompt login if not logged in
    } else {
      setShowMap(true);
    }
  };



// 2. Update the function inside Home component
const handleOrderSubmission = async (pickup: L.LatLng, drop: L.LatLng, pAddr: string, dAddr: string) => {
  if (!user || !profile) {
    alert("User profile not found. Please log in again.");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "orders"), {
      userId: user.uid,
      userName: profile.name || user.displayName,
      userPhone: profile.phone, // FETCHED FROM PROFILE STATE
      serviceType: "ride",
      status: "pending",
      pickup: {
        lat: pickup.lat,
        lng: pickup.lng,
        address: pAddr
      },
      drop: {
        lat: drop.lat,
        lng: drop.lng,
        address: dAddr
      },
      createdAt: serverTimestamp(),
    });

    console.log("Order placed:", docRef.id);
    setShowMap(false);
    alert("Kothrito Order Placed!");
    
  } catch (error) {
    console.error("Error:", error);
  }
};

  // ... In your return JSX, update the 'Book Now' button:
  <button 
  onClick={handleBookingRequest} // <--- Make sure this is here
  className="bg-white text-orange-600 px-5 py-2.5 rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all"
  >
    Book Now
  </button>

  
  // --- AUTH LOGIC ---
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (u) => {
    if (u) {
      setUser(u);
      // Fetch user data from Firestore
      const userDoc = await getDoc(doc(db, "users", u.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfile(userData); // Save profile data (including phone)
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
  return () => unsubscribe();
}, []);

useEffect(() => {
  if (showLogout) {
    const timer = setTimeout(() => setShowLogout(false), 5000); // Auto-hide after 5 seconds
    return () => clearTimeout(timer);
  }
}, [showLogout]);

const handleLogout = async () => {
  try {
    await auth.signOut();
    
    // Clear all site data
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear cookies (best effort)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Hard reload to clear React state and browser memory
    window.location.href = "/"; 
  } catch (error) {
    console.error("Logout failed", error);
  }
};

  const handleAuthAction = async () => {
  if (!user) {
    try {
      await signInWithPopup(auth, googleProvider);
      // Logic will automatically flow to useEffect and check profile
    } catch (error) {
      console.error("Login Error:", error);
    }
  } else {
    // If user clicks login button while already logged in, 
    // maybe they want to book? Let's open the map.
    setShowMap(true);
  }
};
  const saveProfile = async () => {
    if (!user || !phone || phone.length < 10) {
      alert("Please enter a valid phone number");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        phone: phone,
        email: user.email,
        uid: user.uid,
        updatedAt: new Date(),
      });
      setShowOnboarding(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // --- LOADING SCREEN ---
  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="mt-4 text-sm font-bold text-slate-400 tracking-widest uppercase">Kothrito</p>
      </div>
    );
  }

  

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-white overflow-hidden p-0 m-0 relative">

      {/* 1. HEADER (Fixed 10%) */}
<header className="flex items-center justify-between px-6 h-[10%] shrink-0">
  <div className="flex items-center h-full py-3">
    <div 
      onClick={() => window.location.reload()} 
      className="relative h-8 w-32 cursor-pointer active:scale-95 transition-transform"
    >
      <Image src="/logo.png" alt="Kothrito" fill sizes="128px" className="object-contain object-left" />
    </div>
  </div>

  <div className="flex items-center gap-2">
    {user ? (
      <div className="flex items-center gap-2">
        {/* LOGOUT BUTTON (Shown only when toggled) */}
        {showLogout && (
          <button 
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black animate-in fade-in zoom-in duration-200 shadow-lg shadow-red-200"
          >
            LOGOUT?
          </button>
        )}
        
        {/* NAME/AVATAR BUTTON */}
        <button 
          onClick={() => setShowLogout(!showLogout)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full active:scale-95 transition-all border ${showLogout ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${showLogout ? 'bg-white text-slate-800' : 'bg-orange-500 text-white'}`}>
            {user.displayName?.[0]}
          </div>
          <span className="text-xs font-bold">{user.displayName?.split(' ')[0]}</span>
        </button>
      </div>
    ) : (
      /* LOGIN BUTTON */
      <button 
        onClick={handleAuthAction}
        className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full active:scale-95 transition-all border border-slate-100 text-slate-700"
      >
        <LogIn size={14} /> <span className="text-xs font-bold">Login</span>
      </button>
    )}
  </div>
</header>

      {/* 2. HERO SECTION */}
      <section className="h-[45%] mx-4 rounded-[2.5rem] bg-gradient-to-br from-[#f3934e] to-[#f8b55d] p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl shadow-orange-200">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-2">
            Fast.<br />Local.<br />Reliable.
          </h1>
          <p className="text-orange-50 text-sm font-medium opacity-90 leading-relaxed mb-6">
            Get anything in Kothri,<br /> delivered in minutes.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleAuthAction}
              className="bg-white text-orange-600 px-5 py-2.5 rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all"
            >
              Book Now
            </button>
            <button className="bg-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all border border-white/20">
              Details
            </button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      </section>

      {/* 3. SERVICES SECTION */}
      <section className="h-[45%] px-6 flex flex-col justify-center gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Services</h3>
          <div className="h-[1px] flex-1 bg-slate-100 ml-4"></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {services.map((service) => (
            <div
              key={service.id}
              onClick={handleAuthAction}
              className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col items-center justify-center text-center gap-2 active:bg-orange-50 active:border-orange-200 transition-colors cursor-pointer"
            >
              <div className={`${service.color} p-3 rounded-2xl shadow-sm`}>
                {service.icon}
              </div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-none">{service.title}</h4>
                <span className="text-[9px] font-bold text-slate-400">{service.price}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 bg-slate-900 rounded-2xl p-4 flex items-center justify-between text-white active:scale-[0.98] transition-transform cursor-pointer">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Quick Link</span>
            <span className="text-xs font-bold">Track Active Order</span>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <ChevronRight size={16} />
          </div>
        </div>
      </section>

      {/* ONBOARDING MODAL OVERLAY */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Welcome to Kothrito!</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Just one more step to start booking.</p>

            <div className="space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 mb-1 block tracking-widest">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:ring-2 ring-orange-100 outline-none transition-all"
                  placeholder="Your Name"
                />
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 mb-1 block tracking-widest">WhatsApp Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:ring-2 ring-orange-100 outline-none transition-all"
                  placeholder="10-digit mobile number"
                  type="tel"
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={isSaving}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-orange-100 mt-4 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : "Complete Setup"}
              </button>
            </div>
          </div>
        </div>
      )}
      {
        showMap && (
          <MapPicker
            onClose={() => setShowMap(false)}
            onConfirm={handleOrderSubmission}
          />
        )
      }
    </main>
  );
}