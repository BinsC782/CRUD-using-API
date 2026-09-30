(function(){
  'use strict';

  /* ---------- Persistence ---------- */
  var STORE = 'pixelforge.questlog.v1';
  var THEME = 'pixelforge.theme';
  var SEED = 'pixelforge.seeded.v1';
  var TAGS = ['Raid','Speedrun','Grind','Story','Co-op','Backlog'];

  function load(){
    try{
      var raw = localStorage.getItem(STORE);
      var list = raw ? JSON.parse(raw) : null;
      return Array.isArray(list) ? list.filter(valid) : [];
    }catch(e){ return []; }
  }
  function save(list){
    try{ localStorage.setItem(STORE, JSON.stringify(list)); return true; }
    catch(e){ toast('Storage is full or blocked — changes not saved','err'); return false; }
  }
  function valid(q){
    return q && typeof q === 'object' && typeof q.title === 'string';
  }
  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  /* ---------- State ---------- */
  var quests = load();
  var filter = 'All';
  var query = '';
  var editingId = null;
  var busy = false;

  /* ---------- Elements ---------- */
  var el = {
    form: document.getElementById('questForm'),
    id: document.getElementById('qId'),
    title: document.getElementById('fTitle'),
    note: document.getElementById('fNote'),
    tag: document.getElementById('fTag'),
    diff: document.getElementById('fDiff'),
    formTitle: document.getElementById('formTitle'),
    editFlag: document.getElementById('editFlag'),
    save: document.getElementById('saveBtn'),
    saveLabel: document.getElementById('saveLabel'),
    cancel: document.getElementById('cancelBtn'),
    list: document.getElementById('list'),
    empty: document.getElementById('empty'),
    emptyText: document.getElementById('emptyText'),
    chips: document.getElementById('chips'),
    search: document.getElementById('search'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
    themeBtn: document.getElementById('themeBtn'),
    sTotal: document.getElementById('sTotal'),
    sDone: document.getElementById('sDone'),
    sOpen: document.getElementById('sOpen'),
    sRate: document.getElementById('sRate')
  };

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg, kind){
    el.toastMsg.textContent = msg;
    el.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.toast.className = 'toast' + (kind ? ' ' + kind : ''); }, 2600);
  }

  /* ---------- Theme ---------- */
  function applyTheme(mode){
    document.documentElement.setAttribute('data-theme', mode);
    try{ localStorage.setItem(THEME, mode); }catch(e){}
  }
  var savedTheme = null;
  try{ savedTheme = localStorage.getItem(THEME); }catch(e){}
  applyTheme(savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  el.themeBtn.addEventListener('click', function(){
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- Seed demo content once ---------- */
  if(!quests.length){
    try{ if(!localStorage.getItem(SEED)){ quests = seed(); localStorage.setItem(SEED,'1'); save(quests); } }catch(e){}
  }
  function seed(){
    var t = Date.now();
    return [
      { id: uid(), title: 'Clear Nightfall on Legendary', note: 'No healing flasks allowed. Swap to frost build after phase two.', tag: 'Raid', diff: 'Legendary', done: false, at: t - 7200000 },
      { id: uid(), title: 'Beat the Any% route in under 40 minutes', note: 'Skip the two optional boss keys, the skip on segment 4 is faster anyway.', tag: 'Speedrun', diff: 'Hard', done: true, at: t - 86400000 },
      { id: uid(), title: 'Farm 25 Titan shards for the new rifle', note: 'Do it during the weekend double-drop event.', tag: 'Grind', diff: 'Normal', done: false, at: t - 1800000 },
      { id: uid(), title: 'Finish the Meridian storyline', note: 'Chapter 7 — need to find the lost cartographer log first.', tag: 'Story', diff: 'Normal', done: false, at: t - 43200000 }
    ];
  }

  /* ---------- Rendering ---------- */
  function visible(){
    var q = query.trim().toLowerCase();
    return quests.filter(function(item){
      var okTag = filter === 'All' || item.tag === filter;
      var okQ = !q || item.title.toLowerCase().indexOf(q) > -1 ||
                (item.note || '').toLowerCase().indexOf(q) > -1 ||
                (item.tag || '').toLowerCase().indexOf(q) > -1;
      return okTag && okQ;
    }).sort(function(a,b){ return (b.at || 0) - (a.at || 0); });
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  function ago(ts){
    var s = Math.max(0, (Date.now() - (ts||0)) / 1000);
    if(s < 60) return 'just now';
    if(s < 3600) return Math.floor(s/60) + 'm ago';
    if(s < 86400) return Math.floor(s/3600) + 'h ago';
    if(s < 2592000) return Math.floor(s/86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    spin: '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.2-8.6"/></svg>'
  };

  function render(){
    var list = visible();
    el.list.innerHTML = '';

    list.forEach(function(item){
      var node = document.createElement('article');
      node.className = 'item' + (item.done ? ' done' : '');
      node.innerHTML =
        '<button class="check" type="button" data-act="toggle" data-id="' + esc(item.id) + '" aria-label="Toggle complete">' + ICON.check + '</button>' +
        '<div class="body">' +
          '<h3>' + esc(item.title) + '</h3>' +
          (item.note ? '<p>' + esc(item.note) + '</p>' : '') +
          '<div class="meta"><span class="tag">' + esc(item.tag || 'Quest') + '</span>' +
          '<span class="tag">' + esc(item.diff || 'Normal') + '</span>' +
          '<span class="time">' + ago(item.at) + '</span></div>' +
        '</div>' +
        '<div class="tools">' +
          '<button class="icon-btn" type="button" data-act="edit" data-id="' + esc(item.id) + '" aria-label="Edit quest">' + ICON.edit + '</button>' +
          '<button class="icon-btn danger" type="button" data-act="del" data-id="' + esc(item.id) + '" aria-label="Delete quest">' + ICON.trash + '</button>' +
        '</div>';
      el.list.appendChild(node);
    });

    var none = list.length === 0;
    el.empty.style.display = none ? 'block' : 'none';
    el.emptyText.textContent = quests.length
      ? 'No quests match this filter'
      : 'No quests logged yet';

    var total = quests.length;
    var done = quests.filter(function(q){ return q.done; }).length;
    el.sTotal.textContent = total;
    el.sDone.textContent = done;
    el.sOpen.textContent = total - done;
    el.sRate.textContent = total ? Math.round(done / total * 100) + '%' : '0%';
  }

  function renderChips(){
    el.chips.innerHTML = '';
    ['All'].concat(TAGS).forEach(function(name){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (filter === name ? ' active' : '');
      b.textContent = name;
      b.addEventListener('click', function(){ filter = name; renderChips(); render(); });
      el.chips.appendChild(b);
    });
  }

  /* ---------- CRUD ---------- */
  function setBusy(state, label){
    busy = state;
    el.save.disabled = state;
    el.cancel.disabled = state;
    el.formTitle.style.opacity = state ? '.55' : '1';
    el.saveLabel.textContent = state ? 'Saving…' : label;
  }

  function onSubmit(e){
    e.preventDefault();
    if(busy) return;
    var title = el.title.value.trim();
    var note = el.note.value.trim();
    if(!title){ toast('Give the quest a name first','err'); el.title.focus(); return; }

    var data = {
      title: title,
      note: note,
      tag: el.tag.value,
      diff: el.diff.value
    };

    if(editingId){
      setBusy(true, 'Updating');
      var i = quests.findIndex(function(q){ return q.id === editingId; });
      if(i > -1){
        quests[i] = Object.assign({}, quests[i], data, { at: Date.now() });
        persist('Quest updated');
        resetForm();
      } else { setBusy(false, 'Update quest'); }
    } else {
      setBusy(true, 'Adding');
      quests.unshift(Object.assign({ id: uid(), done: false, at: Date.now() }, data));
      persist('Quest added to the log');
      el.form.reset();
      el.title.focus();
      setBusy(false, 'Add quest');
    }
  }

  function persist(msg){
    if(save(quests)){ render(); toast(msg); }
    else { render(); }
  }

  function startEdit(id){
    var q = quests.find(function(x){ return x.id === id; });
    if(!q) return;
    editingId = id;
    el.id.value = id;
    el.title.value = q.title;
    el.note.value = q.note || '';
    el.tag.value = q.tag || 'Raid';
    el.diff.value = q.diff || 'Normal';
    el.formTitle.textContent = 'Refine quest';
    el.editFlag.classList.add('on');
    el.saveLabel.textContent = 'Save changes';
    el.cancel.style.display = '';
    el.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.title.focus();
  }

  function resetForm(){
    editingId = null;
    el.form.reset();
    el.id.value = '';
    el.formTitle.textContent = 'Forge a new quest';
    el.editFlag.classList.remove('on');
    el.saveLabel.textContent = 'Add quest';
    el.cancel.style.display = 'none';
  }

  function toggle(id, btn){
    var q = quests.find(function(x){ return x.id === id; });
    if(!q) return;
    btn.innerHTML = ICON.spin;
    setTimeout(function(){
      q.done = !q.done;
      persist(q.done ? 'Marked as cleared' : 'Reopened quest');
    }, 260);
  }

  function remove(id, btn){
    var q = quests.find(function(x){ return x.id === id; });
    if(!q) return;
    if(!confirm('Abandon "' + q.title + '"? This cannot be undone.')) return;
    btn.innerHTML = ICON.spin;
    setTimeout(function(){
      quests = quests.filter(function(x){ return x.id !== id; });
      if(editingId === id) resetForm();
      persist('Quest removed');
    }, 220);
  }

  /* ---------- Events ---------- */
  el.form.addEventListener('submit', onSubmit);
  el.cancel.addEventListener('click', function(){ resetForm(); toast('Edit cancelled','out'); });
  el.search.addEventListener('input', function(e){ query = e.target.value; render(); });

  el.list.addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    if(act === 'edit') startEdit(id);
    else if(act === 'toggle') toggle(id, btn);
    else if(act === 'del') remove(id, btn);
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && editingId) resetForm();
    if((e.ctrlKey || e.metaKey) && e.key === 'k'){ e.preventDefault(); el.search.focus(); el.search.select(); }
  });

  window.addEventListener('storage', function(e){
    if(e.key === STORE){ quests = load(); render(); }
  });

  /* ---------- Init ---------- */
  renderChips();
  render();
})();
