// Redirect to dashboard if already logged in
if (localStorage.getItem('vault_token')) {
  window.location.href = '/dashboard';
}

// ── Tab switching ─────────────────────────────
const tabs      = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('loginForm');
const regForm   = document.getElementById('registerForm');
const loginErr  = document.getElementById('loginError');
const regErr    = document.getElementById('registerError');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const isLogin = tab.dataset.tab === 'login';
    loginForm.hidden = !isLogin;
    regForm.hidden   =  isLogin;
    loginErr.hidden  =  true;
    regErr.hidden    =  true;
  });
});

// ── Helpers ───────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function setLoading(form, loading) {
  const btn     = form.querySelector('button[type=submit]');
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled    = loading;
  label.hidden    = loading;
  spinner.hidden  = !loading;
}

// ── Login ─────────────────────────────────────
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginErr.hidden = true;
  setLoading(loginForm, true);

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email:    document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    });
    const data = await res.json();

    if (!res.ok) return showError(loginErr, data.error);

    localStorage.setItem('vault_token', data.token);
    localStorage.setItem('vault_user',  JSON.stringify(data.user));
    window.location.href = '/dashboard';

  } catch {
    showError(loginErr, 'Connection error — please try again');
  } finally {
    setLoading(loginForm, false);
  }
});

// ── Register ──────────────────────────────────
regForm.addEventListener('submit', async e => {
  e.preventDefault();
  regErr.hidden = true;
  setLoading(regForm, true);

  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:     document.getElementById('regName').value.trim(),
        email:    document.getElementById('regEmail').value.trim(),
        password: document.getElementById('regPassword').value,
      }),
    });
    const data = await res.json();

    if (!res.ok) return showError(regErr, data.error);

    localStorage.setItem('vault_token', data.token);
    localStorage.setItem('vault_user',  JSON.stringify(data.user));
    window.location.href = '/dashboard';

  } catch {
    showError(regErr, 'Connection error — please try again');
  } finally {
    setLoading(regForm, false);
  }
});
