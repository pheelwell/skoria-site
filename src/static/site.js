// Basic interactive polish: subtle parallax on banner (rAF-throttled)
let __mmRaf = 0;
let __mmLast = null;
document.addEventListener(
  "mousemove",
  (e) => {
    __mmLast = e;
    if (__mmRaf) return;
    __mmRaf = requestAnimationFrame(() => {
      __mmRaf = 0;
      const aurora = document.querySelector(".aurora-layer");
      if (!aurora || !__mmLast) return;
      const x = (__mmLast.clientX / window.innerWidth - 0.5) * 10;
      const y = (__mmLast.clientY / window.innerHeight - 0.5) * 6;
      aurora.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  },
  { passive: true }
);

// Lazy-load metadata and power search
let __metaIndex = null;
async function ensureMetadata() {
  if (__metaIndex) return __metaIndex;
  try {
    const res = await fetch('/static/metadata.json');
    const json = await res.json();
    const items = Object.entries(json).map(([title, data]) => ({
      title,
      titleLower: title.toLowerCase(),
      path: normalizePath(data.path || '/'),
      banner: data.banner || null,
    }));
    __metaIndex = items;
    return items;
  } catch (e) {
    __metaIndex = [];
    return __metaIndex;
  }
}

function normalizePath(p) {
  if (!p) return '/';
  let s = String(p);
  s = s.replace(/%5C/gi, '/');
  s = s.replace(/\\/g, '/');
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

function renderSearchResults(results) {
  const panel = document.getElementById('searchResults');
  if (!panel) return;
  panel.innerHTML = '';
  if (results.length === 0) {
    panel.hidden = true;
    return;
  }
  for (const item of results.slice(0, 24)) {
    const a = document.createElement('a');
    a.href = item.path;
    a.className = 'row';
    if (item.banner) {
      const img = document.createElement('img');
      img.src = item.banner;
      img.alt = '';
      a.appendChild(img);
    } else {
      const img = document.createElement('img');
      img.src = '/static/Placeholder.png';
      img.alt = '';
      a.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = item.title;
    a.appendChild(span);
    panel.appendChild(a);
  }
  panel.hidden = false;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setupSearch() {
  const input = document.getElementById("search");
  const panel = document.getElementById('searchResults');
  if (!input || !panel) return;
  let lastTerm = '';
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim().toLowerCase();
    lastTerm = q;
    if (q.length === 0) { panel.hidden = true; return; }
    const items = await ensureMetadata();
    const results = items.filter(x => x.titleLower.includes(q));
    // if user typed more while fetching, respect newest term
    if (q !== lastTerm) return;
    renderSearchResults(results);
  }, 120));
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== input) {
      panel.hidden = true;
    }
  });
}

function setupNavAutoClose() {
  const dropdown = document.querySelector('[data-nav]');
  if (!dropdown) return;
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) dropdown.open = false;
  });
  
  // Close when clicking on navigation links
  const navLinks = dropdown.querySelectorAll('a[href]');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      dropdown.open = false;
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.open) {
      dropdown.open = false;
    }
  });
  
  // Prevent body scroll when modal is open
  dropdown.addEventListener('toggle', () => {
    if (dropdown.open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });
}

let __themeTimer = 0;
let __transitionAnimation = null;
let __currentAnimationState = null; // Track current animation state

function updateHeroTheme(animate = false) {
  console.log('🔄 updateHeroTheme called with animate:', animate);
  
  // Get theme data from swup container or banner container
  const container = document.getElementById('swup') || document.getElementById('swup-banner');
  if (!container) {
    console.warn('⚠️ No container found (swup or banner)');
    return;
  }
  
  const hueMain = Number(container.dataset.hueMain);
  const hueBg = Number(container.dataset.hueBg || hueMain);
  const hero0 = Number(container.dataset.hero0 || hueMain);
  const hero1 = Number(container.dataset.hero1 || hueMain);
  const hero2 = Number(container.dataset.hero2 || hueBg);
  
  console.log('🎨 Theme values:', { hueMain, hueBg, hero0, hero1, hero2 });
  
  if (!isFinite(hueMain)) {
    console.warn('⚠️ Invalid hueMain value:', hueMain);
    return;
  }
  
  // Update aurora element data attributes
  const aurora = document.querySelector('.aurora');
  if (aurora) {
    console.log('🌟 Updating aurora data attributes');
    aurora.dataset.hueBg = hueBg;
    aurora.dataset.hero0 = hero0;
    aurora.dataset.hero1 = hero1;
    aurora.dataset.hero2 = hero2;
  } else {
    console.warn('⚠️ Aurora element not found');
  }
  
  // Debug: Check aurora element state
  if (aurora) {
    console.log('🔍 Aurora element data attributes:', {
      'data-hue-bg': aurora.dataset.hueBg,
      'data-hero0': aurora.dataset.hero0,
      'data-hero1': aurora.dataset.hero1,
      'data-hero2': aurora.dataset.hero2
    });
  }
  
  if (animate) {
    console.log('🎭 Starting 10s transition animation');
    if (__themeTimer) {
      console.log('⏰ Clearing existing timer');
      clearTimeout(__themeTimer);
    }
    if (__transitionAnimation) {
      console.log('⏰ Cancelling existing animation');
      cancelAnimationFrame(__transitionAnimation);
      __transitionAnimation = null;
    }
    
    // Start smooth transition animation
    startSmoothTransition(hueMain, hueBg, hero0, hero1, hero2);
  } else {
    // Instant update
    setThemeVariables(hueMain, hueBg, hero0, hero1, hero2);
  }
  
  console.log('🏁 updateHeroTheme completed');
}

function setThemeVariables(hueMain, hueBg, hero0, hero1, hero2) {
  const bodyStyle = document.body.style;
  console.log('🎨 Setting body CSS variables instantly');
  
  bodyStyle.setProperty('--main-background-color', `hsl(${hueBg}, 60%, 5%)`);
  bodyStyle.setProperty('--secondary-background-color', `hsl(${hueBg}, 40%, 10%)`);
  bodyStyle.setProperty('--tertiary-background-color', `hsl(${hueBg}, 62%, 15%)`);
  bodyStyle.setProperty('--accent-fg', `hsl(${hueMain}, 70%, 66%)`);
  bodyStyle.setProperty('--accent-fg-dim', `hsl(${hueMain}, 55%, 60%)`);
  
  // Update hero color variables
  bodyStyle.setProperty('--hero0', `hsl(${hero0}, 70%, 50%)`);
  bodyStyle.setProperty('--hero0-dark', `hsl(${hero0}, 70%, 30%)`);
  bodyStyle.setProperty('--hero0-light', `hsl(${hero0}, 70%, 70%)`);
  bodyStyle.setProperty('--hero0-saturated', `hsl(${hero0}, 90%, 50%)`);
  
  bodyStyle.setProperty('--hero1', `hsl(${hero1}, 70%, 50%)`);
  bodyStyle.setProperty('--hero1-dark', `hsl(${hero1}, 70%, 30%)`);
  bodyStyle.setProperty('--hero1-light', `hsl(${hero1}, 70%, 70%)`);
  bodyStyle.setProperty('--hero1-saturated', `hsl(${hero1}, 90%, 50%)`);
  
  bodyStyle.setProperty('--hero2', `hsl(${hero2}, 70%, 50%)`);
  bodyStyle.setProperty('--hero2-dark', `hsl(${hero2}, 70%, 30%)`);
  bodyStyle.setProperty('--hero2-light', `hsl(${hero2}, 70%, 70%)`);
  bodyStyle.setProperty('--hero2-saturated', `hsl(${hero2}, 90%, 50%)`);
  
  console.log('✅ Body CSS variables set');
}

function startSmoothTransition(targetHueMain, targetHueBg, targetHero0, targetHero1, targetHero2) {
  // Get current values - use animation state if available, otherwise read from CSS
  let currentHueBg, currentHero0, currentHero1, currentHero2;
  
  if (__currentAnimationState) {
    // Use current animation state values
    currentHueBg = __currentAnimationState.currentHueBg;
    currentHero0 = __currentAnimationState.currentHero0;
    currentHero1 = __currentAnimationState.currentHero1;
    currentHero2 = __currentAnimationState.currentHero2;
    console.log('🎭 Using current animation state for transition start');
  } else {
    // Read from CSS variables
    const currentStyle = getComputedStyle(document.body);
    currentHueBg = parseFloat(currentStyle.getPropertyValue('--main-background-color').match(/hsl\(([^,]+)/)?.[1] || targetHueBg);
    currentHero0 = parseFloat(currentStyle.getPropertyValue('--hero0').match(/hsl\(([^,]+)/)?.[1] || targetHero0);
    currentHero1 = parseFloat(currentStyle.getPropertyValue('--hero1').match(/hsl\(([^,]+)/)?.[1] || targetHero1);
    currentHero2 = parseFloat(currentStyle.getPropertyValue('--hero2').match(/hsl\(([^,]+)/)?.[1] || targetHero2);
    console.log('🎭 Reading current values from CSS');
  }
  
  console.log('🎭 Starting smooth transition from:', { currentHueBg, currentHero0, currentHero1, currentHero2 });
  console.log('🎭 To:', { targetHueBg, targetHero0, targetHero1, targetHero2 });
  
  const duration = 10000; // 10 seconds
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth transition
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // Interpolate values
    const currentHueBgValue = currentHueBg + (targetHueBg - currentHueBg) * easeProgress;
    const currentHero0Value = currentHero0 + (targetHero0 - currentHero0) * easeProgress;
    const currentHero1Value = currentHero1 + (targetHero1 - currentHero1) * easeProgress;
    const currentHero2Value = currentHero2 + (targetHero2 - currentHero2) * easeProgress;
    
    // Update CSS variables
    setThemeVariables(targetHueMain, currentHueBgValue, currentHero0Value, currentHero1Value, currentHero2Value);
    
    // Track current animation state for potential interruption
    __currentAnimationState = {
      currentHueBg: currentHueBgValue,
      currentHero0: currentHero0Value,
      currentHero1: currentHero1Value,
      currentHero2: currentHero2Value
    };
    
    if (progress < 1) {
      __transitionAnimation = requestAnimationFrame(animate);
    } else {
      console.log('🎭 Transition completed');
      __transitionAnimation = null;
      __currentAnimationState = null; // Clear state when done
    }
  }
  
  __transitionAnimation = requestAnimationFrame(animate);
}



function initPageEnhancements(animate = false) {
  console.log('🚀 initPageEnhancements called with animate:', animate);
  updateHeroTheme(animate);
  setupSearch();
  setupNavAutoClose();
  setupGlowBorders();
  setupPasswordProtection();
  
  // Request device orientation permission on mobile
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      const requestOrientationPermission = () => {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              console.log('Device orientation permission granted');
            }
          })
          .catch(console.error);
      };
      
      // Request permission on first user interaction
      document.addEventListener('touchstart', requestOrientationPermission, { once: true });
    }
  }
}

window.addEventListener("load", () => {
  console.log('📄 Page loaded, initializing enhancements');
  initPageEnhancements(false);
  // Initialize Swup for smooth transitions, and re-run init on page change
  if (window.Swup) {
    console.log('🔄 Initializing Swup');
    const swup = new window.Swup({
      containers: ['#swup', '#swup-banner'],
      cache: true,
    });
    swup.hooks.on('page:view', () => {
      console.log('🔄 Swup page:view event triggered');
      initPageEnhancements(true);
    });
    
    // Clean up password overlay when navigating
    swup.hooks.on('page:before', () => {
      console.log('🔄 Swup page:before event triggered - cleaning up password overlay');
      const overlay = document.getElementById('passwordOverlay');
      if (overlay) {
        overlay.classList.remove('active');
      }
    });
  } else {
    console.warn('⚠️ Swup not available');
  }
});

// Lightweight GlowCard-like pointer tracking for nav panels (no React)
function setupGlowBorders() {
  const targets = document.querySelectorAll('.dropdown-panel details, .callout, article.prose blockquote, .card');
  const lerp = (a, b, t) => a + (b - a) * t;
  
  // Check if device supports orientation
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const supportsOrientation = window.DeviceOrientationEvent && isMobile;
  
  targets.forEach((el) => {
    let start = 0;
    let raf = 0;
    let active = 0;
    let touchActive = false;
    
    const updateGlow = (angle, intensity = 1) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        start = lerp(start, angle, 0.25);
        el.style.setProperty('--glow-start', String(start));
        el.style.setProperty('--glow-active', String(intensity));
      });
    };
    
    const onMove = (e) => {
      if (touchActive) return; // Don't interfere with touch
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const angle = Math.atan2((e.clientY - cy), (e.clientX - cx)) * 180 / Math.PI + 90;
      updateGlow(angle, 1);
    };
    
    const onLeave = () => {
      if (!touchActive) {
        updateGlow(start, 0);
      }
    };
    
    // Mouse events (desktop)
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave, { passive: true });
    
    // Touch events (mobile)
    if (isMobile) {
      let touchStartAngle = 0;
      let touchStartTime = 0;
      
      el.addEventListener('touchstart', (e) => {
        touchActive = true;
        const rect = el.getBoundingClientRect();
        const touch = e.touches[0];
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        touchStartAngle = Math.atan2((touch.clientY - cy), (touch.clientX - cx)) * 180 / Math.PI + 90;
        touchStartTime = Date.now();
        updateGlow(touchStartAngle, 0.8);
      }, { passive: true });
      
      el.addEventListener('touchmove', (e) => {
        if (!touchActive) return;
        const rect = el.getBoundingClientRect();
        const touch = e.touches[0];
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const angle = Math.atan2((touch.clientY - cy), (touch.clientX - cx)) * 180 / Math.PI + 90;
        const intensity = Math.min(1, 0.8 + (Date.now() - touchStartTime) / 1000);
        updateGlow(angle, intensity);
      }, { passive: true });
      
      el.addEventListener('touchend', () => {
        touchActive = false;
        updateGlow(start, 0);
      }, { passive: true });
    }
    
    // Device orientation (mobile)
    if (supportsOrientation) {
      let orientationActive = false;
      let lastBeta = 0;
      let lastGamma = 0;
      
      const onOrientation = (e) => {
        if (!touchActive && orientationActive) {
          const beta = e.beta || 0; // -180 to 180 (front/back tilt)
          const gamma = e.gamma || 0; // -90 to 90 (left/right tilt)
          
          // Smooth the orientation values
          const smoothBeta = lerp(lastBeta, beta, 0.1);
          const smoothGamma = lerp(lastGamma, gamma, 0.1);
          
          // Convert device orientation to glow angle
          const angle = (smoothGamma * 2) + 90; // Map -90/90 to 0/180
          const intensity = Math.max(0.3, 1 - Math.abs(smoothBeta) / 90); // Reduce intensity with tilt
          
          updateGlow(angle, intensity);
          
          lastBeta = smoothBeta;
          lastGamma = smoothGamma;
        }
      };
      
      // Enable orientation tracking when element is visible
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            orientationActive = true;
            if (window.DeviceOrientationEvent) {
              window.addEventListener('deviceorientation', onOrientation, { passive: true });
            }
          } else {
            orientationActive = false;
            if (window.DeviceOrientationEvent) {
              window.removeEventListener('deviceorientation', onOrientation);
            }
          }
        });
      }, { threshold: 0.1 });
      
      observer.observe(el);
    }
  });
}

// Password protection system
function setupPasswordProtection() {
  console.log('🔒 setupPasswordProtection called');
  
  // Clean up any existing password protection
  const existingOverlay = document.getElementById('passwordOverlay');
  if (existingOverlay) {
    existingOverlay.classList.remove('active');
  }
  
  const existingArticle = document.querySelector('article.prose');
  if (existingArticle) {
    existingArticle.classList.remove('article-protected', 'revealed');
  }
  
  const article = document.querySelector('article.prose');
  const overlay = document.getElementById('passwordOverlay');
  const input = document.getElementById('passwordInput');
  const submit = document.getElementById('passwordSubmit');
  const error = document.getElementById('passwordError');
  const hint = document.getElementById('passwordHint');
  
  console.log('🔍 Password elements found:', {
    article: !!article,
    overlay: !!overlay,
    input: !!input,
    submit: !!submit,
    error: !!error,
    hint: !!hint
  });
  
  if (!article || !overlay) {
    console.log('❌ Missing required elements, returning');
    return;
  }
  
  const password = article.dataset.password;
  const passwordHint = article.dataset.passwordHint;
  
  console.log('🔍 Password data:', {
    password: password,
    passwordHint: passwordHint
  });
  
  // If no password is set, check if there's a hint-only mode
  if (!password) {
    if (passwordHint) {
      // Hint-only mode: show hint and allow proceeding without password
      console.log('🔓 Hint-only mode detected');
      
      // Set hint text
      hint.textContent = passwordHint;
      
        // Add protected class to article
  article.classList.add('article-protected');
  
  // Show overlay
  overlay.classList.add('active');
  
  // Reset any previous state
  input.value = '';
  input.style.display = 'block';
  error.classList.remove('show');
  submit.textContent = 'Submit';
  submit.classList.remove('hint-only-mode');
  
  // Focus input
  input.focus();
      
      // Check if already unlocked in this session
      if (sessionStorage.getItem('password_unlocked_' + window.location.pathname) === 'true') {
        console.log('🔓 Already unlocked in this session');
        article.classList.add('revealed');
        return;
      }
      
      // For hint-only mode, show a "Continue" button instead of password input
      submit.textContent = 'Continue';
      submit.classList.add('hint-only-mode');
      
      // Hide the password input field in hint-only mode
      input.style.display = 'none';
      
      // Reset any previous state
      input.value = '';
      error.classList.remove('show');
      
      // Event listeners for hint-only mode
      submit.addEventListener('click', () => {
        console.log('🔓 Hint-only mode: continuing');
        overlay.classList.remove('active');
        article.classList.add('revealed');
        sessionStorage.setItem('password_unlocked_' + window.location.pathname, 'true');
      });
      
      return;
    } else {
      // No password and no hint, don't show protection
      console.log('❌ No password or hint set, returning');
      return;
    }
  }
  
  console.log('🔒 Setting up password protection');
  
  // Check if already unlocked in this session
  if (sessionStorage.getItem('password_unlocked_' + window.location.pathname) === 'true') {
    console.log('🔓 Already unlocked in this session');
    article.classList.add('revealed');
    return;
  }
  
  // Set hint text if provided
  if (passwordHint) {
    hint.textContent = passwordHint;
  }
  
  // Add protected class to article
  article.classList.add('article-protected');
  
  // Show overlay
  overlay.classList.add('active');
  
  // Focus input
  input.focus();
  
  // Handle submit
  function checkPassword() {
    const enteredPassword = input.value.trim();
    
    if (enteredPassword === password) {
      console.log('🔓 Password correct, revealing content');
      
      // Hide overlay
      overlay.classList.remove('active');
      
      // Reveal article
      article.classList.add('revealed');
      
      // Store in session storage so it persists during navigation
      sessionStorage.setItem('password_unlocked_' + window.location.pathname, 'true');
      
    } else {
      console.log('❌ Incorrect password');
      
      // Show error
      error.classList.add('show');
      
      // Clear input
      input.value = '';
      
      // Hide error after 3 seconds
      setTimeout(() => {
        error.classList.remove('show');
      }, 3000);
    }
  }
  
  // For testing: allow "test" password on any page
  function checkTestPassword() {
    const enteredPassword = input.value.trim();
    
    if (enteredPassword === 'test') {
      console.log('🔓 Test password accepted');
      
      // Hide overlay
      overlay.classList.remove('active');
      
      // Reveal article
      article.classList.add('revealed');
      
      // Store in session storage
      sessionStorage.setItem('password_unlocked_' + window.location.pathname, 'true');
      
    } else {
      checkPassword(); // Fall back to normal password check
    }
  }
  
  // Event listeners
  submit.addEventListener('click', checkPassword);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkPassword();
    }
  });
}

