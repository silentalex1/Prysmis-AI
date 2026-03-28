(function () {

  const tabBtns = document.querySelectorAll('.tab-btn');
  const panelUser = document.getElementById('panel-user');
  const panelAdmin = document.getElementById('panel-admin');
  const viewSignup = document.getElementById('view-signup');
  const viewLogin = document.getElementById('view-login');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'user') {
        panelUser.classList.remove('hidden-panel');
        panelUser.style.display = 'block';
        panelAdmin.classList.add('hidden-panel');
        panelAdmin.style.display = 'none';
      } else {
        panelAdmin.classList.remove('hidden-panel');
        panelAdmin.style.display = 'block';
        panelUser.classList.add('hidden-panel');
        panelUser.style.display = 'none';
      }
    });
  });

  document.getElementById('go-login').addEventListener('click', () => {
    viewSignup.style.display = 'none';
    viewLogin.style.display = 'block';
  });

  document.getElementById('go-signup').addEventListener('click', () => {
    viewLogin.style.display = 'none';
    viewSignup.style.display = 'block';
  });

  function getEl(id) { return document.getElementById(id); }

  function setError(inputId, errId, show) {
    const inp = getEl(inputId);
    const err = getEl(errId);
    if (show) {
      inp.classList.add('is-error');
      err.classList.add('show');
    } else {
      inp.classList.remove('is-error');
      err.classList.remove('show');
    }
    return !show;
  }

  function clearError(inputId, errId) {
    getEl(inputId).classList.remove('is-error');
    getEl(errId).classList.remove('show');
  }

  ['reg-username', 'reg-password', 'login-username', 'login-password', 'admin-key'].forEach(id => {
    const el = getEl(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('is-error');
      const errId = 'err-' + id;
      const errEl = getEl(errId);
      if (errEl) errEl.classList.remove('show');
    });
  });

  function setLoading(btn, state) {
    if (state) btn.classList.add('is-loading');
    else btn.classList.remove('is-loading');
  }

  function showToast(msg, type) {
    const t = getEl('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || '');
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3000);
  }

  getEl('btn-register').addEventListener('click', () => {
    const un = getEl('reg-username').value.trim();
    const pw = getEl('reg-password').value.trim();
    const a = setError('reg-username', 'err-reg-username', un.length === 0);
    const b = setError('reg-password', 'err-reg-password', pw.length < 6);
    if (!a || !b) return;
    const btn = getEl('btn-register');
    setLoading(btn, true);
    setTimeout(() => {
      setLoading(btn, false);
      showToast('Account created!', 'ok');
    }, 1400);
  });

  getEl('btn-login').addEventListener('click', () => {
    const un = getEl('login-username').value.trim();
    const pw = getEl('login-password').value.trim();
    const a = setError('login-username', 'err-login-username', un.length === 0);
    const b = setError('login-password', 'err-login-password', pw.length === 0);
    if (!a || !b) return;
    const btn = getEl('btn-login');
    setLoading(btn, true);
    setTimeout(() => {
      setLoading(btn, false);
      showToast('Signed in successfully!', 'ok');
    }, 1200);
  });

  getEl('btn-admin').addEventListener('click', () => {
    const key = getEl('admin-key').value.trim();
    const ok = setError('admin-key', 'err-admin-key', key.length === 0);
    if (!ok) return;
    const btn = getEl('btn-admin');
    setLoading(btn, true);
    setTimeout(() => {
      setLoading(btn, false);
      setError('admin-key', 'err-admin-key', true);
      showToast('Access denied.', 'fail');
    }, 1000);
  });

  (function initBg() {
    const c = document.getElementById('bgCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');

    function resize() {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const squares = [];
    for (let i = 0; i < 22; i++) {
      squares.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: 14 + Math.random() * 42,
        speed: 0.12 + Math.random() * 0.22,
        opacity: 0.025 + Math.random() * 0.065,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.0028,
        hue: Math.random() > 0.5 ? 220 : 255
      });
    }

    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      squares.forEach(sq => {
        ctx.save();
        ctx.translate(sq.x, sq.y);
        ctx.rotate(sq.rotation);
        ctx.globalAlpha = sq.opacity;
        ctx.strokeStyle = 'hsl(' + sq.hue + ', 65%, 70%)';
        ctx.lineWidth = 0.9;
        ctx.strokeRect(-sq.size / 2, -sq.size / 2, sq.size, sq.size);
        ctx.restore();
        sq.y -= sq.speed;
        sq.rotation += sq.rotSpeed;
        if (sq.y < -sq.size) {
          sq.y = c.height + sq.size;
          sq.x = Math.random() * c.width;
        }
      });
      requestAnimationFrame(draw);
    }
    draw();
  })();

})();
