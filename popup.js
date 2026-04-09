// popup.js
const readBtn = document.getElementById("readBtn");
const openBtn = document.getElementById("openBtn");
const statusEl = document.getElementById("status");
const counter = document.getElementById("counter");
const friendCount = document.getElementById("friendCount");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");

let progress = 0;
let progressTimer = null;

function startProgressAnimation() {
  progressBar.style.display = "block";
  progress = 0;
  progressTimer = setInterval(() => {
    if (progress < 90) {
      progress += Math.random() * 3;
      progressFill.style.width = progress + "%";
    }
  }, 500);
}

function completeProgress() {
  clearInterval(progressTimer);
  progressFill.style.width = "100%";
  setTimeout(() => {
    progressBar.style.display = "none";
  }, 1000);
}

readBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab.url.includes("facebook.com")) {
    statusEl.textContent = "❌ Please open facebook.com/friends/list!";
    return;
  }

  if (!tab.url.includes("friends")) {
    statusEl.textContent = "⚠️ Go to facebook.com/friends/list first!";
    return;
  }

  readBtn.disabled = true;
  readBtn.textContent = "⏳ Working...";
  counter.style.display = "block";
  openBtn.disabled = true;
  startProgressAnimation();
  statusEl.textContent = "🚀 Starting...";

  chrome.tabs.sendMessage(tab.id, { action: "getFriends" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "❌ Refresh Facebook and try again!";
      readBtn.disabled = false;
      readBtn.textContent = "▶️ Read All Friends";
      completeProgress();
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
    completeProgress();
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