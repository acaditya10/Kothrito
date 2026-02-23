"use client";
import React, { useState, useEffect } from 'react';
import { ChefHat, Loader2, Utensils, ReceiptText, Check, PackageOpen, LayoutGrid, Store, Power } from 'lucide-react';
import Branding from '@/components/Branding';

// Firebase Imports
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, getDocs } from 'firebase/firestore';

interface Restaurant {
    id: string;
    name: string;
    phone: string;
    paymentDetails: string;
    lat: number;
    lng: number;
    isOnline: boolean;
}

export default function RestaurantApp() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);

    // 1. Fetch available restaurants for initial "login" pseudo-auth
    useEffect(() => {
        const fetchR = async () => {
            const snap = await getDocs(collection(db, "restaurants"));
            setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)));
            setLoading(false);
        };
        fetchR();
    }, []);

    // 2. Fetch Active Orders for the selected restaurant
    useEffect(() => {
        if (!selectedRest) return;
        const q = query(collection(db, "orders"), where("restaurantId", "==", selectedRest.id), where("status", "in", ["pending_payment", "cooking"]));
        const unsub = onSnapshot(q, (snap) => {
            const o = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setOrders(o);

            // Keep restaurant metadata updated in real-time (especially isOnline)
            onSnapshot(doc(db, "restaurants", selectedRest.id), (rSnap) => {
                if (rSnap.exists()) setSelectedRest({ id: rSnap.id, ...rSnap.data() } as Restaurant);
            });
        });
        return () => unsub();
    }, [selectedRest]);

    const toggleStatus = async () => {
        if (!selectedRest) return;
        await updateDoc(doc(db, "restaurants", selectedRest.id), { isOnline: !selectedRest.isOnline });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-orange-500" /></div>;

    // ------------------------------------
    // SCREEN 1: "Auth" / Select Restaurant
    // ------------------------------------
    if (!selectedRest) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
                <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl text-center border dark:border-slate-800">
                    <div className="w-20 h-20 bg-orange-100 dark:bg-orange-500/20 text-orange-600 mx-auto rounded-full flex items-center justify-center mb-6">
                        <ChefHat size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Kothri<span className="text-orange-500">Eats</span></h1>
                    <p className="text-sm font-bold text-slate-500 mb-8">Select your kitchen to manage incoming orders.</p>

                    <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
                        {restaurants.map(r => (
                            <button key={r.id} onClick={() => setSelectedRest(r)} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 text-left active:scale-95 transition-transform border dark:border-slate-700">
                                <Store className="text-slate-400 shrink-0" />
                                <div className="flex-1 truncate">
                                    <h3 className="font-black text-slate-800 dark:text-white truncate">{r.name}</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{r.phone}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ------------------------------------
    // SCREEN 2: Kitchen Dashboard
    // ------------------------------------
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-24">
            {/* HEADER */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <div>
                    <h2 className="font-black text-xl text-slate-800 dark:text-white">{selectedRest.name}</h2>
                    <button onClick={() => setSelectedRest(null)} className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Switch Kitchen</button>
                </div>
                <button onClick={toggleStatus} className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${selectedRest.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    <Power size={14} /> {selectedRest.isOnline ? 'Online' : 'Offline'}
                </button>
            </div>

            <div className="p-6 max-w-lg mx-auto">
                {/* STATS */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">Unpaid</p>
                        <div className="flex justify-between items-end">
                            <span className="text-4xl font-black text-slate-800 dark:text-white">{orders.filter(o => o.status === 'pending_payment').length}</span>
                            <ReceiptText className="text-yellow-500 mb-1" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">Cooking</p>
                        <div className="flex justify-between items-end">
                            <span className="text-4xl font-black text-slate-800 dark:text-white">{orders.filter(o => o.status === 'cooking').length}</span>
                            <Utensils className="text-orange-500 mb-1" />
                        </div>
                    </div>
                </div>

                {/* ORDERS PIPELINE */}
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <LayoutGrid size={16} className="text-orange-500" /> Active Tickets
                </h3>

                {orders.length === 0 ? (
                    <div className="bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center text-slate-400">
                        <PackageOpen size={48} className="mb-4 opacity-50" />
                        <p className="font-black text-lg text-slate-600 dark:text-slate-300">Kitchen is Empty</p>
                        <p className="text-sm font-bold">Waiting for students to place orders.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map(o => (
                            <div key={o.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-start border-b dark:border-slate-800 pb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Customer</p>
                                        <p className="font-black text-lg dark:text-white leading-none">{o.userName}</p>
                                        <a href={`tel:${o.userPhone}`} className="text-xs font-bold text-blue-500 mt-1 block">📞 {o.userPhone}</a>
                                    </div>
                                    <span className="text-xl font-black text-slate-800 dark:text-white">₹{o.price}</span>
                                </div>

                                <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-2">Order Specifics</p>
                                    <p className="font-bold text-orange-900 dark:text-orange-100 whitespace-pre-wrap">{o.orderDetails}</p>
                                </div>

                                {o.status === 'pending_payment' && (
                                    <button onClick={() => updateDoc(doc(db, "orders", o.id), { status: 'cooking' })} className="w-full bg-yellow-500 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-yellow-500/20">
                                        <ReceiptText size={16} /> Student Paid via UPI
                                    </button>
                                )}

                                {o.status === 'cooking' && (
                                    <button onClick={() => updateDoc(doc(db, "orders", o.id), { status: 'pending_rider' })} className="w-full bg-green-500 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-500/20">
                                        <Check size={16} /> Food Ready - Call Driver
                                    </button>
                                )}

                                <button onClick={async () => {
                                    if (confirm('Cancel this active order?')) {
                                        await updateDoc(doc(db, "orders", o.id), { status: 'cancelled' });
                                    }
                                }} className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center mt-2 underline decoration-2 underline-offset-4">
                                    Reject Ticket
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
