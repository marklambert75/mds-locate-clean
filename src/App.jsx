import { useState } from "react";

function App() {
  const [pin2Description, setPin2Description] = useState("");
  const [sceneImage, setSceneImage] = useState(null);
  const [mapImage, setMapImage] = useState(null);
  const [windDir, setWindDir] = useState("");
  const [windIntensity, setWindIntensity] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");

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
You are given the following:
- A map image where Pin 1 = user location, Pin 2 = landmark
- A scene image showing current local conditions
- Environmental inputs (wind, weather, manual notes)

Instructions:
1. Use the **map image only** to generate a concise **Location Description** that defines where the user is relative to the landmark. Do not mention "pin 1" or "pin 2" — instead, express the relationship using natural terms, e.g., "~400 feet SW of NE corner of well pad." Use precise sub-features of the landmark if visually available (e.g., corners, edges).
2. Use the **scene image**, wind/weather conditions, and manual notes to generate **Additional Comments**.
   - These comments should be **factual, minimal, and observational**.
   - Avoid narrative phrasing like "the scene shows..." or "there appears to be...".
   - Preferred format: short phrases separated by periods. Ex: "Rainy conditions. Excavator in operation. Moderate wind from N."
   - Do not embellish or speculate. Only include direct, observable information.

Always express wind using qualitative terms (e.g., "light", "moderate", "strong"), not numeric speeds.

Return the result in this format:
Location Description: <just the description>
Additional Comments: <just the comments>

Pin 2 Description: ${pin2Description}
Wind Direction: ${windDir}
Wind Intensity: ${windIntensity}
Weather Condition: ${weather}
Manual Notes: ${notes}
            `,
          },
          ...(mapImage ? [{ type: "image_url", image_url: { url: mapImage } }] : []),
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
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "No response";

      const locMatch = content.match(/Location Description:\s*(.*)/);
      const commentMatch = content.match(/Additional Comments:\s*(.*)/);

      setLocationDesc(locMatch ? locMatch[1].trim() : "");
      setAdditionalComments(commentMatch ? commentMatch[1].trim() : "");
    } catch (err) {
      setLocationDesc("");
      setAdditionalComments("Error: " + err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container">
      <h1>MDS Locate Assist</h1>

      <div>
        <label>📍 Upload Map Image</label><br />
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setMapImage)} className="input" />
      </div>

      <input
        placeholder="What does Pin 2 represent?"
        value={pin2Description}
        onChange={(e) => setPin2Description(e.target.value)}
        className="input"
      />

      <div>
        <label>📷 Upload Scene Photo (optional)</label><br />
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setSceneImage)} className="input" />
      </div>

      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <div>
          <label>Wind from</label><br />
          <select value={windDir} onChange={(e) => setWindDir(e.target.value)} className="input">
            <option value="">--</option>
            <option value="N">N</option>
            <option value="NE">NE</option>
            <option value="E">E</option>
            <option value="SE">SE</option>
            <option value="S">S</option>
            <option value="SW">SW</option>
            <option value="W">W</option>
            <option value="NW">NW</option>
          </select>
        </div>

        <div>
          <label>Wind Intensity</label><br />
          <select value={windIntensity} onChange={(e) => setWindIntensity(e.target.value)} className="input">
            <option value="">--</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="strong">Strong</option>
          </select>
        </div>

        <div>
          <label>Weather</label><br />
          <select value={weather} onChange={(e) => setWeather(e.target.value)} className="input">
            <option value="">--</option>
            <option value="Clear">Clear</option>
            <option value="Rain">Rain</option>
            <option value="Fog">Fog</option>
            <option value="Snow">Snow</option>
            <option value="Dust">Dust</option>
          </select>
        </div>
      </div>

      <textarea
        placeholder="Manual notes (e.g. 'crew is trenching 50 ft north of me')"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="input"
        style={{ height: 100 }}
      />

      <button onClick={handleSubmit} style={{ marginTop: 10 }}>
        Generate
      </button>

      {locationDesc && (
        <div style={{ marginTop: 20 }}>
          <label><strong>Location Description</strong></label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <textarea value={locationDesc} readOnly className="input" style={{ background: "#f8f8f8", color: "#222" }} />
            <button onClick={() => copyToClipboard(locationDesc)}>Copy</button>
          </div>
        </div>
      )}

      {additionalComments && (
        <div style={{ marginTop: 20 }}>
          <label><strong>Additional Comments</strong></label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <textarea value={additionalComments} readOnly className="input" style={{ background: "#f8f8f8", color: "#222" }} />
            <button onClick={() => copyToClipboard(additionalComments)}>Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
