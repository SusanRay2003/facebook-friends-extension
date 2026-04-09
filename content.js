// content.js
const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

let allFriends = new Map();

// ── FIREBASE ──────────────────────────────────────────────────
async function saveToFirebase(friends, userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/friendslists/${userId}?key=${FIREBASE_API_KEY}`;
  const fields = {};
  friends.forEach((f, i) => {
    fields[`friend_${i}`] = {
      mapValue: {
        fields: {
          name:       { stringValue: f.name       || "" },
          profileUrl: { stringValue: f.profileUrl || "" },
          avatar:     { stringValue: f.avatar     || "" }
        }
      }
    };
  });
  fields["total"]     = { integerValue: friends.length };
  fields["updatedAt"] = { stringValue: new Date().toISOString() };
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
}

// ── USER ID ───────────────────────────────────────────────────
function getUserId() {
  const cookieMatch = document.cookie.match(/c_user=(\d+)/);
  if (cookieMatch) return cookieMatch[1];
  const links = document.querySelectorAll('a[href*="facebook.com/"]');
  for (let link of links) {
    const m = link.href.match(/facebook\.com\/([^/?]+)/);
    if (m && !['friends','list','home','messages'].includes(m[1]))
      return m[1];
  }
  return "user_" + Date.now();
}

// ── SCRAPE WHAT'S VISIBLE ON PAGE RIGHT NOW ───────────────────
function scrapeFriendList() {
  // Method 1 — span text + nearest link
  document.querySelectorAll('span[dir="auto"]').forEach(span => {
    const name = span.innerText?.trim();
    const link = span.closest('a');
    if (
      name && name.length > 2 && name.length < 60 &&
      !allFriends.has(name) &&
      !/^\d/.test(name) &&
      !['friend','mutual','facebook','search',
        'home','menu','people','add'].some(w =>
          name.toLowerCase().includes(w)) &&
      link?.href?.includes('facebook.com')
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

  // Method 2 — img alt text
  document.querySelectorAll('img[alt]').forEach(img => {
    const name = img.getAttribute('alt')?.trim();
    const link = img.closest('a');
    if (
      name && name.length > 2 && name.length < 60 &&
      !allFriends.has(name) &&
      !['facebook','cover photo','profile picture',
        'image','icon','photo'].some(w =>
          name.toLowerCase().includes(w)) &&
      link?.href?.includes('facebook.com')
    ) {
      allFriends.set(name, {
        name,
        profileUrl: link.href,
        avatar: img.src || null
      });
    }
  });
}

// ── THE KEY FUNCTION (from the code you shared) ───────────────
async function autoScrollAndCollect() {
  let previousHeight = 0;
  let currentHeight  = document.body.scrollHeight;
  let sameHeightCount = 0;
  const MAX_SAME = 8; // increased from 5 to 8

  const observer = new MutationObserver(() => {
    scrapeFriendList();
    chrome.runtime.sendMessage({
      action: "liveCount",
      count: allFriends.size
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scrapeFriendList();

  console.log("Starting automated scroll and collection...");

  while (sameHeightCount < MAX_SAME) {
    previousHeight = document.body.scrollHeight;

    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);

    // Also scroll any inner scrollable containers Facebook uses
    document.querySelectorAll(
      '[role="main"], [role="feed"], [data-pagelet], ' +
      '[style*="overflow"], .x9f619, .x1n2onr6'
    ).forEach(el => {
      el.scrollTop = el.scrollHeight;
    });

    chrome.runtime.sendMessage({
      action: "updateStatus",
      message: `⏳ Scrolling... ${allFriends.size} / 856 friends`
    });

    // ✅ Wait LONGER — 3.5 seconds for Facebook to load
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Scrape whatever loaded
    scrapeFriendList();

    currentHeight = document.body.scrollHeight;

    if (currentHeight === previousHeight) {
      sameHeightCount++;

      chrome.runtime.sendMessage({
        action: "updateStatus",
        message: `🔍 Waiting for more... attempt ${sameHeightCount}/${MAX_SAME}`
      });

      // ✅ Extra long wait on stall — 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // ✅ Try scrolling UP a bit then back DOWN
      // This tricks Facebook into loading more!
      window.scrollBy(0, -300);
      await new Promise(resolve => setTimeout(resolve, 1000));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check again after trick scroll
      scrapeFriendList();
      currentHeight = document.body.scrollHeight;

      if (currentHeight !== previousHeight) {
        sameHeightCount = 0; // Reset! New content loaded!
        console.log("Trick scroll worked! New content loaded.");
      }

    } else {
      sameHeightCount = 0;
      console.log(`New content! Height: ${currentHeight}, Friends: ${allFriends.size}`);
    }
  }

  observer.disconnect();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log("Done! Total friends:", allFriends.size);
}

// ── MESSAGE LISTENER ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    sendResponse({ started: true });
    allFriends.clear();

    (async () => {
      try {
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "🚀 Starting auto-scroll..."
        });

        // ✅ Run the scroll + collect loop
        await autoScrollAndCollect();

        const friendsList = Array.from(allFriends.values());
        const userId      = getUserId();

        chrome.storage.local.set({ friends: friendsList, userId });

        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: `☁️ Saving ${friendsList.length} friends to cloud...`
        });

        await saveToFirebase(friendsList, userId);

        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friendsList.length,
          userId
        });

      } catch (err) {
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: allFriends.size,
          error: err.message
        });
      }
    })();

    return true;
  }
});