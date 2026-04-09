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

// Debug: log all scrollable divs to console
function debugScrollContainers() {
  console.log("=== SCROLLABLE CONTAINERS ===");
  document.querySelectorAll('div').forEach((div, i) => {
    if (div.scrollHeight > div.clientHeight + 200 && div.clientHeight > 100) {
      console.log(
        `[${i}] scrollHeight:${div.scrollHeight}`,
        `clientHeight:${div.clientHeight}`,
        `class:${div.className?.slice(0,40)}`
      );
    }
  });
}
// ── THE KEY FUNCTION (from the code you shared) ───────────────
async function autoScrollAndCollect() {
  let sameHeightCount = 0;
  const MAX_SAME = 10;

  // ✅ MutationObserver to catch friends as they appear
  const observer = new MutationObserver(() => {
    scrapeFriendList();
    chrome.runtime.sendMessage({
      action: "liveCount",
      count: allFriends.size
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scrapeFriendList();

  // ✅ Find Facebook's actual scrollable container
  function getScrollableContainer() {
    // Try all possible containers Facebook uses
    const selectors = [
      '[role="main"]',
      '[data-pagelet="FriendsListPageContent"]',
      '[data-pagelet="ProfileAppSection_0"]',
      'div[style*="overflow-y: auto"]',
      'div[style*="overflow-y:auto"]',
      'div[style*="overflow: auto"]',
      'div[style*="overflow:auto"]',
      'div[style*="overflow-y: scroll"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) {
        console.log("Found container:", sel);
        return el;
      }
    }

    // Last resort — find by largest scrollHeight
    let best = null;
    let bestScrollHeight = 0;
    document.querySelectorAll('div').forEach(div => {
      if (
        div.scrollHeight > div.clientHeight + 100 &&
        div.scrollHeight > bestScrollHeight &&
        div.clientHeight > 200
      ) {
        best = div;
        bestScrollHeight = div.scrollHeight;
      }
    });

    return best;
  }

  console.log("Starting scroll...");

  while (sameHeightCount < MAX_SAME) {
    const container = getScrollableContainer();
    const prevHeight = container
      ? container.scrollHeight
      : document.body.scrollHeight;

    // ✅ Scroll BOTH window AND container
    window.scrollTo(0, document.body.scrollHeight);

    if (container) {
      container.scrollTop = container.scrollHeight;
      console.log("Scrolling container:", container.className?.slice(0,50));
    }

    // ✅ Also try scrolling ALL divs that might be the list
    document.querySelectorAll('div').forEach(div => {
      if (
        div.scrollHeight > div.clientHeight + 200 &&
        div.clientHeight > 300
      ) {
        div.scrollTop = div.scrollHeight;
      }
    });

    chrome.runtime.sendMessage({
      action: "updateStatus",
      message: `⏳ Loading friends... ${allFriends.size} found`
    });

    // Wait for Facebook to load new friends
    await new Promise(r => setTimeout(r, 3000));
    scrapeFriendList();

    const newHeight = container
      ? container.scrollHeight
      : document.body.scrollHeight;

    if (newHeight === prevHeight) {
      sameHeightCount++;

      chrome.runtime.sendMessage({
        action: "updateStatus",
        message: `🔄 Retrying ${sameHeightCount}/${MAX_SAME}... ${allFriends.size} friends`
      });

      // ✅ Scroll UP then back DOWN — triggers lazy loading!
      if (container) {
        container.scrollTop -= 500;
      } else {
        window.scrollBy(0, -500);
      }

      await new Promise(r => setTimeout(r, 1500));

      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }

      await new Promise(r => setTimeout(r, 4000));
      scrapeFriendList();

      // Check if new content loaded after retry
      const retryHeight = container
        ? container.scrollHeight
        : document.body.scrollHeight;

      if (retryHeight > newHeight) {
        sameHeightCount = 0;
        console.log("Retry worked!");
      }

    } else {
      sameHeightCount = 0;
      console.log(`✅ New content! Friends: ${allFriends.size}`);
    }
  }

  observer.disconnect();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log("✅ Done! Total:", allFriends.size);
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