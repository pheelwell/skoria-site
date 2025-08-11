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
function updateHeroTheme(animate = false) {
  const container = document.getElementById('swup');
  if (!container) return;
  const hueMain = Number(container.dataset.hueMain);
  const hueBg = Number(container.dataset.hueBg || hueMain);
  if (!isFinite(hueMain)) return;
  if (animate) {
    if (__themeTimer) clearTimeout(__themeTimer);
    document.documentElement.classList.add('theme-animate');
  }
  const bodyStyle = document.body.style;
  bodyStyle.setProperty('--main-background-color', `hsl(${hueBg}, 60%, 5%)`);
  bodyStyle.setProperty('--secondary-background-color', `hsl(${hueBg}, 40%, 10%)`);
  bodyStyle.setProperty('--tertiary-background-color', `hsl(${hueBg}, 62%, 15%)`);
  bodyStyle.setProperty('--accent-fg', `hsl(${hueMain}, 70%, 66%)`);
  bodyStyle.setProperty('--accent-fg-dim', `hsl(${hueMain}, 55%, 60%)`);
  if (animate) {
    __themeTimer = setTimeout(() => {
      document.documentElement.classList.remove('theme-animate');
      __themeTimer = 0;
    }, 4000);
  }
}

function initPageEnhancements(animate = false) {
  updateHeroTheme(animate);
  setupSearch();
  setupNavAutoClose();
  setupGlowBorders();
  
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
  initPageEnhancements(false);
  // Initialize Swup for smooth transitions, and re-run init on page change
  if (window.Swup) {
    const swup = new window.Swup({
      containers: ['#swup'],
      cache: true,
    });
    swup.hooks.on('page:view', () => {
      initPageEnhancements(true);
    });
  }
});

// Lightweight GlowCard-like pointer tracking for nav panels (no React)
function setupGlowBorders() {
  const targets = document.querySelectorAll('.dropdown-panel details, .callout, article.prose blockquote');
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

