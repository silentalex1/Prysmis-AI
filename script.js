window.addEventListener('DOMContentLoaded', function () {

  var loader = document.getElementById('loader');
  var site = document.getElementById('site');
  var loaderBar = document.getElementById('loaderBar');
  var statusEl = document.getElementById('loaderStatus');
  var canvas = document.getElementById('loaderCanvas');
  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();

  var CW = canvas.width;
  var CH = canvas.height;
  var CX = CW / 2;
  var CY = CH / 2;

  var C = {
    skin:    '#f5c8a0',
    hair:    '#7b3b10',
    torso:   '#009fd4',
    arm:     '#009fd4',
    leg:     '#1e22d6',
    shoe:    '#1a1a2e',
    outline: 'rgba(0,0,0,0.45)',
    eye:     '#1e22d6',
    mouth:   'rgba(0,0,0,0.5)'
  };

  var SCALE = Math.min(CW, CH) / 700;
  var S = Math.max(0.7, Math.min(1.4, SCALE));

  var state = {
    phase: 'walk',
    time: 0,
    phaseT: 0,
    walkX: -(CW / 2 + 120),
    walkTarget: 0,
    waveAngle: 0,
    crouchAmt: 0,
    liftProgress: 0,
    exitProgress: 0,
    charOpacity: 1,
    barProgress: 0,
    statusIdx: 0,
    statusTimer: 0,
    frameId: null
  };

  var STATUS = ['Loading...', 'Building world...', 'Placing blocks...', 'Almost ready...', 'Ready.'];
  statusEl.style.transition = 'opacity 0.18s';

  function nextStatus() {
    if (state.statusIdx >= STATUS.length - 1) return;
    statusEl.style.opacity = '0';
    setTimeout(function () {
      state.statusIdx = Math.min(state.statusIdx + 1, STATUS.length - 1);
      statusEl.textContent = STATUS[state.statusIdx];
      statusEl.style.opacity = '1';
    }, 180);
  }

  function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut2(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function fillRoundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2 * S;
      ctx.stroke();
    }
  }

  function drawChar(cx, cy, walkCycle, waveAng, crouch, opacity) {
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;

    var sc = S;
    var HW = 40 * sc, HH = 40 * sc;
    var TW = 32 * sc, TH = 42 * sc;
    var AW = 13 * sc, AH = 34 * sc;
    var LW = 13 * sc, LH = 34 * sc;
    var SH = 8 * sc;

    var legSwing   = Math.sin(walkCycle) * 20;
    var armSwingL  = Math.sin(walkCycle + Math.PI) * 18;

    var baseY = cy - crouch * sc;
    var torsoY = baseY - TH / 2;
    var torsoX = cx - TW / 2;
    var headY  = torsoY - HH - 2 * sc;
    var headX  = cx - HW / 2;

    var legTopY = torsoY + TH - 4 * sc;
    var armTopY = torsoY + 3 * sc;

    ctx.save();
    ctx.translate(cx - TW / 2 - AW - 2 * sc, armTopY);
    ctx.rotate(armSwingL * Math.PI / 180);
    fillRoundRect(0, 0, AW, AH, 4 * sc, C.arm, C.outline);
    ctx.restore();

    ctx.save();
    ctx.translate(cx + TW / 2 + 2 * sc, armTopY);
    ctx.rotate(waveAng * Math.PI / 180);
    fillRoundRect(0, 0, AW, AH * 0.55, 4 * sc, C.arm, C.outline);
    ctx.restore();

    ctx.save();
    ctx.translate(cx - LW - 3 * sc, legTopY);
    ctx.rotate(legSwing * Math.PI / 180);
    fillRoundRect(0, 0, LW, LH, 4 * sc, C.leg, C.outline);
    fillRoundRect(-2 * sc, LH - 3 * sc, LW + 4 * sc, SH, 3 * sc, C.shoe, null);
    ctx.restore();

    ctx.save();
    ctx.translate(cx + 3 * sc, legTopY);
    ctx.rotate(-legSwing * Math.PI / 180);
    fillRoundRect(0, 0, LW, LH, 4 * sc, C.leg, C.outline);
    fillRoundRect(-2 * sc, LH - 3 * sc, LW + 4 * sc, SH, 3 * sc, C.shoe, null);
    ctx.restore();

    fillRoundRect(torsoX, torsoY, TW, TH, 5 * sc, C.torso, C.outline);

    fillRoundRect(headX, headY, HW, HH, 6 * sc, C.skin, C.outline);

    var hairH = 10 * sc;
    fillRoundRect(headX - 2 * sc, headY - hairH + 5 * sc, HW + 4 * sc, hairH, [5 * sc, 5 * sc, 0, 0], C.hair, C.outline);

    var eyeW = 7 * sc, eyeH = 7 * sc;
    fillRoundRect(headX + 8 * sc, headY + 13 * sc, eyeW, eyeH, 1.5 * sc, C.eye, null);
    fillRoundRect(headX + HW - 8 * sc - eyeW, headY + 13 * sc, eyeW, eyeH, 1.5 * sc, C.eye, null);

    ctx.fillStyle = C.mouth;
    ctx.beginPath();
    ctx.arc(cx, headY + 28 * sc, 6 * sc, 0, Math.PI);
    ctx.fill();

    ctx.restore();
  }

  function drawRevealCurtain(progress) {
    if (progress <= 0) return;
    var h = Math.min(progress * CH * 1.6, CH);
    var top = CH - h;
    ctx.save();
    ctx.globalAlpha = Math.min(progress * 1.8, 1);
    var grad = ctx.createLinearGradient(0, top, 0, CH);
    grad.addColorStop(0, 'rgba(10,10,18,0)');
    grad.addColorStop(0.2, '#0a0a12');
    grad.addColorStop(1, '#06060a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, CW, h);
    ctx.restore();
  }

  var lastTs = null;
  function animate(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(ts - lastTs, 50);
    lastTs = ts;
    state.time += dt;
    state.phaseT += dt;
    state.statusTimer += dt;

    if (state.statusTimer > 850 && state.statusIdx < 3) {
      nextStatus();
      state.statusTimer = 0;
    }

    state.barProgress = Math.min(state.barProgress + dt / 4000, 1);
    loaderBar.style.width = (state.barProgress * 100).toFixed(1) + '%';

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, CW, CH);

    var p = state;

    if (p.phase === 'walk') {
      var speed = 220 * S;
      p.walkX += (dt / 1000) * speed;
      if (p.walkX >= p.walkTarget) {
        p.walkX = p.walkTarget;
        p.phase = 'pause';
        p.phaseT = 0;
      }
      var cycle = state.time / 240;
      drawChar(CX + p.walkX, CY + 30 * S, cycle, 0, 0, 1);
    }

    else if (p.phase === 'pause') {
      drawChar(CX, CY + 30 * S, 0, 0, 0, 1);
      if (p.phaseT > 280) { p.phase = 'wave'; p.phaseT = 0; }
    }

    else if (p.phase === 'wave') {
      var wt = p.phaseT;
      p.waveAngle = -55 - Math.sin(wt / 160) * 38;
      drawChar(CX, CY + 30 * S, 0, p.waveAngle, 0, 1);
      if (p.phaseT > 1800) { p.phase = 'crouch'; p.phaseT = 0; }
    }

    else if (p.phase === 'crouch') {
      var ct = Math.min(p.phaseT / 500, 1);
      p.crouchAmt = easeInOut2(ct) * 22;
      drawChar(CX, CY + 30 * S, 0, 0, p.crouchAmt, 1);
      if (p.phaseT > 500) { p.phase = 'lift'; p.phaseT = 0; }
    }

    else if (p.phase === 'lift') {
      var lt = Math.min(p.phaseT / 1100, 1);
      p.liftProgress = easeOut3(lt);
      var uncrouch = easeOut3(lt) * 22;
      p.crouchAmt = 22 - uncrouch;
      var charRise = p.liftProgress * 55 * S;
      drawChar(CX, CY + 30 * S - charRise, 0, 0, p.crouchAmt, 1);
      drawRevealCurtain(p.liftProgress);
      if (p.phaseT > 1100) { p.phase = 'finalwave'; p.phaseT = 0; }
    }

    else if (p.phase === 'finalwave') {
      var fw = p.phaseT;
      var fwAng = -60 - Math.sin(fw / 140) * 40;
      var charRiseFinal = 55 * S;
      drawRevealCurtain(1);
      drawChar(CX, CY + 30 * S - charRiseFinal, 0, fwAng, 0, 1);
      if (p.phaseT > 1200) { p.phase = 'exit'; p.phaseT = 0; }
    }

    else if (p.phase === 'exit') {
      var et = Math.min(p.phaseT / 600, 1);
      p.exitProgress = easeInOut2(et);
      p.charOpacity = 1 - p.exitProgress;
      var exitY = p.exitProgress * 40 * S;
      var charRiseExit = 55 * S;
      drawRevealCurtain(1);
      drawChar(CX, CY + 30 * S - charRiseExit - exitY, 0, -80, 0, p.charOpacity);

      ctx.save();
      ctx.globalAlpha = p.exitProgress * 0.9;
      ctx.fillStyle = '#06060a';
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();

      if (p.phaseT > 600) {
        cancelAnimationFrame(p.frameId);
        nextStatus();
        finishLoader();
        return;
      }
    }

    p.frameId = requestAnimationFrame(animate);
  }

  function finishLoader() {
    loader.style.transition = 'opacity 0.75s ease';
    loader.style.opacity = '0';
    site.classList.remove('site-hidden');
    setTimeout(function () {
      site.classList.add('site-visible');
      loader.style.display = 'none';
      initSquares();
      initReveal();
      initFaq();
    }, 780);
  }

  state.frameId = requestAnimationFrame(animate);

  function initSquares() {
    var sc = document.getElementById('squaresCanvas');
    if (!sc) return;
    var sctx = sc.getContext('2d');

    function rsz() {
      sc.width = sc.offsetWidth;
      sc.height = sc.offsetHeight;
    }
    rsz();
    window.addEventListener('resize', rsz);

    var sq = [];
    for (var i = 0; i < 30; i++) {
      sq.push({
        x: Math.random() * sc.width,
        y: Math.random() * sc.height,
        size: 16 + Math.random() * 50,
        speed: 0.14 + Math.random() * 0.28,
        opacity: 0.025 + Math.random() * 0.09,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.0035,
        drift: (Math.random() - 0.5) * 0.22,
        hue: Math.random() > 0.5 ? 248 : 186
      });
    }

    function tick() {
      sctx.clearRect(0, 0, sc.width, sc.height);
      sq.forEach(function (s) {
        sctx.save();
        sctx.translate(s.x, s.y);
        sctx.rotate(s.rotation);
        sctx.globalAlpha = s.opacity;
        sctx.strokeStyle = 'hsl(' + s.hue + ',65%,68%)';
        sctx.lineWidth = 0.85;
        sctx.strokeRect(-s.size / 2, -s.size / 2, s.size, s.size);
        sctx.restore();
        s.y -= s.speed;
        s.x += s.drift;
        s.rotation += s.rotSpeed;
        if (s.y < -s.size) { s.y = sc.height + s.size; s.x = Math.random() * sc.width; }
        if (s.x < -s.size) s.x = sc.width + s.size;
        if (s.x > sc.width + s.size) s.x = -s.size;
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  function initReveal() {
    var els = document.querySelectorAll('.feature-card, .faq-item, .hero-inner > *, .cta-section h2, .cta-eyebrow, .cta-btn, .section-label, h2, .section-sub');
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    els.forEach(function (el) {
      el.classList.add('reveal');
      obs.observe(el);
    });
  }

  function initFaq() {
    document.querySelectorAll('.faq-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        document.querySelectorAll('.faq-q').forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          b.nextElementSibling.classList.remove('open');
        });
        if (!open) {
          btn.setAttribute('aria-expanded', 'true');
          btn.nextElementSibling.classList.add('open');
        }
      });
    });
  }

});
