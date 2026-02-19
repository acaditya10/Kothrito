"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Map, Phone, CheckCircle, Power, Bike } from 'lucide-react';

export default function RiderDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // 1. Auth & Authorization Check
  // Inside app/kothrito-rider/page.tsx

useEffect(() => {
  const unsub = auth.onAuthStateChanged(async (u) => {
    if (u) {
      // 1. Reference the document using the UID
      const riderRef = doc(db, "riders", u.uid);
      const riderDoc = await getDoc(riderRef);
      
      // 2. Check if document exists AND role is rider
      if (riderDoc.exists() && riderDoc.data().role === "rider") {
        setUser({ ...u, ...riderDoc.data() }); // Merge Auth user with Firestore data (gets phone/role)
        setIsAuthorized(true);
      } else {
        // Not a rider? Send them home.
        window.location.href = "/"; 
      }
    } else {
      setIsAuthorized(false);
    }
    });
    return () => unsub();
}, []);

  // 2. Listen for Orders
  useEffect(() => {
    if (!isAuthorized) return;

    // Listen for New Orders (Pending)
    const qPending = query(collection(db, "orders"), where("status", "==", "pending"));
    const unsubPending = onSnapshot(qPending, (snap) => {
      setAvailableOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen for My Active Order
    const qActive = query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "accepted"));
    const unsubActive = onSnapshot(qActive, (snap) => {
      if (!snap.empty) {
        setActiveOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveOrder(null);
      }
    });

    return () => { unsubPending(); unsubActive(); };
  }, [isAuthorized, user?.uid]);

  const claimOrder = async (orderId: string) => {
  if (!user) return;

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "accepted",
      riderId: user.uid,
      riderName: user.name, // From Firestore doc
      riderPhone: user.phone // From Firestore doc (the number you just added)
    });
    // This will trigger the "Active Order" view automatically
    } catch (error) {
        console.error("Error claiming order:", error);
        alert("Could not claim order. Someone else might have taken it!");
    }
    };

  const completeOrder = async (orderId: string) => {
    await updateDoc(doc(db, "orders", orderId), { status: "completed" });
  };

  if (!isAuthorized) return <p className="p-10 text-center font-bold">Verifying Rider Access...</p>;

  return (
    <div className="min-h-screen bg-orange-50 p-6 max-w-md mx-auto font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-black text-orange-600">Kothrito Rider</h1>
        <div className="bg-white px-3 py-1 rounded-full border border-orange-200 text-xs font-bold">Online</div>
      </header>

      {/* ACTIVE JOB VIEW */}
      {activeOrder ? (
        <div className="bg-white rounded-[2rem] p-8 shadow-xl border-2 border-orange-500 animate-pulse-slow">
          <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">Current Task</span>
          <h2 className="text-2xl font-black mt-4">{activeOrder.userName}</h2>
          
          <div className="my-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 bg-green-500 rounded-full"></div>
              <p className="text-sm font-bold">Pickup: <span className="text-slate-500">{activeOrder.pickup.address}</span></p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 bg-red-500 rounded-full"></div>
              <p className="text-sm font-bold">Drop: <span className="text-slate-500">{activeOrder.drop.address}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <a href={`tel:${activeOrder.userPhone}`} className="flex flex-col items-center bg-slate-100 p-4 rounded-2xl">
              <Phone className="text-orange-600 mb-1" />
              <span className="text-[10px] font-bold">CALL</span>
            </a>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.pickup.lat},${activeOrder.pickup.lng}`} className="flex flex-col items-center bg-slate-100 p-4 rounded-2xl">
              <Map className="text-blue-600 mb-1" />
              <span className="text-[10px] font-bold">MAPS</span>
            </a>
          </div>

          <button 
            onClick={() => completeOrder(activeOrder.id)}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-100"
          >
            FINISH RIDE
          </button>
        </div>
      ) : (
        /* PENDING JOBS LIST */
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Available Jobs ({availableOrders.length})</h3>
          {availableOrders.map(order => (
            <div key={order.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-4">
                  <span className="font-black text-slate-800 italic">{order.serviceType}</span>
                  <span className="text-orange-600 font-black tracking-tighter">₹20.00</span>
               </div>
               <p className="text-sm font-bold text-slate-500 mb-4 truncate">📍 {order.pickup.address} to {order.drop.address}</p>
               <button 
                 onClick={() => claimOrder(order.id)}
                 className="w-full bg-black text-white py-3 rounded-xl font-bold active:scale-95 transition-transform"
               >
                 Accept Job
               </button>
            </div>
          ))}
          {availableOrders.length === 0 && (
            <div className="text-center py-20 opacity-30 font-black">Waiting for students... 🛸</div>
          )}
        </div>
      )}
    </div>
  );
}