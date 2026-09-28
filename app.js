(() => {
  const API = "https://frosttiers.onrender.com";

  const $ = s => document.querySelector(s);

  const TI = [
    "HT1","LT1","HT2","LT2","HT3",
    "LT3","HT4","LT4","HT5","LT5"
  ];

  const MODES = [
    ["vanilla","Vanilla"],
    ["uhc","UHC"],
    ["pot","Pot"],
    ["nethop","NethOP"],
    ["smp","SMP"],
    ["sword","Sword"],
    ["axe","Axe"],
    ["mace","Mace"]
  ];

  const REG = [
    ["NA","North America"],
    ["EU","Europe"],
    ["AS","Asia"],
    ["OC","Oceania"],
    ["SA","South America"],
    ["AF","Africa"]
  ];

  const esc = s =>
    String(s ?? "").replace(
      /[&<>"']/g,
      c => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
      }[c])
    );

  const opts = (arr, selected) =>
    arr.map(([v,l]) =>
      `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(l)}</option>`
    ).join("");

  const modeName = mode =>
    MODES.find(x => x[0] === mode)?.[1] || mode;

  const regionName = region =>
    REG.find(x => x[0] === region)?.[1] || region;

  const tierIndex = tier =>
    TI.indexOf(tier);

  const tierName = index =>
    TI[index] || "Unranked";

  const formatDate = timestamp => {
    if (!timestamp) return "Unknown";

    return new Date(timestamp).toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  };

  let me = null;

  /*
   * --------------------------------------------------
   * API
   * --------------------------------------------------
   */

  async function api(
    url,
    method = "GET",
    data = undefined
  ) {
    const endpoint =
      url.startsWith("/api/")
        ? API + url
        : url;

    const config = {
      method,
      credentials: "include",
      headers: {}
    };

    if (data !== undefined) {
      config.headers["Content-Type"] =
        "application/json";

      config.body =
        JSON.stringify(data);
    }

    const response =
      await fetch(
        endpoint,
        config
      );

    let result = {};

    try {
      result =
        await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `Request failed (${response.status})`
      );
    }

    return result;
  }

  /*
   * --------------------------------------------------
   * MODAL
   * --------------------------------------------------
   */

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <dialog id="dlg">
        <button
          class="dx"
          aria-label="Close"
          type="button"
        >×</button>

        <div id="dc"></div>
      </dialog>
    `
  );

  const dlg = $("#dlg");
  const dc = $("#dc");

  $(".dx").onclick = () =>
    dlg.close();

  dlg.addEventListener(
    "click",
    e => {
      if (
        e.target === dlg
      ) {
        dlg.close();
      }
    }
  );

  const open = html => {
    dc.innerHTML = html;

    if (!dlg.open) {
      dlg.showModal();
    }

    document.body.classList.remove(
      "open"
    );
  };

  const msg = (
    text,
    bad = false
  ) => {
    const el = $("#msg");

    if (!el) return;

    el.textContent = text;
    el.className =
      bad ? "bad" : "ok";
  };

  /*
   * --------------------------------------------------
   * NAVIGATION
   * --------------------------------------------------
   */

  function menu() {
    const nav =
      $(".dr nav");

    if (!nav) return;

    nav
      .querySelectorAll(
        ".acct"
      )
      .forEach(
        x => x.remove()
      );

    const link = (
      action,
      text
    ) =>
      `<a class="acct" href="#" data-a="${action}">${text}</a>`;

    let html = "";

    if (me) {
      if (
        me.role !== "user"
      ) {
        html += link(
          "test",
          "Submit a test"
        );
      }

      if (
        me.role === "admin"
      ) {
        html += link(
          "admin",
          "Admin panel"
        );
      }

      html += link(
        "out",
        `Log out (@${esc(me.username)})`
      );
    } else {
      html += link(
        "login",
        "Log in / Sign up"
      );
    }

    nav.insertAdjacentHTML(
      "beforeend",
      html
    );
  }

  const drawer =
    $(".dr");

  if (drawer) {
    drawer.addEventListener(
      "click",
      async e => {
        const a =
          e.target.closest(
            "[data-a]"
          );

        if (!a) return;

        e.preventDefault();

        const action =
          a.dataset.a;

        if (
          action ===
          "login"
        ) {
          auth("login");
        }

        if (
          action ===
          "test"
        ) {
          testView();
        }

        if (
          action ===
          "admin"
        ) {
          adminView();
        }

        if (
          action ===
          "out"
        ) {
          try {
            await api(
              "/api/auth/logout",
              "POST"
            );
          } catch {}

          me = null;

          menu();

          document.body.classList.remove(
            "open"
          );
        }
      }
    );
  }

  /*
   * --------------------------------------------------
   * AUTH
   * --------------------------------------------------
   */

  function auth(
    mode = "login"
  ) {
    const register =
      mode === "register";

    open(`
      <h2>
        ${register
          ? "Create account"
          : "Log in"}
      </h2>

      <form id="f">

        <label>
          Minecraft username
          <input
            name="minecraftUsername"
            autocomplete="username"
            required
            minlength="3"
            maxlength="16"
            pattern="[A-Za-z0-9_]{3,16}"
          >
        </label>

        ${
          register
            ? `
              <label>
                Discord username
                <input
                  name="discordUsername"
                  required
                  minlength="2"
                  maxlength="100"
                >
              </label>
            `
            : ""
        }

        <label>
          Password
          <input
            name="password"
            type="password"
            autocomplete="${
              register
                ? "new-password"
                : "current-password"
            }"
            required
            minlength="${
              register ? 8 : 1
            }"
          >
        </label>

        ${
          register
            ? `
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                >
              </label>
            `
            : ""
        }

        <button
          class="go"
          type="submit"
        >
          ${
            register
              ? "Create account"
              : "Log in"
          }
        </button>

        <div id="msg"></div>
      </form>

      <p class="sw">
        ${
          register
            ? "Already have an account?"
            : "New here?"
        }

        <a
          href="#"
          id="sw"
        >
          ${
            register
              ? "Log in"
              : "Create an account"
          }
        </a>
      </p>
    `);

    $("#sw").onclick =
      e => {
        e.preventDefault();

        auth(
          register
            ? "login"
            : "register"
        );
      };

    $("#f").onsubmit =
      async e => {
        e.preventDefault();

        const data =
          Object.fromEntries(
            new FormData(
              e.target
            )
          );

        try {
          const result =
            await api(
              register
                ? "/api/auth/signup"
                : "/api/auth/login",
              "POST",
              data
            );

          me =
            result.user;

          menu();

          dlg.close();

          if (
            me.role ===
            "admin"
          ) {
            setTimeout(
              adminView,
              150
            );
          }
        } catch (error) {
          msg(
            error.message,
            true
          );
        }
      };
  }

  /*
   * --------------------------------------------------
   * TEST SUBMISSION
   * --------------------------------------------------
   */

  function testView() {
    open(`
      <h2>Submit a test result</h2>

      <form id="f">

        <label>
          Minecraft username
          <input
            name="player"
            required
            pattern="[A-Za-z0-9_]{3,16}"
            maxlength="16"
          >
        </label>

        <label>
          Region
          <select name="region">
            ${opts(REG)}
          </select>
        </label>

        <label>
          Gamemode
          <select name="mode">
            ${opts(MODES)}
          </select>
        </label>

        <label>
          Tier earned
          <select name="tier">
            ${TI.map(
              t =>
                `<option value="${t}">${t}</option>`
            ).join("")}
          </select>
        </label>

        <button
          class="go"
          type="submit"
        >
          Submit result
        </button>

        <div id="msg"></div>
      </form>

      <h3>Recent tests</h3>

      <div
        id="hist"
        class="list"
      >
        Loading...
      </div>
    `);

    hist();

    $("#f").onsubmit =
      async e => {
        e.preventDefault();

        try {
          const result =
            await api(
              "/api/tests",
              "POST",
              Object.fromEntries(
                new FormData(
                  e.target
                )
              )
            );

          msg(
            result.webhook
              ? "Saved and posted to Discord."
              : "Saved, but the Discord post failed.",
            !result.webhook
          );

          e.target.player.value =
            "";

          if (
            window.loadPlayers
          ) {
            window.loadPlayers();
          }

          hist();
        } catch (error) {
          msg(
            error.message,
            true
          );
        }
      };
  }

  async function hist() {
    try {
      const tests =
        await api(
          "/api/tests"
        );

      const el =
        $("#hist");

      if (!el) return;

      el.innerHTML =
        tests.length
          ? tests
              .slice(0, 30)
              .map(
                test =>
                  `
                  <div class="row">
                    <span>
                      <b>
                        ${esc(
                          test.player
                        )}
                      </b>

                      ${esc(
                        modeName(
                          test.mode
                        )
                      )}

                      ${esc(
                        test.tier
                      )}
                    </span>

                    <small>
                      @${esc(
                        test.by
                      )}
                    </small>
                  </div>
                  `
              )
              .join("")
          : "No tests yet.";
    } catch {
      const el =
        $("#hist");

      if (el) {
        el.textContent =
          "Unable to load tests.";
      }
    }
  }

  /*
   * --------------------------------------------------
   * ADMIN PANEL
   * --------------------------------------------------
   */

  async function adminView() {
    if (
      !me ||
      me.role !== "admin"
    ) {
      return auth("login");
    }

    open(`
      <div class="admin-head">
        <div>
          <h2>Admin panel</h2>
          <p class="muted">
            Manage FrostTiers from one place.
          </p>
        </div>
      </div>

      <div
        class="admin-tabs"
        role="tablist"
      >
        <button
          type="button"
          class="admin-tab active"
          data-tab="overview"
        >
          Overview
        </button>

        <button
          type="button"
          class="admin-tab"
          data-tab="accounts"
        >
          Accounts
        </button>

        <button
          type="button"
          class="admin-tab"
          data-tab="players"
        >
          Players
        </button>

        <button
          type="button"
          class="admin-tab"
          data-tab="tests"
        >
          Tests
        </button>
      </div>

      <div id="admin-content">
        Loading...
      </div>
    `);

    const tabs =
      dc.querySelectorAll(
        ".admin-tab"
      );

    tabs.forEach(
      button => {
        button.onclick =
          () => {
            tabs.forEach(
              x =>
                x.classList.remove(
                  "active"
                )
            );

            button.classList.add(
              "active"
            );

            adminTab(
              button.dataset.tab
            );
          };
      }
    );

    await adminTab(
      "overview"
    );
  }

  async function adminTab(
    tab
  ) {
    const content =
      $("#admin-content");

    if (!content) return;

    content.innerHTML =
      `<div class="admin-loading">Loading...</div>`;

    try {
      if (
        tab ===
        "overview"
      ) {
        await adminOverview(
          content
        );
      }

      if (
        tab ===
        "accounts"
      ) {
        await adminAccounts(
          content
        );
      }

      if (
        tab ===
        "players"
      ) {
        await adminPlayers(
          content
        );
      }

      if (
        tab ===
        "tests"
      ) {
        await adminTests(
          content
        );
      }
    } catch (error) {
      content.innerHTML = `
        <div class="admin-error">
          ${esc(
            error.message
          )}
        </div>
      `;
    }
  }

  /*
   * ADMIN OVERVIEW
   */

  async function adminOverview(
    content
  ) {
    const data =
      await api(
        "/api/admin/dashboard"
      );

    const s =
      data.stats;

    content.innerHTML = `
      <div class="stat-grid">

        <div class="stat-card">
          <span>Accounts</span>
          <strong>${s.users}</strong>
        </div>

        <div class="stat-card">
          <span>Players</span>
          <strong>${s.players}</strong>
        </div>

        <div class="stat-card">
          <span>Tests</span>
          <strong>${s.tests}</strong>
        </div>

        <div class="stat-card">
          <span>Testers</span>
          <strong>${s.testers}</strong>
        </div>

        <div class="stat-card">
          <span>Admins</span>
          <strong>${s.admins}</strong>
        </div>

      </div>

      <div class="admin-section">
        <div class="section-head">
          <div>
            <h3>Recent tests</h3>
            <p class="muted">
              Latest tier results submitted.
            </p>
          </div>

          <button
            class="small-btn"
            id="open-tests"
            type="button"
          >
            View all
          </button>
        </div>

        <div class="admin-list">
          ${
            data.recentTests.length
              ? data.recentTests
                  .map(
                    test =>
                      `
                      <div class="admin-row">
                        <div>
                          <b>
                            ${esc(
                              test.player
                            )}
                          </b>

                          <span class="sub">
                            ${esc(
                              modeName(
                                test.mode
                              )
                            )}
                            ·
                            ${esc(
                              test.region
                            )}
                          </span>
                        </div>

                        <div class="row-right">
                          <strong>
                            ${esc(
                              test.tier
                            )}
                          </strong>

                          <small>
                            @${esc(
                              test.by
                            )}
                          </small>
                        </div>
                      </div>
                      `
                  )
                  .join("")
              : `
                <div class="empty">
                  No tests yet.
                </div>
              `
          }
        </div>
      </div>

      <div class="admin-section">
        <h3>Quick actions</h3>

        <div class="quick-grid">

          <button
            type="button"
            class="quick-btn"
            data-quick="accounts"
          >
            <strong>Manage accounts</strong>
            <span>Create users and change roles.</span>
          </button>

          <button
            type="button"
            class="quick-btn"
            data-quick="players"
          >
            <strong>Manage players</strong>
            <span>Edit regions and tiers.</span>
          </button>

          <button
            type="button"
            class="quick-btn"
            data-quick="tests"
          >
            <strong>Review tests</strong>
            <span>Inspect and remove results.</span>
          </button>

        </div>
      </div>
    `;

    $("#open-tests").onclick =
      () =>
        adminTab(
          "tests"
        );

    content
      .querySelectorAll(
        "[data-quick]"
      )
      .forEach(
        button => {
          button.onclick =
            () =>
              adminTab(
                button.dataset.quick
              );

          button.addEventListener(
            "click",
            () => {
              content
                .parentElement
                ?.querySelectorAll(
                  ".admin-tab"
                )
                .forEach(
                  x => {
                    x.classList.toggle(
                      "active",
                      x.dataset.tab ===
                        button.dataset.quick
                    );
                  }
                );
            }
          );
        }
      );
  }

  /*
   * ADMIN ACCOUNTS
   */

  async function adminAccounts(
    content
  ) {
    const users =
      await api(
        "/api/users"
      );

    content.innerHTML = `
      <div class="admin-section">

        <div class="section-head">
          <div>
            <h3>Accounts</h3>
            <p class="muted">
              ${users.length}
              account${
                users.length === 1
                  ? ""
                  : "s"
              }
            </p>
          </div>

          <button
            id="create-account"
            class="small-btn primary"
            type="button"
          >
            + Create account
          </button>
        </div>

        <div class="admin-search">
          <input
            id="account-search"
            placeholder="Search Minecraft or Discord username..."
            autocomplete="off"
          >
        </div>

        <div
          id="account-list"
          class="admin-list"
        ></div>
      </div>
    `;

    const render =
      query => {
        const q =
          query
            .trim()
            .toLowerCase();

        const filtered =
          users.filter(
            user =>
              user.username
                .toLowerCase()
                .includes(q) ||
              String(
                user.discordUsername ||
                ""
              )
                .toLowerCase()
                .includes(q) ||
              user.role
                .toLowerCase()
                .includes(q)
          );

        const list =
          $("#account-list");

        list.innerHTML =
          filtered.length
            ? filtered
                .map(
                  user =>
                    `
                    <div class="admin-row account-row">

                      <div class="user-main">

                        <div class="avatar">
                          ${esc(
                            user.username
                              .charAt(0)
                              .toUpperCase()
                          )}
                        </div>

                        <div>
                          <b>
                            @${esc(
                              user.username
                            )}
                          </b>

                          <span class="sub">
                            ${
                              user.discordUsername
                                ? `Discord: ${esc(
                                    user.discordUsername
                                  )}`
                                : "No Discord username"
                            }
                          </span>

                          <small>
                            Created
                            ${formatDate(
                              user.created
                            )}
                          </small>
                        </div>

                      </div>

                      <div class="account-actions">

                        <select
                          data-role="${esc(
                            user.id
                          )}"
                          aria-label="Role"
                        >
                          ${opts(
                            [
                              [
                                "user",
                                "User"
                              ],
                              [
                                "tester",
                                "Tester"
                              ],
                              [
                                "admin",
                                "Admin"
                              ]
                            ],
                            user.role
                          )}
                        </select>

                        <button
                          class="del"
                          data-delete-user="${esc(
                            user.id
                          )}"
                          type="button"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                    `
                )
                .join("")
            : `
              <div class="empty">
                No matching accounts.
              </div>
            `;
      };

    render("");

    $("#account-search").oninput =
      e =>
        render(
          e.target.value
        );

    $("#create-account").onclick =
      () =>
        createAccount();

    content.onchange =
      async e => {
        const id =
          e.target.dataset.role;

        if (!id) return;

        try {
          await api(
            `/api/users/${encodeURIComponent(
              id
            )}`,
            "PATCH",
            {
              role:
                e.target.value
            }
          );

          await adminAccounts(
            content
          );
        } catch (error) {
          alert(
            error.message
          );

          await adminAccounts(
            content
          );
        }
      };

    content.onclick =
      async e => {
        const id =
          e.target.dataset
            .deleteUser;

        if (!id) return;

        if (
          !confirm(
            "Delete this account? This cannot be undone."
          )
        ) {
          return;
        }

        try {
          await api(
            `/api/users/${encodeURIComponent(
              id
            )}`,
            "DELETE"
          );

          await adminAccounts(
            content
          );
        } catch (error) {
          alert(
            error.message
          );
        }
      };
  }

  function createAccount() {
    open(`
      <h2>Create account</h2>

      <form id="f">

        <label>
          Minecraft username
          <input
            name="username"
            required
            minlength="3"
            maxlength="16"
            pattern="[A-Za-z0-9_]{3,16}"
          >
        </label>

        <label>
          Discord username
          <input
            name="discordUsername"
            maxlength="100"
          >
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minlength="8"
          >
        </label>

        <label>
          Role
          <select name="role">
            <option value="user">
              User
            </option>

            <option value="tester">
              Tester
            </option>

            <option value="admin">
              Admin
            </option>
          </select>
        </label>

        <button
          class="go"
          type="submit"
        >
          Create account
        </button>

        <div id="msg"></div>

      </form>
    `);

    $("#f").onsubmit =
      async e => {
        e.preventDefault();

        try {
          await api(
            "/api/users",
            "POST",
            Object.fromEntries(
              new FormData(
                e.target
              )
            )
          );

          dlg.close();

          adminView();
        } catch (error) {
          msg(
            error.message,
            true
          );
        }
      };
  }

  /*
   * ADMIN PLAYERS
   */

  async function adminPlayers(
    content
  ) {
    const players =
      await api(
        "/api/admin/players"
      );

    content.innerHTML = `
      <div class="admin-section">

        <div class="section-head">
          <div>
            <h3>Players</h3>
            <p class="muted">
              Manage player regions and tiers.
            </p>
          </div>
        </div>

        <div class="admin-search">
          <input
            id="player-search"
            placeholder="Search players..."
            autocomplete="off"
          >
        </div>

        <div
          id="player-list"
          class="admin-list"
        ></div>

      </div>
    `;

    const render =
      query => {
        const q =
          query
            .trim()
            .toLowerCase();

        const filtered =
          players.filter(
            player =>
              player.name
                .toLowerCase()
                .includes(q) ||
              String(
                player.region
              )
                .toLowerCase()
                .includes(q)
          );

        const list =
          $("#player-list");

        list.innerHTML =
          filtered.length
            ? filtered
                .map(
                  player =>
                    `
                    <div class="admin-row">

                      <div>
                        <b>
                          ${esc(
                            player.name
                          )}
                        </b>

                        <span class="sub">
                          ${esc(
                            regionName(
                              player.region
                            )
                          )}
                          ·
                          ${player.pts}
                          points
                        </span>

                        <small>
                          ${esc(
                            player.title
                          )}
                        </small>
                      </div>

                      <button
                        type="button"
                        class="small-btn"
                        data-edit-player="${esc(
                          player.name
                        )}"
                      >
                        Edit
                      </button>

                    </div>
                    `
                )
                .join("")
            : `
              <div class="empty">
                No players found.
              </div>
            `;
      };

    render("");

    $("#player-search").oninput =
      e =>
        render(
          e.target.value
        );

    content.onclick =
      e => {
        const name =
          e.target.dataset
            .editPlayer;

        if (!name) return;

        const player =
          players.find(
            x =>
              x.name ===
              name
          );

        if (player) {
          editPlayer(
            player
          );
        }
      };
  }

  function editPlayer(
    player
  ) {
    open(`
      <h2>
        Edit ${esc(
          player.name
        )}
      </h2>

      <form id="f">

        <label>
          Region
          <select name="region">
            ${opts(
              REG,
              player.region
            )}
          </select>
        </label>

        <div class="tier-editor">

          ${MODES.map(
            ([mode,label]) => {
              const index =
                player.tiers?.[
                  mode
                ];

              return `
                <label>
                  ${esc(label)}

                  <select
                    name="tier_${esc(
                      mode
                    )}"
                  >
                    <option
                      value=""
                    >
                      Unranked
                    </option>

                    ${TI.map(
                      (tier,i) =>
                        `<option value="${i}"${
                          i === index
                            ? " selected"
                            : ""
                        }>${tier}</option>`
                    ).join("")}

                  </select>
                </label>
              `;
            }
          ).join("")}

        </div>

        <button
          class="go"
          type="submit"
        >
          Save player
        </button>

        <button
          class="danger-wide"
          id="delete-player"
          type="button"
        >
          Delete player
        </button>

        <div id="msg"></div>

      </form>
    `);

    $("#delete-player").onclick =
      async () => {
        if (
          !confirm(
            `Delete ${player.name}? This removes their player record and tiers.`
          )
        ) {
          return;
        }

        try {
          await api(
            `/api/admin/players/${encodeURIComponent(
              player.name
            )}`,
            "DELETE"
          );

          dlg.close();

          adminView();
        } catch (error) {
          msg(
            error.message,
            true
          );
        }
      };

    $("#f").onsubmit =
      async e => {
        e.preventDefault();

        const form =
          new FormData(
            e.target
          );

        const tiers = {};

        MODES.forEach(
          ([mode]) => {
            const value =
              form.get(
                `tier_${mode}`
              );

            if (
              value !== ""
            ) {
              tiers[mode] =
                Number(value);
            }
          }
        );

        try {
          await api(
            `/api/admin/players/${encodeURIComponent(
              player.name
            )}`,
            "PATCH",
            {
              region:
                form.get(
                  "region"
                ),
              tiers
            }
          );

          dlg.close();

          adminView();
        } catch (error) {
          msg(
            error.message,
            true
          );
        }
      };
  }

  /*
   * ADMIN TESTS
   */

  async function adminTests(
    content
  ) {
    const tests =
      await api(
        "/api/admin/tests"
      );

    content.innerHTML = `
      <div class="admin-section">

        <div class="section-head">
          <div>
            <h3>Test results</h3>
            <p class="muted">
              Review every submitted test.
            </p>
          </div>
        </div>

        <div class="test-filters">

          <input
            id="test-search"
            placeholder="Search player or tester..."
            autocomplete="off"
          >

          <select id="test-mode">
            <option value="">
              All gamemodes
            </option>

            ${opts(MODES)}
          </select>

          <select id="test-tier">
            <option value="">
              All tiers
            </option>

            ${TI.map(
              tier =>
                `<option value="${tier}">${tier}</option>`
            ).join("")}
          </select>

        </div>

        <div
          id="test-list"
          class="admin-list"
        ></div>

      </div>
    `;

    const render =
      () => {
        const query =
          $("#test-search")
            .value
            .trim()
            .toLowerCase();

        const mode =
          $("#test-mode")
            .value;

        const tier =
          $("#test-tier")
            .value;

        const filtered =
          tests.filter(
            test => {
              const searchMatch =
                !query ||
                test.player
                  .toLowerCase()
                  .includes(query) ||
                test.by
                  .toLowerCase()
                  .includes(query);

              const modeMatch =
                !mode ||
                test.mode ===
                  mode;

              const tierMatch =
                !tier ||
                test.tier ===
                  tier;

              return (
                searchMatch &&
                modeMatch &&
                tierMatch
              );
            }
          );

        const list =
          $("#test-list");

        list.innerHTML =
          filtered.length
            ? filtered
                .map(
                  test =>
                    `
                    <div class="admin-row test-row">

                      <div>

                        <b>
                          ${esc(
                            test.player
                          )}
                        </b>

                        <span class="sub">
                          ${esc(
                            modeName(
                              test.mode
                            )
                          )}
                          ·
                          ${esc(
                            regionName(
                              test.region
                            )
                          )}
                        </span>

                        <small>
                          Previous:
                          ${esc(
                            test.previous
                          )}
                          ·
                          @${esc(
                            test.by
                          )}
                          ·
                          ${formatDate(
                            test.at
                          )}
                        </small>

                      </div>

                      <div class="test-actions">

                        <strong>
                          ${esc(
                            test.tier
                          )}
                        </strong>

                        <button
                          type="button"
                          class="del"
                          data-delete-test="${esc(
                            test.id
                          )}"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                    `
                )
                .join("")
            : `
              <div class="empty">
                No tests match your filters.
              </div>
            `;
      };

    render();

    $("#test-search").oninput =
      render;

    $("#test-mode").onchange =
      render;

    $("#test-tier").onchange =
      render;

    content.onclick =
      async e => {
        const id =
          e.target.dataset
            .deleteTest;

        if (!id) return;

        if (
          !confirm(
            "Delete this test result? This cannot be undone."
          )
        ) {
          return;
        }

        try {
          await api(
            `/api/admin/tests/${encodeURIComponent(
              id
            )}`,
            "DELETE"
          );

          const index =
            tests.findIndex(
              test =>
                test.id ===
                id
            );

          if (
            index !== -1
          ) {
            tests.splice(
              index,
              1
            );
          }

          render();
        } catch (error) {
          alert(
            error.message
          );
        }
      };
  }

  /*
   * --------------------------------------------------
   * STARTUP
   * --------------------------------------------------
   */

  api("/api/me")
    .then(result => {
      me =
        result.user;

      menu();
    })
    .catch(() => {
      me = null;
      menu();
    });
})();
