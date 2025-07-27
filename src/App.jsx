// === SECTION 1: 
import { useState, useEffect } from "react";

function App() {
  // === State Management ===
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

    // === Phrase Manager State ===
  const [savedPhrases, setSavedPhrases] = useState(() => {
    const stored = localStorage.getItem("mds_phrases");
    return stored ? JSON.parse(stored) : [];
  });
  const [selectedPhrases, setSelectedPhrases] = useState([]);
  const [newPhraseTitle, setNewPhraseTitle] = useState("");
  const [newPhraseContent, setNewPhraseContent] = useState("");
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [phraseMode, setPhraseMode] = useState("add"); // "add" or "delete"


  const addPhrase = () => {
    if (!newPhraseTitle || !newPhraseContent) return;
    setSavedPhrases([...savedPhrases, { title: newPhraseTitle, content: newPhraseContent }]);
    setNewPhraseTitle("");
    setNewPhraseContent("");
  };

  const removePhrase = (index) => {
    setSavedPhrases(savedPhrases.filter((_, i) => i !== index));
  };

  const togglePhrase = (content) => {
    setSelectedPhrases(prev =>
      prev.includes(content) ? prev.filter(p => p !== content) : [...prev, content]
    );
  };

  const editPhrase = (index, newTitle, newContent) => {
    const updated = [...savedPhrases];
    updated[index] = { title: newTitle, content: newContent };
    setSavedPhrases(updated);
  };

  useEffect(() => {
    localStorage.setItem("mds_phrases", JSON.stringify(savedPhrases));
  }, [savedPhrases]);

// === SECTION 2:


  // === Location Builder State ===
  const [distanceTotal, setDistanceTotal] = useState(0);
  const [directionFromLandmark, setDirectionFromLandmark] = useState("");
  const [locationType, setLocationType] = useState("");
  const [cornerDirection, setCornerDirection] = useState("");
  const [edgeDirection, setEdgeDirection] = useState("");
  const [landmark1, setLandmark1] = useState("");
  const [landmark2, setLandmark2] = useState("");

  // === Utility Functions ===
  const handleAttachToLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const stored = JSON.parse(localStorage.getItem("mds_locations") || "[]");
    stored.push({
      lat: latitude,
      lon: longitude,
      locationDesc: buildLocationDescription(),
      additionalComments
    });
    localStorage.setItem("mds_locations", JSON.stringify(stored));
    alert("Fields attached to current location.");
  }, () => {
    alert("Could not get location.");
  });
};

const handleRetrieveFromLocation = () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    const stored = JSON.parse(localStorage.getItem("mds_locations") || "[]");
    if (!stored.length) return alert("No stored locations found.");

    const distance = (a, b) => {
      const toRad = (x) => (x * Math.PI) / 180;
      const R = 6371e3;
      const φ1 = toRad(a.lat);
      const φ2 = toRad(b.lat);
      const Δφ = toRad(b.lat - a.lat);
      const Δλ = toRad(b.lon - a.lon);
      const aVal = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
      return R * c;
    };

    let closest = null;
    let minDist = Infinity;

    for (let entry of stored) {
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
  });
};

// === SECTION 3:

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
          ...(sceneImage ? [{ type: "image_url", image_url: { url: sceneImage } }] : []),
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

Do not describe surroundings or speculate. Only report what is clearly visible on the object itself.
`.trim(),

        },
        {
          type: "image_url",
          image_url: { url: landmarkImage },
        },
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
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (content) setLandmark1(content.trim());
  } catch (err) {
    alert("Error analyzing image: " + err.message);
  }
};

// === SECTION 4:

const handleGeoAnalyze = () => {
  if (!navigator.geolocation) {
    setLocationDesc("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      const displayName = data.display_name || "Unknown location";

      // Step 1: Ask OpenAI to reformat this into a clean field-style location description
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

      const aiData = await aiRes.json();
      const aiReplyRaw = aiData.choices?.[0]?.message?.content?.trim();
      const aiReply = aiReplyRaw?.replace(/^["']|["']$/g, ""); // strip surrounding quotes

      if (aiReply) {
        setLocationDesc(prev => prev ? `${prev}. ${aiReply}` : aiReply);
      } else {
        setLocationDesc(prev => prev ? `${prev}. Near ${displayName}` : `Near ${displayName}`);
      }

    } catch (error) {
      setLocationDesc("Unable to fetch location details.");
    }
  }, () => {
    setLocationDesc("Permission denied or unavailable.");
  });
};


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

  const buildLocationDescription = () => {
    if (!locationType || !directionFromLandmark) return locationDesc || "";
    let base = "";
    switch (locationType) {
      case "corner":
        base = cornerDirection && landmark1 ? `~${distanceTotal} feet ${directionFromLandmark} of ${cornerDirection} corner of ${landmark1}` : "";
        break;
      case "edge":
        base = edgeDirection && landmark1 ? `~${distanceTotal} feet ${directionFromLandmark} of ${edgeDirection} edge of ${landmark1}` : "";
        break;
      case "intersection":
        base = landmark1 && landmark2 ? `~${distanceTotal} feet ${directionFromLandmark} of intersection of ${landmark1} and ${landmark2}` : "";
        break;
      case "landmark":
        base = landmark1 ? `~${distanceTotal} feet ${directionFromLandmark} of ${landmark1}` : "";
        break;
      default:
        base = "";
    }
    return locationDesc ? `${base}. ${locationDesc}` : base;
  };

  // === SECTION 5:

  const buildAdditionalComments = () => {
    const parts = [];
    if (windIntensity && windDir) parts.push(`${capitalize(windIntensity)} wind from ${windDir}`);
    if (weather) parts.push(`${weatherDescription(weather)}`);
    if (notes) parts.push(notes);
    if (aiComments) parts.push(aiComments);
    if (geoLocationComment) parts.push(geoLocationComment);
    parts.push(...selectedPhrases); // include user-selected phrases at the end
    return parts
      .filter(Boolean)
      .map(str => str.trim().replace(/\.+$/, ""))
      .join(". ");
};


  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const weatherDescription = (value) => {
    switch (value.toLowerCase()) {
      case "clear": return "Clear skies";
      case "rain": return "Rainy";
      case "fog": return "Foggy";
      case "snow": return "Snowy";
      case "dust": return "Dusty";
      default: return value;
    }
  };

  useEffect(() => {
  setAdditionalComments(buildAdditionalComments());
}, [windDir, windIntensity, weather, notes, aiComments, geoLocationComment, selectedPhrases]);


  return (
    <div className="container">
<h1>MDS Assist</h1>

      <div className="section-header" style={{ background: "#333", color: "#fff", padding: "8px 12px", margin: "16px 0" }}>
        Build Location Description
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ margin: "4px 0 8px 0" }}>Select distance in feet (values cumulate)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {[5, 10, 20, 50, 100].map((n) => (
            <button key={n} onClick={() => setDistanceTotal(distanceTotal + n)}>{n}</button>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>Total est distance: ~{distanceTotal} feet</div>

        <select value={directionFromLandmark} onChange={(e) => setDirectionFromLandmark(e.target.value)} className="input" style={{ marginBottom: 8 }}>
          <option value="">Direction from landmark</option>
          {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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

        {locationType === "corner" && (
          <>
            <select value={cornerDirection} onChange={(e) => setCornerDirection(e.target.value)} className="input">
              <option value="">Select corner</option>
              {["NE", "NW", "SE", "SW"].map((dir) => (
                <option key={dir} value={dir}>{dir}</option>
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
            <select value={edgeDirection} onChange={(e) => setEdgeDirection(e.target.value)} className="input">
              <option value="">Select edge direction</option>
              {["N", "E", "S", "W"].map((dir) => (
                <option key={dir} value={dir}>{dir}</option>
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
              <label>📷 Upload Landmark Photo</label><br />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setLandmarkImage)}
                className="input"
              />
              <button onClick={handleAnalyzeLandmarkImage} style={{ marginTop: 8 }}>
                Analyze Landmark with AI
              </button>
            </div>
          </>
        )}

        <div style={{ marginBottom: 10 }}>
          <button onClick={handleGeoAnalyze}>Analyze Location with AI (experimental)</button>
        </div>
        <textarea
          value={buildLocationDescription()}
          readOnly
          className="input"
          style={{ background: "#f8f8f8", color: "#222", marginTop: 8 }}
        />

        <button onClick={clearLocationFields}>Clear Location Fields</button>
      </div>

      <div className="section-header" style={{ background: "#333", color: "#fff", padding: "8px 12px", margin: "16px 0" }}>
        Build Additional Comments
      </div>

      <div>
        <label>📷 Upload Scene Photo</label><br />
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setSceneImage)} className="input" />
        {sceneImage && (
          <button onClick={handleSubmit}>Analyze Photo with AI</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <div>
          <label>Wind from</label><br />
          <select value={windDir} onChange={(e) => setWindDir(e.target.value)} className="input">
            <option value="">--</option>
            {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((dir) => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Wind Intensity</label><br />
          <select value={windIntensity} onChange={(e) => setWindIntensity(e.target.value)} className="input">
            <option value="">--</option>
            {["light", "moderate", "strong"].map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Weather</label><br />
          <select value={weather} onChange={(e) => setWeather(e.target.value)} className="input">
            <option value="">--</option>
            {["Clear", "Rain", "Fog", "Snow", "Dust"].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

{/* === SECTION 6:*/}

{/* === Phrase Quick Add Dropdown (always visible) === */}
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
      <option key={i} value={p.content}>{p.title}</option>
    ))}
  </select>
</div>

{/* === Phrase Manager Toggle Section === */}
<div>
  <button
    onClick={() => setShowPhraseManager(p => !p)}
    style={{ margin: "8px 0", fontSize: "0.9em" }}
  >
    {showPhraseManager ? "Hide Phrase Manager" : "Manage Phrases"}
  </button>

  {showPhraseManager && (
    <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 12 }}>
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

      {phraseMode === "add" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="input"
            placeholder="Phrase Title (e.g. 'Drift')"
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

      {phraseMode === "delete" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select
            className="input"
            value={newPhraseTitle}
            onChange={(e) => setNewPhraseTitle(e.target.value)}
          >
            <option value="">Select phrase to delete</option>
            {savedPhrases.map((p, i) => (
              <option key={i} value={p.title}>{p.title}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const index = savedPhrases.findIndex(p => p.title === newPhraseTitle);
              if (index !== -1) removePhrase(index);
              setNewPhraseTitle("");
            }}
          >
            Delete Selected Phrase
          </button>
        </div>
      )}
    </div>
  )}
</div>


{/* === SECTION 7:*/}

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


      <div className="section-header" style={{ background: "#333", color: "#fff", padding: "8px 12px", margin: "16px 0" }}>
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
        <label><strong>Location Description</strong></label>
        <textarea value={buildLocationDescription()} readOnly className="input" style={{ background: "#f8f8f8", color: "#222" }} />
        <button onClick={() => copyToClipboard(buildLocationDescription())}>Copy</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <label><strong>Additional Comments</strong></label>
        <textarea value={additionalComments} readOnly className="input" style={{ background: "#f8f8f8", color: "#222" }} />
        <button onClick={() => copyToClipboard(additionalComments)}>Copy</button>
      </div>
    </div>
  );
}

export default App;
