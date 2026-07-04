// ── Auth guard ────────────────────────────────
const token = localStorage.getItem('vault_token');
if (!token) window.location.href = '/';

const user = JSON.parse(localStorage.getItem('vault_user') || '{}');

// ── DOM refs ──────────────────────────────────
const searchInput    = document.getElementById('searchInput');
const uploadCard     = document.getElementById('uploadCard');
const fileInput      = document.getElementById('fileInput');
const browseBtn      = document.getElementById('browseBtn');
const dropzone       = document.getElementById('dropzone');
const uploadQueue    = document.getElementById('uploadQueue');
const gridView       = document.getElementById('gridView');
const listView       = document.getElementById('listView');
const fileTableBody  = document.getElementById('fileTableBody');
const emptyState     = document.getElementById('emptyState');
const loadingState   = document.getElementById('loadingState');
const panelTitle     = document.getElementById('panelTitle');
const refreshBtn     = document.getElementById('refreshBtn');
const viewGrid       = document.getElementById('viewGrid');
const viewList       = document.getElementById('viewList');
const toastContainer = document.getElementById('toastContainer');
const confirmModal   = document.getElementById('confirmModal');
const confirmText    = document.getElementById('confirmModalText');
const confirmCancel  = document.getElementById('confirmCancel');
const confirmOk      = document.getElementById('confirmOk');

let allFiles        = [];
let pendingDeleteId = null;
let currentView     = 'grid'; // 'grid' | 'list'

// ── Init user info ────────────────────────────
document.getElementById('userName').textContent = user.name || '';
document.getElementById('userAvatar').textContent =
  (user.name || user.email || '?')[0].toUpperCase();

// ── API helper ────────────────────────────────
// Attaches the auth token to every request automatically
async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/';
  }
  return res;
}

// ── Formatters ────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)   return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDateFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── File type helpers ─────────────────────────
const FILE_TYPES = {
  img:    { exts: ['png','jpg','jpeg','gif','webp','svg','avif'], emoji: '🖼️', bg: '#EFF6FF', color: '#3B82F6', label: 'Image' },
  doc:    { exts: ['pdf','doc','docx','txt','md','rtf'],          emoji: '📄', bg: '#F5F3FF', color: '#8B5CF6', label: 'Doc' },
  sheet:  { exts: ['xls','xlsx','csv'],                           emoji: '📊', bg: '#ECFDF5', color: '#10B981', label: 'Sheet' },
  code:   { exts: ['js','ts','py','html','css','json','go','rb','java','cpp','c','sh'], emoji: '💻', bg: '#FFF7ED', color: '#F97316', label: 'Code' },
  video:  { exts: ['mp4','mov','avi','mkv','webm'],               emoji: '🎬', bg: '#FEF2F2', color: '#EF4444', label: 'Video' },
  audio:  { exts: ['mp3','wav','flac','aac','ogg'],               emoji: '🎵', bg: '#FDF4FF', color: '#A855F7', label: 'Audio' },
  zip:    { exts: ['zip','rar','7z','tar','gz'],                  emoji: '🗜️', bg: '#F8FAFC', color: '#64748B', label: 'Archive' },
};

function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  for (const [key, type] of Object.entries(FILE_TYPES)) {
    if (type.exts.includes(ext)) return { key, ...type };
  }
  return { key: 'other', emoji: '📁', bg: '#F9FAFB', color: '#6B7280', label: ext.toUpperCase() || 'File' };
}

// ── Toast ─────────────────────────────────────
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    t.style.transition = 'all .2s';
    setTimeout(() => t.remove(), 200);
  }, 3000);
}

// ── Load & render files ───────────────────────
async function loadFiles() {
  setLoading(true);
  try {
    const res   = await api('/api/files');
    allFiles    = await res.json();
    renderAll(allFiles);
    updateStats(allFiles);
  } catch {
    toast('Could not load files', 'error');
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  loadingState.classList.toggle('is-active', on);
  if (on) {
    gridView.hidden = true;
    listView.hidden = true;
    emptyState.hidden = true;
  }
}

function updateStats(files) {
  document.getElementById('statFiles').textContent   = files.length;
  document.getElementById('statStorage').textContent = fmtSize(files.reduce((s,f) => s+f.size, 0));
  document.getElementById('statRecent').textContent  = files.length
    ? fmtDate(files[0].uploadedAt)
    : 'Never';
}

function renderAll(files) {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? files.filter(f => f.fileName.toLowerCase().includes(q))
    : files;

  panelTitle.textContent = q
    ? `Results for "${searchInput.value.trim()}" (${filtered.length})`
    : `All files (${files.length})`;

  if (filtered.length === 0) {
    gridView.hidden = true;
    listView.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  if (currentView === 'grid') {
    gridView.hidden = false;
    listView.hidden = true;
    renderGrid(filtered);
  } else {
    gridView.hidden = true;
    listView.hidden = false;
    renderList(filtered);
  }
}

// ── Grid view ─────────────────────────────────
function renderGrid(files) {
  gridView.innerHTML = files.map(f => {
    const type = getFileType(f.fileName);
    const isImg = type.key === 'img';
    return `
      <div class="file-card" data-id="${f.fileId}">
        <div class="file-card__thumb" style="background:${type.bg}">
          ${isImg
            ? `<span style="font-size:2.2rem">${type.emoji}</span>`
            : `<span style="font-size:2.2rem">${type.emoji}</span>`
          }
        </div>
        <div class="file-card__body">
          <p class="file-card__name" title="${f.fileName}">${f.fileName}</p>
          <p class="file-card__meta">${fmtSize(f.size)}</p>
        </div>
        <div class="file-card__actions">
          <button class="dl-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 16l-4-4M12 16l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Download
          </button>
          <button class="del-btn danger">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  gridView.querySelectorAll('.file-card').forEach(card => {
    const id   = card.dataset.id;
    const name = files.find(f => f.fileId === id)?.fileName || '';
    card.querySelector('.dl-btn').addEventListener('click', e => { e.stopPropagation(); downloadFile(id); });
    card.querySelector('.del-btn').addEventListener('click', e => { e.stopPropagation(); askDelete(id, name); });
  });
}

// ── List view ─────────────────────────────────
function renderList(files) {
  fileTableBody.innerHTML = files.map(f => {
    const type = getFileType(f.fileName);
    return `
      <tr data-id="${f.fileId}">
        <td>
          <div class="file-name-cell">
            <div class="file-icon-wrap" style="background:${type.bg};color:${type.color}">
              ${type.emoji}
            </div>
            <span class="file-name-text" title="${f.fileName}">${f.fileName}</span>
          </div>
        </td>
        <td>
          <span class="type-badge" style="background:${type.bg};color:${type.color}">${type.label}</span>
        </td>
        <td class="file-mono">${fmtSize(f.size)}</td>
        <td class="file-mono">${fmtDateFull(f.uploadedAt)}</td>
        <td>
          <div class="row-actions">
            <button class="dl-btn" title="Download">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 16l-4-4M12 16l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button class="del-btn danger" title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  fileTableBody.querySelectorAll('tr').forEach(row => {
    const id   = row.dataset.id;
    const name = files.find(f => f.fileId === id)?.fileName || '';
    row.querySelector('.dl-btn').addEventListener('click', () => downloadFile(id));
    row.querySelector('.del-btn').addEventListener('click', () => askDelete(id, name));
  });
}

// ── Download ──────────────────────────────────
async function downloadFile(fileId) {
  try {
    const res  = await api(`/api/files/${fileId}/download`);
    const data = await res.json();
    if (!res.ok) throw new Error();
    window.open(data.url, '_blank');
  } catch {
    toast('Could not generate download link', 'error');
  }
}

// ── Delete ────────────────────────────────────
function askDelete(fileId, fileName) {
  pendingDeleteId = fileId;
  confirmText.textContent = `"${fileName}" will be permanently deleted and cannot be recovered.`;
  confirmModal.classList.add('is-open');
}

confirmCancel.addEventListener('click', () => {
  confirmModal.classList.remove('is-open');
  pendingDeleteId = null;
});

confirmModal.addEventListener('click', e => {
  if (e.target === confirmModal) {
    confirmModal.classList.remove('is-open');
    pendingDeleteId = null;
  }
});

confirmOk.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  confirmModal.classList.remove('is-open');
  pendingDeleteId = null;
  try {
    const res = await api(`/api/files/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    toast('File deleted', 'success');
    loadFiles();
  } catch {
    toast('Could not delete file', 'error');
  }
});

// ── Upload ────────────────────────────────────
function uploadFile(file) {
  const item = document.createElement('div');
  item.className = 'upload-item';
  item.innerHTML = `
    <span class="upload-item__name">${file.name}</span>
    <div class="upload-item__track"><div class="upload-item__bar"></div></div>
    <span class="upload-item__pct">0%</span>
  `;
  uploadQueue.appendChild(item);

  const bar = item.querySelector('.upload-item__bar');
  const pct = item.querySelector('.upload-item__pct');
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/files');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  const formData = new FormData();
  formData.append('file', file);

  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const p = Math.round(e.loaded / e.total * 100);
      bar.style.width = p + '%';
      pct.textContent = p + '%';
    }
  });

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      pct.textContent = '✓';
      bar.style.width = '100%';
      toast(`${file.name} uploaded`, 'success');
      loadFiles();
      setTimeout(() => item.remove(), 1500);
    } else if (xhr.status === 401) {
      localStorage.clear(); window.location.href = '/';
    } else {
      item.classList.add('is-error');
      pct.textContent = '✗';
      toast(`Failed to upload ${file.name}`, 'error');
    }
  };

  xhr.onerror = () => {
    item.classList.add('is-error');
    pct.textContent = '✗';
    toast('Upload failed — check your connection', 'error');
  };

  xhr.send(formData);
}

// ── View toggle ───────────────────────────────
viewGrid.addEventListener('click', () => {
  currentView = 'grid';
  viewGrid.classList.add('is-active');
  viewList.classList.remove('is-active');
  renderAll(allFiles);
});

viewList.addEventListener('click', () => {
  currentView = 'list';
  viewList.classList.add('is-active');
  viewGrid.classList.remove('is-active');
  renderAll(allFiles);
});

// ── Search ────────────────────────────────────
searchInput.addEventListener('input', () => renderAll(allFiles));

// ── Dropzone ──────────────────────────────────
let dropzoneVisible = false;

function toggleDropzone(show) {
  dropzoneVisible = show;
  dropzone.classList.toggle('is-visible', show);
}

uploadCard.addEventListener('click', () => {
  toggleDropzone(!dropzoneVisible);
  if (dropzoneVisible) fileInput.click();
});

browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) Array.from(fileInput.files).forEach(uploadFile);
  fileInput.value = '';
  toggleDropzone(false);
});

// Drag anywhere on the page to show dropzone
document.addEventListener('dragenter', e => {
  if (e.dataTransfer.types.includes('Files')) toggleDropzone(true);
});

['dragenter', 'dragover'].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('is-dragover'); })
);

['dragleave', 'drop'].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('is-dragover'); })
);

dropzone.addEventListener('drop', e => {
  if (e.dataTransfer.files.length) Array.from(e.dataTransfer.files).forEach(uploadFile);
  toggleDropzone(false);
});

// ── Refresh + logout ──────────────────────────
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('is-spinning');
  loadFiles().finally(() => setTimeout(() => refreshBtn.classList.remove('is-spinning'), 500));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

// ── Boot ──────────────────────────────────────
loadFiles();
