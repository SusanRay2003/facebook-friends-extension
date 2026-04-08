import { useEffect, useState } from "react";
import "./index.css";

function App() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // This now works because the app is served FROM the extension
    chrome.storage.local.get(["friends"], (result) => {
      setFriends(result.friends || []);
      setLoading(false);
    });
  }, []);

  const filtered = friends.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{padding:"2rem"}}>⏳ Loading...</div>;

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
          <p>Go to <strong>facebook.com/friends/list</strong>, scroll down, then click <strong>"Read Friends"</strong> in the extension.</p>
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