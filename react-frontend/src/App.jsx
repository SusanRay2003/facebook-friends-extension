import { useEffect, useState } from "react";
import "./index.css";

function App() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    // Check if running inside Chrome Extension
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      setIsExtension(true);
      chrome.storage.local.get(["friends"], (result) => {
        setFriends(result.friends || []);
        setLoading(false);
      });
    } else {
      // Running on Vercel/browser — show instructions
      setIsExtension(false);
      setLoading(false);
    }
  }, []);

  const filtered = friends.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="center">⏳ Loading...</div>;

  // 👇 This shows when opened from Vercel link
  if (!isExtension) {
    return (
      <div className="app">
        <h1>👥 Facebook Friends Reader</h1>
        <div className="instruction-box">
          <h2>👋 Welcome!</h2>
          <p>This app works together with a Chrome Extension.</p>
          <br/>
          <h3>📋 How to use:</h3>
          <ol>
            <li>Download and install the Chrome Extension from GitHub</li>
            <li>Go to <strong>facebook.com/friends/list</strong></li>
            <li>Click the extension icon</li>
            <li>Click <strong>"Read Friends from Facebook"</strong></li>
            <li>Click <strong>"Open Friends App"</strong></li>
            <li>Your friends will appear here! 🎉</li>
          </ol>
          <br/>
          
            href="https://github.com/YourUsername/facebook-friends-extension"
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

  // 👇 This shows when opened from the Extension
  return (
    <div className="app">
      <h1>👥 Your Facebook Friends</h1>
      <p className="subtitle">{friends.length} friends found</p>

      <input
        type="text"
        placeholder="🔍 Search friends..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="search"
      />

      {friends.length === 0 && (
        <div className="error-box">
          <p>😕 No friends found yet!</p>
          <p>Go to <strong>facebook.com/friends/list</strong> and click Read Friends first!</p>
        </div>
      )}

      <div className="grid">
        {filtered.map((friend, i) => (
          <a key={i} href={friend.profileUrl} target="_blank" rel="noreferrer" className="card">
            <div className="avatar">
              {friend.avatar
                ? <img src={friend.avatar} alt={friend.name} />
                : <span>{friend.name[0]}</span>}
            </div>
            <p className="name">{friend.name}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export default App;