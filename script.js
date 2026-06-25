// ---------- storage helper (chrome.storage with localStorage fallback) ----------
const store = {
  async get(key, fallback) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise(res => {
        chrome.storage.local.get([key], r => res(r[key] !== undefined ? r[key] : fallback));
      });
    }
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  async set(key, value) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise(res => {
        chrome.storage.local.set({ [key]: value }, res);
      });
    }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
  }
};

// ---------- clock ----------
function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  document.getElementById('time').textContent = `${h}:${m}`;
  document.getElementById('ampm').textContent = ampm;

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('date').textContent = dateStr;
}
tickClock();
setInterval(tickClock, 1000);

// ---------- favicon helper ----------
function faviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  } catch (e) { return ''; }
}

// ---------- bookmarks drawer ----------
const bookmarksToggle = document.getElementById('bookmarksToggle');
const bookmarksDrawer = document.getElementById('bookmarksDrawer');
const closeBookmarks = document.getElementById('closeBookmarks');
const bookmarksList = document.getElementById('bookmarksList');

bookmarksToggle.addEventListener('click', () => {
  bookmarksDrawer.classList.toggle('open');
  if (bookmarksDrawer.classList.contains('open')) {
    loadBookmarks();
  }
});

closeBookmarks.addEventListener('click', () => {
  bookmarksDrawer.classList.remove('open');
});

// Close drawer if clicking outside of it and not on the toggle button
document.addEventListener('click', (e) => {
  if (!bookmarksDrawer.contains(e.target) && !bookmarksToggle.contains(e.target)) {
    bookmarksDrawer.classList.remove('open');
  }
});

async function loadBookmarks() {
  bookmarksList.innerHTML = '';

  if (window.chrome && chrome.bookmarks && chrome.bookmarks.getTree) {
    chrome.bookmarks.getTree((tree) => {
      const flat = [];
      function traverse(nodes) {
        nodes.forEach(node => {
          if (node.url) {
            flat.push(node);
          }
          if (node.children) {
            traverse(node.children);
          }
        });
      }
      traverse(tree);
      renderBookmarksList(flat);
    });
  } else {
    // Fallback mock bookmarks for non-extension testing
    const mock = [
      { title: 'Google', url: 'https://google.com' },
      { title: 'Brave Search', url: 'https://search.brave.com' },
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'Hacker News', url: 'https://news.ycombinator.com' },
      { title: 'YouTube', url: 'https://youtube.com' }
    ];
    renderBookmarksList(mock);
  }
}

function renderBookmarksList(bookmarks) {
  bookmarksList.innerHTML = '';
  if (bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = 'No bookmarks found.';
    bookmarksList.appendChild(empty);
    return;
  }

  bookmarks.forEach(bm => {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
    a.href = bm.url;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.chrome && chrome.tabs) {
        chrome.tabs.getCurrent((tab) => {
          if (tab) chrome.tabs.update(tab.id, { url: bm.url });
          else window.location.href = bm.url;
        });
      } else {
        window.location.href = bm.url;
      }
    });

    const img = document.createElement('img');
    img.className = 'bookmark-icon';
    img.src = faviconUrl(bm.url);
    img.alt = '';
    img.onerror = () => {
      img.remove();
      const initial = document.createElement('div');
      initial.className = 'bookmark-fallback-icon';
      initial.textContent = bm.title ? bm.title.trim().slice(0, 1).toUpperCase() : 'B';
      a.insertBefore(initial, a.firstChild);
    };
    a.appendChild(img);

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bm.title || bm.url;
    title.title = bm.title || bm.url;
    a.appendChild(title);

    bookmarksList.appendChild(a);
  });
}

// ---------- tasks ----------
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'task-empty';
    empty.textContent = 'Nothing yet.';
    taskList.appendChild(empty);
  }
  tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const check = document.createElement('div');
    check.className = 'task-check' + (task.done ? ' done' : '');
    check.addEventListener('click', async () => {
      const current = await store.get('tasks', []);
      current[idx].done = !current[idx].done;
      await store.set('tasks', current);
      renderTasks(current);
      updateCount(current);
    });

    const text = document.createElement('span');
    text.className = 'task-text' + (task.done ? ' done' : '');
    text.textContent = task.text;

    const del = document.createElement('span');
    del.className = 'task-del';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      const current = await store.get('tasks', []);
      current.splice(idx, 1);
      await store.set('tasks', current);
      renderTasks(current);
      updateCount(current);
    });

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(del);
    taskList.appendChild(li);
  });
}

function updateCount(tasks) {
  const left = tasks.filter(t => !t.done).length;
  taskCount.textContent = `${left} left`;
}

async function initTasks() {
  const tasks = await store.get('tasks', []);
  renderTasks(tasks);
  updateCount(tasks);
}
initTasks();

taskInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const text = taskInput.value.trim();
  if (!text) return;
  const current = await store.get('tasks', []);
  current.push({ text, done: false });
  await store.set('tasks', current);
  taskInput.value = '';
  renderTasks(current);
  updateCount(current);
});

// ---------- theme ----------
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // sun for light, moon for dark
  if (theme === 'light') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>';
  } else {
    themeIcon.innerHTML = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>';
  }
}

async function initTheme() {
  const theme = await store.get('theme', 'dark');
  applyTheme(theme);
}
initTheme();

themeToggle.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await store.set('theme', next);
});

// ---------- Gallery of Goals (Glassmorphic Polaroid) + Sticky Notes ----------
const board = document.getElementById('board');
const photoInput = document.getElementById('photoInput');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const clearPhotosBtn = document.getElementById('clearPhotosBtn');

// Shared z-index counter across photos AND notes so "bring to front" works
// consistently no matter what kind of item the user last touched.
let _boardZCounter = 10;

function makeDraggable(el, item, onChange) {
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.del') || e.target.closest('.resize') || e.target.closest('.note-text') || e.target.closest('.note-dot') || e.target.closest('.note-close') || e.target.closest('.note-resize')) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origX = item.x, origY = item.y;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';

    function move(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      item.x = origX + dx;
      item.y = origY + dy;
      el.style.left = item.x + 'px';
      el.style.top = item.y + 'px';
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.style.cursor = 'grab';
      onChange();
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}

function makeResizable(el, handle, item, onChange, minW = 120, minH = 150) {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const origW = item.w, origH = item.h;
    handle.setPointerCapture(e.pointerId);

    function move(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      item.w = Math.max(minW, origW + dx);
      item.h = Math.max(minH, origH + dy);
      el.style.width = item.w + 'px';
      el.style.height = item.h + 'px';
    }
    function up() {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      onChange();
    }
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

// Bring any board item (photo or note) to the front, flash a confirmation
// ring, and persist via the supplied callback.
function bringToFront(wrap, item, persist) {
  _boardZCounter += 1;
  item.z = _boardZCounter;
  wrap.style.zIndex = _boardZCounter;
  wrap.classList.add('photo-lifted');
  setTimeout(() => wrap.classList.remove('photo-lifted'), 350);
  persist();
}

// ── placement helper shared by photo upload & note creation ──────────────
// Scatters new items near a random existing anchor (of either kind) so
// photos and notes interleave naturally instead of stacking in one corner.
function pickPlacement(anchors, w, h) {
  let x, y;
  if (anchors.length > 0) {
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    const minOff = 100, maxOff = 200;
    const randOff = () => (minOff + Math.random() * (maxOff - minOff)) * (Math.random() < 0.5 ? 1 : -1);
    x = anchor.x + randOff();
    y = anchor.y + randOff();
  } else {
    x = window.innerWidth / 2 - w / 2;
    y = window.innerHeight / 2 - h / 2;
  }
  const margin = 20;
  x = Math.max(margin, Math.min(window.innerWidth - w - margin, x));
  y = Math.max(margin, Math.min(window.innerHeight - h - margin, y));
  return { x, y };
}

function renderPhotoEl(photo) {
  const wrap = document.createElement('div');
  wrap.className = 'photo';
  wrap.style.left = photo.x + 'px';
  wrap.style.top = photo.y + 'px';
  wrap.style.width = photo.w + 'px';
  wrap.style.height = photo.h + 'px';

  // Apply persisted z-index (default to 2 if none saved yet)
  const savedZ = photo.z || 2;
  wrap.style.zIndex = savedZ;
  if (savedZ > _boardZCounter) _boardZCounter = savedZ;

  const img = document.createElement('img');
  img.src = photo.src;
  wrap.appendChild(img);

  const del = document.createElement('div');
  del.className = 'del';
  del.textContent = '×';
  del.addEventListener('click', async () => {
    const photos = await store.get('photos', []);
    const filtered = photos.filter(p => p.id !== photo.id);
    await store.set('photos', filtered);
    wrap.remove();
  });
  wrap.appendChild(del);

  const resize = document.createElement('div');
  resize.className = 'resize';
  wrap.appendChild(resize);

  board.appendChild(wrap);

  async function persist() {
    const photos = await store.get('photos', []);
    const idx = photos.findIndex(p => p.id === photo.id);
    if (idx > -1) { photos[idx] = photo; await store.set('photos', photos); }
  }

  // Click (not drag) → bring this photo to the front
  wrap.addEventListener('pointerdown', () => bringToFront(wrap, photo, persist));

  makeDraggable(wrap, photo, persist);
  makeResizable(wrap, resize, photo, persist);
}

async function renderBoard() {
  const [photos, notes] = await Promise.all([
    store.get('photos', []),
    store.get('notes', [])
  ]);
  board.innerHTML = '';
  photos.forEach(renderPhotoEl);
  notes.forEach(renderNoteEl);
}
renderBoard();

// ── shared "add photos" pipeline used by both the file picker and drag-drop ──
async function addPhotoFiles(files) {
  const imageFiles = [...files].filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  const [photos, notes] = await Promise.all([
    store.get('photos', []),
    store.get('notes', [])
  ]);
  // Anchor pool includes existing notes too, so photos can land near them
  const existingSnapshot = [...photos, ...notes];
  const w = 220, h = 220;

  for (const file of imageFiles) {
    const dataUrl = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });

    const { x, y } = pickPlacement(existingSnapshot, w, h);

    _boardZCounter += 1;
    const photo = {
      id: Date.now() + Math.random().toString(36).slice(2),
      src: dataUrl,
      x, y, w, h,
      z: _boardZCounter
    };
    photos.push(photo);
    existingSnapshot.push(photo);
  }

  await store.set('photos', photos);
  renderBoard();
}

addPhotoBtn.addEventListener('click', () => {
  // Close any open panels before opening the file picker
  bookmarksDrawer.classList.remove('open');
  pinPickerPanel.classList.remove('open');
  photoInput.click();
});

clearPhotosBtn.addEventListener('click', async () => {
  const [photos, notes] = await Promise.all([
    store.get('photos', []),
    store.get('notes', [])
  ]);
  const total = photos.length + notes.length;
  if (total === 0) return;

  const confirmed = confirm(`Remove all ${total} item${total === 1 ? '' : 's'} (photos & notes) from the board?`);
  if (!confirmed) return;

  await Promise.all([store.set('photos', []), store.set('notes', [])]);
  renderBoard();
});

photoInput.addEventListener('change', async (e) => {
  await addPhotoFiles(e.target.files);
  photoInput.value = '';
});

// ---------- Drag & drop image upload directly onto the board ----------
let _dragDepth = 0; // tracks nested dragenter/dragleave so the overlay doesn't flicker

function hasFiles(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  _dragDepth++;
  board.classList.add('drag-active');
});

window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  _dragDepth = Math.max(0, _dragDepth - 1);
  if (_dragDepth === 0) board.classList.remove('drag-active');
});

window.addEventListener('drop', async (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  _dragDepth = 0;
  board.classList.remove('drag-active');
  await addPhotoFiles(e.dataTransfer.files);
});

// ---------- Sticky Notes ----------
const NOTE_COLORS = ['yellow', 'pink', 'mint', 'sky', 'lilac'];

function renderNoteEl(note) {
  const wrap = document.createElement('div');
  wrap.className = `note note-${note.color || 'yellow'}`;
  wrap.style.left = note.x + 'px';
  wrap.style.top = note.y + 'px';
  wrap.style.width = note.w + 'px';
  wrap.style.height = note.h + 'px';

  const savedZ = note.z || 2;
  wrap.style.zIndex = savedZ;
  if (savedZ > _boardZCounter) _boardZCounter = savedZ;

  async function persist() {
    const notes = await store.get('notes', []);
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx > -1) { notes[idx] = note; await store.set('notes', notes); }
  }

  // Header row: accent dot (click to cycle color) + close button
  const header = document.createElement('div');
  header.className = 'note-header';

  const dot = document.createElement('button');
  dot.className = 'note-dot';
  dot.setAttribute('aria-label', 'Change note color');
  dot.title = 'Change color';
  dot.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const curIdx = NOTE_COLORS.indexOf(note.color);
    note.color = NOTE_COLORS[(curIdx + 1) % NOTE_COLORS.length];
    wrap.className = `note note-${note.color}`;
    wrap.style.left = note.x + 'px';
    wrap.style.top = note.y + 'px';
    wrap.style.width = note.w + 'px';
    wrap.style.height = note.h + 'px';
    wrap.style.zIndex = note.z || savedZ;
    persist();
  });
  header.appendChild(dot);

  const del = document.createElement('div');
  del.className = 'note-close';
  del.textContent = '×';
  del.addEventListener('click', async () => {
    const notes = await store.get('notes', []);
    const filtered = notes.filter(n => n.id !== note.id);
    await store.set('notes', filtered);
    wrap.remove();
  });
  header.appendChild(del);

  wrap.appendChild(header);

  // Editable text area
  const text = document.createElement('div');
  text.className = 'note-text';
  text.contentEditable = 'true';
  text.setAttribute('data-placeholder', 'Type a note…');
  text.textContent = note.text || '';
  text.spellcheck = false;

  let saveTimer = null;
  text.addEventListener('input', () => {
    note.text = text.textContent;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400); // debounce so typing doesn't hammer storage
  });
  // Don't let the drag handler engage while editing, but still bring the
  // note to front so it's not buried under another item while typing.
  text.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    bringToFront(wrap, note, persist);
  });
  wrap.appendChild(text);

  const resize = document.createElement('div');
  resize.className = 'note-resize';
  wrap.appendChild(resize);

  board.appendChild(wrap);

  wrap.addEventListener('pointerdown', () => bringToFront(wrap, note, persist));

  makeDraggable(wrap, note, persist);
  makeResizable(wrap, resize, note, persist, 160, 130);

  return wrap;
}

addNoteBtn.addEventListener('click', async () => {
  bookmarksDrawer.classList.remove('open');
  pinPickerPanel.classList.remove('open');

  const [photos, notes] = await Promise.all([
    store.get('photos', []),
    store.get('notes', [])
  ]);
  const existingSnapshot = [...photos, ...notes];
  const w = 220, h = 200;
  const { x, y } = pickPlacement(existingSnapshot, w, h);

  _boardZCounter += 1;
  const note = {
    id: Date.now() + Math.random().toString(36).slice(2),
    text: '',
    color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    x, y, w, h,
    z: _boardZCounter
  };
  notes.push(note);
  await store.set('notes', notes);

  const wrap = renderNoteEl(note);
  // Focus the new note's text area immediately so the user can start typing
  requestAnimationFrame(() => {
    const t = wrap.querySelector('.note-text');
    t.focus();
  });
});

// ---------- Pinned App Shortcuts ----------
const pinShortcutsBtn = document.getElementById('pinShortcutsBtn');
const pinPickerPanel  = document.getElementById('pinPickerPanel');
const closePinPicker  = document.getElementById('closePinPicker');
const pinPickerList   = document.getElementById('pinPickerList');
const pinPickerHint   = document.getElementById('pinPickerHint');
const pinnedShortcutsGroup = document.getElementById('pinnedShortcutsGroup');

const MAX_PINS = 6;

// Show/hide the + add-shortcut button based on current pin count
function syncPinBtn(pinnedCount) {
  pinShortcutsBtn.style.display = pinnedCount >= MAX_PINS ? 'none' : '';
}

// Open / close pin picker panel
pinShortcutsBtn.addEventListener('click', () => {
  const isOpen = pinPickerPanel.classList.contains('open');
  // Close bookmarks drawer if open
  bookmarksDrawer.classList.remove('open');
  pinPickerPanel.classList.toggle('open', !isOpen);
  if (!isOpen) loadPinPicker();
});

closePinPicker.addEventListener('click', () => {
  pinPickerPanel.classList.remove('open');
});

// Close if clicking outside
document.addEventListener('click', (e) => {
  if (!pinPickerPanel.contains(e.target) && !pinShortcutsBtn.contains(e.target)) {
    pinPickerPanel.classList.remove('open');
  }
});

async function loadPinPicker() {
  pinPickerList.innerHTML = '<div class="bookmark-empty">Loading bookmarks…</div>';

  let allBookmarks = [];

  if (window.chrome && chrome.bookmarks && chrome.bookmarks.getTree) {
    allBookmarks = await new Promise((res) => {
      chrome.bookmarks.getTree((tree) => {
        const flat = [];
        function traverse(nodes) {
          nodes.forEach(n => {
            if (n.url) flat.push({ id: n.id, title: n.title || n.url, url: n.url });
            if (n.children) traverse(n.children);
          });
        }
        traverse(tree);
        res(flat);
      });
    });
  } else {
    // Fallback mock data for non-extension testing
    allBookmarks = [
      { id: '1', title: 'Google',       url: 'https://google.com' },
      { id: '2', title: 'GitHub',       url: 'https://github.com' },
      { id: '3', title: 'YouTube',      url: 'https://youtube.com' },
      { id: '4', title: 'Hacker News',  url: 'https://news.ycombinator.com' },
      { id: '5', title: 'Brave Search', url: 'https://search.brave.com' },
    ];
  }

  renderPinPicker(allBookmarks);
}

async function renderPinPicker(bookmarks) {
  const pinned = await store.get('pinnedShortcuts', []);
  pinPickerList.innerHTML = '';

  if (bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = 'No bookmarks found.';
    pinPickerList.appendChild(empty);
    return;
  }

  bookmarks.forEach(bm => {
    const isPinned = pinned.some(p => p.url === bm.url);
    const item = document.createElement('li');
    item.className = 'pin-picker-item' + (isPinned ? ' pinned' : '');

    // Favicon
    const img = document.createElement('img');
    img.className = 'bookmark-icon';
    img.src = faviconUrl(bm.url);
    img.alt = '';
    img.onerror = () => {
      img.remove();
      const fb = document.createElement('div');
      fb.className = 'bookmark-fallback-icon';
      fb.textContent = (bm.title || 'B').trim().slice(0, 1).toUpperCase();
      item.insertBefore(fb, item.firstChild);
    };
    item.appendChild(img);

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'bookmark-title';
    titleEl.textContent = bm.title || bm.url;
    titleEl.title = bm.url;
    item.appendChild(titleEl);

    // Check indicator
    const check = document.createElement('div');
    check.className = 'pin-check';
    item.appendChild(check);

    // Toggle pin on click
    item.addEventListener('click', async () => {
      const current = await store.get('pinnedShortcuts', []);
      const idx = current.findIndex(p => p.url === bm.url);
      if (idx > -1) {
        // Unpin
        current.splice(idx, 1);
        item.classList.remove('pinned');
      } else {
        if (current.length >= MAX_PINS) {
          // Visual shake to indicate max reached
          pinPickerHint.style.color = 'var(--text)';
          pinPickerHint.textContent = `All ${MAX_PINS} slots filled. Right-click a pinned icon to unpin it.`;
          setTimeout(() => {
            pinPickerHint.style.color = '';
            pinPickerHint.textContent = `Choose up to ${MAX_PINS} bookmarks to pin as quick-access icons.`;
          }, 2500);
          return;
        }
        // Pin
        current.push({ title: bm.title || bm.url, url: bm.url });
        item.classList.add('pinned');
      }
      await store.set('pinnedShortcuts', current);
      renderPinnedToolbar(current);
      syncPinBtn(current.length);
    });

    pinPickerList.appendChild(item);
  });
}

// ---------- Right-click context menu for pinned shortcuts ----------
const shortcutContextMenu = document.getElementById('shortcutContextMenu');
const ctxUnpin   = document.getElementById('ctxUnpin');
const ctxOpenLink = document.getElementById('ctxOpenLink');

let _ctxTarget = null; // the shortcut object currently right-clicked

function showContextMenu(x, y, shortcut) {
  _ctxTarget = shortcut;
  shortcutContextMenu.style.display = 'block';

  // Position: prefer right of cursor, flip left if too close to edge
  const menuW = 160;
  const menuH = shortcutContextMenu.offsetHeight || 80;
  const left = (x + menuW > window.innerWidth)  ? x - menuW : x;
  const top  = (y + menuH > window.innerHeight) ? y - menuH : y;

  shortcutContextMenu.style.left = left + 'px';
  shortcutContextMenu.style.top  = top  + 'px';
  // Re-trigger animation each time
  shortcutContextMenu.style.animation = 'none';
  requestAnimationFrame(() => {
    shortcutContextMenu.style.animation = '';
  });
}

function hideContextMenu() {
  shortcutContextMenu.style.display = 'none';
  _ctxTarget = null;
}

// Dismiss on any click outside the menu
document.addEventListener('click', (e) => {
  if (!shortcutContextMenu.contains(e.target)) hideContextMenu();
});

// Dismiss on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});

// "Unpin shortcut" action
ctxUnpin.addEventListener('click', async () => {
  if (!_ctxTarget) return;
  const current = await store.get('pinnedShortcuts', []);
  const updated = current.filter(p => p.url !== _ctxTarget.url);
  await store.set('pinnedShortcuts', updated);
  renderPinnedToolbar(updated);
  syncPinBtn(updated.length);
  hideContextMenu();
});

// "Open site" action
ctxOpenLink.addEventListener('click', () => {
  if (!_ctxTarget) return;
  if (window.chrome && chrome.tabs) {
    chrome.tabs.getCurrent(tab => chrome.tabs.update(tab.id, { url: _ctxTarget.url }));
  } else {
    window.location.href = _ctxTarget.url;
  }
  hideContextMenu();
});

function renderPinnedToolbar(pinned) {
  pinnedShortcutsGroup.innerHTML = '';

  pinned.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'pinned-shortcut task-btn';
    btn.setAttribute('data-title', p.title);
    btn.title = '';  // suppress native tooltip; we use CSS ::after
    btn.setAttribute('aria-label', p.title);

    const img = document.createElement('img');
    img.src = faviconUrl(p.url);
    img.alt = p.title;
    img.onerror = () => {
      img.remove();
      const fb = document.createElement('div');
      fb.className = 'shortcut-fallback';
      fb.textContent = (p.title || '?').trim().slice(0, 1).toUpperCase();
      btn.appendChild(fb);
    };
    btn.appendChild(img);

    // Left-click → navigate
    btn.addEventListener('click', () => {
      if (window.chrome && chrome.tabs) {
        chrome.tabs.getCurrent(tab => chrome.tabs.update(tab.id, { url: p.url }));
      } else {
        window.location.href = p.url;
      }
    });

    // Right-click → show context menu
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX + 6, e.clientY + 2, p);
    });

    pinnedShortcutsGroup.appendChild(btn);
  });
}

// Init pinned shortcuts on load
(async () => {
  const pinned = await store.get('pinnedShortcuts', []);
  renderPinnedToolbar(pinned);
  syncPinBtn(pinned.length);
})();

// ---------- Google Search Bar (enhanced) ----------
(function () {
  const searchBarInput   = document.getElementById('searchBarInput');
  const searchBarWrapper = document.getElementById('searchBarWrapper');
  const suggestionsBox   = document.getElementById('searchSuggestions');
  if (!searchBarInput) return;

  const HISTORY_KEY  = 'searchHistory';
  const MAX_HISTORY  = 5;
  const URL_PATTERN  = /^(https?:\/\/|ftp:\/\/|\S+\.\S{2,}(\/\S*)?$)/i;

  let focusedIdx   = -1;   // keyboard nav index in suggestions
  let currentItems = [];   // flat list of rendered suggestion elements
  let debounceTimer = null;

  // ── helpers ──────────────────────────────────────────────────
  async function getHistory() {
    return store.get(HISTORY_KEY, []);
  }

  async function addToHistory(query) {
    let hist = await getHistory();
    hist = hist.filter(h => h !== query);
    hist.unshift(query);
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    store.set(HISTORY_KEY, hist);
  }

  async function deleteHistoryEntry(query) {
    let hist = await getHistory();
    hist = hist.filter(h => h !== query);
    store.set(HISTORY_KEY, hist);
    // Re-render suggestions with the current input value
    await renderSuggestions(searchBarInput.value.trim());
  }

  function isUrl(text) {
    return URL_PATTERN.test(text.trim());
  }

  function normaliseUrl(text) {
    const t = text.trim();
    if (/^https?:\/\//i.test(t)) return t;
    return 'https://' + t;
  }

  function navigate(target) {
    if (window.chrome && chrome.tabs) {
      chrome.tabs.getCurrent(tab => chrome.tabs.update(tab.id, { url: target }));
    } else {
      window.location.href = target;
    }
  }

  function googleSearch(query) {
    navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }

  // ── spotlight (active) state ──────────────────────────────────
  function setActive(on) {
    searchBarWrapper.classList.toggle('active', on);
  }

  // ── Google autocomplete (fetch-based, CSP-compliant for MV3) ──
  function fetchGoogleSuggestions(query) {
    // Use client=firefox to get a plain JSON array response (no JSONP needed).
    // This avoids dynamic <script> injection which is blocked by MV3 CSP.
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    return fetch(url)
      .then(r => r.json())
      .then(data => {
        // Response format: [query, [suggestions]]
        return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 6) : [];
      })
      .catch(() => []);
  }

  // ── render suggestions ────────────────────────────────────────
  function svgIcon(path, size = 14) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8">${path}</svg>`;
  }

  const ICON_HISTORY  = svgIcon('<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>');
  const ICON_SEARCH   = svgIcon('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>');
  const ICON_NAVIGATE = svgIcon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>');

  function highlightMatch(text, query) {
    if (!query) return document.createTextNode(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return document.createTextNode(text);
    const span = document.createElement('span');
    span.className = 'suggestion-text';
    span.innerHTML =
      escapeHtml(text.slice(0, idx)) +
      `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>` +
      escapeHtml(text.slice(idx + query.length));
    return span;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildItem({ icon, label, query, badge, onActivate }) {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.setAttribute('role', 'option');
    div.tabIndex = -1;

    const iconEl = document.createElement('span');
    iconEl.className = 'suggestion-icon';
    iconEl.innerHTML = icon;

    const textEl = document.createElement('span');
    textEl.className = 'suggestion-text';

    const hl = highlightMatch(label, query);
    if (hl instanceof Node) {
      if (hl.nodeType === Node.TEXT_NODE) {
        textEl.textContent = label;
      } else {
        textEl.innerHTML = hl.innerHTML;
      }
    }

    div.appendChild(iconEl);
    div.appendChild(textEl);

    if (badge) {
      const b = document.createElement('span');
      b.className = 'suggestion-type-badge';
      b.textContent = badge;
      div.appendChild(b);
    }

    div.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent blur before click
      onActivate();
    });

    return div;
  }

  // History item = regular item + a × delete button
  function buildHistoryItem({ label, query, onActivate }) {
    const div = buildItem({ icon: ICON_HISTORY, label, query, onActivate });

    const del = document.createElement('button');
    del.className = 'suggestion-delete-btn';
    del.setAttribute('aria-label', 'Remove from history');
    del.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    del.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't trigger the item's onActivate
      deleteHistoryEntry(label);
    });

    div.appendChild(del);
    return div;
  }

  function sectionLabel(text) {
    const el = document.createElement('div');
    el.className = 'suggestion-section-label';
    el.textContent = text;
    return el;
  }

  async function renderSuggestions(query) {
    suggestionsBox.innerHTML = '';
    focusedIdx = -1;
    currentItems = [];

    if (!query) {
      // Show recent history
      const hist = await getHistory();
      if (hist.length === 0) { hideSuggestions(); return; }
      suggestionsBox.appendChild(sectionLabel('Recent'));
      hist.forEach(h => {
        const item = buildHistoryItem({
          label: h,
          query: '',
          onActivate: () => commitQuery(h)
        });
        suggestionsBox.appendChild(item);
        currentItems.push(item);
      });
      showSuggestions();
      return;
    }

    // Detect URL
    const looksLikeUrl = isUrl(query);

    // Always offer the direct action first
    if (looksLikeUrl) {
      const item = buildItem({
        icon: ICON_NAVIGATE,
        label: query,
        query,
        badge: 'Go to site',
        onActivate: () => { addToHistory(query); navigate(normaliseUrl(query)); }
      });
      suggestionsBox.appendChild(item);
      currentItems.push(item);
    } else {
      const item = buildItem({
        icon: ICON_SEARCH,
        label: `Search: ${query}`,
        query,
        badge: 'Google',
        onActivate: () => commitQuery(query)
      });
      suggestionsBox.appendChild(item);
      currentItems.push(item);
    }

    showSuggestions();

    // History matches
    const hist = await getHistory();
    const histMatches = hist.filter(h => h.toLowerCase().includes(query.toLowerCase()) && h !== query);
    if (histMatches.length) {
      suggestionsBox.appendChild(sectionLabel('Recent'));
      histMatches.slice(0, 3).forEach(h => {
        const item = buildHistoryItem({
          label: h,
          query,
          onActivate: () => commitQuery(h)
        });
        suggestionsBox.appendChild(item);
        currentItems.push(item);
      });
    }

    // Google suggestions (async — append when ready)
    if (!looksLikeUrl) {
      // Capture a snapshot of currentItems so we only append if the
      // suggestions box hasn't been reset by a newer renderSuggestions call.
      const itemsAtDispatch = currentItems;
      fetchGoogleSuggestions(query).then(suggestions => {
        // Only show if the input hasn't changed AND this render is still active
        if (searchBarInput.value.trim() !== query) return;
        if (currentItems !== itemsAtDispatch) return;
        const newSuggestions = suggestions.filter(s => s !== query);
        if (!newSuggestions.length) return;

        const label = sectionLabel('Suggestions');
        suggestionsBox.appendChild(label);

        newSuggestions.forEach(s => {
          const item = buildItem({
            icon: ICON_SEARCH,
            label: s,
            query,
            onActivate: () => commitQuery(s)
          });
          suggestionsBox.appendChild(item);
          currentItems.push(item);
        });
      });
    }
  }

  function showSuggestions() {
    suggestionsBox.classList.add('visible');
  }

  function hideSuggestions() {
    suggestionsBox.classList.remove('visible');
    suggestionsBox.innerHTML = '';
    focusedIdx = -1;
    currentItems = [];
  }

  function commitQuery(text) {
    const t = text.trim();
    if (!t) return;
    if (isUrl(t)) {
      addToHistory(t);
      navigate(normaliseUrl(t));
    } else {
      addToHistory(t);
      googleSearch(t);
    }
  }

  // ── keyboard navigation ───────────────────────────────────────
  function moveFocus(delta) {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    if (!items.length) return;
    items.forEach(el => el.classList.remove('focused'));
    // When starting from -1 and going up, jump straight to the last item
    if (focusedIdx === -1 && delta === -1) {
      focusedIdx = items.length - 1;
    } else {
      focusedIdx = (focusedIdx + delta + items.length) % items.length;
    }
    items[focusedIdx].classList.add('focused');
    // Fill input with the hovered suggestion text
    const labelEl = items[focusedIdx].querySelector('.suggestion-text');
    if (labelEl) {
      const raw = labelEl.textContent.replace(/^Search:\s/, '');
      searchBarInput.value = raw;
    }
  }

  searchBarInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveFocus(-1); return; }

    if (e.key === 'Enter') {
      e.preventDefault();
      const focused = suggestionsBox.querySelector('.suggestion-item.focused');
      if (focused) {
        focused.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      } else {
        const q = searchBarInput.value.trim();
        if (q) commitQuery(q);
      }
      return;
    }

    if (e.key === 'Escape') {
      hideSuggestions();
      searchBarInput.blur();
    }
  });

  // ── input handler (debounced) ─────────────────────────────────
  searchBarInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderSuggestions(searchBarInput.value.trim());
    }, 160);
  });

  // ── focus / blur ──────────────────────────────────────────────
  searchBarInput.addEventListener('focus', async () => {
    setActive(true);
    await renderSuggestions(searchBarInput.value.trim());
  });

  searchBarInput.addEventListener('blur', () => {
    // Delay so mousedown on a suggestion fires first
    setTimeout(() => {
      setActive(false);
      hideSuggestions();
    }, 180);
  });

  // ── Ctrl+G shortcut ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'g') {
      const active = document.activeElement;
      const tag = active ? active.tagName : '';
      if (tag === 'INPUT' && active !== searchBarInput) return;
      if (tag === 'TEXTAREA') return;
      e.preventDefault();
      searchBarInput.focus();
      searchBarInput.select();
    }
  });
})();


// ══════════════════════════════════════════════════════════════
// Welcome Overlay — show only on first install
// ══════════════════════════════════════════════════════════════
(async function initWelcome() {
  const overlay  = document.getElementById('welcomeOverlay');
  const dismissBtn = document.getElementById('welcomeDismiss');
  if (!overlay || !dismissBtn) return;

  // Check if the user has already been welcomed
  const welcomed = await store.get('welcomed', false);
  if (welcomed) return; // not first install — do nothing

  // First install: reveal the overlay
  // Use rAF to ensure the CSS transition fires properly after display
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });

  // "Get Started" — animate out, then hide & persist the flag
  dismissBtn.addEventListener('click', async () => {
    // Immediately cut pointer-events so double-clicks can't fire
    overlay.style.pointerEvents = 'none';
    overlay.classList.add('dismissing');
    await store.set('welcomed', true);
    // Wait for the CSS transition to finish before fully hiding
    overlay.addEventListener('transitionend', () => {
      overlay.style.display = 'none';
    }, { once: true });
    // Fallback: hide after 450 ms even if transitionend never fires
    setTimeout(() => { overlay.style.display = 'none'; }, 450);
  });
})();
