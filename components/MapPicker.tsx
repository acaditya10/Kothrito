"use client";
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, ArrowRight, CheckCircle2, X } from 'lucide-react';

interface MapPickerProps {
  onConfirm: (pickup: L.LatLng, drop: L.LatLng, pAddr: string, dAddr: string) => void;
  onClose: () => void;
}

export default function MapPicker({ onConfirm, onClose }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [step, setStep] = useState(1); // 1: Pickup, 2: Drop, 3: Address Details
  const [pickup, setPickup] = useState<L.LatLng | null>(null);
  const [drop, setDrop] = useState<L.LatLng | null>(null);
  const [pAddr, setPAddr] = useState("");
  const [dAddr, setDAddr] = useState("");

  const center = [23.081306, 76.842861]; // VIT Bhopal Center

  useEffect(() => {
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

  const handleConfirmLocation = () => {
    if (!mapRef.current) return;
    const currentCenter = mapRef.current.getCenter();

    if (step === 1) {
      setPickup(currentCenter);
      setStep(2);
      // Add a visual marker for pickup point
      L.circleMarker(currentCenter, { color: '#22c55e', radius: 8, fillOpacity: 1 }).addTo(mapRef.current);
    } else if (step === 2) {
      setDrop(currentCenter);
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="absolute top-0 inset-x-0 p-6 z-[1000] flex items-center justify-between pointer-events-none">
        <button onClick={onClose} className="p-3 bg-white rounded-full shadow-xl pointer-events-auto active:scale-90 transition-transform">
          <X size={20} />
        </button>
        <div className="bg-white px-4 py-2 rounded-full shadow-xl pointer-events-auto border border-orange-100 font-bold text-xs text-orange-600 uppercase tracking-widest">
          {step === 1 ? "Set Pickup" : step === 2 ? "Set Drop" : "Details"}
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* THE MAP (Steps 1 & 2) */}
      {step < 3 && (
        <div className="relative flex-1">
          <div id="map-container" className="w-full h-full" />
          
          {/* CENTER CROSSHAIR */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="flex flex-col items-center mb-10"> {/* Offset for pin tip */}
               <div className="bg-black text-white text-[10px] px-2 py-1 rounded mb-1 font-bold animate-bounce">
                  {step === 1 ? "PICKUP HERE" : "DROP HERE"}
               </div>
               <MapPin size={40} className={step === 1 ? "text-green-500 fill-green-500/20" : "text-red-500 fill-red-500/20"} />
               <div className="w-1 h-1 bg-black rounded-full shadow-xl"></div>
            </div>
          </div>

          {/* CONFIRM BUTTON */}
          <div className="absolute bottom-10 inset-x-6 z-[1000]">
            <button 
              onClick={handleConfirmLocation}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {step === 1 ? "Confirm Pickup Location" : "Confirm Drop Location"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ADDRESS FORM (Step 3) */}
      {step === 3 && (
        <div className="flex-1 bg-slate-50 p-8 flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="flex-1 flex flex-col justify-center gap-8">
            <h2 className="text-3xl font-black text-slate-800">Final Step</h2>
            
            <div className="space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-2 block">Pickup Landmark</label>
                <input 
                  value={pAddr}
                  onChange={(e) => setPAddr(e.target.value)}
                  placeholder="Ex: Hostel 1, Room 202 or Library Gate"
                  className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 ring-green-100 transition-all"
                />
              </div>

              <div className="relative">
                <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2 block">Drop Landmark</label>
                <input 
                  value={dAddr}
                  onChange={(e) => setDAddr(e.target.value)}
                  placeholder="Ex: Near Nescafe or Academic Block"
                  className="w-full bg-white border border-slate-100 p-4 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 ring-red-100 transition-all"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => pickup && drop && onConfirm(pickup, drop, pAddr, dAddr)}
            className="w-full bg-orange-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-orange-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            Place Kothrito Order
            <CheckCircle2 size={24} />
          </button>
        </div>
      )}
    </div>
  );
}