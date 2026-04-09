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

  // Watch DOM — capture friends the moment they appear!
  const observer = new MutationObserver(() => {
    scrapeFriendList();
    chrome.runtime.sendMessage({
      action: "liveCount",
      count: allFriends.size
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scrape before scrolling
  scrapeFriendList();

  console.log("Starting automated scroll and collection...");

  while (sameHeightCount < 5) {
    previousHeight = document.body.scrollHeight;

    // ✅ Scroll to absolute bottom
    window.scrollTo(0, document.body.scrollHeight);

    // ✅ Also try scrollTop for Facebook's inner containers
    document.querySelectorAll('[role="main"], [role="feed"]')
      .forEach(el => { el.scrollTop = el.scrollHeight; });

    // ✅ Send live update to popup
    chrome.runtime.sendMessage({
      action: "updateStatus",
      message: `⏳ Scrolling... ${allFriends.size} friends found`
    });

    // ✅ Wait 2.5 seconds — gives Facebook time to load
    await new Promise(resolve => setTimeout(resolve, 2500));

    // ✅ Scrape whatever loaded
    scrapeFriendList();

    currentHeight = document.body.scrollHeight;

    if (currentHeight === previousHeight) {
      sameHeightCount++;
      console.log(`No new content, attempt ${sameHeightCount}/5`);

      chrome.runtime.sendMessage({
        action: "updateStatus",
        message: `🔍 Checking for more friends... (${sameHeightCount}/5)`
      });

      // Extra long wait on stall
      await new Promise(resolve => setTimeout(resolve, 3000));

    } else {
      sameHeightCount = 0; // reset — new content loaded!
      console.log(`New content! Height: ${currentHeight}, Friends: ${allFriends.size}`);
    }
  }

  observer.disconnect();
  console.log("Reached end of list. Total friends:", allFriends.size);

  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
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