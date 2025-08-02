// ==========================================================================
//  MDS‑Assist  –  Single‑file rewrite (2025‑08‑02)
//
//  Numbered sections keep logic tightly scoped; no behavioural changes.
// ==========================================================================
import { useState, useEffect } from "react";

// === SECTION 01: Imports & Firebase Setup =================================
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { db, auth, storage, googleProvider } from "./firebase";
import MapboxLandmarkPicker from "./components/MapboxLandmarkPicker";

// ==========================================================================
//  App component
// ==========================================================================
function App() {
  // === SECTION 02: Navigation & UI Mode Selectors =========================
  const [activeScreen, setActiveScreen] = useState("main"); // "main" | "guide" | "settings"
  const [locMethod, setLocMethod] = useState("build");      // "build" | "landmark" | "ai"
  const [buildMode, setBuildMode] = useState("manual");     // "manual" | "map"
  const [isPickingLandmark, setIsPickingLandmark] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState(false);

  /* --- Auto‑trigger Landmark / AI actions on tab switch ------------------ */
  useEffect(() => {
    if (locMethod === "landmark") {
      autoDescribeNearest();
    } else if (locMethod === "ai") {
      handleGeoAnalyze();
    }
  }, [locMethod]);

  // === SECTION 02A: Auth State & Handlers =================================
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign‑in error:", err);
      alert("Failed to sign in");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign‑out error:", err);
      alert("Failed to sign out");
    }
  };

// === SECTION 02B: Mapbox Landmark Picker Handler ==========================
  const handleLandmarkSelect = async ({ lat, lon }) => {
  // Close the picker
  setIsPickingLandmark(false);
  // **Capture coords for the Add-Landmark form**
  setNewLandmarkCoords(`${lat}, ${lon}`);

  try {
    // show GPS-lock countdown
    setGeoStatus("Waiting for GPS lock…");
    const { latitude: curLat, longitude: curLon } =
      await acquireAccuratePosition({ desiredAccuracy: 20 });
    setGeoStatus("");

    // compute distance and bearing
    const meters = haversine(curLat, curLon, lat, lon);
    const feet   = Math.ceil((meters * 3.28084) / 10) * 10;
    const bearing = computeBearing(curLat, curLon, lat, lon);
    const rev     = (bearing + 180) % 360;
    const dir     = bearingToCompass(rev);

    setDistanceTotal(feet);
    setDirectionFromLandmark(dir);
  } catch (err) {
    setGeoStatus("");
    alert("Unable to get your location: " + err.message);
  }
};

// === SECTION 02C: Reverse-Geocode & AI Location Helper ===================
const handleGeoAnalyze = async () => {
  if (!navigator.geolocation) {
    setLocationDesc("Geolocation not supported.");
    return;
  }

  try {
    setGeoStatus("Waiting for GPS lock…");
    const { latitude, longitude } = await acquireAccuratePosition({ desiredAccuracy: 20 });
    setGeoStatus("");

    // reverse-geocode
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    const data = await res.json();
    const displayName = data.display_name || "Unknown location";

    // AI prompt
    const prompt = `
Generate a short, clear field location descriptions based on GPS data. 
Examples of good responses:
"2023 S Crystal Way"
"N corner of Green Ivy sports field"
"intersection of Smith and Murphy Street"
"~100 ft W of Intersection of Danube St and Garbanzo Way"

Always be concise and extremely factual. Return your answer with no line breaks or quotation marks.

The information must be factual. It is better to be non-specific and say "NW corner of field" than
to make up the name of the field. Never punt a response. If you have no data to return, simply respond
with "-".

Address:
"${displayName}"
    `.trim();

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData  = await aiRes.json();
    const aiReply = aiData.choices?.[0]?.message?.content?.trim();
    const cleaned = aiReply?.replace(/^["']|["']$/g, "");

    setLocationDesc((prev) =>
      cleaned
        ? prev
          ? `${prev}. ${cleaned}`
          : cleaned
        : prev
    );
  } catch (error) {
    setGeoStatus("");
    setLocationDesc("Unable to get location: " + error.message);
  }
};

  // === SECTION 03: Location‑Builder State =================================
  const [distanceTotal, setDistanceTotal] = useState(0);
  const [directionFromLandmark, setDirectionFromLandmark] = useState("");
  const [locationType, setLocationType] = useState("");
  const [cornerDirection, setCornerDirection] = useState("");
  const [edgeDirection, setEdgeDirection] = useState("");
  const [landmark1, setLandmark1] = useState("");
  const [landmark2, setLandmark2] = useState("");

  // === SECTION 04: Incident & GPS State ===================================
  const [incidentLat, setIncidentLat] = useState("");
  const [incidentLon, setIncidentLon] = useState("");
  const [incidentCoords, setIncidentCoords] = useState("");
  const [positionReport, setPositionReport] = useState("");
  const [nearestLandmarkReport, setNearestLandmarkReport] = useState("");
  const [geoStatus, setGeoStatus] = useState("");
  const [gpsTimer, setGpsTimer] = useState(0);
  const [gpsWaitSec, setGpsWaitSec] = useState(15);
  useEffect(() => {
    const stored = localStorage.getItem("gpsWaitSec");
    if (stored !== null) setGpsWaitSec(Number(stored));
  }, []);
  const saveGpsWaitSec = () => {
    localStorage.setItem("gpsWaitSec", gpsWaitSec);
    alert("GPS wait saved.");
  };

  // === SECTION 05: Comment / Weather / AI Image State =====================
  const [sceneImage, setSceneImage] = useState(null);
  const [windDir, setWindDir] = useState("");
  const [windIntensity, setWindIntensity] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [aiComments, setAiComments] = useState("");
  const [windRelative, setWindRelative] = useState("");
  const [instrumentNote, setInstrumentNote] = useState("");
  const [landmarkImage, setLandmarkImage] = useState(null);

  // === SECTION 06: Landmarks & Lists State =================================
  const [landmarks, setLandmarks] = useState([]); // [{id, description, lat, lon}]
  const [editLandmarks, setEditLandmarks] = useState({});
  const [newLandmarkDesc, setNewLandmarkDesc] = useState("");
  const [newLandmarkCoords, setNewLandmarkCoords] = useState("");

  // === SECTION 07: Phrases State ==========================================
  const [savedPhrases, setSavedPhrases] = useState([]);
  const [selectedPhrases, setSelectedPhrases] = useState([]);
  const [newPhraseTitle, setNewPhraseTitle] = useState("");
  const [newPhraseContent, setNewPhraseContent] = useState("");
  const [phraseMode, setPhraseMode] = useState("add"); // "add" | "delete"

  // === SECTION 08: Guides State ===========================================
  const [guideMode, setGuideMode]         = useState("view"); // "view" | "create" | "edit" | "delete"
  const [guides, setGuides]               = useState([]);
  const [selectedGuideId, setSelectedGuideId] = useState("");
  const [selectedGuideToDeleteId, setSelectedGuideToDeleteId] = useState("");
  const [builderAddMode, setBuilderAddMode] = useState(""); // "" | "section" | "entry" | "image"
  const [builderTitle, setBuilderTitle]   = useState("");
  const [builderItems, setBuilderItems]   = useState([]);
  const [newSectionHeading, setNewSectionHeading] = useState("");
  const [newEntryFieldName, setNewEntryFieldName] = useState("");
  const [newEntryFieldValue, setNewEntryFieldValue] = useState("");
  const [newEntryComment, setNewEntryComment] = useState("");
  const [newImageFile, setNewImageFile]   = useState(null);
  const [newImageCaption, setNewImageCaption] = useState("");

  // === SECTION 09: Instruments State ======================================
  const [instruments, setInstruments]             = useState([]);
  const [editInstruments, setEditInstruments]     = useState({});
  const [newInstrAbbr, setNewInstrAbbr]           = useState("");
  const [newInstrBarcode, setNewInstrBarcode]     = useState("");
  const [newInstrBatch, setNewInstrBatch]         = useState("");
  const [newInstrExp, setNewInstrExp]             = useState("");

  // === SECTION 10: Initial Load Effects ====================================
  useEffect(() => {
    loadPhrases();
    loadGuides();
    loadLandmarks();
    loadIncidentSite();
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                          Firestore CRUD blocks                         */
  /* ---------------------------------------------------------------------- */

  // === SECTION 11: CRUD – Phrases =========================================
  const loadPhrases = async () => {
    try {
      const snap = await getDocs(collection(db, "phrases"));
      setSavedPhrases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading phrases:", err);
    }
  };

  const addPhrase = async () => {
    if (!newPhraseTitle || !newPhraseContent) return;
    try {
      await addDoc(collection(db, "phrases"), {
        title: newPhraseTitle,
        content: newPhraseContent,
      });
      setNewPhraseTitle("");
      setNewPhraseContent("");
      loadPhrases();
    } catch (err) {
      console.error("Error adding phrase:", err);
    }
  };

  const removePhrase = async (index) => {
    const phraseToDelete = savedPhrases[index];
    if (!phraseToDelete?.id) return;
    try {
      await deleteDoc(doc(db, "phrases", phraseToDelete.id));
      loadPhrases();
    } catch (err) {
      console.error("Error deleting phrase:", err);
    }
  };

  const togglePhrase = (content) => {
    setSelectedPhrases((prev) =>
      prev.includes(content) ? prev.filter((p) => p !== content) : [...prev, content]
    );
  };

  // === SECTION 12: CRUD – Guides ==========================================
  const loadGuides = async () => {
    try {
      const snap = await getDocs(collection(db, "guides"));
      setGuides(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading guides:", err);
    }
  };

  const saveGuide = async () => {
    if (!builderTitle || !builderItems.length) return;
    try {
      await addDoc(collection(db, "guides"), {
        title: builderTitle,
        items: builderItems,
        timestamp: Date.now(),
      });
      setBuilderTitle("");
      setBuilderItems([]);
      loadGuides();
      alert("Guide saved.");
    } catch (err) {
      console.error("Error saving guide:", err);
    }
  };

  const deleteGuide = async (guideId) => {
    if (!guideId) return;
    try {
      await deleteDoc(doc(db, "guides", guideId));
      loadGuides();
      alert("Guide deleted.");
    } catch (err) {
      console.error("Error deleting guide:", err);
    }
  };

  const updateGuide = async (guideId) => {
    if (!guideId || !builderTitle.trim() || !builderItems.length) return;
    try {
      await updateDoc(doc(db, "guides", guideId), {
        title: builderTitle.trim(),
        items: builderItems,
        timestamp: Date.now(),
      });
      loadGuides();
      alert("Guide updated.");
    } catch (err) {
      console.error("Error updating guide:", err);
    }
  };

  // === SECTION 13: CRUD – Landmarks =======================================
  const loadLandmarks = async () => {
    try {
      const snap = await getDocs(collection(db, "landmarks"));
      setLandmarks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading landmarks:", err);
    }
  };

  const addLandmark = async (description, lat, lon) => {
    try {
      await addDoc(collection(db, "landmarks"), { description, lat, lon });
      loadLandmarks();
    } catch (err) {
      console.error("Error adding landmark:", err);
    }
  };

  const updateLandmark = async (id, description, lat, lon) => {
    try {
      await updateDoc(doc(db, "landmarks", id), { description, lat, lon });
      loadLandmarks();
    } catch (err) {
      console.error("Error updating landmark:", err);
    }
  };

  const deleteLandmark = async (id) => {
    try {
      await deleteDoc(doc(db, "landmarks", id));
      loadLandmarks();
    } catch (err) {
      console.error("Error deleting landmark:", err);
    }
  };

  // === SECTION 14: CRUD – Instruments =====================================
  const loadInstruments = async () => {
    try {
      const snap = await getDocs(collection(db, "instruments"));
      setInstruments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading instruments:", err);
    }
  };
  useEffect(() => { loadInstruments(); }, []);

  const addInstrument = async (abbr, barcode, batch, exp) => {
    try {
      await addDoc(collection(db, "instruments"), { abbr, barcode, batch, exp });
      loadInstruments();
    } catch (err) {
      console.error("Error adding instrument:", err);
    }
  };

  const updateInstrument = async (id, abbr, barcode, batch, exp) => {
    try {
      await updateDoc(doc(db, "instruments", id), { abbr, barcode, batch, exp });
      loadInstruments();
    } catch (err) {
      console.error("Error updating instrument:", err);
    }
  };

  const deleteInstrument = async (id) => {
    try {
      await deleteDoc(doc(db, "instruments", id));
      loadInstruments();
    } catch (err) {
      console.error("Error deleting instrument:", err);
    }
  };

  const copyInstrumentBarcode = (code) => navigator.clipboard.writeText(code);
  const makeInstrumentNote = (abbr) => {
    const inst = instruments.find((i) => i.abbr === abbr);
    if (!inst) return "";
    const label = abbr === "UR" ? "Batch number" : "QC number";
    return `${label}: ${inst.batch || ""}\nExp date: ${inst.exp || ""}`.trim();
  };

  // === SECTION 15: Incident Site Helpers ==================================
  const loadIncidentSite = async () => {
    try {
      const docRef = doc(db, "settings", "incidentSite");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const { lat, lon } = snap.data();
        setIncidentLat(lat);
        setIncidentLon(lon);
      }
    } catch (err) {
      console.error("loadIncidentSite error:", err);
    }
  };

  useEffect(() => {
    if (incidentLat !== "" && incidentLon !== "") {
      const cleanLat = String(incidentLat).replace(/['"]/g, "");
      const cleanLon = String(incidentLon).replace(/['"]/g, "");
      setIncidentCoords(`${cleanLat}, ${cleanLon}`);
    }
  }, [incidentLat, incidentLon]);

  const handleSaveIncidentCoords = async () => {
    const parts = incidentCoords.split(",");
    if (parts.length !== 2) {
      return alert("Enter lat and lon separated by a comma.");
    }
    const lat = parseFloat(parts[0].trim());
    const lon = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lon)) {
      return alert("Invalid format. Example: 43.5844120, -116.1939362");
    }
    try {
      await setDoc(doc(db, "settings", "incidentSite"), { lat, lon });
      setIncidentLat(lat);
      setIncidentLon(lon);
      alert("Incident site saved.");
    } catch (err) {
      console.error("Error saving incident site:", err);
      alert("Failed to save incident site.");
    }
  };

  // === SECTION 16: Geolocation Utilities ==================================
  let timerIntervalId = null;
  const startGpsTimer = (duration) => {
    setGpsTimer(duration);
    timerIntervalId = setInterval(() => {
      setGpsTimer((t) => {
        if (t <= 1) {
          clearInterval(timerIntervalId);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };
  const stopGpsTimer = () => {
    clearInterval(timerIntervalId);
    setGpsTimer(0);
  };

  const acquireAccuratePosition = ({
    timeout,
    desiredAccuracy = 20,
  } = {}) => {
    const timeoutMs = timeout ?? gpsWaitSec * 1000;
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported."));
        return;
      }
      let best = null;
      const startTime = Date.now();
      startGpsTimer(Math.ceil(timeoutMs / 1000));
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (!best || accuracy < best.accuracy) {
            best = { latitude, longitude, accuracy };
          }
        },
        (err) => {
          if (err.code === 1 || err.code === 3) {
            cleanup();
            reject(err);
          }
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      const timer = setTimeout(() => {
        cleanup();
        if (best) {
          resolve({ latitude: best.latitude, longitude: best.longitude });
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            (e) =>
              reject(new Error("Fallback getCurrentPosition failed: " + e.message)),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          );
        }
      }, timeoutMs);
      function cleanup() {
        stopGpsTimer();
        clearTimeout(timer);
        navigator.geolocation.clearWatch(watchId);
      }
    });
  };

  /* --- Distance & bearing helpers --------------------------------------- */
  const toRad = (v) => (v * Math.PI) / 180;
  const toDeg = (v) => (v * 180) / Math.PI;
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const computeBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = toRad(lat1),
      φ2 = toRad(lat2),
      Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };
  const bearingToCompass = (deg) => {
    const points = [
      "N","NNE","NE","ENE","E","ESE","SE","SSE",
      "S","SSW","SW","WSW","W","WNW","NW","NNW"
    ];
    return points[Math.floor(((deg + 11.25) % 360) / 22.5)];
  };
  const formatDistance = (meters) => {
    const feet = meters * 3.28084;
    return feet >= 5280 ? `${(feet / 5280).toFixed(1)} mi`
                        : `${Math.ceil(feet / 10) * 10} ft`;
  };

  // === SECTION 17: Position & Wind Helpers ================================
  const handleReportPosition = async () => {
    if (!incidentLat || !incidentLon) {
      return alert("Please save an incident site first.");
    }
    try {
      setGeoStatus("Waiting for GPS lock…");
      const { latitude: curLat, longitude: curLon } =
        await acquireAccuratePosition({ timeout: 15000 });
      setGeoStatus("");

      const dist = haversine(curLat, curLon, incidentLat, incidentLon);
      const bear = computeBearing(curLat, curLon, incidentLat, incidentLon);
      setPositionReport(`${formatDistance(dist)} ${bearingToCompass(bear)} of incident site`);
    } catch (err) {
      setGeoStatus("");
      alert("Unable to get your position: " + err.message);
    }
  };

  const angleDiff = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  const handleWindRelative = () => {
    if (!incidentLat || !incidentLon) {
      alert("Please save an incident site first."); return;
    }
    if (!windDir) {
      alert("Select ‘Wind from’ first."); return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const meters  = haversine(incidentLat, incidentLon, coords.latitude, coords.longitude);
        const bearing = computeBearing(incidentLat, incidentLon, coords.latitude, coords.longitude);
        const dir     = bearingToCompass(bearing);
        const distStr = `~${formatDistance(meters)}`;

        const map     = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
        const windFrom = map[windDir];
        const downwind = (windFrom + 180) % 360;

        let rel = "crosswind";
        if (angleDiff(bearing, windFrom) <= 22.5) rel = "upwind";
        else if (angleDiff(bearing, downwind) <= 22.5) rel = "downwind";

        setWindRelative(`${distStr} ${dir} and ${rel} of incident site`);
      },
      (err) => alert("Unable to get your location: " + err.message)
    );
  };

  const autoDescribeNearest = async () => {
    if (!landmarks.length) return alert("No landmarks defined.");
    try {
      setGeoStatus("Waiting for GPS lock…");
      const { latitude, longitude } = await acquireAccuratePosition();
      setGeoStatus("");
      let best = null, minDist = Infinity;
      landmarks.forEach((lm) => {
        const d = haversine(latitude, longitude, lm.lat, lm.lon);
        if (d < minDist) [minDist, best] = [d, lm];
      });
      if (!best) return;
      const bearing = computeBearing(best.lat, best.lon, latitude, longitude);
      setNearestLandmarkReport(
        `~${formatDistance(minDist)} ${bearingToCompass(bearing)} of ${best.description}`
      );
    } catch (err) {
      setGeoStatus("");
      alert("Unable to get your position: " + err.message);
    }
  };

// === SECTION 17B: Attach & Retrieve Fields at Location =====================
/**
 * Attach the current field data to this GPS position.
 */
const handleAttachToLocation = async () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }
  try {
    setGeoStatus("Waiting for GPS lock…");
    const { latitude, longitude } =
      await acquireAccuratePosition({ timeout: 15000, desiredAccuracy: 20 });
    setGeoStatus("");
    // …then feed latitude/longitude into your reverse-geocode + AI logic…
  } catch (err) {
    setGeoStatus("");
    setLocationDesc("Unable to get location: " + err.message);
  }
};

/**
 * Find stored fields nearest your current GPS position and load them.
 */
const handleRetrieveFromLocation = async () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    try {
      const snapshot = await getDocs(collection(db, "locations"));
      const entries = snapshot.docs.map((d) => d.data());
      if (!entries.length) return alert("No stored locations found.");

      // Find the closest entry
      const distance = (a, b) => {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371e3;
        const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
        const Δφ = toRad(b.lat - a.lat), Δλ = toRad(b.lon - a.lon);
        const aVal =
          Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
        return R * c;
      };

      let closest = null, minDist = Infinity;
      for (const entry of entries) {
        const d = distance({ lat: latitude, lon: longitude }, entry);
        if (d < minDist) {
          minDist = d;
          closest = entry;
        }
      }

      if (minDist < 50 && closest) {
        setLocationDesc(closest.locationDesc);
        setAdditionalComments(closest.additionalComments);
        alert("Fields retrieved from nearby location.");
      } else {
        alert("No nearby location found (within 50 meters).");
      }
    } catch (err) {
      console.error("Error retrieving locations:", err);
      alert("Failed to retrieve location.");
    }
  });
};


  // === SECTION 18: Image Upload & OpenAI Calls ============================
  const handleImageUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSceneAnalyze = async () => {
    if (!sceneImage) return;
    const messages = [{
      role: "user",
      content: [
        {
          type: "text",
          text: `You are provided with a site image.

Describe visible primary objects and immediate terrain in short factual phrases.
Ignore background scenery. Do NOT infer weather or wind. Examples of good phrases:
"A team of workers are digging a ditch."
"Excavator and skidsteer excavating a berm."
"Puddles of water have an oily sheen."
"River with algae. Wildlife present, including heron and turtle."

Always be concise and extremely factual. Return your answer with no line breaks or quotation marks. 

`
        },
        { type: "image_url", image_url: { url: sceneImage } },
      ],
    }];
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
        },
        body: JSON.stringify({ model: "gpt-4o", messages }),
      });
      const data = await res.json();
      setAiComments(data.choices?.[0]?.message?.content?.trim() || "");
    } catch (err) {
      setAiComments("Error: " + err.message);
    }
  };

  const handleAnalyzeLandmarkImage = async () => {
    if (!landmarkImage) return;
    const messages = [{
      role: "user",
      content: [
        {
          type: "text",
          text: `You are provided with a photo showing a single landmark such as a structure, utility pole, sign, or gate marker.

Your task is to:
- Identify the type of object (e.g., utility pole, gate marker, sign)
- Include any visible ID or label on it if it is clearly legible
- Return a single short phrase. 
- If your phrase begins with a standard word (not a cardinal direction or proper noun) use a lower case letter.

Examples:
- "utility pole 79557B"
- "sign: No Trespassing"
- "gate marker 3A"
- house with a red roof
- white corrugated iron storage shed

Do not describe background surroundings or speculate. 
Only report what is clearly visible on the object itself.

`
        },
        { type: "image_url", image_url: { url: landmarkImage } },
      ],
    }];
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
        },
        body: JSON.stringify({ model: "gpt-4o", messages }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) setLandmark1(content);
    } catch (err) {
      alert("Error analyzing image: " + err.message);
    }
  };

  // === SECTION 19: Derived Builders =======================================
  const buildLocationDescription = () => {
    if (!locationType || !directionFromLandmark) return locationDesc || "";
    let base = "";
    switch (locationType) {
      case "corner":
        base =
          cornerDirection && landmark1
            ? `~${distanceTotal} ft ${directionFromLandmark} of ${cornerDirection} corner of ${landmark1}`
            : "";
        break;
      case "edge":
        base =
          edgeDirection && landmark1
            ? `~${distanceTotal} ft ${directionFromLandmark} of ${edgeDirection} edge of ${landmark1}`
            : "";
        break;
      case "intersection":
        base =
          landmark1 && landmark2
            ? `~${distanceTotal} ft ${directionFromLandmark} of intersection of ${landmark1} and ${landmark2}`
            : "";
        break;
      default:
        base = landmark1
          ? `~${distanceTotal} ft ${directionFromLandmark} of ${landmark1}`
          : "";
    }
    return locationDesc ? `${base}. ${locationDesc}` : base;
  };

  const capitalize = (t) => t ? t[0].toUpperCase() + t.slice(1) : "";
  const weatherDescription = (w) => {
    switch (w.toLowerCase()) {
      case "clear": return "Clear skies";
      case "rain":  return "Rainy";
      case "fog":   return "Foggy";
      case "snow":  return "Snowy";
      case "dust":  return "Dusty";
      default:      return w;
    }
  };

// === SECTION 19B: Build Additional Comments ======================================= 

const buildAdditionalComments = () => {
  // Instrument note (if any) on its own line
  const instr = instrumentNote.trim();

  // Quick phrases, manual notes, weather description, AI comments
  const quick      = selectedPhrases.map(p => p.trim().replace(/\.+$/, "")).join(". ");
  const note       = notes.trim().replace(/\.+$/, "");
  const weatherStr = weather ? weatherDescription(weather) : "";
  const aiText     = aiComments.trim().replace(/\.+$/, "");

  // Base description line
  const baseLine = [quick, note, weatherStr, aiText].filter(Boolean).join(". ");

  // Wind info line
  let windInfo = "";
  if (windIntensity === "no wind") {
    windInfo = "No wind";
  } else if (windIntensity && windDir) {
    windInfo = `${capitalize(windIntensity)} wind from ${windDir}`;
  }
  const windLine = [windInfo, windRelative].filter(Boolean).join(". ");

  // Now assemble final output:
  // If there’s an instrument note, keep it first, then in the second line join baseLine + windLine with a period.
  if (instr) {
    return `${instr}\n${[baseLine, windLine].filter(Boolean).join(". ")}`;
  }

  // Otherwise, return a single line with baseLine + windLine
  return [baseLine, windLine].filter(Boolean).join(". ");
};

  useEffect(() => {
    setAdditionalComments(buildAdditionalComments());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentNote, selectedPhrases, aiComments, notes, weather, windIntensity, windDir, windRelative]);

  // === SECTION 20: Reset & Clipboard Helpers ==============================
  const clearLocationFields = () => {
    setDistanceTotal(0);
    setDirectionFromLandmark("");
    setLocationType("");
    setCornerDirection("");
    setEdgeDirection("");
    setLandmark1("");
    setLandmark2("");
    setLocationDesc("");
    setPositionReport("");
    setNearestLandmarkReport("");
  };
  const clearCommentsFields = () => {
    setSceneImage(null);
    document.querySelectorAll('input[type="file"]').forEach((i) => (i.value = ""));
    setWindDir("");
    setWindIntensity("");
    setWeather("");
    setNotes("");
    setAdditionalComments("");
    setAiComments("");
    setSelectedPhrases([]);
    setWindRelative("");
    setInstrumentNote("");
  };
  const copyToClipboard = (txt) => navigator.clipboard.writeText(txt);

  // === SECTION 21: UI Render =============================================
  if (!user) {
    return (
      <div className="container" style={{ textAlign: "center", marginTop: 50 }}>
        <h2>Please sign in with Google to continue</h2>
        <button onClick={handleSignIn} style={{ padding: "8px 16px", fontSize: 16 }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  /* --- Mapbox Landmark Picker modal ------------------------------------- */
  const landmarkPicker = isPickingLandmark && (
    <MapboxLandmarkPicker
      onSelect={({ lat, lon }) => {
        setIsPickingLandmark(false);
        setNewLandmarkCoords(`${lat}, ${lon}`);
      }}
      onSelect={handleLandmarkSelect}
      onClose={() => setIsPickingLandmark(false)}
    />
  );

return (
  <>
    {landmarkPicker}  {/* Mapbox modal is injected via constant */}

    {/* ===== SECTION 22: Main Container ===== */}
    <div className="container">
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button onClick={() => setActiveScreen("main")}>Main</button>
        <button onClick={() => setActiveScreen("guide")}>Guide</button>
        <button onClick={() => setActiveScreen("settings")}>Settings</button>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
        {activeScreen === "main" && (
          <>
            <h1>MDS Assist</h1>

{/* ─────────────────────── Build Location Description ───────────────────── */}
<div
  className="section-header"
  style={{
    background: "#333",
    color: "#fff",
    padding: "8px 12px",
    margin: "16px 0",
  }}
>
  Build Location Description
</div>

{/* ── Top-level method tabs ─────────────────────────────────────────────── */}
<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
  {[
    { label: "Build", value: "build" },
    { label: "Landmark", value: "landmark" },
    { label: "AI (experimental)", value: "ai" },
  ].map(({ label, value }) => (
    <button
      key={value}
      onClick={() => {
        setLocMethod(value);
        // reset conflicting state on tab switch
        setDistanceTotal(0);
        setDirectionFromLandmark("");
        setLocationType("");
      }}
        style={{
        backgroundColor: locMethod === value ? "#555" : "#999",
        color: "#fff",
        border: "none",
        padding: "6px 12px",
        borderRadius: "4px",
        cursor: "pointer",
        }}    
>
      {label}
    </button>
  ))}
</div>

{/* ───────────────────── Method: BUILD ──────────────────────────────────── */}
{locMethod === "build" && (
  <>
{/* ── Sub-selector: Manual vs Map (with GPS timer) ─────────────────── */}
<div
  style={{
    display: "flex",
    gap: 8,
    alignItems: "center",     // vertical align all items
    marginBottom: 12,
  }}
>
  {/* Manual mode */}
  <button
    onClick={() => setBuildMode("manual")}
    style={{
      backgroundColor: buildMode === "manual" ? "#555" : "#999",
      color: "#fff",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      cursor: "pointer",
    }}
  >
    Manual
  </button>

  {/* Map mode (opens the picker) */}
  <button
    onClick={() => {
      setBuildMode("map");
      setIsPickingLandmark(true);
    }}
    style={{
      backgroundColor: buildMode === "map" ? "#555" : "#999",
      color: "#fff",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      cursor: "pointer",
    }}
  >
    Map
  </button>

  {/* GPS‐lock timer */}
  {gpsTimer > 0 && (
    <span
      className="timer"
      style={{
        marginLeft: 8,
        fontFamily: "monospace",
        fontSize: "0.9rem",
        color: "#333",
      }}
    >
      {gpsTimer}s
    </span>
  )}
</div>

    {/* ── Manual distance + direction UI ───────────────────────────────── */}
    {buildMode === "manual" && (
      <>
        <div style={{ margin: "4px 0 8px 0" }}>
          Set distance and direction to landmark.
        </div>

        {/* Distance buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {[5, 10, 20, 50, 100].map((n) => (
            <button key={n} onClick={() => setDistanceTotal(distanceTotal + n)}>
              {n}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          Total est distance: ~{distanceTotal} feet
        </div>

        {/* Direction dropdown */}
        <select
          value={directionFromLandmark}
          onChange={(e) => setDirectionFromLandmark(e.target.value)}
          className="input"
          style={{ marginBottom: 8 }}
        >
          <option value="">Direction from landmark</option>
          {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir) => (
            <option key={dir} value={dir}>
              {dir}
            </option>
          ))}
        </select>
      </>
    )}

    {/* distance+direction set → show Define Landmark ************************/}
    {distanceTotal > 0 && directionFromLandmark && (
      <>
        <div
          style={{
            margin: "16px 0 8px",
            fontWeight: "bold",
          }}
        >
          Define landmark
        </div>

        {/* Landmark-type buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            { label: "Corner", value: "corner" },
            { label: "Edge", value: "edge" },
            { label: "Intersection", value: "intersection" },
            { label: "Point", value: "landmark" },
            { label: "Image", value: "image" },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setLocationType(value)}
              style={{
                backgroundColor: locationType === value ? "#ccc" : "",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dynamic landmark inputs */}
        {locationType === "corner" && (
          <>
            <select
              value={cornerDirection}
              onChange={(e) => setCornerDirection(e.target.value)}
              className="input"
            >
              <option value="">Select corner</option>
              {["NE", "NW", "SE", "SW"].map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
            <input
              placeholder="Enter landmark"
              value={landmark1}
              onChange={(e) => setLandmark1(e.target.value)}
              className="input"
            />
          </>
        )}

        {locationType === "edge" && (
          <>
            <select
              value={edgeDirection}
              onChange={(e) => setEdgeDirection(e.target.value)}
              className="input"
            >
              <option value="">Select edge direction</option>
              {["N", "E", "S", "W"].map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
            <input
              placeholder="Enter landmark"
              value={landmark1}
              onChange={(e) => setLandmark1(e.target.value)}
              className="input"
            />
          </>
        )}

        {locationType === "intersection" && (
          <>
            <input
              placeholder="First road or feature"
              value={landmark1}
              onChange={(e) => setLandmark1(e.target.value)}
              className="input"
            />
            <input
              placeholder="Second road or feature"
              value={landmark2}
              onChange={(e) => setLandmark2(e.target.value)}
              className="input"
            />
          </>
        )}

        {locationType === "landmark" && (
          <input
            placeholder="Enter landmark"
            value={landmark1}
            onChange={(e) => setLandmark1(e.target.value)}
            className="input"
          />
        )}

        {locationType === "image" && (
          <div style={{ marginTop: 10 }}>
            <label>📷 Upload Landmark Photo</label>
            <br />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, setLandmarkImage)}
              className="input"
            />
            <button
              onClick={handleAnalyzeLandmarkImage}
              style={{ marginTop: 8 }}
            >
              Analyze Landmark with AI
            </button>
          </div>
        )}
      </>
    )}
  </>
)}

{/* ──────────────────── Method: LANDMARK ─────────────────────────────────── */}
{locMethod === "landmark" && (
  <div style={{ margin: "16px 0" }}>
    <button
      onClick={autoDescribeNearest}
      style={{
        backgroundColor: "purple",
        color: "#fff",
        border: "none",
        padding: "6px 12px",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Auto describe » nearest landmark
    </button>
    {gpsTimer > 0 && <span className="timer">{gpsTimer}s</span>}
  </div>
)}

{/* ─────────────────── Method: AI (experimental) ─────────────────────────── */}
{locMethod === "ai" && (
  <div style={{ margin: "16px 0" }}>
    <button
      onClick={handleGeoAnalyze}
      style={{
        backgroundColor: "purple",
        color: "#fff",
        border: "none",
        padding: "6px 12px",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Acquire Location with AI
    </button>
    {gpsTimer > 0 && <span className="timer">{gpsTimer}s</span>}
  </div>
)}

{/* ──────────────── Preview + Clear buttons (unchanged) ──────────────────── */}
<textarea
  value={
    [
      buildLocationDescription(),
      positionReport,
      nearestLandmarkReport,
    ]
      .filter(Boolean)
      .join(". ")
  }
  readOnly
  className="input"
  style={{ background: "#f8f8f8", color: "#222", marginTop: 8 }}
/>
<button onClick={clearLocationFields}>Clear Location Fields</button>

            {/* Build Additional Comments */}
            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Build Additional Comments
            </div>
            
        {activeScreen === "main" && (
          <>

        {/* Instrument note buttons */}
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <button onClick={() => setInstrumentNote(makeInstrumentNote("UR"))}>
            UR
          </button>
          <button onClick={() => setInstrumentNote(makeInstrumentNote("Gastec"))}>
            Gastec
          </button>
        </div>


        {/* ===== SECTION 22B: Phrase Quick-Add ===== */}
        <div style={{ marginTop: 16 }}>
          <select
            onChange={(e) => {
              if (e.target.value) togglePhrase(e.target.value);
              e.target.selectedIndex = 0;
            }}
            className="input"
            style={{ marginBottom: 12 }}
          >
            <option value="">Select phrase to add</option>
            {[...savedPhrases]
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((p) => (
                <option key={p.id} value={p.content}>
                  {p.title}
                </option>
              ))}
          </select>
        </div>
          
          </>
        )}

            <div>
              <label>📷 Upload Scene Photo</label>
              <br />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setSceneImage)}
                className="input"
              />
              {sceneImage && (
                <button onClick={handleSceneAnalyze}>Analyze Photo with AI</button>
              )}
            </div>


        {/* ===== SECTION 22C: Final Data, Copy Buttons etc (Main only) ===== */}
        {activeScreen === "main" && (
          <>
            <textarea
              placeholder="Manual notes (e.g. 'crew is trenching 50 ft north of me')"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              style={{ height: 100 }}
            />

            {/* Wind / weather */}
            <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
              {/* --- Wind Intensity FIRST --- */}
              <div>
                <label>Wind Intensity</label>
                <br />
            <select
              value={windIntensity}
              onChange={(e) => setWindIntensity(e.target.value)}
              className="input"
            >
              <option value="">--</option>
              {["no wind", "light", "moderate", "strong"].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
              </div>


              {/* --- Wind From second --- */}
              <div>
                <label>Wind from</label>
                <br />
                <select
                  value={windDir}
                  onChange={(e) => setWindDir(e.target.value)}
                  className="input"
                  disabled={windIntensity === "no wind"}   
                >
                  <option value="">--</option>
                  {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>

              {/* --- Weather unchanged --- */}
              <div>
                <label>Weather</label>
                <br />
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="input"
                >
                  <option value="">--</option>
                  {["Clear", "Rain", "Fog", "Snow", "Dust"].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>


<button
  onClick={handleWindRelative}
  title="Wind relative to incident"
  style={{
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3182ce",  // Vercel blue
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    marginLeft: "8px",
    padding: 0,
    alignSelf: "center",
  }}
>
  🧭
</button>





            </div>  

            {/* ——— Wind » Incident site ——— */}


            
        



            <textarea
              value={additionalComments}
              readOnly
              className="input"
              style={{ background: "#f8f8f8", color: "#222", marginTop: 8 }}
            />

            <button onClick={clearCommentsFields}>Clear Comment Fields</button>

            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Final Data for MDS
            </div>



            <div style={{ marginTop: 10 }}>
              
            <label>
              <strong>Location Description</strong>
            </label>
            <textarea
              value={
                [
                  buildLocationDescription(),
                  positionReport,
                  nearestLandmarkReport
                ]
                  .filter(Boolean)
                  .join(". ")
              }
              readOnly
              className="input"
              style={{ background: "#f8f8f8", color: "#222" }}
            />
            <button
              onClick={() =>
                copyToClipboard(
                  [
                    buildLocationDescription(),
                    positionReport,
                    nearestLandmarkReport
                  ]
                    .filter(Boolean)
                    .join(". ")
                )
              }
            >
              Copy
            </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>
                <strong>Additional Comments</strong>
              </label>
              <textarea
                value={additionalComments}
                readOnly
                className="input"
                style={{ background: "#f8f8f8", color: "#222" }}
              />
              <button onClick={() => copyToClipboard(additionalComments)}>
                Copy
              </button>
            </div>
          </>
        )}

          </>  
        )}   



                {/* ===== Guide Screen ===== */}
        {activeScreen === "guide" && (
          <>
            <h1>Guides</h1>

            {/* Top‑bar mode buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setGuideMode("view")}
                style={{ backgroundColor: guideMode === "view" ? "#ccc" : "" }}
              >
                View Guide
              </button>
              <button
                onClick={() => setGuideMode("create")}
                style={{ backgroundColor: guideMode === "create" ? "#ccc" : "" }}
              >
                Create Guide
              </button>
              <button
                onClick={() => setGuideMode("edit")}
                style={{ backgroundColor: guideMode === "edit" ? "#ccc" : "" }}
              >
                Edit Guide
              </button>
              <button
                onClick={() => setGuideMode("delete")}
                style={{ backgroundColor: guideMode === "delete" ? "#ccc" : "" }}
              >
                Delete Guide
              </button>
            </div>

            {/* --- Mode‑specific placeholders (to be fleshed out) --- */}
            {guideMode === "view" && (
              <>
                {/* --- Guide picker --- */}
                <div style={{ marginBottom: 16 }}>
                  <select
                    className="input"
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    style={{ width: "100%", maxWidth: 400 }}
                  >
                    <option value="">Select a guide…</option>

                    {[...guides]
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </div>



          {/* --- Selected guide display --- */}
          {(() => {
            const guide = guides.find((g) => g.id === selectedGuideId);
            if (!guide) return null;
            if (!guide.items?.length)
              return <p style={{ fontStyle: "italic" }}>Guide is empty.</p>;

            return (
              <div style={{ border: "1px solid #ddd", padding: 12 }}>
                {guide.items.map((item, i) =>
                  item.type === "section" ? (
                    // ── Section heading ───────────────────────────────────────────
                    <h3 key={i} style={{ margin: "12px 0 6px" }}>
                      {item.heading}
                    </h3>
                  ) : item.type === "image" ? (
                    // ── Image item ────────────────────────────────────────────────
                    <div key={i} style={{ margin: "8px 0" }}>
                      <img
                        src={item.src}
                        alt=""
                        style={{ maxWidth: "100%", border: "1px solid #ccc" }}
                      />
                      {item.caption && (
                        <div style={{ fontStyle: "italic" }}>{item.caption}</div>
                      )}
                    </div>
                  ) : (
                    // ── Text entry item ───────────────────────────────────────────
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        margin: "4px 0",
                      }}
                    >
                      <span style={{ flex: "1 1 auto" }}>
                        <strong>{item.fieldName}</strong>: {item.fieldValue}
                        {item.comment && ` — ${item.comment}`}
                      </span>
                      <button onClick={() => copyToClipboard(item.fieldValue)}>
                        Copy
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })()}
              </>
            )}

            {guideMode === "edit" && (
            <>
              {/* --- Choose guide to edit --- */}
              {selectedGuideId === "" && (
                <div style={{ marginBottom: 16 }}>

                  <select
                    className="input"
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    style={{ width: "100%", maxWidth: 400 }}
                  >
                    <option value="">Select a guide…</option>

                    {[...guides]
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* --- Builder UI re-used once a guide is chosen --- */}
              {selectedGuideId && (
                <>
                  {/* ---- Title ---- */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      className="input"
                      placeholder="Guide title"
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* ---- Add buttons ---- */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <button onClick={() => setBuilderAddMode("section")}>
                      Create Section
                    </button>
                    <button onClick={() => setBuilderAddMode("entry")}>
                      Create Entry
                    </button>
                    <button onClick={() => setBuilderAddMode("image")}>Create Image</button>
                  </div>

                  {/* ---- Conditional add forms (same as in Create mode) ---- */}
                  {builderAddMode === "section" && (
                    <div
                      style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}
                    >
                      <h4>New Section</h4>
                      <input
                        className="input"
                        placeholder="Section heading"
                        value={newSectionHeading}
                        onChange={(e) => setNewSectionHeading(e.target.value)}
                        style={{ width: "100%", marginBottom: 8 }}
                      />
                      <button onClick={addSectionHeading}>Submit Section</button>
                    </div>
                  )}

                  {builderAddMode === "entry" && (
                    <div
                      style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}
                    >
                      <h4>New Entry</h4>
                      <input
                        className="input"
                        placeholder="Field name"
                        value={newEntryFieldName}
                        onChange={(e) => setNewEntryFieldName(e.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <input
                        className="input"
                        placeholder="Field value"
                        value={newEntryFieldValue}
                        onChange={(e) => setNewEntryFieldValue(e.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <textarea
                        className="input"
                        placeholder="Comment (optional)"
                        value={newEntryComment}
                        onChange={(e) => setNewEntryComment(e.target.value)}
                        style={{ width: "100%", marginBottom: 8 }}
                      />
                      <button onClick={addEntryItem}>Submit Entry</button>
                    </div>
                  )}

                  {builderAddMode === "image" && (
                    <div style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}>
                      <h4>New Image</h4>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewImageFile(e.target.files[0] || null)}
                        className="input"
                        style={{ marginBottom: 6 }}
                      />
                      <input
                        className="input"
                        placeholder="Caption (optional)"
                        value={newImageCaption}
                        onChange={(e) => setNewImageCaption(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <button onClick={addImageItem} disabled={!newImageFile}>
                        Submit Image
                      </button>
                    </div>
                  )}

                  {/* ---- Preview list with reorder arrows ---- */}
                  {builderItems.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4>Current Items</h4>
                      {builderItems.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          <button onClick={() => moveBuilderItem(i, "up")}>⬆️</button>
                          <button onClick={() => moveBuilderItem(i, "down")}>⬇️</button>
                          <button onClick={() => removeBuilderItem(i)}>🗑️</button>

                          {item.type === "section" ? (
                            <strong>{item.heading}</strong>
                          ) : item.type === "image" ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <img
                                src={item.src}
                                alt=""
                                style={{ width: 60, height: 60, objectFit: "cover", border: "1px solid #ccc" }}
                              />
                              {item.caption && <em>{item.caption}</em>}
                            </span>
                          ) : (
                            <span>
                              {item.fieldName}: {item.fieldValue}
                              {item.comment && ` — ${item.comment}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ---- Save changes ---- */}
                  <button
                    onClick={() => updateGuide(selectedGuideId)}
                    disabled={!builderTitle.trim() || builderItems.length === 0}
                  >
                    Save Changes
                  </button>

                  {/* ---- Cancel editing ---- */}
                  <button
                    onClick={() => {
                      setSelectedGuideId("");
                      setBuilderTitle("");
                      setBuilderItems([]);
                      setBuilderAddMode("");
                    }}
                    style={{ marginLeft: 10 }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

            {guideMode === "create" && (
              <>
                {/* --- Guide title --- */}
                <div style={{ marginBottom: 12 }}>
                  <input
                    className="input"
                    placeholder="Guide title (e.g. Daily Excavation Checklist)"
                    value={builderTitle}
                    onChange={(e) => setBuilderTitle(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                {/* --- Add buttons --- */}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button onClick={() => setBuilderAddMode("section")}>Create Section</button>
                  <button onClick={() => setBuilderAddMode("entry")}>Create Entry</button>
                  <button onClick={() => setBuilderAddMode("image")}>Create Image</button>
                </div>

                {/* --- Conditional add forms --- */}
                {builderAddMode === "section" && (
                  <div style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}>
                    <h4>New Section</h4>
                    <input
                      className="input"
                      placeholder="Section heading"
                      value={newSectionHeading}
                      onChange={(e) => setNewSectionHeading(e.target.value)}
                      style={{ width: "100%", marginBottom: 8 }}
                    />
                    <button onClick={addSectionHeading}>Submit Section</button>
                  </div>
                )}

                {builderAddMode === "entry" && (
                  <div style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}>
                    <h4>New Entry</h4>
                    <input
                      className="input"
                      placeholder="Field name"
                      value={newEntryFieldName}
                      onChange={(e) => setNewEntryFieldName(e.target.value)}
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                    <input
                      className="input"
                      placeholder="Field value"
                      value={newEntryFieldValue}
                      onChange={(e) => setNewEntryFieldValue(e.target.value)}
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                    <textarea
                      className="input"
                      placeholder="Comment (optional)"
                      value={newEntryComment}
                      onChange={(e) => setNewEntryComment(e.target.value)}
                      style={{ width: "100%", marginBottom: 8 }}
                    />
                    <button onClick={addEntryItem}>Submit Entry</button>
                  </div>
                )}

                {builderAddMode === "image" && (
                  <div style={{ marginBottom: 16, border: "1px solid #ccc", padding: 10 }}>
                    <h4>New Image</h4>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewImageFile(e.target.files[0] || null)}
                      className="input"
                      style={{ marginBottom: 6 }}
                    />
                    <input
                      className="input"
                      placeholder="Caption (optional)"
                      value={newImageCaption}
                      onChange={(e) => setNewImageCaption(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <button onClick={addImageItem} disabled={!newImageFile}>
                      Submit Image
                    </button>
                  </div>
                )}


                {/* --- Preview list with reorder arrows --- */}
                {builderItems.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h4>Current Items</h4>
                    {builderItems.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        {/* Up/down arrows */}
                        <button onClick={() => moveBuilderItem(i, "up")}>⬆️</button>
                        <button onClick={() => moveBuilderItem(i, "down")}>⬇️</button>

                        {/* Content preview */}
                        {item.type === "section" ? (
                          <strong>{item.heading}</strong>
                        ) : item.type === "image" ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <img
                              src={item.src}
                              alt=""
                              style={{ width: 60, height: 60, objectFit: "cover", border: "1px solid #ccc" }}
                            />
                            {item.caption && <em>{item.caption}</em>}
                          </span>
                        ) : (
                          <span>
                            {item.fieldName}: {item.fieldValue}
                            {item.comment && ` — ${item.comment}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* --- Final save --- */}
                <button
                  onClick={saveGuide}
                  disabled={!builderTitle.trim() || builderItems.length === 0}
                >
                  Submit Guide
                </button>
              </>
            )}

            {guideMode === "delete" && (
              <>
                {/* --- Delete picker --- */}
                <div style={{ marginBottom: 16 }}>
                  <select
                    className="input"
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    style={{ width: "100%", maxWidth: 400 }}
                  >
                    <option value="">Select a guide…</option>

                    {[...guides]
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  disabled={!selectedGuideToDeleteId}
                  onClick={() => {
                    const guide = guides.find((g) => g.id === selectedGuideToDeleteId);
                    if (
                      !guide ||
                      !window.confirm(`Delete guide “${guide.title}” permanently?`)
                    )
                      return;
                    deleteGuide(selectedGuideToDeleteId);
                    setSelectedGuideToDeleteId("");
                    // If you’re viewing the same guide, clear that too
                    if (selectedGuideId === guide.id) setSelectedGuideId("");
                  }}
                  style={{ background: "#d33", color: "#fff" }}
                >
                  Delete Selected Guide
                </button>
              </>
            )}
          </>
        )}

        {activeScreen === "settings" && (
          <>
            <h1>Settings</h1>
            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Incident Site
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label><strong>Incident Coordinates</strong></label>
              <input
                type="text"
                placeholder="43.5844120, -116.1939362"
                value={incidentCoords}
                onChange={(e) =>
                  setIncidentCoords(e.target.value.replace(/['"]/g, ""))
                }
                className="input"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <button onClick={handleSaveIncidentCoords}>
                Save Incident Site
              </button>
            </div>

            {/* ==== SECTION: Landmarks List & Editor ==== */}
            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Landmarks
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* — Existing landmarks — */}
{landmarks.map((lm) => (
  <div
    key={lm.id}
    className="landmark-card"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      marginBottom: "4px",
    }}
  >
    {/* Description */}
    <span>{lm.description}</span>

    {/* Action buttons */}
    <div style={{ display: "flex", gap: "8px" }}>
      {/* Delete */}
      <button
        onClick={() => deleteLandmark(lm.id)}
        style={{
          background: "#e53e3e",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        title="Delete landmark"
      >
        ✕
      </button>

      {/* Map view */}
      <button
        onClick={() =>
          window.open(
            `https://www.google.com/maps?q=${lm.lat},${lm.lon}`,
            "_blank"
          )
        }
        style={{
          background: "#3182ce",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        title="View on map"
      >
        📍
      </button>
    </div>
  </div>
))}

              <hr className="landmark-divider" />
              {/* — Add new landmark — */}
              
<div
  className="landmark-add-row"
  style={{ display: "flex", flexDirection: "column", gap: 8 }}
>
  {/* Header for the add form */}
  <div style={{ fontWeight: "bold", fontSize: "1.1em" }}>
    Add Landmark
  </div>

  {/* Description field */}
  <input
    type="text"
    className="input"
    placeholder="Description"
    value={newLandmarkDesc}
    onChange={(e) => setNewLandmarkDesc(e.target.value)}
  />

  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    {/* Map picker */}
{/* — Pick on map button — */}
<button onClick={() => setIsPickingLandmark(true)}>
  Pick on Map
</button>

{/* — Show picked coords as soon as they arrive — */}
{newLandmarkCoords && (
  <input
    type="text"
    className="input"
    readOnly
    value={newLandmarkCoords}
    style={{ marginTop: 8 }}
  />
)}

    {/* Add button (only enabled when you have both fields) */}
    <button
      onClick={() => {
        const [latStr = "", lonStr = ""] = newLandmarkCoords.split(",");
        addLandmark(
          newLandmarkDesc,
          parseFloat(latStr.trim()),
          parseFloat(lonStr.trim())
        );
        setNewLandmarkDesc("");
        setNewLandmarkCoords("");
        setManualEntryMode(false);
      }}
      disabled={!newLandmarkDesc.trim() || !newLandmarkCoords.trim()}
    >
      Add
    </button>
  </div>
</div>
            </div>
            {/* ==== end Landmarks Section ==== */}

            {/* ==== SECTION: Instruments ==== */}
            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Instruments
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* — Existing instruments — */}
              {instruments.map((ins) => (
               
            <div key={ins.id} className="instrument-card">
                {/* Row 1: Abbr + Barcode */}
                <div className="instr-row">
                  <select
                    className="input"
                    style={{ flex: 1 }}
                    value={editInstruments[ins.id]?.abbr ?? ins.abbr}
                    onChange={(e) =>
                      setEditInstruments((p) => ({
                        ...p,
                        [ins.id]: { ...p[ins.id], abbr: e.target.value },
                      }))
                    }
                  >
                    <option value="">Select abbreviation</option>
                    {["UR","MR","AR","Gastec","Horiba","Minican","Other"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                      <input
                  className="input"
                  style={{ flex: 2 }}
                  value={editInstruments[ins.id]?.barcode ?? ins.barcode}
                  onChange={(e) =>
                    setEditInstruments((p) => ({
                      ...p,
                      [ins.id]: { ...p[ins.id], barcode: e.target.value },
                    }))
                  }
                />
              </div>

              {/* --- Row 2: Batch/QC + Exp date ------------------------------ */}
              <div className="instr-row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Batch / QC"
                  value={editInstruments[ins.id]?.batch ?? ins.batch}
                  onChange={(e) =>
                    setEditInstruments((p) => ({
                      ...p,
                      [ins.id]: { ...p[ins.id], batch: e.target.value },
                    }))
                  }
                />
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Exp date"
                  value={editInstruments[ins.id]?.exp ?? ins.exp}
                  onChange={(e) =>
                    setEditInstruments((p) => ({
                      ...p,
                      [ins.id]: { ...p[ins.id], exp: e.target.value },
                    }))
                  }
                />
              </div>

              {/* --- Row 3: Action buttons ----------------------------------- */}
              <div className="instr-row actions">
                <button onClick={() => copyInstrumentBarcode(ins.barcode)}>Copy</button>
                <button
                  onClick={() => {
                    const buf = editInstruments[ins.id] || {};
                    updateInstrument(
                      ins.id,
                      buf.abbr ?? ins.abbr,
                      buf.barcode ?? ins.barcode,
                      buf.batch ?? ins.batch,
                      buf.exp ?? ins.exp
                    );
                  }}
                  style={{ background: "#3182ce", color: "#fff" }}
                >
                  Save
                </button>
                <button
                  onClick={() => deleteInstrument(ins.id)}
                  style={{ background: "#e53e3e", color: "#fff" }}
                >
                  🗑️
                </button>
              </div>
            </div>
                          ))}

            {/* — Add new instrument — */}
            <hr className="landmark-divider" />

            <div className="instrument-card">
              {/* Row 1: abbreviation + barcode */}
            <div className="instr-row">
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={newInstrAbbr}
                  onChange={(e) => setNewInstrAbbr(e.target.value)}
                >
                  <option value="">Select abbreviation</option>
                  {["UR","MR","AR","Gastec","Horiba","Minican","Other"].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>                <input
                  className="input"
                  style={{ flex: 2 }}
                  placeholder="Barcode"
                  value={newInstrBarcode}
                  onChange={(e) => setNewInstrBarcode(e.target.value)}
                />
              </div>

              {/* Row 2: batch/QC + exp date */}
              <div className="instr-row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Batch / QC"
                  value={newInstrBatch}
                  onChange={(e) => setNewInstrBatch(e.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Exp date"
                  value={newInstrExp}
                  onChange={(e) => setNewInstrExp(e.target.value)}
                />
              </div>

              {/* Row 3: Add button */}
              <div className="instr-row actions">
                <button
                  onClick={() => {
                    addInstrument(newInstrAbbr, newInstrBarcode, newInstrBatch, newInstrExp);
                    setNewInstrAbbr("");
                    setNewInstrBarcode("");
                    setNewInstrBatch("");
                    setNewInstrExp("");
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            </div>



            {/* ==== SECTION: Situation Assessment ==== */}
            <div
              className="section-header"
              style={{
                background: "#333",
                color: "#fff",
                padding: "8px 12px",
                margin: "16px 0",
              }}
            >
              Quick phrases
            </div>

            {/* --- Mode toggle --- */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setPhraseMode("add")}
                style={{ backgroundColor: phraseMode === "add" ? "#ddd" : "#f0f0f0" }}
              >
                Add Phrase
              </button>
              <button
                onClick={() => setPhraseMode("delete")}
                style={{ backgroundColor: phraseMode === "delete" ? "#ddd" : "#f0f0f0" }}
              >
                Delete Phrase
              </button>
            </div>

            {/* --- Add form --- */}
            {phraseMode === "add" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Phrase Title"
                  value={newPhraseTitle}
                  onChange={(e) => setNewPhraseTitle(e.target.value)}
                />
                <textarea
                  className="input"
                  placeholder="Phrase Content"
                  value={newPhraseContent}
                  onChange={(e) => setNewPhraseContent(e.target.value)}
                />
                <button onClick={addPhrase}>Save New Phrase</button>
              </div>
            )}

            {/* --- Delete form --- */}
            {phraseMode === "delete" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <select
                  className="input"
                  value={newPhraseTitle}
                  onChange={(e) => setNewPhraseTitle(e.target.value)}
                >
                  <option value="">Select phrase to delete</option>
                  {savedPhrases.map((p) => (
                    <option key={p.id} value={p.title}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const idx = savedPhrases.findIndex((p) => p.title === newPhraseTitle);
                    if (idx !== -1) removePhrase(idx);
                    setNewPhraseTitle("");
                  }}
                >
                  Delete Selected Phrase
                </button>
              </div>
            )}


          </>
        )}


{/* ==== SECTION: GPS Accuracy Wait ==== */}
<div
  className="section-header"
  style={{
    background: "#333",
    color: "#fff",
    padding: "8px 12px",
    margin: "16px 0",
  }}
>
  GPS Accuracy Wait
</div>

{/* Slider + label */}
<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
  <label style={{ fontWeight: "bold" }}>
    Wait up to {gpsWaitSec} s for high-accuracy fix
  </label>
  <input
    type="range"
    min="5"
    max="20"
    step="5"
    value={gpsWaitSec}
    onChange={(e) => setGpsWaitSec(Number(e.target.value))}
    style={{ width: "100%", maxWidth: 400 }}
  />
</div>

{/* Save button, below the slider */}
<div style={{ marginTop: 16 }}>
  <button
    onClick={saveGpsWaitSec}
    style={{
      background: "#3182ce",
      color: "#fff",
      border: "none",
      padding: "8px 16px",
      borderRadius: 4,
      cursor: "pointer",
    }}
  >
    Save GPS Wait
  </button>
</div>



      </div>
      {/* ===== END container  ===== */}
    </>
  ); // end return
} // end App()

export default App;
