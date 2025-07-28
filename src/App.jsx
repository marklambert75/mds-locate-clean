// === SECTION 01: Imports & App Setup =======================================
import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,   // ← new
  doc,
} from "firebase/firestore";

function App() {
  // === SECTION 02: State – Screen & Core Fields =============================
  const [activeScreen, setActiveScreen] = useState("main"); // "main" or "guide"

  const [sceneImage, setSceneImage] = useState(null);
  const [windDir, setWindDir] = useState("");
  const [windIntensity, setWindIntensity] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [aiComments, setAiComments] = useState("");
  const [geoLocationComment, setGeoLocationComment] = useState("");
  const [landmarkImage, setLandmarkImage] = useState(null);

  // === SECTION 03: State – Phrase Manager ==================================
  const [savedPhrases, setSavedPhrases] = useState([]);
  const [selectedPhrases, setSelectedPhrases] = useState([]);
  const [newPhraseTitle, setNewPhraseTitle] = useState("");
  const [newPhraseContent, setNewPhraseContent] = useState("");
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [phraseMode, setPhraseMode] = useState("add"); // "add" or "delete"

  // === Guide State ===================================================
  const [guideMode, setGuideMode] = useState("view"); // "view" | "create" | "delete"
  const [guides, setGuides] = useState([]);           // all guides from Firestore
  const [selectedGuideId, setSelectedGuideId] = useState(""); // ID chosen in View/Delete
  const [selectedGuideToDeleteId, setSelectedGuideToDeleteId] = useState("");
  const [builderAddMode, setBuilderAddMode] = useState(""); // "" | "section" | "entry"

  // --- Builder (Create Guide) ---
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderItems, setBuilderItems] = useState([]); // [{type:"section"| "entry", ...}]
  // temp fields while adding items
  const [newSectionHeading, setNewSectionHeading] = useState("");
  const [newEntryFieldName, setNewEntryFieldName] = useState("");
  const [newEntryFieldValue, setNewEntryFieldValue] = useState("");
  const [newEntryComment, setNewEntryComment] = useState("");


  // === SECTION 04: CRUD Helpers – Phrases ===================================
  const loadPhrases = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "phrases"));
      const phrases = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSavedPhrases(phrases);
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

  /* --- Guide helpers ------------------------------------------------ */
  const loadGuides = async () => {
    try {
      const snap = await getDocs(collection(db, "guides"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGuides(list);
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
      // reset builder state
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
    // Optionally reset builder state or switch modes:
    // setGuideMode("view");
    // setBuilderTitle("");
    // setBuilderItems([]);
    // setSelectedGuideId("");
  } catch (err) {
    console.error("Error updating guide:", err);
  }
};


  // === SECTION 05: Effect – Load Saved Phrases on Mount =====================
  useEffect(() => {
    loadPhrases();
  }, []);

  // Load guides once on mount
  useEffect(() => {
    loadGuides();
  }, []);

    // Pre-fill builder when a guide is selected in Edit mode
  useEffect(() => {
    if (guideMode !== "edit") return;
    const g = guides.find((gg) => gg.id === selectedGuideId);
    if (g) {
      setBuilderTitle(g.title || "");
      setBuilderItems(g.items || []);
    } else {
      setBuilderTitle("");
      setBuilderItems([]);
    }
    setBuilderAddMode(""); // reset add-mode whenever selection changes
  }, [guideMode, selectedGuideId, guides]);

  // === SECTION 06: State – Location Builder =================================
  const [distanceTotal, setDistanceTotal] = useState(0);
  const [directionFromLandmark, setDirectionFromLandmark] = useState("");
  const [locationType, setLocationType] = useState("");
  const [cornerDirection, setCornerDirection] = useState("");
  const [edgeDirection, setEdgeDirection] = useState("");
  const [landmark1, setLandmark1] = useState("");
  const [landmark2, setLandmark2] = useState("");

  // === SECTION 07: Helpers – Geolocation Storage & Retrieval ===============
  const handleAttachToLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await addDoc(collection(db, "locations"), {
            lat: latitude,
            lon: longitude,
            locationDesc: buildLocationDescription(),
            additionalComments,
            timestamp: Date.now(),
          });
          alert("Fields attached to current location.");
        } catch (err) {
          console.error("Error saving location:", err);
          alert("Failed to attach location.");
        }
      },
      () => {
        alert("Could not get location.");
      }
    );
  };

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

        const distance = (a, b) => {
          const toRad = (x) => (x * Math.PI) / 180;
          const R = 6371e3;
          const φ1 = toRad(a.lat);
          const φ2 = toRad(b.lat);
          const Δφ = toRad(b.lat - a.lat);
          const Δλ = toRad(b.lon - a.lon);
          const aVal =
            Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
          return R * c;
        };

        let closest = null;
        let minDist = Infinity;

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

  // === SECTION 08: Helpers – Image Upload & AI Calls ========================
  const handleImageUpload = (e, setImage) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
You are provided with a site image.

Your task is to describe what is visibly happening using short factual phrases.

Focus only on primary objects and immediate terrain (e.g. vehicles, equipment, workers, ground conditions).

Ignore background elements such as trees, buildings, or distant scenery.

Do NOT infer weather or wind — those are handled separately in the app.

Do NOT narrate or speculate. Just describe what is directly visible in the image.

Format example: "Excavator on site. Workers in high-vis. Pile of piping near trench."`,
          },
          ...(sceneImage
            ? [{ type: "image_url", image_url: { url: sceneImage } }]
            : []),
        ],
      },
    ];

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
      const content = data.choices?.[0]?.message?.content || "No response";
      setAiComments(content.trim());
    } catch (err) {
      setAiComments("Error: " + err.message);
    }
  };

  const handleAnalyzeLandmarkImage = async () => {
    if (!landmarkImage) return;

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
You are provided with a photo showing a single landmark such as a utility pole, sign, or gate marker.

Your task is to:
- Identify the type of object (e.g., utility pole, gate marker, sign)
- Include any visible ID or label on it
- Return both as a single short phrase

Examples:
- "Utility pole 79557B"
- "Sign: No Trespassing"
- "Gate marker 3A"

Do not describe surroundings or speculate. Only report what is clearly visible on the object itself.`,
          },
          { type: "image_url", image_url: { url: landmarkImage } },
        ],
      },
    ];

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
      const content = data.choices?.[0]?.message?.content || "";
      if (content) setLandmark1(content.trim());
    } catch (err) {
      alert("Error analyzing image: " + err.message);
    }
  };

  // === SECTION 09: Helpers – Reverse Geocode & AI Location ==================
  const handleGeoAnalyze = () => {
    if (!navigator.geolocation) {
      setLocationDesc("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const displayName = data.display_name || "Unknown location";

          const prompt = `
You are generating short, clear field location descriptions based on GPS data.

Using the address below, return a short phrase describing the location. Prioritize:
- Named places (e.g. parks, businesses, buildings)
- Visible address numbers (e.g. 2023 S Crystal Way)
- Corners or edges if the place is large (e.g. Ivy Green Park (N corner))

Avoid guessing intersections unless they are the clearest visible reference.

Only return the formatted sentence — no commentary or extra data.

Address:
"${displayName}"
          `.trim();

          const aiRes = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
              }),
            }
          );

          const aiData = await aiRes.json();
          const aiReplyRaw = aiData.choices?.[0]?.message?.content?.trim();
          const aiReply = aiReplyRaw?.replace(/^["']|["']$/g, "");

          if (aiReply) {
            setLocationDesc((prev) => (prev ? `${prev}. ${aiReply}` : aiReply));
          } else {
            setLocationDesc((prev) =>
              prev ? `${prev}. Near ${displayName}` : `Near ${displayName}`
            );
          }
        } catch (error) {
          setLocationDesc("Unable to fetch location details.");
        }
      },
      () => {
        setLocationDesc("Permission denied or unavailable.");
      }
    );
  };

  // === SECTION 10: Helpers – Reset & Misc Utility ===========================
  const clearLocationFields = () => {
    setDistanceTotal(0);
    setDirectionFromLandmark("");
    setLocationType("");
    setCornerDirection("");
    setEdgeDirection("");
    setLandmark1("");
    setLandmark2("");
    setLocationDesc("");
  };

  const clearCommentsFields = () => {
    setSceneImage(null);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = "";
    setWindDir("");
    setWindIntensity("");
    setWeather("");
    setNotes("");
    setAdditionalComments("");
    setAiComments("");
    setSelectedPhrases([]);
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

    /* --- Guide-builder helpers --------------------------------------- */
  const addSectionHeading = () => {
    if (!newSectionHeading.trim()) return;
    setBuilderItems((items) => [
      ...items,
      { type: "section", heading: newSectionHeading.trim() },
    ]);
    setNewSectionHeading("");
    setBuilderAddMode("");
  };

  const addEntryItem = () => {
    if (!newEntryFieldName.trim() || !newEntryFieldValue.trim()) return;
    setBuilderItems((items) => [
      ...items,
      {
        type: "entry",
        fieldName: newEntryFieldName.trim(),
        fieldValue: newEntryFieldValue.trim(),
        comment: newEntryComment.trim(),
      },
    ]);
    setNewEntryFieldName("");
    setNewEntryFieldValue("");
    setNewEntryComment("");
    setBuilderAddMode("");
  };

  const moveBuilderItem = (index, dir) => {
    setBuilderItems((items) => {
      const newIdx = dir === "up" ? index - 1 : index + 1;
      if (newIdx < 0 || newIdx >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(index, 1);
      copy.splice(newIdx, 0, moved);
      return copy;
    });
  };

    // Remove an item by index
    const removeBuilderItem = (index) =>
      setBuilderItems((items) => items.filter((_, i) => i !== index));


  const buildLocationDescription = () => {
    if (!locationType || !directionFromLandmark) return locationDesc || "";
    let base = "";
    switch (locationType) {
      case "corner":
        base =
          cornerDirection && landmark1
            ? `~${distanceTotal} feet ${directionFromLandmark} of ${cornerDirection} corner of ${landmark1}`
            : "";
        break;
      case "edge":
        base =
          edgeDirection && landmark1
            ? `~${distanceTotal} feet ${directionFromLandmark} of ${edgeDirection} edge of ${landmark1}`
            : "";
        break;
      case "intersection":
        base =
          landmark1 && landmark2
            ? `~${distanceTotal} feet ${directionFromLandmark} of intersection of ${landmark1} and ${landmark2}`
            : "";
        break;
      case "landmark":
        base = landmark1
          ? `~${distanceTotal} feet ${directionFromLandmark} of ${landmark1}`
          : "";
        break;
      default:
        base = "";
    }
    return locationDesc ? `${base}. ${locationDesc}` : base;
  };

  // === SECTION 11: Helpers – Weather & Additional‑Comments Builder ==========
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  const weatherDescription = (value) => {
    switch (value.toLowerCase()) {
      case "clear":
        return "Clear skies";
      case "rain":
        return "Rainy";
      case "fog":
        return "Foggy";
      case "snow":
        return "Snowy";
      case "dust":
        return "Dusty";
      default:
        return value;
    }
  };

  const buildAdditionalComments = () => {
    const parts = [];
    if (windIntensity && windDir)
      parts.push(`${capitalize(windIntensity)} wind from ${windDir}`);
    if (weather) parts.push(weatherDescription(weather));
    if (notes) parts.push(notes);
    if (aiComments) parts.push(aiComments);
    if (geoLocationComment) parts.push(geoLocationComment);
    parts.push(...selectedPhrases);
    return parts
      .filter(Boolean)
      .map((str) => str.trim().replace(/\.+$/, ""))
      .join(". ");
  };

  useEffect(() => {
    setAdditionalComments(buildAdditionalComments());
  }, [
    windDir,
    windIntensity,
    weather,
    notes,
    aiComments,
    geoLocationComment,
    selectedPhrases,
  ]);

  // === SECTION 12: RENDER ===================================================
  return (
    <>
      {/* ===== SECTION 12A: Main Container ===== */}
      <div className="container">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setActiveScreen("main")}>Main</button>
          <button onClick={() => setActiveScreen("guide")}>Guide</button>
        </div>

        {activeScreen === "main" && (
          <>
            <h1>MDS Assist</h1>

            {/* Build Location Description */}
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

            {/* Distance, direction & landmark controls */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ margin: "4px 0 8px 0" }}>
                Select distance in feet (values cumulate)
              </div>
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <button key={n} onClick={() => setDistanceTotal(distanceTotal + n)}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 8 }}>
                Total est distance: ~{distanceTotal} feet
              </div>

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

              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
              >
                {[
                  { label: "Corner of", value: "corner" },
                  { label: "Edge of", value: "edge" },
                  { label: "Intersection of", value: "intersection" },
                  { label: "Landmark only", value: "landmark" },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setLocationType(value)}
                    style={{ backgroundColor: locationType === value ? "#ccc" : "" }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Dynamic inputs based on locationType */}
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
                <>
                  <input
                    placeholder="Enter landmark"
                    value={landmark1}
                    onChange={(e) => setLandmark1(e.target.value)}
                    className="input"
                  />

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
                </>
              )}

              <div style={{ marginBottom: 10 }}>
                <button onClick={handleGeoAnalyze}>
                  Analyze Location with AI (experimental)
                </button>
              </div>
              <textarea
                value={buildLocationDescription()}
                readOnly
                className="input"
                style={{ background: "#f8f8f8", color: "#222", marginTop: 8 }}
              />

              <button onClick={clearLocationFields}>Clear Location Fields</button>
            </div>

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
                <button onClick={handleSubmit}>Analyze Photo with AI</button>
              )}
            </div>

            {/* Wind / weather */}
            <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
              <div>
                <label>Wind from</label>
                <br />
                <select
                  value={windDir}
                  onChange={(e) => setWindDir(e.target.value)}
                  className="input"
                >
                  <option value="">--</option>
                  {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Wind Intensity</label>
                <br />
                <select
                  value={windIntensity}
                  onChange={(e) => setWindIntensity(e.target.value)}
                  className="input"
                >
                  <option value="">--</option>
                  {["light", "moderate", "strong"].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

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
            </div>
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
                    {guides.map((g) => (
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
                          <h3 key={i} style={{ margin: "12px 0 6px" }}>
                            {item.heading}
                          </h3>
                        ) : (
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
                    <option value="">Select a guide to edit…</option>
                    {guides.map((g) => (
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
                    value={selectedGuideToDeleteId}
                    onChange={(e) => setSelectedGuideToDeleteId(e.target.value)}
                    style={{ width: "100%", maxWidth: 400 }}
                  >
                    <option value="">Select guide to delete…</option>
                    {guides.map((g) => (
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

        {activeScreen === "main" && (
          <>
            {/* ===== SECTION 12B: Phrase Quick-Add & Manager ===== */}
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
                {savedPhrases.map((p, i) => (
                  <option key={i} value={p.content}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={() => setShowPhraseManager((p) => !p)}
                style={{ margin: "8px 0", fontSize: "0.9em" }}
              >
                {showPhraseManager ? "Hide Phrase Manager" : "Manage Phrases"}
              </button>

              {showPhraseManager && (
                <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 12 }}>
                  {/* …manager forms stay unchanged… */}
                </div>
              )}
            </div>
          </>
        )}


        {/* ===== SECTION 12C: Final Data, Copy Buttons etc (Main only) ===== */}
        {activeScreen === "main" && (
          <>
            <textarea
              placeholder="Manual notes (e.g. 'crew is trenching 50 ft north of me')"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              style={{ height: 100 }}
            />

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

            <div style={{ marginBottom: 10 }}>
              <button onClick={handleAttachToLocation} style={{ marginRight: 10 }}>
                Attach Fields to Location
              </button>
              <button onClick={handleRetrieveFromLocation}>
                Retrieve Fields at Location
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>
                <strong>Location Description</strong>
              </label>
              <textarea
                value={buildLocationDescription()}
                readOnly
                className="input"
                style={{ background: "#f8f8f8", color: "#222" }}
              />
              <button onClick={() => copyToClipboard(buildLocationDescription())}>
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
      </div>
      {/* ===== END container (SECTION 12) ===== */}
    </>
  ); // end return
} // end App()

export default App;
