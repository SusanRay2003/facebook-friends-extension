// popup.js
document.getElementById("readBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "⏳ Auto-scrolling to load all friends...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("facebook.com")) {
    statusEl.textContent = "❌ Please open Facebook first!";
    return;
  }

  // Disable button while working
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

// Listen for when friends are done being collected
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "friendsDone") {
    const statusEl = document.getElementById("status");
    document.getElementById("readBtn").disabled = false;
    document.getElementById("readBtn").textContent = "📥 Read Friends from Facebook";

    if (message.error) {
      statusEl.textContent = `⚠️ Found ${message.count} friends but cloud save failed.`;
    } else {
      statusEl.textContent = `✅ Found ${message.count} friends! View on web app now!`;
    }
  }
});

document.getElementById("openBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://facebook-friends-extension.vercel.app" });
});