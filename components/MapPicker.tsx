"use client";
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, ArrowRight, CheckCircle2, X, History, LocateFixed } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { Loader2 } from 'lucide-react'; // Need Loader

interface MapPickerProps {
  onConfirm: (pickup: L.LatLng, drop: L.LatLng, pAddr: string, dAddr: string, exactPrice: number) => void;
  onClose: () => void;
  baseFare: number;
  perKmRate: number;
  surgeMultiplier: number;
  isDeliveryOnly?: boolean;
}

export default function MapPicker({ onConfirm, onClose, baseFare, perKmRate, surgeMultiplier, isDeliveryOnly = false }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [step, setStep] = useState(1); // 1: Pickup, 2: Drop, 3: Address Details
  const [pickup, setPickup] = useState<L.LatLng | null>(null);
  const [drop, setDrop] = useState<L.LatLng | null>(null);
  const [pAddr, setPAddr] = useState("");
  const [dAddr, setDAddr] = useState("");
  const [focusedInput, setFocusedInput] = useState<'pickup' | 'drop' | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [quickLocations, setQuickLocations] = useState<string[]>([]);

  // Dynamic Pricing States
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [calculatedFare, setCalculatedFare] = useState<number>(baseFare);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(0);

  const center = [23.081306, 76.842861]; // VIT Bhopal Center

  useEffect(() => {
    // Load Recents
    const saved = localStorage.getItem('kothrito-recent-addresses');
    if (saved) {
      try { setRecentAddresses(JSON.parse(saved)); } catch (e) { }
    }

    // Load Quick Locations from Admin Settings
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'appSettings'));
        if (snap.exists() && snap.data().quickLocations) {
          setQuickLocations(snap.data().quickLocations);
        }
      } catch (err) {
        console.error("Failed to load quick locations:", err);
      }
    };
    loadSettings();

    if (!mapRef.current) {
      mapRef.current = L.map('map-container', {
        center: center as L.LatLngExpression,
        zoom: 17,
        zoomControl: false,
        attributionControl: false
      });

      // Google Satellite Hybrid Tiles
      L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
        maxZoom: 20,
      }).addTo(mapRef.current);

      // Lock bounds to 10km around campus
      const bounds = L.latLng(23.081306, 76.842861).toBounds(10000);
      mapRef.current.setMaxBounds(bounds);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const calculateRouteAndFare = async (p: L.LatLng, d: L.LatLng) => {
    setIsCalculatingRoute(true);

    // In campuses and rural areas, OSRM will incorrectly "snap" points to distant highways 
    // if internal roads aren't fully mapped, causing wildly inaccurate 5km+ distances.
    // Instead, we use the Earth's Haversine straight-line distance multiplied by a 1.3x 
    // "road curve factor" to generate a highly accurate, map-agnostic driving estimate.

    const straightLineMeters = p.distanceTo(d);
    let distKm = (straightLineMeters * 1.3) / 1000;

    // Set a minimum distance so very short 10m walks don't calculate to ₹0.
    if (distKm < 0.5) distKm = 0.5;

    setDistanceKm(distKm);

    // Exact Price Logic: Base + (Km * PerKmRate) * Surge
    const exactPrice = Math.round((baseFare + (distKm * perKmRate)) * surgeMultiplier);
    setCalculatedFare(exactPrice);

    // ETA: (Distance / 20 kmph approx campus driving limit) * 60 minutes
    setEtaMinutes(Math.max(2, Math.round((distKm / 20) * 60)));

    setIsCalculatingRoute(false);
  };

  const handleConfirmLocation = () => {
    if (!mapRef.current) return;
    const currentCenter = mapRef.current.getCenter();

    if (step === 2) {
      setPickup(currentCenter);
      setStep(3);
      // Add a visual marker for pickup point
      L.circleMarker(currentCenter, { color: '#22c55e', radius: 8, fillOpacity: 1 }).addTo(mapRef.current);
    } else if (step === 3) {
      setDrop(currentCenter);
      setStep(4);

      let routeStart = pickup;
      if (isDeliveryOnly && !pickup) {
        routeStart = L.latLng(center[0], center[1]);
        setPickup(routeStart);
      }
      if (routeStart) calculateRouteAndFare(routeStart, currentCenter);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 18, { animate: true, duration: 1 });
        setIsLocating(false);
      },
      () => {
        alert("Unable to access your location. Please check your browser settings.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="absolute top-0 inset-x-0 p-6 z-[1000] flex items-center justify-between pointer-events-none">
        <button onClick={onClose} className="p-3 bg-white rounded-full shadow-xl pointer-events-auto active:scale-90 transition-transform">
          <X size={20} />
        </button>
        <div className="bg-white px-4 py-2 rounded-full shadow-xl pointer-events-auto border border-orange-100 font-bold text-xs text-orange-600 uppercase tracking-widest">
          {step === 1 ? "Enter Details" : step === 2 ? "Set Pickup" : step === 3 ? "Set Drop" : "Confirm Fare"}
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* ALWAYS RENDER MAP (Leaflet crashes if #map-container unmounts abruptly) */}
      <div className="relative flex-1">
        <div id="map-container" className="w-full h-full relative z-0" />

        {/* MAP CONTROL OVERLAYS (Steps 2 & 3) */}
        {(step === 2 || step === 3) && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className="flex flex-col items-center mb-10"> {/* Offset for pin tip */}
                <div className="bg-black text-white text-[10px] px-2 py-1 rounded mb-1 font-bold animate-bounce">
                  {step === 2 ? "PICKUP HERE" : "DROP HERE"}
                </div>
                <MapPin size={40} className={step === 2 ? "text-green-500 fill-green-500/20" : "text-red-500 fill-red-500/20"} />
                <div className="w-1 h-1 bg-black rounded-full shadow-xl"></div>
              </div>
            </div>

            <div className="absolute bottom-28 right-6 z-[1000]">
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="bg-white p-4 rounded-full shadow-2xl active:scale-90 transition-transform text-slate-700 disabled:opacity-50 border border-slate-100"
              >
                {isLocating ? <Loader2 size={24} className="animate-spin text-orange-500" /> : <LocateFixed size={24} />}
              </button>
            </div>

            <div className="absolute bottom-10 inset-x-6 z-[1000]">
              <button
                onClick={handleConfirmLocation}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {step === 2 ? "Confirm Pickup Location" : "Confirm Drop Location"}
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* STEP 1: INITIAL ADDRESS FORM (OVERLAYS MAP) */}
      {step === 1 && (
        <div className="absolute inset-0 bg-slate-50 z-[500] p-8 pt-24 flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="flex-1 flex flex-col justify-start gap-6 max-w-md mx-auto w-full">
            <h2 className="text-3xl font-black text-slate-800">Trip Details</h2>
            <div className="space-y-6">
              {!isDeliveryOnly && (
                <div className="relative">
                  <label className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-2 block">Pickup Landmark</label>
                  <input
                    value={pAddr}
                    onFocus={() => setFocusedInput('pickup')}
                    onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                    onChange={(e) => setPAddr(e.target.value)}
                    placeholder="Ex: Hostel 1, Room 202 or Library Gate"
                    className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 ring-green-100 transition-all"
                  />
                  {focusedInput === 'pickup' && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl z-50 border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                      {quickLocations.map(loc => (
                        <div key={`p-${loc}`} onClick={() => { setPAddr(loc); setFocusedInput(null); }} className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 text-sm font-bold cursor-pointer active:bg-orange-50">{loc}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="relative">
                <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2 block">Drop Landmark</label>
                <input
                  value={dAddr}
                  onFocus={() => setFocusedInput('drop')}
                  onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                  onChange={(e) => setDAddr(e.target.value)}
                  placeholder="Ex: Near Nescafe or Academic Block"
                  className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 ring-red-100 transition-all"
                />
                {focusedInput === 'drop' && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl z-50 border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                    {quickLocations.map(loc => (
                      <div key={`d-${loc}`} onClick={() => { setDAddr(loc); setFocusedInput(null); }} className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 text-sm font-bold cursor-pointer active:bg-orange-50">{loc}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {recentAddresses.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <History size={12} /> Recent Locations
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentAddresses.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => !pAddr ? setPAddr(addr) : setDAddr(addr)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm active:scale-95 transition-transform"
                    >
                      {addr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              disabled={(isDeliveryOnly ? !dAddr : (!pAddr || !dAddr))}
              onClick={() => {
                // Save to recents
                const updated = Array.from(new Set([pAddr, dAddr, ...recentAddresses])).filter(Boolean).slice(0, 5);
                setRecentAddresses(updated);
                localStorage.setItem('kothrito-recent-addresses', JSON.stringify(updated));

                if (isDeliveryOnly) {
                  setStep(3); // Skip pickup pin
                } else {
                  setStep(2);
                }
                setTimeout(() => mapRef.current?.invalidateSize(), 150);
              }}
              className="w-full mt-6 bg-slate-900 disabled:bg-slate-300 disabled:text-slate-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              Choose Map Locations
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: FARE CONFIRMATION (OVERLAYS MAP) */}
      {step === 4 && (
        <div className="absolute inset-x-0 bottom-0 bg-white z-[500] rounded-t-[3rem] p-8 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col animate-in slide-in-from-bottom duration-300 max-w-md mx-auto">
          <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Review Trip</h2>

          <div className="bg-slate-50 p-5 rounded-[2rem] border border-orange-100 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route</span>
              {isCalculatingRoute ? (
                <Loader2 size={14} className="animate-spin text-orange-500" />
              ) : (
                <span className="text-sm font-bold text-slate-800">{distanceKm > 0 ? `${distanceKm.toFixed(1)} km • ~${etaMinutes} min` : 'Base'}</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Fare</span>
              {isCalculatingRoute ? (
                <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
              ) : (
                <span className="text-3xl font-black text-orange-600 leading-none">₹{calculatedFare}</span>
              )}
            </div>
          </div>

          <button
            disabled={isCalculatingRoute || !pickup || !drop}
            onClick={() => pickup && drop && onConfirm(pickup, drop, pAddr, dAddr, calculatedFare)}
            className="w-full bg-orange-500 disabled:bg-slate-300 disabled:text-slate-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-orange-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isCalculatingRoute ? "Calculating..." : "Place Order"}
            {!isCalculatingRoute && <CheckCircle2 size={24} />}
          </button>
        </div>
      )}
    </div>
  );
}