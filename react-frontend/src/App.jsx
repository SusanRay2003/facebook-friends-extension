import { useEffect, useState } from "react";
import "./index.css";

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

async function fetchFriendsFromFirebase(userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/friendslists/${userId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.fields) return [];

  const friends = [];
  Object.entries(data.fields).forEach(([key, value]) => {
    if (key.startsWith("friend_") && value.mapValue) {
      const f = value.mapValue.fields;
      friends.push({
        name: f.name?.stringValue || "",
        profileUrl: f.profileUrl?.stringValue || "#",
        avatar: f.avatar?.stringValue || null
      });
    }
  });

  return friends;
}

function App() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Get userId from URL like: vercel.app?user=susan.ray
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");

    // If no userId in URL → show instructions page
    if (!userId) {
      setError("no_user");
      setLoading(false);
      return;
    }

    fetchFriendsFromFirebase(userId)
      .then(data => {
        if (data.length === 0) {
          setError("No friends found! Use the extension on Facebook first.");
        }
        setFriends(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load. Please try again.");
        setLoading(false);
      });
  }, []);

  const filtered = friends.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="center">⏳ Loading your friends...</div>;

  // Show instructions if no user in URL
  if (error === "no_user") {
    return (
      <div className="app">
        <h1>👥 Facebook Friends Reader</h1>
        <div className="instruction-box">
          <h2>👋 Welcome!</h2>
          <p>This app works together with a Chrome Extension.</p>
          <br />
          <h3>📋 How to use:</h3>
          <ol>
            <li>Download and install the Chrome Extension from GitHub</li>
            <li>Open Chrome and go to facebook.com/friends/list</li>
            <li>Click the extension icon in your toolbar</li>
            <li>Click Read Friends from Facebook</li>
            <li>Click Open Friends App</li>
            <li>Your friends will appear here!</li>
          </ol>
          <br />
          
          <a
            href="https://github.com/SusanRay2003/facebook-friends-extension"
            target="_blank"
            rel="noreferrer"
            className="github-btn"
          >
            📦 Download Extension from GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>👥 Your Facebook Friends</h1>

      {error && error !== "no_user" ? (
        <div className="error-box"><p>{error}</p></div>
      ) : (
        <>
          <p className="subtitle">{friends.length} friends found</p>
          <input
            type="text"
            placeholder="Search friends..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search"
          />
          <div className="grid">
            {filtered.map((friend, i) => (
              <a 
                key={i}
                href={friend.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="card"
              >
                <div className="avatar">
                  {friend.avatar
                    ? <img src={friend.avatar} alt={friend.name} />
                    : <span>{friend.name[0]}</span>
                  }
                </div>
                <p className="name">{friend.name}</p>
              </a>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="empty">No friends match your search.</p>
          )}
        </>
      )}
    </div>
  );
}

export default App;