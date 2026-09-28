const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const DATA_FILE = path.join(__dirname, "data.json");
const CONFIG_FILE = path.join(__dirname, "config.json");

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

const VALID_ROLES = ["user", "tester", "moderator", "admin"];

function defaultData() {
  return {
    users: [],
    sessions: {},
    players: {},
    tests: []
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const fresh = defaultData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
      return fresh;
    }

    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: parsed.sessions && typeof parsed.sessions === "object"
        ? parsed.sessions
        : {},
      players: parsed.players && typeof parsed.players === "object"
        ? parsed.players
        : {},
      tests: Array.isArray(parsed.tests) ? parsed.tests : []
    };
  } catch (error) {
    console.error("Failed to load data.json:", error);
    return defaultData();
  }
}

let data = loadData();

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};

    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

const config = loadConfig();

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ||
  config.discordWebhook ||
  "";

function sendJSON(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": res.reqOrigin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    ...extraHeaders
  });

  res.end(payload);
}

function sendText(res, status, text, contentType = "text/plain") {
  res.writeHead(status, {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Access-Control-Allow-Origin": res.reqOrigin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });

  res.end(text);
}

function error(res, status, message) {
  sendJSON(res, status, {
    error: message,
    message
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function hashPassword(password, salt) {
  return crypto
    .scryptSync(password, salt, 64)
    .toString("hex");
}

function createPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  return {
    salt,
    hash: hashPassword(password, salt)
  };
}

function verifyPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;

  const hash = hashPassword(password, user.salt);

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(user.hash, "hex")
  );
}

function createSession(userId) {
  const token = crypto.randomBytes(48).toString("hex");

  data.sessions[token] = {
    uid: userId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000
  };

  saveData();

  return token;
}

function parseCookies(req) {
  const cookies = {};

  const header = req.headers.cookie || "";

  header.split(";").forEach(part => {
    const index = part.indexOf("=");

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function getCurrentUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;

  if (!token) return null;

  const session = data.sessions[token];

  if (!session) return null;

  if (session.exp < Date.now()) {
    delete data.sessions[token];
    saveData();
    return null;
  }

  return data.users.find(user => user.id === session.uid) || null;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    discordUsername: user.discordUsername || "",
    role: user.role || "user",
    created: user.created
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeMode(mode) {
  return String(mode || "").trim().toLowerCase();
}

function tierIndex(tier) {
  return TIERS.indexOf(String(tier || "").toUpperCase());
}

function getPlayer(username) {
  return data.players[normalizeUsername(username)] || null;
}

function playerPoints(player) {
  if (!player || !player.tiers) return 0;

  return MODES.reduce((total, mode) => {
    const tier = player.tiers[mode];

    if (typeof tier !== "number") return total;

    const tierName = TIERS[tier];

    return total + (TIER_POINTS[tierName] || 0);
  }, 0);
}

function playerInfo(player) {
  if (!player) return null;

  return {
    name: player.name,
    region: player.region || "NA",
    tiers: player.tiers || {},
    points: playerPoints(player)
  };
}

function roleRank(role) {
  return {
    user: 0,
    tester: 1,
    moderator: 2,
    admin: 3
  }[role] ?? 0;
}

function isStaff(user) {
  return !!user && ["tester", "moderator", "admin"].includes(user.role);
}

function canRank(user) {
  return !!user && ["tester", "moderator", "admin"].includes(user.role);
}

function isAdmin(user) {
  return !!user && user.role === "admin";
}

function isModeratorOrHigher(user) {
  return !!user && ["moderator", "admin"].includes(user.role);
}

function requireStaff(req, res) {
  const user = getCurrentUser(req);

  if (!user) {
    error(res, 401, "You must be logged in.");
    return null;
  }

  if (!isStaff(user)) {
    error(res, 403, "Staff access required.");
    return null;
  }

  return user;
}

function requireRankPermission(req, res) {
  const user = getCurrentUser(req);

  if (!user) {
    error(res, 401, "You must be logged in.");
    return null;
  }

  if (!canRank(user)) {
    error(res, 403, "You do not have permission to rank players.");
    return null;
  }

  return user;
}

function requireAdmin(req, res) {
  const user = getCurrentUser(req);

  if (!user) {
    error(res, 401, "You must be logged in.");
    return null;
  }

  if (!isAdmin(user)) {
    error(res, 403, "Admins only.");
    return null;
  }

  return user;
}

async function sendDiscordTest(test) {
  if (!DISCORD_WEBHOOK_URL) return;

  try {
    const player = getPlayer(test.player);

    const content = [
      `**FrostTiers Test Result**`,
      ``,
      `**Player:** ${test.player}`,
      `**Gamemode:** ${test.mode}`,
      `**Tier:** ${test.tier}`,
      `**Region:** ${test.region}`,
      `**Previous:** ${test.previous || "Unranked"}`,
      `**Tester:** ${test.by}`,
      `**Points:** ${playerPoints(player)}`
    ].join("\n");

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content
      })
    });

    if (!response.ok) {
      console.error(
        "Discord webhook returned",
        response.status,
        await response.text()
      );
    }
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}

function setSessionCookie(token) {
  return `session=${encodeURIComponent(token)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=None`;
}

function clearSessionCookie() {
  return "session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None";
}

function safeUsername(value) {
  return /^[A-Za-z0-9_]{1,16}$/.test(String(value || ""));
}

function generateId(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    crypto.randomBytes(5).toString("hex")
  );
}

async function handleAPI(req, res, pathname) {
  /*
   * AUTH
   */

  if (req.method === "GET" && pathname === "/api/me") {
    const user = getCurrentUser(req);

    sendJSON(res, 200, {
      user: publicUser(user)
    });

    return true;
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = getCurrentUser(req);

    sendJSON(res, 200, {
      user: publicUser(user)
    });

    return true;
  }

  if (
    req.method === "POST" &&
    (pathname === "/api/auth/signup" || pathname === "/api/register")
  ) {
    try {
      const body = await readBody(req);

      const minecraftUsername = String(
        body.minecraftUsername ||
        body.username ||
        ""
      ).trim();

      const discordUsername = String(
        body.discordUsername ||
        body.discord ||
        ""
      ).trim();

      const password = String(body.password || "");
      const confirmPassword = String(
        body.confirmPassword ||
        body.confirm ||
        ""
      );

      if (!safeUsername(minecraftUsername)) {
        error(
          res,
          400,
          "Minecraft username must be 1-16 characters and contain only letters, numbers, or underscores."
        );
        return true;
      }

      if (!discordUsername) {
        error(res, 400, "Discord username is required.");
        return true;
      }

      if (password.length < 6) {
        error(res, 400, "Password must be at least 6 characters.");
        return true;
      }

      if (password !== confirmPassword) {
        error(res, 400, "Passwords do not match.");
        return true;
      }

      const exists = data.users.some(
        user =>
          user.username.toLowerCase() ===
          minecraftUsername.toLowerCase()
      );

      if (exists) {
        error(res, 409, "That Minecraft username already has an account.");
        return true;
      }

      const credentials = createPassword(password);

      const user = {
        id: generateId("user_"),
        username: minecraftUsername,
        discordUsername,
        salt: credentials.salt,
        hash: credentials.hash,

        /*
         * First account is automatically admin.
         * Everyone else starts as a normal user.
         */
        role: data.users.length === 0 ? "admin" : "user",

        created: new Date().toISOString()
      };

      data.users.push(user);

      const token = createSession(user.id);

      sendJSON(
        res,
        201,
        {
          user: publicUser(user)
        },
        {
          "Set-Cookie": setSessionCookie(token)
        }
      );

      return true;
    } catch (err) {
      error(res, 400, err.message || "Could not create account.");
      return true;
    }
  }

  if (
    req.method === "POST" &&
    (pathname === "/api/auth/login" || pathname === "/api/login")
  ) {
    try {
      const body = await readBody(req);

      const username = String(
        body.username ||
        body.minecraftUsername ||
        ""
      ).trim();

      const password = String(body.password || "");

      const user = data.users.find(
        candidate =>
          candidate.username.toLowerCase() === username.toLowerCase()
      );

      if (!user || !verifyPassword(password, user)) {
        error(res, 401, "Invalid username or password.");
        return true;
      }

      const token = createSession(user.id);

      sendJSON(
        res,
        200,
        {
          user: publicUser(user)
        },
        {
          "Set-Cookie": setSessionCookie(token)
        }
      );

      return true;
    } catch (err) {
      error(res, 400, err.message || "Could not log in.");
      return true;
    }
  }

  if (
    req.method === "POST" &&
    pathname === "/api/auth/logout"
  ) {
    const cookies = parseCookies(req);

    if (cookies.session) {
      delete data.sessions[cookies.session];
      saveData();
    }

    sendJSON(
      res,
      200,
      {
        ok: true
      },
      {
        "Set-Cookie": clearSessionCookie()
      }
    );

    return true;
  }

  /*
   * PUBLIC PLAYERS
   */

  if (req.method === "GET" && pathname === "/api/players") {
    const players = Object.values(data.players)
      .map(playerInfo)
      .sort((a, b) => b.points - a.points);

    sendJSON(res, 200, {
      players
    });

    return true;
  }

  /*
   * TESTS
   *
   * Test submission is allowed for:
   * admin / moderator / tester
   */

  if (req.method === "GET" && pathname === "/api/tests") {
    sendJSON(res, 200, {
      tests: [...data.tests].reverse()
    });

    return true;
  }

  if (req.method === "POST" && pathname === "/api/tests") {
    const user = requireRankPermission(req, res);

    if (!user) return true;

    try {
      const body = await readBody(req);

      const playerName = String(
        body.player ||
        body.username ||
        body.minecraftUsername ||
        ""
      ).trim();

      const mode = normalizeMode(body.mode);
      const tier = String(body.tier || "").toUpperCase();
      const region = String(body.region || "").toUpperCase();

      if (!safeUsername(playerName)) {
        error(res, 400, "Invalid Minecraft username.");
        return true;
      }

      if (!MODES.includes(mode)) {
        error(res, 400, "Invalid gamemode.");
        return true;
      }

      if (!TIERS.includes(tier)) {
        error(res, 400, "Invalid tier.");
        return true;
      }

      if (!["NA", "EU", "AS", "OC"].includes(region)) {
        error(res, 400, "Invalid region.");
        return true;
      }

      const key = normalizeUsername(playerName);

      let player = data.players[key];

      if (!player) {
        player = {
          name: playerName,
          region,
          tiers: {}
        };

        data.players[key] = player;
      }

      player.name = playerName;
      player.region = region;

      const previousIndex =
        typeof player.tiers[mode] === "number"
          ? player.tiers[mode]
          : null;

      const previous =
        previousIndex === null
          ? "Unranked"
          : TIERS[previousIndex];

      player.tiers[mode] = tierIndex(tier);

      const test = {
        id: generateId("test_"),
        player: playerName,
        region,
        mode,
        tier,
        previous,
        by: user.username,
        at: new Date().toISOString()
      };

      data.tests.push(test);

      saveData();

      sendJSON(res, 201, {
        ok: true,
        test,
        player: playerInfo(player)
      });

      sendDiscordTest(test);

      return true;
    } catch (err) {
      error(res, 400, err.message || "Could not submit test.");
      return true;
    }
  }

  /*
   * ADMIN DASHBOARD
   */

  if (
    req.method === "GET" &&
    pathname === "/api/admin/dashboard"
  ) {
    const user = requireStaff(req, res);

    if (!user) return true;

    const testers = data.users.filter(
      u => ["tester", "moderator", "admin"].includes(u.role)
    ).length;

    const admins = data.users.filter(
      u => u.role === "admin"
    ).length;

    sendJSON(res, 200, {
      stats: {
        users: data.users.length,
        admins,
        testers,
        players: Object.keys(data.players).length,
        tests: data.tests.length
      },

      recentTests: [...data.tests]
        .reverse()
        .slice(0, 10)
    });

    return true;
  }

  /*
   * ADMIN / STAFF PLAYERS
   */

  if (
    req.method === "GET" &&
    pathname === "/api/admin/players"
  ) {
    const user = requireStaff(req, res);

    if (!user) return true;

    sendJSON(res, 200, {
      players: Object.values(data.players)
        .map(playerInfo)
        .sort((a, b) => b.points - a.points)
    });

    return true;
  }

  const playerMatch = pathname.match(
    /^\/api\/admin\/players\/([^/]+)$/
  );

  if (playerMatch) {
    const username = decodeURIComponent(playerMatch[1]);
    const key = normalizeUsername(username);

    if (req.method === "PATCH") {
      const user = requireRankPermission(req, res);

      if (!user) return true;

      try {
        const body = await readBody(req);

        let player = data.players[key];

        if (!player) {
          player = {
            name: username,
            region: "NA",
            tiers: {}
          };

          data.players[key] = player;
        }

        if (body.region !== undefined) {
          const region = String(body.region).toUpperCase();

          if (!["NA", "EU", "AS", "OC"].includes(region)) {
            error(res, 400, "Invalid region.");
            return true;
          }

          player.region = region;
        }

        if (body.tiers && typeof body.tiers === "object") {
          for (const mode of MODES) {
            if (body.tiers[mode] === undefined) continue;

            const value = body.tiers[mode];

            let index;

            if (typeof value === "number") {
              index = value;
            } else {
              index = tierIndex(value);
            }

            if (
              !Number.isInteger(index) ||
              index < 0 ||
              index >= TIERS.length
            ) {
              error(res, 400, `Invalid tier for ${mode}.`);
              return true;
            }

            player.tiers[mode] = index;
          }
        }

        saveData();

        sendJSON(res, 200, {
          ok: true,
          player: playerInfo(player)
        });

        return true;
      } catch (err) {
        error(res, 400, err.message || "Could not update player.");
        return true;
      }
    }

    if (req.method === "DELETE") {
      const user = requireModeratorOrHigher(req, res);

      if (!user) return true;

      if (!data.players[key]) {
        error(res, 404, "Player not found.");
        return true;
      }

      delete data.players[key];

      saveData();

      sendJSON(res, 200, {
        ok: true
      });

      return true;
    }
  }

  /*
   * ADMIN TEST MANAGEMENT
   */

  if (
    req.method === "GET" &&
    pathname === "/api/admin/tests"
  ) {
    const user = requireStaff(req, res);

    if (!user) return true;

    sendJSON(res, 200, {
      tests: [...data.tests].reverse()
    });

    return true;
  }

  const testMatch = pathname.match(
    /^\/api\/admin\/tests\/([^/]+)$/
  );

  if (testMatch && req.method === "DELETE") {
    const user = requireModeratorOrHigher(req, res);

    if (!user) return true;

    const id = decodeURIComponent(testMatch[1]);

    const index = data.tests.findIndex(
      test => String(test.id) === String(id)
    );

    if (index === -1) {
      error(res, 404, "Test not found.");
      return true;
    }

    data.tests.splice(index, 1);

    saveData();

    sendJSON(res, 200, {
      ok: true
    });

    return true;
  }

  /*
   * ADMIN ACCOUNT MANAGEMENT
   */

  if (req.method === "GET" && pathname === "/api/users") {
    const user = requireAdmin(req, res);

    if (!user) return true;

    sendJSON(res, 200, {
      users: data.users.map(publicUser)
    });

    return true;
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const admin = requireAdmin(req, res);

    if (!admin) return true;

    try {
      const body = await readBody(req);

      const username = String(
        body.username ||
        body.minecraftUsername ||
        ""
      ).trim();

      const discordUsername = String(
        body.discordUsername ||
        body.discord ||
        ""
      ).trim();

      const password = String(body.password || "");
      const role = String(body.role || "user").toLowerCase();

      if (!safeUsername(username)) {
        error(res, 400, "Invalid Minecraft username.");
        return true;
      }

      if (!discordUsername) {
        error(res, 400, "Discord username is required.");
        return true;
      }

      if (password.length < 6) {
        error(res, 400, "Password must be at least 6 characters.");
        return true;
      }

      if (!VALID_ROLES.includes(role)) {
        error(res, 400, "Invalid role.");
        return true;
      }

      const exists = data.users.some(
        candidate =>
          candidate.username.toLowerCase() ===
          username.toLowerCase()
      );

      if (exists) {
        error(res, 409, "That account already exists.");
        return true;
      }

      const credentials = createPassword(password);

      const user = {
        id: generateId("user_"),
        username,
        discordUsername,
        salt: credentials.salt,
        hash: credentials.hash,
        role,
        created: new Date().toISOString()
      };

      data.users.push(user);

      saveData();

      sendJSON(res, 201, {
        user: publicUser(user)
      });

      return true;
    } catch (err) {
      error(res, 400, err.message || "Could not create account.");
      return true;
    }
  }

  const userMatch = pathname.match(
    /^\/api\/users\/([^/]+)$/
  );

  if (userMatch) {
    const admin = requireAdmin(req, res);

    if (!admin) return true;

    const id = decodeURIComponent(userMatch[1]);

    const target = data.users.find(
      user => String(user.id) === String(id)
    );

    if (!target) {
      error(res, 404, "User not found.");
      return true;
    }

    if (req.method === "PATCH") {
      try {
        const body = await readBody(req);

        if (body.role !== undefined) {
          const role = String(body.role).toLowerCase();

          if (!VALID_ROLES.includes(role)) {
            error(res, 400, "Invalid role.");
            return true;
          }

          /*
           * Never allow the last admin to be removed.
           */
          if (
            target.role === "admin" &&
            role !== "admin"
          ) {
            const adminCount = data.users.filter(
              user => user.role === "admin"
            ).length;

            if (adminCount <= 1) {
              error(
                res,
                400,
                "There must always be at least one admin."
              );
              return true;
            }
          }

          target.role = role;
        }

        if (body.discordUsername !== undefined) {
          target.discordUsername = String(
            body.discordUsername
          ).trim();
        }

        if (body.password !== undefined) {
          const password = String(body.password);

          if (password.length < 6) {
            error(
              res,
              400,
              "Password must be at least 6 characters."
            );
            return true;
          }

          const credentials = createPassword(password);

          target.salt = credentials.salt;
          target.hash = credentials.hash;
        }

        saveData();

        sendJSON(res, 200, {
          user: publicUser(target)
        });

        return true;
      } catch (err) {
        error(res, 400, err.message || "Could not update user.");
        return true;
      }
    }

    if (req.method === "DELETE") {
      if (target.id === admin.id) {
        error(res, 400, "You cannot delete your own account here.");
        return true;
      }

      if (target.role === "admin") {
        const adminCount = data.users.filter(
          user => user.role === "admin"
        ).length;

        if (adminCount <= 1) {
          error(
            res,
            400,
            "There must always be at least one admin."
          );
          return true;
        }
      }

      data.users = data.users.filter(
        user => user.id !== target.id
      );

      for (const [token, session] of Object.entries(data.sessions)) {
        if (session.uid === target.id) {
          delete data.sessions[token];
        }
      }

      saveData();

      sendJSON(res, 200, {
        ok: true
      });

      return true;
    }
  }

  /*
   * TEMP ACCOUNT DELETE
   */

  if (
    req.method === "POST" &&
    pathname === "/api/temp-delete-account"
  ) {
    const user = getCurrentUser(req);

    if (!user) {
      error(res, 401, "You must be logged in.");
      return true;
    }

    if (user.role === "admin") {
      const adminCount = data.users.filter(
        candidate => candidate.role === "admin"
      ).length;

      if (adminCount <= 1) {
        error(
          res,
          400,
          "The last admin account cannot be deleted."
        );
        return true;
      }
    }

    data.users = data.users.filter(
      candidate => candidate.id !== user.id
    );

    for (const [token, session] of Object.entries(data.sessions)) {
      if (session.uid === user.id) {
        delete data.sessions[token];
      }
    }

    saveData();

    sendJSON(
      res,
      200,
      {
        ok: true
      },
      {
        "Set-Cookie": clearSessionCookie()
      }
    );

    return true;
  }

  return false;
}

function serveStatic(req, res, pathname) {
  let filePath;

  if (pathname === "/") {
    filePath = path.join(__dirname, "index.html");
  } else {
    const clean = pathname.replace(/^\/+/, "");

    filePath = path.join(__dirname, clean);
  }

  /*
   * Prevent ../ traversal.
   */
  const resolved = path.resolve(filePath);
  const root = path.resolve(__dirname);

  if (!resolved.startsWith(root)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(resolved)) {
    sendText(res, 404, "Not found");
    return;
  }

  const stat = fs.statSync(resolved);

  if (!stat.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(resolved).toLowerCase();

  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };

  res.writeHead(200, {
    "Content-Type": `${types[ext] || "application/octet-stream"}; charset=utf-8",
    "Cache-Control": ext === ".html"
      ? "no-cache"
      : "public, max-age=3600"
  });

  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  /*
   * Security headers.
   */
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  /*
   * CORS.
   */
  const origin = req.headers.origin;

  const allowedOrigins = [
    "https://frosttiers.xyz",
    "https://www.frosttiers.xyz",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.reqOrigin = origin;
  } else {
    res.reqOrigin = "https://frosttiers.xyz";
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": res.reqOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    });

    res.end();
    return;
  }

  try {
    const parsed = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    const pathname = parsed.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleAPI(req, res, pathname);

      if (handled) return;

      error(res, 404, "API endpoint not found.");
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    console.error("Server error:", err);

    if (!res.headersSent) {
      error(res, 500, "Internal server error.");
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`FrostTiers server running on ${HOST}:${PORT}`);
  console.log(`Players: ${Object.keys(data.players).length}`);
  console.log(`Users: ${data.users.length}`);
  console.log(`Tests: ${data.tests.length}`);
});
