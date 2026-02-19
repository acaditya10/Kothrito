"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Phone, Check, X, Bike, Power } from 'lucide-react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(true);

  // 1. Security Check
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u && u.email === "acadityachandra@gmail.com") { // YOUR EMAIL
        setIsAdmin(true);
      } else {
        window.location.href = "/"; // Boot them out
      }
    });
    return () => unsub();
  }, []);

  // 2. Load Orders & Settings
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "orders"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (d) => {
       setServiceStatus(d.data()?.isServiceActive);
    });

    return () => { unsubOrders(); unsubSettings(); };
  }, [isAdmin]);

  const toggleService = async () => {
    await updateDoc(doc(db, "settings", "global"), { isServiceActive: !serviceStatus });
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-6 pb-24 font-sans max-w-md mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black italic">kothrito <span className="text-xs bg-black text-white px-2 py-1 rounded not-italic ml-2 uppercase">Admin</span></h1>
        
        {/* KILL SWITCH */}
        <button 
          onClick={toggleService}
          className={`p-3 rounded-2xl flex items-center gap-2 font-bold transition-all ${serviceStatus ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          <Power size={20} />
          {serviceStatus ? "ON" : "OFF"}
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Orders ({orders.length})</h2>
        
        {orders.length === 0 && <div className="text-center py-20 text-slate-400 font-bold">No pending orders. Chill out! 🥤</div>}

        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 animate-in fade-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-lg">{order.userName}</h3>
                <p className="text-xs font-bold text-slate-400 tracking-tighter uppercase">{order.serviceType}</p>
              </div>
              <a href={`tel:${order.userPhone}`} className="bg-orange-100 text-orange-600 p-3 rounded-2xl active:scale-90 transition-transform">
                <Phone size={20} />
              </a>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
                <div className="w-1 h-12 bg-slate-100 rounded-full flex flex-col justify-between items-center py-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
                <div className="text-xs font-bold flex flex-col justify-between">
                  <p className="text-slate-400 uppercase tracking-tighter">Pickup</p>
                  <p className="text-slate-800">{order.pickup.address}</p>
                  <p className="text-slate-400 uppercase tracking-tighter mt-1">Drop</p>
                  <p className="text-slate-800">{order.drop.address}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => updateStatus(order.id, 'accepted')}
                className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Check size={16} /> Accept
              </button>
              <button 
                onClick={() => updateStatus(order.id, 'cancelled')}
                className="bg-slate-100 text-slate-400 py-3 px-4 rounded-xl font-bold text-sm"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}