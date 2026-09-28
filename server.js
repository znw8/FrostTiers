// FrostTiers server. No dependencies. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DBF = path.join(__dirname, 'data.json');

const PUB = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;

const FILES = new Set([
  'index.html',
  'app.js',
  'extra.css',
  'logo.jpg',
  'logo.jpeg',
  'logo.png'
]);

let cfg = {};

try {
  cfg = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
  );
} catch {}

const HOOK =
  process.env.DISCORD_WEBHOOK_URL ??
  cfg.discordWebhook ??
  '';

let db = {
  users: [],
  sessions: {},
  players: {},
  tests: []
};

try {
  db = Object.assign(
    db,
    JSON.parse(fs.readFileSync(DBF, 'utf8'))
  );
} catch {}

const save = () => {
  fs.writeFileSync(
    DBF + '.tmp',
    JSON.stringify(db, null, 2)
  );

  fs.renameSync(
    DBF + '.tmp',
    DBF
  );
};

const MODES = {
  vanilla: 'Vanilla',
  uhc: 'UHC',
  pot: 'Pot',
  nethop: 'NethOP',
  smp: 'SMP',
  sword: 'Sword',
  axe: 'Axe',
  mace: 'Mace'
};

const TI = [
  'HT1',
  'LT1',
  'HT2',
  'LT2',
  'HT3',
  'LT3',
  'HT4',
  'LT4',
  'HT5',
  'LT5'
];

const PTS = [
  60,
  45,
  30,
  20,
  10,
  6,
  4,
  2,
  1,
  0
];

const REG = {
  NA: 'North America',
  EU: 'Europe',
  AS: 'Asia',
  OC: 'Oceania',
  SA: 'South America',
  AF: 'Africa'
};

const full = i =>
  (i % 2 ? 'Low' : 'High') +
  ' Tier ' +
  (Math.floor(i / 2) + 1);

const title = p =>
  p >= 400 ? 'Combat Grandmaster' :
  p >= 250 ? 'Combat Master' :
  p >= 100 ? 'Combat Ace' :
  p >= 50 ? 'Combat Cadet' :
  p >= 10 ? 'Combat Novice' :
  'Combat Rookie';

const NAME = /^[A-Za-z0-9_]{3,16}$/;

const hashPw = (
  pw,
  salt = crypto.randomBytes(16).toString('hex')
) => ({
  salt,
  hash: crypto
    .scryptSync(pw, salt, 64)
    .toString('hex')
});

const okPw = (pw, u) => {
  try {
    const a = Buffer.from(
      crypto.scryptSync(pw, u.salt, 64).toString('hex')
    );

    const b = Buffer.from(u.hash);

    return (
      a.length === b.length &&
      crypto.timingSafeEqual(a, b)
    );
  } catch {
    return false;
  }
};

const sha = t =>
  crypto
    .createHash('sha256')
    .update(t)
    .digest('hex');

const cookies = r =>
  Object.fromEntries(
    (r.headers.cookie || '')
      .split(';')
      .map(c => c.trim().split('='))
      .filter(c => c[0])
  );

const userOf = r => {
  const token = cookies(r).sid;

  if (!token) return null;

  const session = db.sessions[sha(token)];

  if (!session) return null;

  if (session.exp < Date.now()) {
    delete db.sessions[sha(token)];
    save();
    return null;
  }

  return db.users.find(
    u => u.id === session.uid
  ) || null;
};

const pub = u => ({
  id: u.id,
  username: u.username,
  minecraftUsername: u.username,
  discordUsername: u.discordUsername || '',
  role: u.role,
  created: u.created
});

const hits = new Map();

const limited = ip => {
  const now = Date.now();

  const h = (hits.get(ip) || [])
    .filter(t => now - t < 600000);

  h.push(now);

  hits.set(ip, h);

  return h.length > 15;
};

function send(res, code, obj, extra = {}) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...extra
  });

  res.end(JSON.stringify(obj));
}

const body = r =>
  new Promise((resolve, reject) => {
    let s = '';

    r.on('data', c => {
      s += c;

      if (s.length > 20000) {
        reject(new Error('Request too large'));
        r.destroy();
      }
    });

    r.on('end', () => {
      try {
        resolve(JSON.parse(s || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });

function startSession(req, res, u) {
  const token = crypto
    .randomBytes(32)
    .toString('hex');

  db.sessions[sha(token)] = {
    uid: u.id,
    exp: Date.now() + 30 * 864e5
  };

  save();

  return {
    'set-cookie':
      `sid=${token}; ` +
      `HttpOnly; ` +
      `SameSite=None; ` +
      `Path=/; ` +
      `Max-Age=${30 * 86400}; ` +
      `Secure`
  };
}

async function postHook(t, by) {
  if (!HOOK) return false;

  const ds = new Date(t.at).toLocaleString(
    'en-US',
    {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }
  );

  const tierIndex = TI.indexOf(t.tier);

  const embed = {
    title: `${t.player} — Test Results`,
    color: 0xC0392B,

    thumbnail: {
      url:
        `https://mc-heads.net/avatar/` +
        `${encodeURIComponent(t.player)}/128`
    },

    fields: [
      {
        name: 'Tester',
        value: '@' + by
      },
      {
        name: 'Gamemode',
        value: MODES[t.mode]
      },
      {
        name: 'Region',
        value: REG[t.region]
      },
      {
        name: 'Username',
        value: t.player
      },
      {
        name: 'Previous Rank',
        value: t.previous
      },
      {
        name: 'Rank Earned',
        value:
          tierIndex >= 0
            ? full(tierIndex)
            : t.tier
      }
    ],

    footer: {
      text:
        `Test ID: ${t.id} | ${ds} UTC`
    }
  };

  try {
    const r = await fetch(HOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    return r.ok;
  } catch {
    return false;
  }
}

const need = (u, ...roles) =>
  !!u && roles.includes(u.role);

async function api(req, res, url) {
  const m = req.method;
  const p = url.pathname;
  const u = userOf(req);

  if (
    m !== 'GET' &&
    !(req.headers['content-type'] || '')
      .includes('application/json')
  ) {
    return send(res, 415, {
      error: 'JSON required'
    });
  }

  const b =
    m === 'GET'
      ? {}
      : await body(req);

  const ip = req.socket.remoteAddress;

  if (
    p === '/api/players' &&
    m === 'GET'
  ) {
    const list = Object.values(db.players)
      .map(pl => {
        const pts =
          Object.values(pl.tiers)
            .reduce(
              (a, i) =>
                a + (PTS[i] || 0),
              0
            );

        return {
          n: pl.name,
          r: pl.region,
          tiers: pl.tiers,
          pts,
          t: title(pts)
        };
      })
      .sort(
        (a, c) =>
          c.pts - a.pts
      );

    return send(res, 200, list);
  }

  if (
    p === '/api/auth/me' &&
    m === 'GET'
  ) {
    return send(res, 200, {
      user: u ? pub(u) : null
    });
  }

  if (
    p === '/api/auth/signup' &&
    m === 'POST'
  ) {
    if (limited(ip)) {
      return send(res, 429, {
        error:
          'Too many attempts. Try again later.'
      });
    }

    const minecraftUsername =
      String(b.minecraftUsername || '').trim();

    const discordUsername =
      String(b.discordUsername || '').trim();

    const password =
      String(b.password || '');

    const confirmPassword =
      String(b.confirmPassword || '');

    if (
      !/^[A-Za-z0-9_]{3,16}$/
        .test(minecraftUsername)
    ) {
      return send(res, 400, {
        error:
          'Minecraft username must be 3-16 letters, numbers or underscores.'
      });
    }

    if (
      discordUsername.length < 2 ||
      discordUsername.length > 100
    ) {
      return send(res, 400, {
        error:
          'Enter a valid Discord username.'
      });
    }

    if (password.length < 8) {
      return send(res, 400, {
        error:
          'Password must be at least 8 characters.'
      });
    }

    if (
      confirmPassword &&
      password !== confirmPassword
    ) {
      return send(res, 400, {
        error:
          'Passwords do not match.'
      });
    }

    if (
      db.users.some(
        x =>
          x.username.toLowerCase() ===
          minecraftUsername.toLowerCase()
      )
    ) {
      return send(res, 409, {
        error:
          'That Minecraft username already has an account.'
      });
    }

    const nu = {
      id:
        crypto
          .randomBytes(8)
          .toString('hex'),

      username:
        minecraftUsername,

      discordUsername,

      ...hashPw(password),

      role:
        db.users.length
          ? 'user'
          : 'admin',

      created:
        Date.now()
    };

    db.users.push(nu);
    save();

    return send(
      res,
      200,
      {
        user: pub(nu)
      },
      startSession(
        req,
        res,
        nu
      )
    );
  }

  if (
    p === '/api/auth/login' &&
    m === 'POST'
  ) {
    if (limited(ip)) {
      return send(res, 429, {
        error:
          'Too many attempts. Try again later.'
      });
    }

    const minecraftUsername =
      String(b.minecraftUsername || '').trim();

    const password =
      String(b.password || '');

    const account =
      db.users.find(
        v =>
          v.username.toLowerCase() ===
          minecraftUsername.toLowerCase()
      );

    if (
      !account ||
      !okPw(password, account)
    ) {
      return send(res, 401, {
        error:
          'Wrong Minecraft username or password.'
      });
    }

    return send(
      res,
      200,
      {
        user: pub(account)
      },
      startSession(
        req,
        res,
        account
      )
    );
  }

  if (
    p === '/api/auth/logout' &&
    m === 'POST'
  ) {
    const token =
      cookies(req).sid;

    if (token) {
      delete db.sessions[sha(token)];
      save();
    }

    return send(
      res,
      200,
      {
        ok: true
      },
      {
        'set-cookie':
          'sid=; HttpOnly; SameSite=None; Path=/; Max-Age=0; Secure'
      }
    );
  }

  if (
    p === '/api/me' &&
    m === 'GET'
  ) {
    return send(res, 200, {
      user: u ? pub(u) : null
    });
  }

  if (
    p === '/api/tests' &&
    m === 'GET'
  ) {
    if (!need(u, 'tester', 'admin')) {
      return send(res, 403, {
        error: 'Not allowed.'
      });
    }

    return send(
      res,
      200,
      db.tests.slice(-30).reverse()
    );
  }

  if (
    p === '/api/tests' &&
    m === 'POST'
  ) {
    if (!need(u, 'tester', 'admin')) {
      return send(res, 403, {
        error:
          'Only testers can submit results.'
      });
    }

    const player =
      String(b.player || '').trim();

    const region = b.region;
    const mode = b.mode;
    const ti = TI.indexOf(b.tier);

    if (!NAME.test(player)) {
      return send(res, 400, {
        error:
          'Enter a valid Minecraft username.'
      });
    }

    if (
      !REG[region] ||
      !MODES[mode] ||
      ti < 0
    ) {
      return send(res, 400, {
        error:
          'Pick a region, gamemode and tier.'
      });
    }

    const k = player.toLowerCase();

    const pl =
      db.players[k] ||
      (db.players[k] = {
        name: player,
        region,
        tiers: {}
      });

    const prev =
      pl.tiers[mode] == null
        ? 'Unranked'
        : full(pl.tiers[mode]);

    pl.name = player;
    pl.region = region;
    pl.tiers[mode] = ti;

    const t = {
      id:
        crypto
          .randomBytes(12)
          .toString('hex'),

      player,
      region,
      mode,
      tier: TI[ti],
      previous: prev,
      by: u.username,
      at: Date.now()
    };

    db.tests.push(t);

    if (db.tests.length > 500) {
      db.tests.shift();
    }

    save();

    return send(
      res,
      200,
      {
        ok: true,
        id: t.id,
        webhook:
          await postHook(
            t,
            u.username
          )
      }
    );
  }

  if (
    p.startsWith('/api/users')
  ) {
    if (!need(u, 'admin')) {
      return send(res, 403, {
        error: 'Admins only.'
      });
    }

    const id = p.split('/')[3];

    if (!id && m === 'GET') {
      return send(
        res,
        200,
        db.users.map(pub)
      );
    }

    if (!id && m === 'POST') {
      const name =
        String(b.username || '').trim();

      const discordUsername =
        String(b.discordUsername || '').trim();

      const pw =
        String(b.password || '');

      if (
        !/^[A-Za-z0-9_]{3,16}$/.test(name) ||
        pw.length < 8 ||
        !['user', 'tester', 'admin'].includes(b.role)
      ) {
        return send(res, 400, {
          error:
            'Need a valid Minecraft username, an 8+ character password and a valid role.'
        });
      }

      if (
        db.users.some(
          x =>
            x.username.toLowerCase() ===
            name.toLowerCase()
        )
      ) {
        return send(res, 409, {
          error:
            'That Minecraft username is taken.'
        });
      }

      const nu = {
        id:
          crypto
            .randomBytes(8)
            .toString('hex'),

        username: name,

        discordUsername,

        ...hashPw(pw),

        role: b.role,

        created: Date.now()
      };

      db.users.push(nu);
      save();

      return send(
        res,
        200,
        {
          user: pub(nu)
        }
      );
    }

    const target =
      db.users.find(
        x => x.id === id
      );

    if (!target) {
      return send(res, 404, {
        error: 'User not found.'
      });
    }

    const admins =
      db.users.filter(
        x => x.role === 'admin'
      ).length;

    if (m === 'PATCH') {
      if (
        !['user', 'tester', 'admin'].includes(b.role)
      ) {
        return send(res, 400, {
          error: 'Bad role.'
        });
      }

      if (
        target.role === 'admin' &&
        b.role !== 'admin' &&
        admins < 2
      ) {
        return send(res, 400, {
          error:
            'There must always be one admin.'
        });
      }

      target.role = b.role;
      save();

      return send(
        res,
        200,
        {
          user: pub(target)
        }
      );
    }

    if (m === 'DELETE') {
      if (
        target.role === 'admin' &&
        admins < 2
      ) {
        return send(res, 400, {
          error:
            'There must always be one admin.'
        });
      }

      db.users =
        db.users.filter(
          x => x.id !== id
        );

      for (
        const [k, s]
        of Object.entries(db.sessions)
      ) {
        if (s.uid === id) {
          delete db.sessions[k];
        }
      }

      save();

      return send(res, 200, {
        ok: true
      });
    }
  }

  // --------------------------------------------------
  // TEMPORARY ACCOUNT DELETE
  // --------------------------------------------------

  if (
    p === '/api/temp-delete-account' &&
    m === 'POST'
  ) {
    const resetKey =
      String(b.resetKey || '');

    const minecraftUsername =
      String(
        b.minecraftUsername || ''
      ).trim();

    if (
      !process.env.RESET_KEY ||
      resetKey !== process.env.RESET_KEY
    ) {
      return send(res, 403, {
        error: 'Invalid reset key.'
      });
    }

    const account =
      db.users.find(
        v =>
          v.username.toLowerCase() ===
          minecraftUsername.toLowerCase()
      );

    if (!account) {
      return send(res, 404, {
        error: 'Account not found.'
      });
    }

    db.users =
      db.users.filter(
        v => v.id !== account.id
      );

    for (
      const [k, s]
      of Object.entries(db.sessions)
    ) {
      if (s.uid === account.id) {
        delete db.sessions[k];
      }
    }

    save();

    return send(res, 200, {
      ok: true,
      message: 'Account deleted successfully.'
    });
  }

  return send(res, 404, {
    error: 'Not found'
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server =
  http.createServer(
    async (req, res) => {

      res.setHeader(
        'access-control-allow-origin',
        'https://frosttiers.xyz'
      );

      res.setHeader(
        'access-control-allow-credentials',
        'true'
      );

      res.setHeader(
        'access-control-allow-headers',
        'Content-Type'
      );

      res.setHeader(
        'access-control-allow-methods',
        'GET, POST, PATCH, DELETE, OPTIONS'
      );

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      res.setHeader(
        'x-content-type-options',
        'nosniff'
      );

      res.setHeader(
        'referrer-policy',
        'same-origin'
      );

      res.setHeader(
        'content-security-policy',
        "default-src 'self'; " +
        "img-src 'self' https://mc-heads.net data:; " +
        "style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "frame-ancestors 'none'"
      );

      const url =
        new URL(
          req.url,
          'http://x'
        );

      try {
        if (
          url.pathname.startsWith('/api/')
        ) {
          return await api(
            req,
            res,
            url
          );
        }

        const name =
          url.pathname === '/'
            ? 'index.html'
            : url.pathname.slice(1);

        let f =
          FILES.has(name)
            ? path.join(PUB, name)
            : null;

        if (
          f &&
          name === 'logo.jpg' &&
          !fs.existsSync(f)
        ) {
          f =
            path.join(
              PUB,
              'logo.jpeg'
            );
        }

        if (
          !f ||
          !fs.existsSync(f)
        ) {
          res.writeHead(404);
          return res.end('Not found');
        }

        res.writeHead(
          200,
          {
            'content-type':
              MIME[
                path.extname(f)
              ] ||
              'application/octet-stream'
          }
        );

        fs.createReadStream(f)
          .pipe(res);

      } catch (e) {
        if (!res.headersSent) {
          send(
            res,
            400,
            {
              error:
                e.message ||
                'Bad request'
            }
          );
        } else {
          res.end();
        }
      }
    }
  );

server.listen(
  PORT,
  () =>
    console.log(
      'FrostTiers running on port ' +
      PORT +
      (
        HOOK
          ? ''
          : ' (no Discord webhook set)'
      )
    )
);
