const API = "https://frosttiers.onrender.com";

const MODES = [
  "vanilla",
  "uhc",
  "pot",
  "nethop",
  "smp",
  "sword",
  "axe",
  "mace"
];

const MODE_NAMES = {
  vanilla: "Vanilla",
  uhc: "UHC",
  pot: "Pot",
  nethop: "NethOP",
  smp: "SMP",
  sword: "Sword",
  axe: "Axe",
  mace: "Mace"
};

const TIERS = [
  "HT1",
  "LT1",
  "HT2",
  "LT2",
  "HT3",
  "LT3",
  "HT4",
  "LT4",
  "HT5",
  "LT5"
];

const TIER_POINTS = {
  HT1: 60,
  LT1: 45,
  HT2: 30,
  LT2: 20,
  HT3: 10,
  LT3: 6,
  HT4: 4,
  LT4: 2,
  HT5: 1,
  LT5: 0
};

let currentUser = null;
let players = [];
let tests = [];
let adminDashboard = null;

function $(selector) {
  return document.querySelector(selector);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function apiRequest(url, options = {}) {
  const config = {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json"
    }
  };

  const endpoint =
    url.startsWith("/api/")
      ? API + url
      : url;

  const response = await fetch(endpoint, config);

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

const api = apiRequest;

function isAdmin() {
  return currentUser?.role === "admin";
}

function isModerator() {
  return ["moderator", "admin"].includes(
    currentUser?.role
  );
}

function isStaff() {
  return ["tester", "moderator", "admin"].includes(
    currentUser?.role
  );
}

function canRank() {
  return ["tester", "moderator", "admin"].includes(
    currentUser?.role
  );
}

function roleName(role) {
  return {
    user: "User",
    tester: "Tester",
    moderator: "Moderator",
    admin: "Administrator"
  }[role] || "User";
}

function tierFromValue(value) {
  if (typeof value === "number") {
    return TIERS[value] || "";
  }

  return String(value || "").toUpperCase();
}

function getPlayerPoints(player) {
  if (!player?.tiers) return 0;

  return MODES.reduce((total, mode) => {
    const tier = tierFromValue(player.tiers[mode]);

    return total + (TIER_POINTS[tier] || 0);
  }, 0);
}

/* =========================================================
   AUTH
========================================================= */

async function loadMe() {
  try {
    const data = await api("/api/me");

    currentUser = data.user || null;
  } catch {
    currentUser = null;
  }

  updateMenu();
}

function updateMenu() {
  const nav = $(".dr nav");

  if (!nav) return;

  nav.innerHTML = "";

  const home = document.createElement("a");
  home.href = "#";
  home.textContent = "Home";

  const rankings = document.createElement("a");
  rankings.href = "#rankings";
  rankings.textContent = "Rankings";

  nav.appendChild(home);
  nav.appendChild(rankings);

  if (isStaff()) {
    const testButton = document.createElement("button");

    testButton.type = "button";
    testButton.textContent = "Submit a test";
    testButton.addEventListener("click", openTestModal);

    nav.appendChild(testButton);
  }

  if (isStaff()) {
    const adminButton = document.createElement("button");

    adminButton.type = "button";
    adminButton.textContent = "Staff panel";
    adminButton.addEventListener("click", openAdminPanel);

    nav.appendChild(adminButton);
  }

  if (currentUser) {
    const account = document.createElement("button");

    account.type = "button";
    account.textContent =
      `${currentUser.username} · ${roleName(currentUser.role)}`;

    account.addEventListener("click", openAuthModal);

    nav.appendChild(account);

    const logout = document.createElement("button");

    logout.type = "button";
    logout.textContent = "Log out";

    logout.addEventListener("click", logoutUser);

    nav.appendChild(logout);
  } else {
    const login = document.createElement("button");

    login.type = "button";
    login.textContent = "Log in / Sign up";

    login.addEventListener("click", openAuthModal);

    nav.appendChild(login);
  }
}

/* =========================================================
   AUTH MODAL
========================================================= */

function openAuthModal() {
  const modal = $("#authModal");

  if (!modal) return;

  modal.setAttribute("aria-hidden", "false");

  if (currentUser) {
    showAccountView();
  } else {
    showLoginView();
  }
}

function closeAuthModal() {
  const modal = $("#authModal");

  if (modal) {
    modal.setAttribute("aria-hidden", "true");
  }
}

function showLoginView() {
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");
  const title = $("#authTitle");
  const sub = $("#authSub");
  const switchButton = $("#authSwitch");

  if (loginForm) loginForm.style.display = "";
  if (signupForm) signupForm.style.display = "none";

  if (title) title.textContent = "Welcome back";
  if (sub) sub.textContent = "Log in to your FrostTiers account.";

  if (switchButton) {
    switchButton.textContent = "Create an account";
  }
}

function showSignupView() {
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");
  const title = $("#authTitle");
  const sub = $("#authSub");
  const switchButton = $("#authSwitch");

  if (loginForm) loginForm.style.display = "none";
  if (signupForm) signupForm.style.display = "";

  if (title) title.textContent = "Create account";
  if (sub) sub.textContent = "Create your FrostTiers account.";

  if (switchButton) {
    switchButton.textContent = "Already have an account?";
  }
}

function showAccountView() {
  const forms = $("#authForms");
  const account = $("#authAccount");

  if (forms) forms.style.display = "none";

  if (account) {
    account.style.display = "";

    const minecraft = $("#loggedInMinecraft");
    const discord = $("#loggedInDiscord");
    const role = $("#loggedInRole");
    const adminButton = $("#adminPanelButton");

    if (minecraft) {
      minecraft.textContent = currentUser.username;
    }

    if (discord) {
      discord.textContent =
        currentUser.discordUsername || "Not set";
    }

    if (role) {
      role.textContent = roleName(currentUser.role);
    }

    if (adminButton) {
      adminButton.style.display = isStaff()
        ? ""
        : "none";
    }
  }
}

async function loginUser(event) {
  event.preventDefault();

  const username = $("#loginUsername")?.value.trim();
  const password = $("#loginPassword")?.value;

  const submit = $("#loginSubmit");

  if (!username || !password) return;

  if (submit) submit.disabled = true;

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    currentUser = data.user;

    closeAuthModal();
    updateMenu();

    location.reload();
  } catch (err) {
    const box = $("#authError");

    if (box) {
      box.textContent = err.message;
      box.style.display = "";
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function signupUser(event) {
  event.preventDefault();

  const minecraftUsername =
    $("#signupMinecraft")?.value.trim();

  const discordUsername =
    $("#signupDiscord")?.value.trim();

  const password =
    $("#signupPassword")?.value;

  const confirmPassword =
    $("#signupConfirm")?.value;

  const submit = $("#signupSubmit");

  if (submit) submit.disabled = true;

  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        minecraftUsername,
        discordUsername,
        password,
        confirmPassword
      })
    });

    currentUser = data.user;

    closeAuthModal();
    updateMenu();

    location.reload();
  } catch (err) {
    const box = $("#authError");

    if (box) {
      box.textContent = err.message;
      box.style.display = "";
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function logoutUser() {
  try {
    await api("/api/auth/logout", {
      method: "POST"
    });
  } catch {}

  currentUser = null;

  updateMenu();

  location.reload();
}

/* =========================================================
   TEST MODAL
========================================================= */

function openTestModal() {
  if (!canRank()) {
    alert("You do not have permission to rank players.");
    return;
  }

  const modal = $("#dlg");

  if (!modal) return;

  modal.setAttribute("aria-hidden", "false");

  const message = $("#msg");

  if (message) {
    message.textContent = "";
    message.style.display = "none";
  }

  loadTestHistory();
}

function closeTestModal() {
  const modal = $("#dlg");

  if (modal) {
    modal.setAttribute("aria-hidden", "true");
  }
}

async function submitTest(event) {
  event.preventDefault();

  if (!canRank()) {
    showTestMessage(
      "You do not have permission to rank players.",
      true
    );

    return;
  }

  const player = $("#player")?.value.trim();
  const mode = $("#mode")?.value;
  const tier = $("#tier")?.value;
  const region = $("#region")?.value;

  const button = $("#sw");

  if (button) button.disabled = true;

  try {
    const result = await api("/api/tests", {
      method: "POST",
      body: JSON.stringify({
        player,
        mode,
        tier,
        region
      })
    });

    showTestMessage(
      `${player} ranked ${tier} in ${MODE_NAMES[mode]}.`,
      false
    );

    if ($("#f")) {
      $("#f").reset();
    }

    await loadPlayers();
    await loadTestHistory();

    if (adminDashboard) {
      await loadAdminDashboard();
    }
  } catch (err) {
    showTestMessage(err.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function showTestMessage(message, isError) {
  const box = $("#msg");

  if (!box) return;

  box.textContent = message;
  box.style.display = "";
  box.className = isError
    ? "test-error"
    : "test-success";
}

async function loadTestHistory() {
  const history = $("#hist");

  if (!history) return;

  try {
    const data = await api("/api/tests");

    const items = Array.isArray(data.tests)
      ? data.tests.slice(0, 10)
      : [];

    if (!items.length) {
      history.innerHTML =
        `<div class="admin-note">No tests yet.</div>`;

      return;
    }

    history.innerHTML = items.map(test => `
      <div class="recent-item">
        <div>
          <strong>${escapeHTML(test.player)}</strong>
          <span>${escapeHTML(
            MODE_NAMES[test.mode] || test.mode
          )}</span>
        </div>
        <b>${escapeHTML(test.tier)}</b>
      </div>
    `).join("");
  } catch (err) {
    history.innerHTML = `
      <div class="admin-note">
        ${escapeHTML(err.message)}
      </div>
    `;
  }
}

/* =========================================================
   PLAYERS
========================================================= */

async function loadPlayers() {
  try {
    const data = await api("/api/players");

    players = Array.isArray(data.players)
      ? data.players
      : [];

    renderPlayers();
  } catch (err) {
    console.error("Could not load players:", err);
  }
}

function renderPlayers() {
  const list = $("#list");

  if (!list) return;

  const query =
    $("#q")?.value.trim().toLowerCase() || "";

  let filtered = players;

  if (query) {
    filtered = players.filter(player =>
      player.name.toLowerCase().includes(query)
    );
  }

  list.innerHTML = filtered.map(player => {
    const points =
      typeof player.points === "number"
        ? player.points
        : getPlayerPoints(player);

    return `
      <div class="player-row">
        <button
          type="button"
          class="player-button"
          data-player="${escapeHTML(player.name)}"
        >
          <span>${escapeHTML(player.name)}</span>
          <small>${escapeHTML(player.region || "NA")}</small>
        </button>

        <strong>${points} pts</strong>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-player]").forEach(button => {
    button.addEventListener("click", () => {
      openPlayerProfile(button.dataset.player);
    });
  });
}

/* =========================================================
   PLAYER PROFILE
========================================================= */

function openPlayerProfile(username) {
  const player = players.find(
    candidate =>
      candidate.name.toLowerCase() ===
      username.toLowerCase()
  );

  if (!player) return;

  const profile = $("#profile");

  if (!profile) return;

  profile.setAttribute("aria-hidden", "false");

  const initial = $("#profileInitial");
  const name = $("#profileName");
  const title = $("#profileTitle");
  const region = $("#profileRegion");
  const nameMC = $("#profileNameMC");
  const rank = $("#profileRank");
  const points = $("#profilePoints");
  const tiers = $("#profileTiers");

  if (initial) {
    initial.textContent =
      player.name.charAt(0).toUpperCase();
  }

  if (name) name.textContent = player.name;

  if (title) {
    title.textContent = "FrostTiers Player";
  }

  if (region) {
    region.textContent = player.region || "NA";
  }

  if (nameMC) {
    nameMC.textContent = player.name;
  }

  if (points) {
    points.textContent =
      `${getPlayerPoints(player)} pts`;
  }

  if (rank) {
    rank.textContent = "Overall";
  }

  if (tiers) {
    tiers.innerHTML = MODES.map(mode => {
      const tier = tierFromValue(player.tiers?.[mode]);

      return `
        <div class="tier-row">
          <span>${MODE_NAMES[mode]}</span>
          <strong>${escapeHTML(
            tier || "Unranked"
          )}</strong>
        </div>
      `;
    }).join("");
  }
}

function closePlayerProfile() {
  const profile = $("#profile");

  if (profile) {
    profile.setAttribute("aria-hidden", "true");
  }
}

/* =========================================================
   ADMIN PANEL
========================================================= */

function openAdminPanel() {
  if (!isStaff()) {
    alert("Staff access required.");
    return;
  }

  const modal = $("#adminModal");

  if (!modal) return;

  modal.setAttribute("aria-hidden", "false");

  setupAdminTabs();

  const active =
    $(".admin-tab.active") ||
    $(".admin-tab[data-tab='overview']");

  const tab =
    active?.dataset.tab ||
    "overview";

  switchAdminTab(tab);
}

function closeAdminPanel() {
  const modal = $("#adminModal");

  if (modal) {
    modal.setAttribute("aria-hidden", "true");
  }
}

function setupAdminTabs() {
  document.querySelectorAll(".admin-tab").forEach(tab => {
    if (tab.dataset.bound === "true") return;

    tab.dataset.bound = "true";

    tab.addEventListener("click", () => {
      switchAdminTab(tab.dataset.tab);
    });
  });
}

async function switchAdminTab(tab) {
  if (!isStaff()) return;

  document.querySelectorAll(".admin-tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tab
    );
  });

  const content = $("#admin-content");

  if (!content) return;

  if (tab === "accounts") {
    if (!isAdmin()) {
      content.innerHTML = `
        <div class="admin-note">
          <strong>Admins only</strong>
          <span>
            Account management is restricted to administrators.
          </span>
        </div>
      `;

      return;
    }

    await renderAccounts();
    return;
  }

  if (tab === "players") {
    await renderAdminPlayers();
    return;
  }

  if (tab === "tests") {
    await renderAdminTests();
    return;
  }

  await renderAdminOverview();
}

/* =========================================================
   ADMIN OVERVIEW
========================================================= */

async function loadAdminDashboard() {
  try {
    const result =
      await api("/api/admin/dashboard");

    adminDashboard = result;

    return result;
  } catch (err) {
    console.error(
      "Admin dashboard error:",
      err
    );

    return null;
  }
}

async function renderAdminOverview() {
  const content = $("#admin-content");

  if (!content) return;

  content.innerHTML = `
    <div class="admin-note">
      Loading dashboard...
    </div>
  `;

  const dashboard =
    await loadAdminDashboard();

  if (!dashboard) {
    content.innerHTML = `
      <div class="admin-note admin-error">
        Could not load the staff dashboard.
      </div>
    `;

    return;
  }

  const stats = dashboard.stats || {};

  const recent =
    Array.isArray(dashboard.recentTests)
      ? dashboard.recentTests
      : [];

  content.innerHTML = `
    <section class="admin-section">
      <div class="admin-head">
        <div>
          <div class="admin-kicker">
            ${escapeHTML(roleName(currentUser.role))}
          </div>

          <h2>Staff Command Center</h2>

          <p>
            Manage FrostTiers rankings, tests, and staff activity.
          </p>
        </div>

        <div class="admin-online">
          <span></span>
          ${escapeHTML(currentUser.username)}
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <span>Players</span>
          <strong>${stats.players || 0}</strong>
          <small>Ranked players</small>
        </div>

        <div class="stat-card">
          <span>Tests</span>
          <strong>${stats.tests || 0}</strong>
          <small>Submitted results</small>
        </div>

        <div class="stat-card">
          <span>Staff</span>
          <strong>${stats.testers || 0}</strong>
          <small>Testers & staff</small>
        </div>

        ${
          isAdmin()
            ? `
              <div class="stat-card">
                <span>Accounts</span>
                <strong>${stats.users || 0}</strong>
                <small>Registered users</small>
              </div>
            `
            : ""
        }

        ${
          isAdmin()
            ? `
              <div class="stat-card">
                <span>Admins</span>
                <strong>${stats.admins || 0}</strong>
                <small>Administrators</small>
              </div>
            `
            : ""
        }
      </div>
    </section>

    <section class="admin-section">
      <div class="section-title-row">
        <div>
          <h3>Quick actions</h3>
          <p>Jump directly into staff tools.</p>
        </div>
      </div>

      <div class="quick-grid">
        <button class="quick-card" id="quickRank" type="button">
          <strong>Rank a player</strong>
          <span>Submit a new tier result.</span>
        </button>

        <button class="quick-card" id="quickPlayers" type="button">
          <strong>Manage players</strong>
          <span>Edit tiers and regions.</span>
        </button>

        <button class="quick-card" id="quickTests" type="button">
          <strong>Test history</strong>
          <span>Review submitted tests.</span>
        </button>

        ${
          isAdmin()
            ? `
              <button class="quick-card" id="quickAccounts" type="button">
                <strong>Accounts</strong>
                <span>Manage staff and users.</span>
              </button>
            `
            : ""
        }
      </div>
    </section>

    <section class="admin-section">
      <div class="section-title-row">
        <div>
          <h3>Recent tests</h3>
          <p>Latest ranking activity.</p>
        </div>
      </div>

      <div class="recent-list">
        ${
          recent.length
            ? recent.map(test => `
              <div class="recent-item">
                <div>
                  <strong>
                    ${escapeHTML(test.player)}
                  </strong>

                  <span>
                    ${escapeHTML(
                      MODE_NAMES[test.mode] ||
                      test.mode
                    )}
                    ·
                    ${escapeHTML(test.region)}
                    ·
                    by ${escapeHTML(test.by)}
                  </span>
                </div>

                <b>${escapeHTML(test.tier)}</b>
              </div>
            `).join("")
            : `
              <div class="admin-note">
                No tests have been submitted yet.
              </div>
            `
        }
      </div>
    </section>
  `;

  $("#quickRank")?.addEventListener(
    "click",
    openTestModal
  );

  $("#quickPlayers")?.addEventListener(
    "click",
    () => switchAdminTab("players")
  );

  $("#quickTests")?.addEventListener(
    "click",
    () => switchAdminTab("tests")
  );

  $("#quickAccounts")?.addEventListener(
    "click",
    () => switchAdminTab("accounts")
  );
}

/* =========================================================
   ADMIN ACCOUNTS
========================================================= */

async function renderAccounts() {
  const content = $("#admin-content");

  if (!content) return;

  if (!isAdmin()) {
    content.innerHTML = `
      <div class="admin-note">
        <strong>Admins only</strong>
        <span>
          You need administrator permissions to manage accounts.
        </span>
      </div>
    `;

    return;
  }

  content.innerHTML = `
    <section class="admin-section">
      <div class="admin-head">
        <div>
          <div class="admin-kicker">Administration</div>
          <h2>Account Management</h2>
          <p>
            Manage users, testers, moderators, and administrators.
          </p>
        </div>

        <button
          class="admin-btn primary"
          id="createAccount"
          type="button"
        >
          + Create account
        </button>
      </div>

      <div class="admin-search-wrap">
        <input
          class="admin-search"
          id="account-search"
          placeholder="Search accounts..."
        >
      </div>

      <div id="account-list" class="admin-list">
        Loading accounts...
      </div>
    </section>
  `;

  $("#createAccount")?.addEventListener(
    "click",
    openCreateAccount
  );

  $("#account-search")?.addEventListener(
    "input",
    renderAccountList
  );

  await fetchAccounts();
}

let adminUsers = [];

async function fetchAccounts() {
  try {
    const data = await api("/api/users");

    adminUsers = Array.isArray(data.users)
      ? data.users
      : [];

    renderAccountList();
  } catch (err) {
    const list = $("#account-list");

    if (list) {
      list.innerHTML = `
        <div class="admin-note admin-error">
          ${escapeHTML(err.message)}
        </div>
      `;
    }
  }
}

function renderAccountList() {
  const list = $("#account-list");

  if (!list) return;

  const query =
    $("#account-search")?.value
      .trim()
      .toLowerCase() || "";

  const filtered = adminUsers.filter(user =>
    user.username.toLowerCase().includes(query) ||
    (user.discordUsername || "")
      .toLowerCase()
      .includes(query) ||
    user.role.toLowerCase().includes(query)
  );

  if (!filtered.length) {
    list.innerHTML = `
      <div class="admin-note">
        No accounts found.
      </div>
    `;

    return;
  }

  list.innerHTML = filtered.map(user => `
    <div class="admin-user">
      <div>
        <strong>${escapeHTML(user.username)}</strong>

        <span>
          ${escapeHTML(
            user.discordUsername || "No Discord"
          )}
        </span>
      </div>

      <div class="admin-actions">
        <select
          class="admin-role-select"
          data-role-user="${escapeHTML(user.id)}"
          ${user.id === currentUser.id ? "disabled" : ""}
        >
          ${["user", "tester", "moderator", "admin"]
            .map(role => `
              <option
                value="${role}"
                ${user.role === role ? "selected" : ""}
              >
                ${roleName(role)}
              </option>
            `).join("")}
        </select>

        ${
          user.id !== currentUser.id
            ? `
              <button
                class="admin-btn danger"
                data-delete-user="${escapeHTML(user.id)}"
                type="button"
              >
                Delete
              </button>
            `
            : ""
        }
      </div>
    </div>
  `).join("");

  list
    .querySelectorAll("[data-role-user]")
    .forEach(select => {
      select.addEventListener(
        "change",
        () => updateUserRole(
          select.dataset.roleUser,
          select.value
        )
      );
    });

  list
    .querySelectorAll("[data-delete-user]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deleteUser(
          button.dataset.deleteUser
        )
      );
    });
}

async function updateUserRole(id, role) {
  try {
    await api(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        role
      })
    });

    await fetchAccounts();
    await loadAdminDashboard();
  } catch (err) {
    alert(err.message);
    await fetchAccounts();
  }
}

async function deleteUser(id) {
  if (
    !confirm(
      "Delete this account? This cannot be undone."
    )
  ) {
    return;
  }

  try {
    await api(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    await fetchAccounts();
    await loadAdminDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function openCreateAccount() {
  const username =
    prompt("Minecraft username:");

  if (!username) return;

  const discord =
    prompt("Discord username:");

  if (!discord) return;

  const password =
    prompt("Temporary password:");

  if (!password) return;

  const role =
    prompt(
      "Role: user, tester, moderator, or admin",
      "tester"
    );

  if (!role) return;

  createAccount({
    username,
    discordUsername: discord,
    password,
    role: role.toLowerCase()
  });
}

async function createAccount(body) {
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(body)
    });

    await fetchAccounts();
    await loadAdminDashboard();
  } catch (err) {
    alert(err.message);
  }
}

/* =========================================================
   ADMIN PLAYERS
========================================================= */

async function renderAdminPlayers() {
  const content = $("#admin-content");

  if (!content) return;

  content.innerHTML = `
    <section class="admin-section">
      <div class="admin-head">
        <div>
          <div class="admin-kicker">Rankings</div>
          <h2>Player Management</h2>
          <p>
            ${canRank()
              ? "Edit player tiers and regions."
              : "View ranked players."
            }
          </p>
        </div>

        ${
          canRank()
            ? `
              <button
                class="admin-btn primary"
                id="adminRankButton"
                type="button"
              >
                + Rank player
              </button>
            `
            : ""
        }
      </div>

      <div class="admin-search-wrap">
        <input
          class="admin-search"
          id="player-search"
          placeholder="Search players..."
        >
      </div>

      <div id="player-list" class="admin-list">
        Loading players...
      </div>
    </section>
  `;

  $("#adminRankButton")?.addEventListener(
    "click",
    openTestModal
  );

  $("#player-search")?.addEventListener(
    "input",
    renderAdminPlayerList
  );

  await fetchAdminPlayers();
}

let adminPlayers = [];

async function fetchAdminPlayers() {
  try {
    const data =
      await api("/api/admin/players");

    adminPlayers = Array.isArray(data.players)
      ? data.players
      : [];

    renderAdminPlayerList();
  } catch (err) {
    const list = $("#player-list");

    if (list) {
      list.innerHTML = `
        <div class="admin-note admin-error">
          ${escapeHTML(err.message)}
        </div>
      `;
    }
  }
}

function renderAdminPlayerList() {
  const list = $("#player-list");

  if (!list) return;

  const query =
    $("#player-search")?.value
      .trim()
      .toLowerCase() || "";

  const filtered = adminPlayers.filter(player =>
    player.name.toLowerCase().includes(query)
  );

  if (!filtered.length) {
    list.innerHTML = `
      <div class="admin-note">
        No players found.
      </div>
    `;

    return;
  }

  list.innerHTML = filtered.map(player => `
    <div class="admin-player">
      <div class="admin-player-main">
        <strong>${escapeHTML(player.name)}</strong>

        <span>
          ${escapeHTML(player.region || "NA")}
          ·
          ${player.points || 0} points
        </span>
      </div>

      <div class="admin-actions">
        <button
          class="admin-btn"
          type="button"
          data-edit-player="${escapeHTML(player.name)}"
        >
          Edit
        </button>

        ${
          isModerator()
            ? `
              <button
                class="admin-btn danger"
                type="button"
                data-delete-player="${escapeHTML(player.name)}"
              >
                Delete
              </button>
            `
            : ""
        }
      </div>
    </div>
  `).join("");

  list
    .querySelectorAll("[data-edit-player]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => editPlayer(
          button.dataset.editPlayer
        )
      );
    });

  list
    .querySelectorAll("[data-delete-player]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deletePlayer(
          button.dataset.deletePlayer
        )
      );
    });
}

async function editPlayer(username) {
  const player = adminPlayers.find(
    candidate =>
      candidate.name.toLowerCase() ===
      username.toLowerCase()
  );

  if (!player) return;

  if (!canRank()) {
    alert("You do not have permission to edit rankings.");
    return;
  }

  const region =
    prompt(
      "Region: NA, EU, AS, or OC",
      player.region || "NA"
    );

  if (!region) return;

  const tiers = {
    ...(player.tiers || {})
  };

  for (const mode of MODES) {
    const current =
      tierFromValue(tiers[mode]) || "Unranked";

    const value =
      prompt(
        `${MODE_NAMES[mode]} tier:`,
        current
      );

    if (!value) continue;

    if (!TIERS.includes(value.toUpperCase())) {
      alert(`Invalid tier for ${MODE_NAMES[mode]}.`);
      return;
    }

    tiers[mode] = value.toUpperCase();
  }

  try {
    await api(
      `/api/admin/players/${encodeURIComponent(username)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          region: region.toUpperCase(),
          tiers
        })
      }
    );

    await fetchAdminPlayers();
    await loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

async function deletePlayer(username) {
  if (
    !confirm(
      `Delete ${username}'s player ranking record?`
    )
  ) {
    return;
  }

  try {
    await api(
      `/api/admin/players/${encodeURIComponent(username)}`,
      {
        method: "DELETE"
      }
    );

    await fetchAdminPlayers();
    await loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

/* =========================================================
   ADMIN TESTS
========================================================= */

async function renderAdminTests() {
  const content = $("#admin-content");

  if (!content) return;

  content.innerHTML = `
    <section class="admin-section">
      <div class="admin-head">
        <div>
          <div class="admin-kicker">Activity</div>
          <h2>Test Management</h2>
          <p>
            Review and manage submitted ranking tests.
          </p>
        </div>

        ${
          canRank()
            ? `
              <button
                class="admin-btn primary"
                id="adminNewTest"
                type="button"
              >
                + New test
              </button>
            `
            : ""
        }
      </div>

      <div class="admin-filters">
        <input
          class="admin-search"
          id="test-search"
          placeholder="Search player or tester..."
        >

        <select
          class="admin-select"
          id="test-mode"
        >
          <option value="">All gamemodes</option>

          ${MODES.map(mode => `
            <option value="${mode}">
              ${MODE_NAMES[mode]}
            </option>
          `).join("")}
        </select>

        <select
          class="admin-select"
          id="test-tier"
        >
          <option value="">All tiers</option>

          ${TIERS.map(tier => `
            <option value="${tier}">
              ${tier}
            </option>
          `).join("")}
        </select>
      </div>

      <div id="test-list" class="admin-list">
        Loading tests...
      </div>
    </section>
  `;

  $("#adminNewTest")?.addEventListener(
    "click",
    openTestModal
  );

  $("#test-search")?.addEventListener(
    "input",
    renderTestList
  );

  $("#test-mode")?.addEventListener(
    "change",
    renderTestList
  );

  $("#test-tier")?.addEventListener(
    "change",
    renderTestList
  );

  await fetchAdminTests();
}

async function fetchAdminTests() {
  try {
    const data =
      await api("/api/admin/tests");

    tests = Array.isArray(data.tests)
      ? data.tests
      : [];

    renderTestList();
  } catch (err) {
    const list = $("#test-list");

    if (list) {
      list.innerHTML = `
        <div class="admin-note admin-error">
          ${escapeHTML(err.message)}
        </div>
      `;
    }
  }
}

function renderTestList() {
  const list = $("#test-list");

  if (!list) return;

  const query =
    $("#test-search")?.value
      .trim()
      .toLowerCase() || "";

  const mode =
    $("#test-mode")?.value || "";

  const tier =
    $("#test-tier")?.value || "";

  const filtered = tests.filter(test => {
    const matchesSearch =
      !query ||
      test.player.toLowerCase().includes(query) ||
      test.by.toLowerCase().includes(query);

    const matchesMode =
      !mode || test.mode === mode;

    const matchesTier =
      !tier || test.tier === tier;

    return (
      matchesSearch &&
      matchesMode &&
      matchesTier
    );
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="admin-note">
        No tests found.
      </div>
    `;

    return;
  }

  list.innerHTML = filtered.map(test => `
    <div class="admin-test">
      <div class="admin-test-main">
        <div>
          <strong>
            ${escapeHTML(test.player)}
          </strong>

          <span>
            ${escapeHTML(
              MODE_NAMES[test.mode] ||
              test.mode
            )}
            ·
            ${escapeHTML(test.region)}
          </span>
        </div>

        <div>
          <strong>
            ${escapeHTML(test.tier)}
          </strong>

          <span>
            Previous:
            ${escapeHTML(test.previous || "Unranked")}
          </span>
        </div>

        <div>
          <span>
            Tested by
            ${escapeHTML(test.by)}
          </span>

          <span>
            ${formatDate(test.at)}
          </span>
        </div>
      </div>

      ${
        isModerator()
          ? `
            <button
              class="admin-btn danger"
              type="button"
              data-delete-test="${escapeHTML(test.id)}"
            >
              Delete
            </button>
          `
          : ""
      }
    </div>
  `).join("");

  list
    .querySelectorAll("[data-delete-test]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deleteTest(
          button.dataset.deleteTest
        )
      );
    });
}

async function deleteTest(id) {
  if (
    !confirm(
      "Delete this test record?"
    )
  ) {
    return;
  }

  try {
    await api(
      `/api/admin/tests/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    await fetchAdminTests();
    await loadAdminDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

/* =========================================================
   EVENT SETUP
========================================================= */

function setupEvents() {
  $("#authClose")?.addEventListener(
    "click",
    closeAuthModal
  );

  $("#adminClose")?.addEventListener(
    "click",
    closeAdminPanel
  );

  $("#profileClose")?.addEventListener(
    "click",
    closePlayerProfile
  );

  $("#dc")?.addEventListener(
    "click",
    closeTestModal
  );

  $("#loginForm")?.addEventListener(
    "submit",
    loginUser
  );

  $("#signupForm")?.addEventListener(
    "submit",
    signupUser
  );

  $("#f")?.addEventListener(
    "submit",
    submitTest
  );

  $("#authSwitch")?.addEventListener(
    "click",
    () => {
      const signup =
        $("#signupForm")?.style.display !== "none";

      if (signup) {
        showLoginView();
      } else {
        showSignupView();
      }
    }
  );

  $("#adminPanelButton")?.addEventListener(
    "click",
    () => {
      closeAuthModal();
      openAdminPanel();
    }
  );

  $("#logoutButton")?.addEventListener(
    "click",
    logoutUser
  );

  $("#q")?.addEventListener(
    "input",
    renderPlayers
  );

  /*
   * Close overlays by clicking outside their card.
   */
  document.querySelectorAll(
    "#authModal, #adminModal, #dlg, #profile"
  ).forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.setAttribute(
          "aria-hidden",
          "true"
        );
      }
    });
  });

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") return;

      closeAuthModal();
      closeAdminPanel();
      closeTestModal();
      closePlayerProfile();
    }
  );
}

/* =========================================================
   START
========================================================= */

async function init() {
  setupEvents();

  await loadMe();

  await loadPlayers();

  /*
   * If the user was already logged in when the page
   * loaded, make sure the menu reflects their role.
   */
  updateMenu();
}

init().catch(error => {
  console.error(
    "FrostTiers initialization error:",
    error
  );
});
