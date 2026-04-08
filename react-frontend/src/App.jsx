import { useEffect, useState } from "react";
import "./index.css";

// Updated with your actual credentials from the screenshot
const FIREBASE_PROJECT_ID = "facebook-friends-app"; 
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

async function fetchFriendsFromFirebase() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/friendslists/mylist?key=${FIREBASE_API_KEY}`;
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
    fetchFriendsFromFirebase()
      .then(data => {
        if (data.length === 0) {
          setError("No friends yet! Use the extension on Facebook first.");
        }
        setFriends(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load friends. Please try again.");
        setLoading(false);
      });
  }, []);

  const filtered = friends.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="center">
        <p>⏳ Loading your friends...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>👥 Your Facebook Friends</h1>

      {error ? (
        <div className="error-box">
          <p>{error}</p>
        </div>
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