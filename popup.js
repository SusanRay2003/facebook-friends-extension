// popup.js
const readBtn    = document.getElementById("readBtn");
const openBtn    = document.getElementById("openBtn");
const statusEl   = document.getElementById("status");
const counter    = document.getElementById("counter");
const friendCount= document.getElementById("friendCount");
const progressBar= document.getElementById("progressBar");
const tip        = document.getElementById("tip");

readBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({
    active: true, currentWindow: true
  });

  if (!tab.url.includes("facebook.com")) {
    statusEl.textContent = "❌ Open facebook.com/friends/list first!";
    return;
  }

  if (!tab.url.includes("friends")) {
    statusEl.textContent = "⚠️ Go to facebook.com/friends/list!";
    return;
  }

  // Update UI
  readBtn.disabled      = true;
  readBtn.textContent   = "⏳ Fetching...";
  counter.style.display = "block";
  progressBar.style.display = "block";
  tip.style.display     = "block";
  openBtn.disabled      = true;
  statusEl.textContent  = "🚀 Starting...";

  chrome.tabs.sendMessage(tab.id, { action: "getFriends" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent  = "❌ Please refresh Facebook and try again!";
      readBtn.disabled      = false;
      readBtn.textContent   = "▶️ Fetch All Friends";
      progressBar.style.display = "none";
      tip.style.display     = "none";
    }
  });
});

openBtn.addEventListener("click", () => {
  chrome.storage.local.get(["userId"], (result) => {
    const userId = result.userId || "unknown";
    chrome.tabs.create({
      url: `https://facebook-friends-extension.vercel.app?user=${userId}`
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "liveCount") {
    friendCount.textContent = message.count;
  }
  if (message.action === "updateStatus") {
    statusEl.textContent = message.message;
  }
  if (message.action === "friendsDone") {
    progressBar.style.display = "none";
    tip.style.display         = "none";
    readBtn.disabled          = false;
    readBtn.textContent       = "▶️ Fetch All Friends";
    friendCount.textContent   = message.count;

    if (message.error) {
      statusEl.textContent = `⚠️ Partial: got ${message.count} friends`;
      if (message.count > 0) openBtn.disabled = false;
    } else {
      statusEl.textContent = `✅ Done! ${message.count} friends saved!`;
      openBtn.disabled     = false;
    }
  }
});