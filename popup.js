// popup.js
const readBtn = document.getElementById("readBtn");
const openBtn = document.getElementById("openBtn");
const statusEl = document.getElementById("status");
const counter = document.getElementById("counter");
const friendCount = document.getElementById("friendCount");
const spinner = document.getElementById("spinner");

readBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("facebook.com")) {
    statusEl.textContent = "❌ Please open facebook.com/friends/list!";
    return;
  }

  if (!tab.url.includes("friends")) {
    statusEl.textContent = "⚠️ Go to facebook.com/friends/list first!";
    return;
  }

  // Update UI to loading state
  readBtn.disabled = true;
  readBtn.textContent = "⏳ Working...";
  counter.style.display = "block";
  spinner.style.display = "block";
  openBtn.disabled = true;
  statusEl.textContent = "📜 Starting auto-scroll...";

  chrome.tabs.sendMessage(tab.id, { action: "getFriends" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "❌ Error! Refresh Facebook and try again.";
      readBtn.disabled = false;
      readBtn.textContent = "▶️ Read All Friends";
      spinner.style.display = "none";
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
    statusEl.textContent = `Found ${message.count} friends so far...`;
  }

  if (message.action === "updateStatus") {
    statusEl.textContent = message.message;
  }

  if (message.action === "friendsDone") {
    spinner.style.display = "none";
    readBtn.disabled = false;
    readBtn.textContent = "▶️ Read All Friends";
    friendCount.textContent = message.count;

    if (message.error) {
      statusEl.textContent = `⚠️ Error: ${message.error}`;
    } else {
      statusEl.textContent = `✅ All ${message.count} friends saved!`;
      openBtn.disabled = false;
    }
  }
});