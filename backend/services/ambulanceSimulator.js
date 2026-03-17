/**
 * AMBULANCE SIMULATOR v1 — Real-time GPS simulation along route
 * Adapted from Smart-Emergency-System vehicleSimulator
 * Moves ambulance along OSRM route points every 1.5s
 */
const Ambulance        = require("../models/Ambulance");
const EmergencyRequest = require("../models/EmergencyRequest");
const calcDist         = require("../utils/distance");

const TICK_MS = 1500;
const CRUISE  = { Critical:70, High:60, Medium:50, Normal:45, Low:38 };

function bearing(lat1, lng1, lat2, lng2) {
  const dL = (lng2-lng1)*Math.PI/180;
  const r1  = lat1*Math.PI/180, r2 = lat2*Math.PI/180;
  return ((Math.atan2(Math.sin(dL)*Math.cos(r2), Math.cos(r1)*Math.sin(r2)-Math.sin(r1)*Math.cos(r2)*Math.cos(dL))*180/Math.PI)+360)%360;
}
function distM(a,b){ return calcDist(a[1],a[0],b[1],b[0])*1000; }
function lerp(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }

// Active simulations map: ambulanceId → intervalId
const activeSimulations = new Map();

exports.simulate = async (io, ambulanceId, emergencyRequestId, routeCoords, priority="High") => {
  // Stop any existing simulation for this ambulance
  if (activeSimulations.has(ambulanceId)) {
    clearInterval(activeSimulations.get(ambulanceId));
    activeSimulations.delete(ambulanceId);
  }

  const coords = routeCoords; // [[lng,lat], ...]
  if (!coords || coords.length < 2) {
    console.log(`[AMB-SIM] No route for ${ambulanceId}`);
    return;
  }

  // Pre-compute distances
  const segDist = [];
  const cumDist = [0];
  let totalDistM = 0;
  for (let j=1; j<coords.length; j++) {
    const d = distM(coords[j-1], coords[j]);
    segDist.push(d); totalDistM += d; cumDist.push(totalDistM);
  }

  const cruise = CRUISE[priority] || 55;
  let segIdx = 0, segProgress = 0, coveredM = 0;

  const getPos = () => {
    if (segIdx >= coords.length-1) return coords[coords.length-1];
    const t = segDist[segIdx]>0 ? segProgress/segDist[segIdx] : 0;
    return lerp(coords[segIdx], coords[segIdx+1], t);
  };

  // Emit simulation started
  io.emit("ambulanceSimStarted", {
    ambulanceId, emergencyRequestId: String(emergencyRequestId),
    totalDistKm: +(totalDistM/1000).toFixed(2),
  });

  const tick = setInterval(async () => {
    try {
      // Arrival check
      if (segIdx >= coords.length-1 || coveredM >= totalDistM) {
        clearInterval(tick);
        activeSimulations.delete(ambulanceId);

        const [lng,lat] = coords[coords.length-1];
        await Ambulance.findOneAndUpdate({ ambulanceId },
          { "location.lat":lat, "location.lng":lng, speed:0, "location.lastUpdated":new Date() }
        ).catch(()=>{});

        io.emit("ambulanceArrived", { ambulanceId, emergencyRequestId: String(emergencyRequestId), lat, lng });
        io.emit("ambulanceLocation", { ambulanceId, lat, lng, speed:0, heading:0, progressPct:100, remainingSec:0, arrived:true });
        console.log(`[AMB-SIM] ${ambulanceId} ARRIVED`);
        return;
      }

      // Speed calculation
      const pct = coveredM/totalDistM;
      let speedKmh;
      if      (pct<0.10) speedKmh = cruise*(0.3+pct*7);
      else if (pct>0.88) speedKmh = cruise*Math.max(0.2,1-(pct-0.88)*7);
      else               speedKmh = cruise+(Math.sin(segIdx*1.3)*4);
      speedKmh = Math.max(15, Math.round(speedKmh));

      // Advance along route
      const metersThisTick = (speedKmh/3.6)*(TICK_MS/1000);
      let remaining = metersThisTick;
      while (remaining>0 && segIdx<coords.length-1) {
        const segLeft = segDist[segIdx]-segProgress;
        if (remaining >= segLeft) { remaining-=segLeft; coveredM+=segLeft; segProgress=0; segIdx++; }
        else { segProgress+=remaining; coveredM+=remaining; remaining=0; }
      }

      const [lng, lat] = getPos();
      const prevC = segIdx>0 ? coords[Math.max(0,segIdx-1)] : coords[0];
      const hdg   = bearing(prevC[1],prevC[0],lat,lng);

      // Save location
      await Ambulance.findOneAndUpdate({ ambulanceId },
        { "location.lat":lat, "location.lng":lng, speed:speedKmh, "location.lastUpdated":new Date() }
      ).catch(()=>{});

      const remainM   = Math.max(0, totalDistM-coveredM);
      const remainSec = Math.max(1, Math.round(remainM/(speedKmh/3.6)));
      const progress  = Math.min(99, Math.round(coveredM/totalDistM*100));

      io.emit("ambulanceLocation", {
        ambulanceId, lat, lng,
        emergencyRequestId: String(emergencyRequestId),
        speed: speedKmh, heading: Math.round(hdg),
        progressPct: progress, remainingSec: remainSec,
        distanceRemaining: +(remainM/1000).toFixed(2),
        distanceCovered:   +(coveredM/1000).toFixed(2),
        totalDistKm:       +(totalDistM/1000).toFixed(2),
        arrived: false,
      });

    } catch(err) {
      console.error("[AMB-SIM]", err.message);
      clearInterval(tick);
      activeSimulations.delete(ambulanceId);
    }
  }, TICK_MS);

  activeSimulations.set(ambulanceId, tick);
  return tick;
};

exports.stopSimulation = (ambulanceId) => {
  if (activeSimulations.has(ambulanceId)) {
    clearInterval(activeSimulations.get(ambulanceId));
    activeSimulations.delete(ambulanceId);
    console.log(`[AMB-SIM] Stopped simulation for ${ambulanceId}`);
  }
};

exports.activeCount = () => activeSimulations.size;
