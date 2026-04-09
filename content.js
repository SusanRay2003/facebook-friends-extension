// content.js

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

let allFriends = new Map();

async function saveToFirebase(friends, userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/friendslists/${userId}?key=${FIREBASE_API_KEY}`;

  const fields = {};
  friends.forEach((f, i) => {
    fields[`friend_${i}`] = {
      mapValue: {
        fields: {
          name: { stringValue: f.name || "" },
          profileUrl: { stringValue: f.profileUrl || "" },
          avatar: { stringValue: f.avatar || "" }
        }
      }
    };
  });

  fields["total"] = { integerValue: friends.length };
  fields["updatedAt"] = { stringValue: new Date().toISOString() };

  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
}

function getUserId() {
  const links = document.querySelectorAll('a[href*="facebook.com/"]');
  for (let link of links) {
    const match = link.href.match(/facebook\.com\/([^/?]+)/);
    if (match && match[1] !== 'friends' && match[1] !== 'list') {
      return match[1];
    }
  }
  return "user_" + Date.now();
}

function scanPageForFriends() {
  const spans = document.querySelectorAll('span[dir="auto"]');
  spans.forEach(span => {
    const name = span.innerText?.trim();
    const link = span.closest('a');
    if (
      name && name.length > 2 && name.length < 60 &&
      !allFriends.has(name) &&
      !/^\d/.test(name) &&
      !name.toLowerCase().includes("friend") &&
      !name.toLowerCase().includes("mutual") &&
      !name.toLowerCase().includes("facebook") &&
      !name.toLowerCase().includes("search") &&
      !name.toLowerCase().includes("home") &&
      link && link.href.includes("facebook.com")
    ) {
      const img = link.querySelector('img') ||
                  link.closest('li')?.querySelector('img');
      allFriends.set(name, {
        name,
        profileUrl: link.href,
        avatar: img?.src || null
      });
    }
  });

  const imgs = document.querySelectorAll('img[alt]');
  imgs.forEach(img => {
    const name = img.getAttribute('alt')?.trim();
    const link = img.closest('a');
    if (
      name && name.length > 2 && name.length < 60 &&
      !allFriends.has(name) &&
      name !== "Facebook" &&
      !name.toLowerCase().includes("cover") &&
      !name.toLowerCase().includes("profile picture") &&
      !name.toLowerCase().includes("image") &&
      !name.toLowerCase().includes("icon") &&
      link && link.href.includes("facebook.com")
    ) {
      allFriends.set(name, {
        name,
        profileUrl: link.href,
        avatar: img.src || null
      });
    }
  });
}

// ✅ THE KEY FIX — Simulate a REAL human scroll event!
function humanScroll() {
  // Random scroll amount like a real person
  const scrollAmount = Math.floor(Math.random() * 300) + 400;

  // Use real wheel event — Facebook can't block this!
  const wheelEvent = new WheelEvent('wheel', {
    deltaY: scrollAmount,
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(wheelEvent);

  // Also use scrollBy as backup
  window.scrollBy({
    top: scrollAmount,
    behavior: 'smooth'
  });
}

// Random delay between scrolls — like a real human pause!
function randomDelay() {
  const min = 1500;
  const max = 2500;
  return Math.floor(Math.random() * (max - min)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll() {
  let lastCount = 0;
  let noChangeAttempts = 0;
  const MAX_NO_CHANGE = 5;

  // Start mutation observer to catch friends as they load
  const observer = new MutationObserver(() => {
    scanPageForFriends();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan
  scanPageForFriends();

  while (true) {
    // Scroll like a human
    humanScroll();

    // Wait random time like a human
    const delay = randomDelay();
    await sleep(delay);

    // Scan for new friends
    scanPageForFriends();

    const currentCount = allFriends.size;

    // Send live count to popup
    chrome.runtime.sendMessage({
      action: "liveCount",
      count: currentCount
    });

    if (currentCount === lastCount) {
      noChangeAttempts++;

      if (noChangeAttempts >= MAX_NO_CHANGE) {
        // Extra long wait to make sure page fully loaded
        await sleep(3000);
        scanPageForFriends();

        // Check one final time
        if (allFriends.size === lastCount) {
          observer.disconnect();
          break;
        }
      }
    } else {
      // New friends found! Reset counter
      noChangeAttempts = 0;
      lastCount = currentCount;
    }
  }

  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(500);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    sendResponse({ started: true });

    allFriends.clear();

    (async () => {
      try {
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "📜 Auto-scrolling... please wait!"
        });

        await autoScroll();

        const friendsList = Array.from(allFriends.values());
        const userId = getUserId();

        chrome.storage.local.set({ friends: friendsList, userId });

        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "☁️ Saving to cloud..."
        });

        await saveToFirebase(friendsList, userId);

        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friendsList.length,
          userId: userId
        });

      } catch (err) {
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: 0,
          error: err.message
        });
      }
    })();

    return true;
  }
});