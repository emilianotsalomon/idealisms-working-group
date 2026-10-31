/* Members' mode of the public reader. With the GitHub token annot.js keeps in this browser, the site also shows what is
   private, fetched from the private repository's members-site branch (tools/publish.py builds it):
     index      the private texts join the one library list, marked "members"; a bar says whether members' mode is on
     graph      the 3D map of the whole library (graph.json from the members' build)
     404 page   a private text, opened at its usual address
     text page  the members' version of a public text when it carries the group's notes
     resources  the Machine Study Resources tab (members only)
   Visitors without a token see the public texts only, and the index tells them members' mode exists. */
(function () {
  const CFG = window.MEMBERS || {};
  if (!CFG.repo) return;
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const token = () => store.get('annot-token') || '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const url = path => `https://api.github.com/repos/${CFG.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${CFG.branch}`;
  const auth = accept => ({ headers: { Authorization: 'Bearer ' + token(), Accept: accept } });
  // the contents API sniffs some binary search shards (ix/*.bin) as UTF-16 and transcodes them, raw and base64 alike (#76);
  // the git blobs API keeps the bytes, so a .bin is fetched by its sha from one listing of its folder
  // shortcut: a contents listing stops at 1,000 files; past that many shards, list ix/ through the git trees API
  const shas = {};
  const shaIn = dir => shas[dir] || (shas[dir] = fetch(url(dir), auth('application/vnd.github+json'))
    .then(r => r.ok ? r.json() : []).then(l => Object.fromEntries(l.map(f => [f.name, f.sha]))));
  const get = path => {
    if (!/\.bin$/.test(path)) return fetch(url(path), auth('application/vnd.github.raw'));
    const i = path.lastIndexOf('/');
    return shaIn(path.slice(0, i)).then(s => s[path.slice(i + 1)]
      ? fetch(`https://api.github.com/repos/${CFG.repo}/git/blobs/${s[path.slice(i + 1)]}`, auth('application/vnd.github.raw'))
      : new Response(null, { status: 404 }));
  };
  const replacePage = html => { document.open(); document.write(html); document.close(); };
  if (token()) window.membersGet = get;             // the index's search and the map read the members' terms.json through this (public copy if refused)
  function shelf() {                                  // members.json, once per browser tab
    let s = null; try { s = sessionStorage.getItem('members-shelf'); } catch (e) {}
    if (s) return Promise.resolve(JSON.parse(s));
    return get('members.json').then(r => r.ok ? r.json() : null).then(j => { if (j) try { sessionStorage.setItem('members-shelf', JSON.stringify(j)); } catch (e) {} return j; });
  }
  function signOut() {
    if (!confirm('Leave members’ mode in this browser? The private texts will be hidden again.')) return;
    store.set('annot-token', ''); try { sessionStorage.removeItem('members-shelf'); } catch (e) {} location.reload();
  }
  function signIn() {                                 // a small dialog that says what members' mode is and how to get in
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:1rem';
    bg.innerHTML = `<form class="an-box" style="font-family:inherit;max-width:32rem;width:100%;background:var(--card,#fffdf8);color:var(--ink,#1f1c17);padding:1.4rem 1.6rem;border-radius:10px;line-height:1.5">
      <h3 style="margin:0 0 .5rem;font-weight:normal;font-size:1.25rem">Member sign-in</h3>
      <p style="margin:.3rem 0">Members of the Idealisms Working Group can read the texts that are not public, and the group’s notes,
      here in the same library. Sign in with a GitHub token that can read the group’s private repository <i>${esc(CFG.repo)}</i>.</p>
      <ol style="margin:.5rem 0 .6rem;padding-left:1.2rem;font-size:.92rem">
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Make a fine-grained token</a>:
            resource owner <b>${esc(CFG.repo.split('/')[0])}</b>, repository <b>${esc(CFG.repo.split('/')[1])}</b>, permission <b>Contents: read and write</b>.</li>
        <li>Paste it below. It stays in this browser only.</li></ol>
      <input name="t" type="password" autocomplete="off" placeholder="github_pat_…" style="width:100%;font:inherit;padding:.45rem .6rem;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--paper,#fff);color:inherit">
      <div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:.9rem">
        <button type="button" data-x style="font:inherit;border:1px solid var(--line,#ccc);background:transparent;color:inherit;border-radius:6px;padding:.35rem .9rem;cursor:pointer">Cancel</button>
        <button style="font:inherit;border:0;background:var(--accent,#7a2a22);color:#fff;border-radius:6px;padding:.35rem .9rem;cursor:pointer">Enter members’ mode</button></div></form>`;
    document.body.appendChild(bg);
    const f = bg.querySelector('form'); f.t.focus();
    const close = () => bg.remove();
    bg.querySelector('[data-x]').onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
    f.onsubmit = e => { e.preventDefault(); const t = f.t.value.trim(); if (!t) return;
      store.set('annot-token', t); try { sessionStorage.removeItem('members-shelf'); } catch (e) {} location.reload(); };
  }
  function topButton() {                              // in the top bar of the index and the map
    const top = document.querySelector('.top .in');
    if (!top) return null;
    const b = document.createElement('button');
    b.style.cssText = 'font:inherit;font-size:.82rem;cursor:pointer;border-radius:999px;padding:.2rem .8rem;margin-left:auto;'
      + (token() ? 'background:var(--accent);color:var(--paper);border:1px solid var(--accent)' : 'background:transparent;color:var(--accent);border:1px solid var(--accent)');
    b.textContent = token() ? '● Members’ mode' : '🔒 Member sign-in';
    b.title = token() ? 'Signed in as a member: private texts are shown. Click to sign out.' : 'Members of the group: sign in to see the private texts';
    b.onclick = () => token() ? signOut() : signIn();
    const prefs = top.querySelector('.prefs');
    prefs ? top.insertBefore(b, prefs) : top.appendChild(b);
    return b;
  }

  if (CFG.page) {                                     // 404.html: a page the public site does not have
    const m = document.getElementById('m');
    let rel = decodeURIComponent(location.pathname);
    rel = rel.startsWith(CFG.base) ? rel.slice(CFG.base.length) : '';
    const home = `<p><a href="${CFG.base}">The library</a></p>`;
    if (!/\.html$/.test(rel)) { m.innerHTML = '<h1>Not found</h1>' + home; return; }
    if (!token()) { m.innerHTML = '<h1>Members only</h1><p>This text is not public. Members of the group can read it in members’ mode.</p>'
                                + '<p><button id="si">Member sign-in</button></p>' + home; document.getElementById('si').onclick = signIn; return; }
    get(rel).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(replacePage)
      .catch(() => { m.innerHTML = '<h1>Not found</h1><p>Either there is no such text, or the token saved in this browser cannot read the group’s private repository '
                                 + `(<i>${esc(CFG.repo)}</i>). A token made for the old public repository does not work: make a new one and sign in again.</p>`
                                 + '<p><button id="si">Sign in again</button></p>' + home;
                     document.getElementById('si').onclick = signIn; });
    return;
  }

  const rel = (window.ANNOT || {}).rel;
  if (rel) {                                          // a public text page: swap in the members' version if it has notes
    if (token()) shelf().then(j => { if (j && j.notes.includes(rel)) get(rel + '.html').then(r => r.ok ? r.text() : null).then(h => { if (h) replacePage(h); }); });
    return;
  }

  if (window.drawGraph) {                             // the map: the members' graph holds the private texts too
    const btn = topButton();
    if (!token()) return;
    window.graphFromMembers = true;
    get('graph.json').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => window.drawGraph(d))
      .catch(() => { window.graphFromMembers = false; fetch('graph.json').then(r => r.json()).then(d => window.drawGraph(d));
                     if (btn) { btn.textContent = 'Token refused: sign in again'; btn.onclick = signIn; } });
    return;
  }

  const lib = document.getElementById('v-lib');       // the index
  if (!lib || !window.libAdd) return;
  const btn = topButton();
  const bar = document.getElementById('members-bar');
  const box = 'margin:1rem 0 0;padding:.7rem 1rem;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;background:var(--card);'
            + 'display:flex;gap:.6rem 1rem;align-items:center;flex-wrap:wrap;font-size:.9rem;max-width:60rem';
  const button = (label, primary) => `<button style="font:inherit;font-size:.85rem;cursor:pointer;border-radius:6px;padding:.25rem .8rem;${primary
    ? 'background:var(--accent);color:var(--paper);border:1px solid var(--accent)' : 'background:transparent;color:var(--ink);border:1px solid var(--line)'}">${label}</button>`;
  const resTab = document.querySelector('.tabs button[data-v="res"]'), resList = document.getElementById('reslist');
  if (resTab) resTab.insertAdjacentHTML('beforeend', ' <span class="chip" style="color:var(--accent);border-color:var(--accent)">members</span>');
  if (!token()) {
    if (bar) { bar.style.cssText = box;
      bar.innerHTML = `<span style="flex:1;min-width:16rem"><b>Members’ mode.</b> Some texts, and the group’s notes, are for members of the working group only.
        Members sign in once in this browser and the private texts appear in this library beside the public ones.</span>${button('🔒 Member sign-in', true)}`;
      bar.querySelector('button').onclick = signIn; }
    return;
  }
  const LANG = { de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', la: 'Latin', hu: 'Hungarian', en: 'English', el: 'Greek', pt: 'Portuguese' };
  function row(t) {                                   // the same markup reader.py gives a public text's row
    const mono = t.translation_language === 'none', ym = /\d{4}/.exec(t.year || ''), yr = ym ? +ym[0] : 0;
    const surname = t.author ? t.author.split(/\s+/).pop() : '~';
    const d = document.createElement('div'); d.className = 'row members';
    Object.assign(d.dataset, { author: t.author || '—', sort: `${surname} ${t.author}`, genre: t.genre || 'Other', lang: LANG[t.original_language] || t.original_language || '—',
                               century: yr ? `${Math.floor((yr - 1) / 100) + 1}th century` : 'undated', year: yr, order: t.order || '', tr: mono ? '0' : '1', words: t.words || '' });
    d.innerHTML = `<div class="t"><a href="${esc(t.rel)}.html">${esc(t.author)}, <i>${esc(t.title)}</i></a>` + (t.year ? ` (${esc(t.year)})` : '')
      + (t.collection ? ` · ${esc(t.collection)}` : '') + (t.title_en ? `<span class="en">${esc(t.title_en)}</span>` : '') + '</div>'
      + `<div class="m">${t.pages && t.pages !== '0' ? esc(t.pages) + ' pp.' : ''}${t.original_language ? `<span class="chip">${esc(t.original_language)}${mono ? '' : '→en'}</span>` : ''}`
      + `<span class="chip" style="color:var(--accent);border-color:var(--accent)">members</span></div>`;
    return d;
  }
  shelf().then(j => {
    if (!j) { if (btn) { btn.textContent = 'Token refused: sign in again'; btn.onclick = signIn; }
              if (bar) { bar.style.cssText = box; bar.innerHTML = `<span style="flex:1">The token saved in this browser cannot read <i>${esc(CFG.repo)}</i>, so only the public texts are shown.</span>${button('Sign in again', true)}`;
                         bar.querySelector('button').onclick = signIn; }
              return; }
    window.libAdd(j.private.map(row));
    if (resList && (j.resources || []).length)        // the study resources: members only
      resList.innerHTML = j.resources.map(r => `<div class="row"><div class="t"><a href="${esc(r.rel)}.html">${esc(r.title)}</a>`
        + ((r.about || r.author) ? `<span class="en">${esc([r.about, r.author].filter(Boolean).join(', '))}</span>` : '') + '</div>'
        + `<div class="m">${r.kind ? `<span class="chip">${esc(r.kind)}</span>` : ''}</div></div>`).join('');
    if (!bar) return;
    bar.style.cssText = box;
    bar.innerHTML = `<span style="flex:1;min-width:16rem"><b>Members’ mode is on.</b> The library below includes ${j.private.length} members-only texts, marked
      <span class="chip" style="color:var(--accent);border-color:var(--accent);margin:0">members</span>, and public texts show the group’s notes.</span>
      ${button('Members’ texts only', false)}${button('Sign out', false)}`;
    const [only, out] = bar.querySelectorAll('button');
    only.onclick = () => { const on = only.dataset.on !== '1'; only.dataset.on = on ? '1' : ''; only.textContent = on ? 'Show all texts' : 'Members’ texts only'; window.libOnly(on ? '.row.members' : null); };
    out.onclick = signOut;
  });
})();
