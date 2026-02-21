"use client";
import React, { useState, useEffect } from 'react';
import { MapPin, Search, Star, History, Crosshair, ChevronLeft, X, Loader2 } from 'lucide-react';

// Firebase
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

interface Location {
    lat: number;
    lng: number;
    address: string;
}

interface Place {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

interface LocationSelectProps {
    userId: string;
    onClose: () => void;
    onConfirm: (pickup: Location, drop: Location) => void;
    onOpenMap: (isPickup: boolean) => void;
    initialPickup?: Location | null;
    initialDrop?: Location | null;
}

export default function LocationSelect({ userId, onClose, onConfirm, onOpenMap, initialPickup, initialDrop }: LocationSelectProps) {
    const [pickup, setPickup] = useState<Location | null>(initialPickup || null);
    const [drop, setDrop] = useState<Location | null>(initialDrop || null);
    const [activeInput, setActiveInput] = useState<'pickup' | 'drop' | null>(null);

    const [popularPlaces, setPopularPlaces] = useState<Place[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [loadingPlaces, setLoadingPlaces] = useState(false);

    useEffect(() => {
        fetchPlaces();
    }, [userId]);

    const fetchPlaces = async () => {
        setLoadingPlaces(true);
        try {
            // Fetch Admin Popular Places
            const popSnap = await getDocs(collection(db, "places"));
            const popData = popSnap.docs.map(d => ({ id: d.id, ...d.data() } as Place));
            setPopularPlaces(popData);

            // Fetch User Saved Places
            const savedSnap = await getDocs(collection(db, `users/${userId}/savedLocations`));
            const savedData = savedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Place));
            setSavedPlaces(savedData);
        } catch (e) {
            console.error("Error fetching places", e);
        } finally {
            setLoadingPlaces(false);
        }
    };

    const selectPlace = (place: Place) => {
        const loc: Location = { lat: place.lat, lng: place.lng, address: place.name };
        if (activeInput === 'pickup') {
            setPickup(loc);
            if (!drop) setActiveInput('drop');
            else setActiveInput(null);
        } else {
            setDrop(loc);
            setActiveInput(null);
        }
    };

    const handleConfirm = () => {
        if (pickup && drop) {
            onConfirm(pickup, drop);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-slate-50 dark:bg-slate-950 flex flex-col font-sans animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-4 shrink-0 flex items-center justify-center relative shadow-sm">
                <button onClick={onClose} className="absolute left-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white">
                    <ChevronLeft size={20} />
                </button>
                <span className="font-black text-lg text-slate-800 dark:text-white">Where to?</span>
            </div>

            {/* Input Group */}
            <div className="bg-white dark:bg-slate-900 px-6 py-6 pb-8 border-b border-slate-100 dark:border-slate-800 shrink-0 relative z-20 shadow-md">
                <div className="relative pl-8 flex flex-col gap-4">
                    {/* Vertical tracking line */}
                    <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>

                    {/* Pickup Input */}
                    <div className="relative group">
                        <div className={`absolute -left-[1.35rem] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[4px] ${activeInput === 'pickup' ? 'border-blue-500 bg-white' : 'border-slate-400 bg-white dark:bg-slate-900'} z-10 transition-colors`}></div>
                        <div
                            onClick={() => setActiveInput('pickup')}
                            className={`w-full p-4 rounded-2xl border-2 flex items-center transition-all cursor-text ${activeInput === 'pickup' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                        >
                            <span className={`font-bold flex-1 truncate ${pickup ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                {pickup ? pickup.address : "Enter pickup location"}
                            </span>
                            {pickup && <button onClick={(e) => { e.stopPropagation(); setPickup(null); setActiveInput('pickup'); }} className="text-slate-400 p-1"><X size={16} /></button>}
                        </div>
                    </div>

                    {/* Drop Input */}
                    <div className="relative group">
                        <div className={`absolute -left-[1.35rem] top-1/2 -translate-y-1/2 w-4 h-4 rounded-none border-[4px] ${activeInput === 'drop' ? 'border-orange-500 bg-white' : 'border-slate-400 bg-white dark:bg-slate-900'} z-10 transition-colors`}></div>
                        <div
                            onClick={() => setActiveInput('drop')}
                            className={`w-full p-4 rounded-2xl border-2 flex items-center transition-all cursor-text ${activeInput === 'drop' ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                        >
                            <span className={`font-bold flex-1 truncate ${drop ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                {drop ? drop.address : "Where are you going?"}
                            </span>
                            {drop && <button onClick={(e) => { e.stopPropagation(); setDrop(null); setActiveInput('drop'); }} className="text-slate-400 p-1"><X size={16} /></button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto w-full relative z-10">

                {/* State 1: Both Selected */}
                {pickup && drop && activeInput === null ? (
                    <div className="p-6 flex justify-center text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-full">
                            <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-6">
                                <MapPin size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Locations Set!</h3>
                            <p className="text-sm font-bold text-slate-500 mb-8">Ready to review your route and get the price.</p>

                            <button
                                onClick={handleConfirm}
                                className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-transform"
                            >
                                Continue to Map
                            </button>
                        </div>
                    </div>
                ) : (
                    /* State 2: Picking a location */
                    <div className="animate-in fade-in duration-300">

                        {/* Map Fallback Option */}
                        <div
                            onClick={() => activeInput && onOpenMap(activeInput === 'pickup')}
                            className="px-6 py-5 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                        >
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-800 dark:text-white">
                                <MapPin size={20} />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-[15px]">Choose on Map</span>
                        </div>

                        {loadingPlaces ? (
                            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                        ) : (
                            <>
                                {/* Saved Places */}
                                {savedPlaces.length > 0 && (
                                    <div className="mt-4">
                                        <span className="px-6 text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">Saved Places</span>
                                        {savedPlaces.map(p => (
                                            <div key={p.id} onClick={() => selectPlace(p)} className="px-6 py-4 flex items-center gap-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 overflow-hidden">
                                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 rounded-full shrink-0">
                                                    <Star size={18} className="fill-yellow-500" />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{p.name}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Popular Places */}
                                {popularPlaces.length > 0 && (
                                    <div className="mt-4 pb-10">
                                        <span className="px-6 text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">Popular on Campus</span>
                                        {popularPlaces.map(p => (
                                            <div key={p.id} onClick={() => selectPlace(p)} className="px-6 py-4 flex items-center gap-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800">
                                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full shrink-0">
                                                    <History size={18} />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{p.name}</span>
                                                    <span className="text-xs font-bold text-slate-400">Campus Hotspot</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
