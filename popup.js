// popup.js
document.getElementById("readBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("facebook.com")) {
    statusEl.textContent = "❌ Please open Facebook first!";
    return;
  }

  statusEl.textContent = "⏳ Starting...";
  document.getElementById("readBtn").disabled = true;
  document.getElementById("readBtn").textContent = "⏳ Working...";

  chrome.tabs.sendMessage(tab.id, { action: "getFriends" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "❌ Error: Refresh Facebook & try again.";
      document.getElementById("readBtn").disabled = false;
      document.getElementById("readBtn").textContent = "📥 Read Friends from Facebook";
    }
  });
});

// Show live status updates from content.js
chrome.runtime.onMessage.addListener((message) => {
  const statusEl = document.getElementById("status");

  if (message.action === "updateStatus") {
    statusEl.textContent = message.message;
  }

  if (message.action === "friendsDone") {
    document.getElementById("readBtn").disabled = false;
    document.getElementById("readBtn").textContent = "📥 Read Friends from Facebook";

    if (message.error) {
      statusEl.textContent = `⚠️ Error: ${message.error}`;
    } else {
      statusEl.textContent = `✅ Found ${message.count} friends! Click Open App!`;
    }
  }
});

document.getElementById("openBtn").addEventListener("click", () => {
  chrome.storage.local.get(["userId"], (result) => {
    const userId = result.userId || "unknown";
    chrome.tabs.create({
      url: `https://facebook-friends-extension.vercel.app?user=${userId}`
    });
  });
});