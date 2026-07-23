const blogState = {
  posts: [],
  activeTag: 'all'
};

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme);

  if (newTheme === 'light') {
    localStorage.setItem('theme', 'light');
  } else {
    localStorage.removeItem('theme');
  }
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle i');
  if (!icon) return;
  icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function setActiveNavLink() {
  const currentPath = normalizePath(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  const urlCategory = params.get('category');
  const bodyPage = document.body.dataset.page;
  let activeSection = null;

  if (currentPath.includes('/blog/writeups') || urlCategory === 'writeups' || bodyPage === 'writeups') {
    activeSection = '/blog/writeups';
  } else if (currentPath.includes('/blog/exam-reviews') || urlCategory === 'exam-reviews' || urlCategory === 'exam_reviews' || bodyPage === 'exam-reviews') {
    activeSection = '/blog/exam-reviews';
  } else if (currentPath.includes('/blog/security-research') || urlCategory === 'security-research' || urlCategory === 'security_research' || bodyPage === 'security-research') {
    activeSection = '/blog/security-research';
  } else if (currentPath.includes('/blog/ultimate-cybersecurity-path') || bodyPage === 'cybersecurity_path' || bodyPage === 'ultimate-cybersecurity-path') {
    activeSection = '/blog/ultimate-cybersecurity-path';
  } else if (bodyPage === 'post') {
    const slug = params.get('post') || params.get('file');
    if (slug && blogState.posts.length) {
      const post = blogState.posts.find(p => p.slug === slug || (p.file && p.file.includes(slug)));
      if (post && post.category) {
        if (post.category === 'writeups') activeSection = '/blog/writeups';
        else if (post.category === 'exam-reviews' || post.category === 'exam_reviews') activeSection = '/blog/exam-reviews';
        else if (post.category === 'security-research' || post.category === 'security_research') activeSection = '/blog/security-research';
      }
    }
  }

  document.querySelectorAll('.navbar .nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = normalizePath(new URL(href, window.location.origin).pathname);

    let isActive = false;
    if (activeSection) {
      isActive = (normalizePath(activeSection) === linkPath);
    } else {
      isActive = (linkPath === currentPath) || (linkPath !== '/blog' && linkPath !== '/blog/' && linkPath.length > 1 && currentPath.startsWith(linkPath));
    }

    if (isActive) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function initNavigation() {
  setActiveNavLink();

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const navbar = document.getElementById('mainNavbar') || document.querySelector('.navbar');
  if (navbar) {
    const updateNavbarScroll = () => {
      if (window.scrollY > 15) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', updateNavbarScroll);
    updateNavbarScroll();
  }

  const navbarCollapse = document.querySelector('.navbar-collapse');
  const navbarToggler = document.querySelector('.navbar-toggler');

  if (navbarCollapse && navbarToggler) {
    const getCollapseInstance = () => {
      if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
        return bootstrap.Collapse.getOrCreateInstance(navbarCollapse, { toggle: false });
      }
      return null;
    };

    document.querySelectorAll('.navbar .nav-link, .navbar .btn').forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          const instance = getCollapseInstance();
          if (instance) {
            instance.hide();
          } else {
            navbarCollapse.classList.remove('show');
          }
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!navbarCollapse.classList.contains('show')) return;
      if (navbarCollapse.contains(e.target) || navbarToggler.contains(e.target)) return;
      const instance = getCollapseInstance();
      if (instance) {
        instance.hide();
      } else {
        navbarCollapse.classList.remove('show');
      }
    });
  }
}

function initScrollProgress() {
  const progressBar = document.querySelector('.scroll-progress');
  if (!progressBar) return;

  const update = () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    progressBar.style.width = `${scrolled}%`;
  };

  window.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
}

function initBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top');
  if (!backToTopBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add('show');
    } else {
      backToTopBtn.classList.remove('show');
    }
  });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initCustomCursor() {
  const cursorDot = document.querySelector('[data-cursor-dot]');
  const cursorOutline = document.querySelector('[data-cursor-outline]');

  if (!cursorDot || !cursorOutline) return;

  window.addEventListener('mousemove', function (e) {
    const posX = e.clientX;
    const posY = e.clientY;

    cursorDot.style.left = `${posX}px`;
    cursorDot.style.top = `${posY}px`;

    cursorOutline.animate({
      left: `${posX}px`,
      top: `${posY}px`
    }, { duration: 500, fill: 'forwards' });
  });

  window.addEventListener('mouseleave', () => {
    document.body.classList.remove('hovering');
  });

  const interactiveElements = document.querySelectorAll('a, button, .btn, input, select, textarea');

  interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('hovering');
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('hovering');
    });
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (!mutation.addedNodes.length) return;

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;

        const elements = node.querySelectorAll ? node.querySelectorAll('a, button, .btn, input, select, textarea') : [];
        elements.forEach(el => {
          el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
          el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
        });

        if (node.matches && node.matches('a, button, .btn, input, select, textarea')) {
          node.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
          node.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function initHeroParticles() {
  const canvas = document.getElementById('global-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width;
  let height;
  let particles = [];
  let colors = ['#1d4ed8', '#0ea5e9'];
  let mouseX = -1000;
  let mouseY = -1000;

  const connectionDistance = 150;
  const moveSpeed = 0.4;
  const mouseRepulsionDist = 120;
  const mouseRepulsionForce = 0.35;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  function updateColors() {
    const style = getComputedStyle(document.body);
    const primary = style.getPropertyValue('--primary-color').trim();
    const secondary = style.getPropertyValue('--secondary-color').trim();
    if (primary && secondary) {
      colors = [primary, secondary];
    }
  }

  updateColors();
  const themeObserver = new MutationObserver(updateColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * moveSpeed;
      this.vy = (Math.random() - 0.5) * moveSpeed;
      this.size = Math.random() * 2 + 1;
      this.type = Math.random() > 0.5 ? 0 : 1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      const dx = this.x - mouseX;
      const dy = this.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseRepulsionDist && dist > 0) {
        const force = (mouseRepulsionDist - dist) / mouseRepulsionDist * mouseRepulsionForce;
        this.x += (dx / dist) * force;
        this.y += (dy / dist) * force;
      }

      if (this.x < 0) this.x = width;
      else if (this.x > width) this.x = 0;

      if (this.y < 0) this.y = height;
      else if (this.y > height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = colors[this.type];
      ctx.fill();
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    particles = [];
    const count = window.innerWidth < 768 ? 35 : 70;
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  resize();
  window.addEventListener('resize', resize);

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      particle.update();
      particle.draw();
    }

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDistance) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = colors[a.type];
          ctx.globalAlpha = (1 - dist / connectionDistance) * 0.25;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  animate();
}

function initWriteupTagFilter() {
  const select = document.getElementById('tag-filter-select');
  const cards = Array.from(document.querySelectorAll('[data-tags]'));
  if (!select || !cards.length) return;

  const tagSet = new Set();
  cards.forEach(card => {
    const tags = (card.dataset.tags || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    tags.forEach(tag => tagSet.add(tag));
  });

  const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  select.innerHTML = [
    '<option value="all">All tags</option>',
    ...sortedTags.map(tag => `<option value="${tag}">#${tag}</option>`)
  ].join('');

  select.addEventListener('change', () => {
    const activeTag = select.value;
    let visibleCount = 0;

    cards.forEach(card => {
      const tags = (card.dataset.tags || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
      const shouldShow = activeTag === 'all' || tags.includes(activeTag);
      card.classList.toggle('d-none', !shouldShow);
      if (shouldShow) visibleCount += 1;
    });

    const countLabel = document.getElementById('tag-filter-count');
    if (countLabel) {
      countLabel.textContent = `${visibleCount} post${visibleCount === 1 ? '' : 's'} visible`;
    }
  });

  const countLabel = document.getElementById('tag-filter-count');
  if (countLabel) {
    countLabel.textContent = `${cards.length} posts visible`;
  }
}

let currentTiltedCard = null;

function resetTiltCard(cardToReset) {
  if (!cardToReset) return;
  cardToReset.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease';
  cardToReset.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  setTimeout(() => {
    if (cardToReset !== currentTiltedCard) {
      cardToReset.style.transform = '';
      cardToReset.style.transition = '';
    }
  }, 500);
}

function initTiltEffect() {
  document.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 1024) return;

    const card = e.target.closest('.card:not(.blog-content-card):not(.blog-toc-card), .blog-featured-card, .blog-category-card, .blog-archive-card, .blog-post-card, .blog-group-card, .blog-panel, .path-hero-banner');

    if (currentTiltedCard && currentTiltedCard !== card) {
      resetTiltCard(currentTiltedCard);
      currentTiltedCard = null;
    }

    if (!card) return;

    currentTiltedCard = card;
    card.style.transition = 'transform 0.1s ease-out, border-color 0.3s ease, box-shadow 0.3s ease';

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  document.addEventListener('mouseleave', () => {
    if (currentTiltedCard) {
      resetTiltCard(currentTiltedCard);
      currentTiltedCard = null;
    }
  });
}

function initAnimations() {
  const animateElements = document.querySelectorAll('.animate-on-scroll:not(.blog-content-card *)');
  if (!animateElements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const element = entry.target;
      const isMobile = window.innerWidth <= 768;
      const mobileAnimation = element.dataset.animationMobile;
      const animation = (isMobile && mobileAnimation) ? mobileAnimation : (element.dataset.animation || 'animate-fade-in-up');
      const delay = parseInt(element.dataset.delay || '0', 10);

      setTimeout(() => {
        element.classList.add(animation);
        setTimeout(() => element.classList.add('animations-finished'), 600);
      }, delay);

      observer.unobserve(element);
    });
  }, { threshold: 0.1, rootMargin: '50px' });

  animateElements.forEach(element => observer.observe(element));
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${dateValue}T00:00:00`));
}

function routeForCategory(category) {
  return `/blog/${category}/`;
}

function formatCategoryLabel(category) {
  return category
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function postsForCategory(category) {
  return blogState.posts
    .filter(post => post.category === category)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTagChips(tags) {
  return tags.map(tag => `<span class="blog-tag-chip">#${escapeHtml(tag)}</span>`).join('');
}

function getOsIconClass(os) {
  if (!os) return 'fas fa-desktop';
  const lower = os.toLowerCase();
  if (lower.includes('window')) return 'fab fa-windows';
  if (lower.includes('linux')) return 'fab fa-linux';
  if (lower.includes('mac') || lower.includes('apple')) return 'fab fa-apple';
  if (lower.includes('android')) return 'fab fa-android';
  return 'fas fa-desktop';
}

function getDifficultyClass(diff) {
  if (!diff) return '';
  const lower = diff.toLowerCase().replace(/\s+/g, '-');
  if (lower.includes('very-easy')) return 'blog-diff-very-easy';
  if (lower.includes('easy')) return 'blog-diff-easy';
  if (lower.includes('medium')) return 'blog-diff-medium';
  if (lower.includes('hard')) return 'blog-diff-hard';
  if (lower.includes('insane')) return 'blog-diff-insane';
  return '';
}

function renderMetaChips(post, options = {}) {
  const osIcon = getOsIconClass(post.os);
  const diffClass = getDifficultyClass(post.difficulty);

  const chips = [
    `<span class="blog-date-chip"><i class="far fa-calendar me-1"></i>${formatDate(post.date)}</span>`,
    post.platform ? `<span class="blog-meta-chip"><i class="fas fa-layer-group me-1"></i>${escapeHtml(post.platform)}</span>` : '',
    post.type ? `<span class="blog-meta-chip"><i class="fas fa-folder-tree me-1"></i>${escapeHtml(post.type)}</span>` : '',
    post.os ? `<span class="blog-meta-chip"><i class="${osIcon} me-1"></i>${escapeHtml(post.os)}</span>` : '',
    post.difficulty ? `<span class="blog-meta-chip ${diffClass}"><i class="fas fa-tachometer-alt me-1"></i>${escapeHtml(post.difficulty)}</span>` : '',
    (post.link && !options.hideLink) ? `<a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer" class="blog-meta-chip blog-link-chip"><i class="fas fa-external-link-alt me-1"></i>Lab Link</a>` : ''
  ];

  return chips.filter(Boolean).join('');
}

function getUploadTypeLabel(category) {
  if (category === 'writeups') return 'Writeup';
  if (category === 'exam-reviews' || category === 'exam_reviews') return 'Exam Review';
  if (category === 'security-research' || category === 'security_research') return 'Security Research';
  return 'Upload';
}

function renderEmptyState(type, detail) {
  let icon = 'fas fa-folder-open';
  let title = 'No content published yet';
  let sectionLabel = 'Archive';
  let description = 'New articles and technical walkthroughs will appear here automatically when published.';
  let isFiltered = false;
  let altLabel = 'Reset Tag Filter';
  let altIcon = 'fas fa-undo';

  if (type === 'security-research' || type === 'security_research') {
    icon = 'fas fa-microscope';
    sectionLabel = 'Security Research';
    title = 'No Security Research Published Yet';
    description = 'Original vulnerability research, novel exploitation analyses, and threat detection whitepapers will appear here soon.';
  } else if (type === 'security-research-filtered') {
    icon = 'fas fa-tags';
    sectionLabel = 'Security Research Filter';
    title = detail ? `No Security Research Matches "#${escapeHtml(detail)}"` : 'No Matching Research Found';
    description = 'Try selecting a different topic tag or searching for another keyword to view published research notes.';
    isFiltered = true;
  } else if (type === 'exam-reviews' || type === 'exam_reviews') {
    icon = 'fas fa-certificate';
    sectionLabel = 'Exam Reviews';
    title = 'No Exam Reviews Published Yet';
    description = 'Certification assessments, lab prep strategies, and exam timeline breakdowns will be published here.';
  } else if (type === 'exam-reviews-filtered') {
    icon = 'fas fa-tags';
    sectionLabel = 'Exam Reviews Filter';
    title = detail ? `No Exam Reviews Match "#${escapeHtml(detail)}"` : 'No Matching Exam Reviews Found';
    description = 'Try selecting a different topic tag or searching for another keyword to view published certification notes.';
    isFiltered = true;
  } else if (type === 'writeups') {
    icon = 'fas fa-layer-group';
    sectionLabel = 'Writeups';
    title = 'No Writeups Published Yet';
    description = 'Platform-specific technical walkthroughs detailing reconnaissance, enumeration, and exploitation strategies will appear here.';
  } else if (type === 'writeups-filtered') {
    icon = 'fas fa-tags';
    sectionLabel = 'Topic Filter';
    title = detail ? `No Writeups Match "#${escapeHtml(detail)}"` : 'No Matching Writeups Found';
    description = 'Try selecting a different topic tag or searching for another keyword to view published walkthroughs.';
    isFiltered = true;
  } else if (type === 'recent' || type === 'all') {
    icon = 'fas fa-pen-nib';
    sectionLabel = 'Recent Posts';
    title = 'No Posts Published Yet';
    description = 'No articles or walkthroughs have been published to the blog catalog yet. Check back soon for initial uploads.';
  }

  return `
    <div class="col-12">
      <div class="blog-empty-state p-4 p-md-5 rounded-4 text-center animate-on-scroll" data-animation="animate-fade-in-up">
        <div class="blog-empty-icon-wrapper mb-4 mx-auto d-flex align-items-center justify-content-center">
          <i class="${icon} text-primary"></i>
        </div>
        <span class="blog-kicker mb-3 text-uppercase tracking-wider fw-bold d-inline-flex align-items-center gap-2">
          <i class="fas fa-info-circle"></i> ${escapeHtml(sectionLabel)}
        </span>
        <h3 class="display-6 fw-bold mb-3">${escapeHtml(title)}</h3>
        <p class="lead text-muted mb-4 mx-auto" style="max-width: 620px;">${escapeHtml(description)}</p>
        <div class="d-flex flex-wrap align-items-center justify-content-center gap-3">
          <a href="/blog/" class="btn btn-primary"><i class="fas fa-book-open me-2"></i>Return to Blog Home</a>
          ${isFiltered ? `
            <button type="button" class="btn btn-outline-primary" id="empty-state-reset-btn">
              <i class="${altIcon} me-2"></i>${altLabel}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderHeroTopSidebar(pageName) {
  const container = document.getElementById('section-top-sidebar') || document.getElementById('featured-post');
  if (!container) return;

  const sortedPosts = [...blogState.posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  let targetPosts = sortedPosts;
  let typeLabel = 'Upload';
  let icon = 'fas fa-bolt';
  let readBtnText = 'Read latest';

  if (pageName === 'writeups') {
    targetPosts = sortedPosts.filter(p => p.category === 'writeups');
    typeLabel = 'Writeup';
    icon = 'fas fa-layer-group';
    readBtnText = 'Read latest writeup';
  } else if (pageName === 'exam-reviews' || pageName === 'exam_reviews') {
    targetPosts = sortedPosts.filter(p => p.category === 'exam-reviews');
    typeLabel = 'Exam Review';
    icon = 'fas fa-certificate';
    readBtnText = 'Read latest review';
  } else if (pageName === 'security-research' || pageName === 'security_research') {
    targetPosts = sortedPosts.filter(p => p.category === 'security-research');
    typeLabel = 'Security Research';
    icon = 'fas fa-microscope';
    readBtnText = 'Read latest research';
  } else {
    typeLabel = 'Publication';
    icon = 'fas fa-bolt';
    readBtnText = 'Read latest publication';
  }

  const latest = targetPosts[0];

  if (!latest) {
    container.innerHTML = `
      <div class="card blog-hero-sidebar-card w-100 p-4 text-center">
        <div class="blog-empty-icon-wrapper mb-3 mx-auto d-flex align-items-center justify-content-center" style="width: 56px; height: 56px;">
          <i class="${icon} text-primary fs-4"></i>
        </div>
        <div class="blog-kicker mb-2 text-uppercase tracking-wider fw-bold">
          <i class="${icon} me-1 text-primary"></i> Latest ${escapeHtml(typeLabel)}
        </div>
        <h3 class="card-title h6 fw-bold mb-2">No ${escapeHtml(typeLabel)} Published Yet</h3>
        <p class="card-text text-muted small mb-0">Check back soon for new articles and technical breakdowns in this domain.</p>
      </div>
    `;
    return;
  }

  const latestUrl = latest.url || `/blog/${latest.category}/${latest.slug}/`;

  container.innerHTML = `
    <article class="card blog-hero-sidebar-card w-100">
      <div class="card-body d-flex flex-column p-4">
        <div class="blog-sidebar-top-bar d-flex align-items-center mb-3 pb-3 border-bottom">
          <span class="blog-kicker mb-0 text-uppercase tracking-wider fw-bold">
            <i class="${icon} me-1 text-primary"></i> Latest ${escapeHtml(typeLabel)}
          </span>
        </div>

        <div class="blog-meta-row mb-2">
          ${renderMetaChips(latest, { hideLink: true })}
        </div>

        <h3 class="card-title h5 fw-bold mt-3 mb-3">
          <a href="${latestUrl}" class="text-decoration-none text-reset hover-primary">${escapeHtml(latest.title)}</a>
        </h3>

        <p class="card-text text-muted small mb-3">
          ${escapeHtml(latest.excerpt)}
        </p>

        ${latest.tags && latest.tags.length ? `
          <div class="blog-tag-row mb-3">
            ${renderTagChips((latest.tags || []).slice(0, 4))}
          </div>
        ` : ''}

        <div class="mt-auto pt-3 border-top d-flex align-items-center justify-content-start">
          <a href="${latestUrl}" class="card-btn primary py-2 px-3 fs-6 d-inline-flex align-items-center gap-2">
            <span>${readBtnText}</span>
            <i class="fas fa-arrow-right fs-7"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderLandingPage() {
  const categoryGrid = document.getElementById('category-cards');
  const recentGrid = document.getElementById('recent-posts');

  renderHeroTopSidebar('landing');

  if (!categoryGrid || !recentGrid) return;

  categoryGrid.classList.add('justify-content-center');
  recentGrid.classList.add('justify-content-center');

  const sortedPosts = [...blogState.posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  const categories = [
    {
      key: 'writeups',
      title: 'Writeups',
      description: 'Platform-specific walkthroughs grouped by platform, type, and topic.',
      icon: 'fas fa-layer-group'
    },
    {
      key: 'exam-reviews',
      title: 'Exam Reviews',
      description: 'Certification and assessment notes with practical takeaways.',
      icon: 'fas fa-certificate'
    },
    {
      key: 'security-research',
      title: 'Security Research',
      description: 'Deep dives, analysis, and research notes on security topics.',
      icon: 'fas fa-microscope'
    },
    {
      key: 'ultimate-cybersecurity-path',
      title: 'Cybersecurity Path',
      description: 'A comprehensive, step-by-step practical roadmap from beginner to expert in cybersecurity.',
      icon: 'fas fa-route',
      metaLabel: 'Practical Roadmap'
    }
  ];

  categoryGrid.innerHTML = categories.map((category, index) => {
    const isPath = category.key === 'ultimate-cybersecurity-path';
    const count = category.metaLabel || `${blogState.posts.filter(post => post.category === category.key).length} publications`;
    const icon = category.icon || 'fas fa-bookmark';
    const url = isPath ? '/blog/ultimate-cybersecurity-path/' : routeForCategory(category.key);
    return `
      <div class="col-xl-3 col-lg-6 col-md-6">
        <article class="blog-category-card card h-100 animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
          <div class="card-body">
            <div class="blog-meta-row mb-2">
              <span class="blog-meta-chip"><i class="${icon} me-1"></i>${count}</span>
            </div>
            <h3 class="card-title">${category.title}</h3>
            <p class="card-text">${category.description}</p>
            <a href="${url}" class="card-btn primary mt-auto">Open section</a>
          </div>
        </article>
      </div>
    `;
  }).join('');

  if (!sortedPosts.length) {
    recentGrid.innerHTML = renderEmptyState('recent');
  } else {
    recentGrid.innerHTML = sortedPosts.slice(0, 3).map((post, index) => {
      const postUrl = post.url || `/blog/${post.category}/${post.slug}/`;
      return `
        <div class="col-lg-4 col-md-6">
          <article class="blog-archive-card card h-100 animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
            <div class="card-body">
              <div class="blog-meta-row">${renderMetaChips(post)}</div>
              <h3 class="card-title">${escapeHtml(post.title)}</h3>
              <p class="card-text">${escapeHtml(post.excerpt)}</p>
              <div class="blog-tag-row">${renderTagChips((post.tags || []).slice(0, 4))}</div>
              <a href="${postUrl}" class="card-btn secondary mt-auto">Read publication</a>
            </div>
          </article>
        </div>
      `;
    }).join('');
  }

  initAnimations();
}

function getWriteupPlatform(post) {
  const title = post.title || '';
  const parts = title.split(':');
  return parts.length > 1 ? parts[0].trim() : '';
}

function getWriteupDisplayTitle(post) {
  const title = post.title || '';
  const platform = post.platform || getWriteupPlatform(post);
  if (platform && !title.toLowerCase().startsWith(platform.toLowerCase() + ':')) {
    return `${platform}: ${title}`;
  }
  return title;
}

function renderArchivePage(category) {
  const filterBarContainer = document.getElementById('tag-filters-container') || document.getElementById('tag-filters');
  const archiveContainer = document.getElementById('archive-content');
  if (!archiveContainer) return;

  renderHeroTopSidebar(category);

  archiveContainer.classList.add('justify-content-center');
  const posts = postsForCategory(category);

  if (!posts.length) {
    if (filterBarContainer) filterBarContainer.innerHTML = '';
    archiveContainer.innerHTML = renderEmptyState(category);
    initAnimations();
    return;
  }

  const tagCounts = new Map();
  posts.forEach(post => {
    (post.tags || []).forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  if (filterBarContainer) {
    filterBarContainer.innerHTML = `
      <div class="blog-tag-filter-wrapper p-3 rounded-3 mb-4 animate-on-scroll" data-animation="animate-fade-in-up">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex align-items-center gap-2">
            <i class="fas fa-tags text-primary"></i>
            <span class="fw-bold">Filter by topic</span>
            <span class="badge bg-secondary rounded-pill ms-1">${tags.length} topics</span>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="blog-tag-select-wrapper">
              <select id="archive-tag-select-filter" class="form-select blog-tag-select" aria-label="Filter by topic">
                <option value="all" ${blogState.activeTag === 'all' ? 'selected' : ''}>All topics (${posts.length})</option>
                ${tags.map(({ tag, count }) => `
                  <option value="${escapeHtml(tag)}" ${blogState.activeTag === tag ? 'selected' : ''}>
                    #${escapeHtml(tag)} (${count})
                  </option>
                `).join('')}
              </select>
              <i class="fas fa-chevron-down blog-tag-select-arrow"></i>
            </div>
            <button id="archive-tag-reset-btn" class="btn blog-tag-reset-btn ${blogState.activeTag === 'all' ? 'd-none' : 'd-inline-flex'}" type="button" aria-label="Reset filter">
              <i class="fas fa-rotate-left me-1"></i> Reset
            </button>
          </div>
        </div>
      </div>
    `;

    const tagSelect = document.getElementById('archive-tag-select-filter');
    const resetBtn = document.getElementById('archive-tag-reset-btn');

    if (tagSelect) {
      tagSelect.addEventListener('change', (e) => {
        blogState.activeTag = e.target.value;
        if (resetBtn) {
          if (blogState.activeTag === 'all') {
            resetBtn.classList.add('d-none');
            resetBtn.classList.remove('d-inline-flex');
          } else {
            resetBtn.classList.remove('d-none');
            resetBtn.classList.add('d-inline-flex');
          }
        }
        renderCategoryGroups(blogState.activeTag);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        blogState.activeTag = 'all';
        if (tagSelect) tagSelect.value = 'all';
        resetBtn.classList.add('d-none');
        resetBtn.classList.remove('d-inline-flex');
        renderCategoryGroups('all');
      });
    }
  }

  function renderCategoryGroups(activeTag) {
    const filtered = activeTag === 'all'
      ? posts
      : posts.filter(post => (post.tags || []).includes(activeTag));

    if (!filtered.length) {
      archiveContainer.innerHTML = renderEmptyState(`${category}-filtered`, activeTag);
      const resetBtn = document.getElementById('empty-state-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          blogState.activeTag = 'all';
          const select = document.getElementById('archive-tag-select-filter');
          if (select) select.value = 'all';
          renderCategoryGroups('all');
        });
      }
      initAnimations();
      return;
    }

    const readText = category === 'exam-reviews' ? 'Read review' : (category === 'security-research' ? 'Read research' : 'Read post');

    archiveContainer.innerHTML = filtered.map((post, index) => {
      const postUrl = post.url || `/blog/${post.category}/${post.slug}/`;
      return `
        <div class="col-12 col-md-6">
          <article class="blog-post-card card animate-on-scroll h-100" data-animation="animate-fade-in-up" data-delay="${index * 65}">
            <div class="card-body d-flex flex-column">
              <div class="blog-meta-row">${renderMetaChips(post)}</div>
              <h3 class="card-title mt-2 mb-2">${escapeHtml(post.title)}</h3>
              <p class="card-text text-muted mb-2">${escapeHtml(post.excerpt)}</p>
              <div class="blog-tag-row mb-3">${renderTagChips(post.tags || [])}</div>
              <a href="${postUrl}" class="card-btn secondary mt-auto">${readText}</a>
            </div>
          </article>
        </div>
      `;
    }).join('');

    initAnimations();
  }

  renderCategoryGroups(blogState.activeTag || 'all');
}

function renderWriteupsPage() {
  const filterBarContainer = document.getElementById('tag-filters-container') || document.getElementById('tag-filters');
  const content = document.getElementById('writeups-content');
  if (!content) return;

  renderHeroTopSidebar('writeups');

  const writeups = postsForCategory('writeups');
  const tagCounts = new Map();
  writeups.forEach(post => {
    (post.tags || []).forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  if (filterBarContainer) {
    filterBarContainer.innerHTML = `
      <div class="blog-tag-filter-wrapper p-3 rounded-3 mb-4 animate-on-scroll" data-animation="animate-fade-in-up">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="d-flex align-items-center gap-2">
            <i class="fas fa-tags text-primary"></i>
            <span class="fw-bold">Filter by topic</span>
            <span class="badge bg-secondary rounded-pill ms-1">${tags.length} topics</span>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="blog-tag-select-wrapper">
              <select id="tag-select-filter" class="form-select blog-tag-select" aria-label="Filter by topic">
                <option value="all" ${blogState.activeTag === 'all' ? 'selected' : ''}>All topics (${writeups.length})</option>
                ${tags.map(({ tag, count }) => `
                  <option value="${escapeHtml(tag)}" ${blogState.activeTag === tag ? 'selected' : ''}>
                    #${escapeHtml(tag)} (${count})
                  </option>
                `).join('')}
              </select>
              <i class="fas fa-chevron-down blog-tag-select-arrow"></i>
            </div>
            <button id="tag-reset-btn" class="btn blog-tag-reset-btn ${blogState.activeTag === 'all' ? 'd-none' : 'd-inline-flex'}" type="button" aria-label="Reset filter">
              <i class="fas fa-rotate-left me-1"></i> Reset
            </button>
          </div>
        </div>
      </div>
    `;

    const tagSelect = document.getElementById('tag-select-filter');
    const resetBtn = document.getElementById('tag-reset-btn');

    if (tagSelect) {
      tagSelect.addEventListener('change', (e) => {
        blogState.activeTag = e.target.value;
        if (resetBtn) {
          if (blogState.activeTag === 'all') {
            resetBtn.classList.add('d-none');
            resetBtn.classList.remove('d-inline-flex');
          } else {
            resetBtn.classList.remove('d-none');
            resetBtn.classList.add('d-inline-flex');
          }
        }
        renderGroups(blogState.activeTag);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        blogState.activeTag = 'all';
        if (tagSelect) tagSelect.value = 'all';
        resetBtn.classList.add('d-none');
        resetBtn.classList.remove('d-inline-flex');
        renderGroups('all');
      });
    }
  }

  function renderGroups(activeTag) {
    const filtered = activeTag === 'all'
      ? writeups
      : writeups.filter(post => (post.tags || []).includes(activeTag));

    if (!filtered.length) {
      content.innerHTML = renderEmptyState(activeTag === 'all' ? 'writeups' : 'writeups-filtered', activeTag);
      const resetBtn = document.getElementById('empty-state-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          blogState.activeTag = 'all';
          const select = document.getElementById('tag-select-filter');
          if (select) select.value = 'all';
          renderGroups('all');
        });
      }
      initAnimations();
      return;
    }

    content.innerHTML = `
      <div class="row justify-content-center g-4">
        ${filtered.map((post, index) => {
      const platform = getWriteupPlatform(post);
      const displayTitle = getWriteupDisplayTitle(post);
      const postUrl = post.url || `/blog/${post.category}/${post.slug}/`;

      return `
            <div class="col-12 col-md-6">
              <article class="blog-post-card card animate-on-scroll h-100" data-animation="animate-fade-in-up" data-delay="${index * 65}">
                <div class="card-body d-flex flex-column">
                  <div class="blog-meta-row">
                    ${renderMetaChips(post, { hideLink: true })}
                  </div>
                  <h3 class="card-title mt-2 mb-2">${escapeHtml(displayTitle)}</h3>
                  <p class="card-text text-muted mb-2">${escapeHtml(post.excerpt)}</p>
                  <div class="blog-tag-row mb-3">${renderTagChips(post.tags || [])}</div>
                  <a href="${postUrl}" class="card-btn secondary mt-auto">Read writeup</a>
                </div>
              </article>
            </div>
          `;
    }).join('')}
      </div>
    `;

    initAnimations();
  }

  renderGroups(blogState.activeTag || 'all');
}

function parseMarkdownToHtml(md) {
  if (!md) return '';

  let html = md.replace(/```([\w-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const languageBadge = lang ? lang.toUpperCase() : 'TERMINAL';
    const escapedCode = escapeHtml(code.trimEnd());
    return `
      <div class="blog-terminal-window my-4">
        <div class="blog-terminal-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <span class="blog-traffic-light red"></span>
            <span class="blog-traffic-light yellow"></span>
            <span class="blog-traffic-light green"></span>
            <span class="blog-lang-badge ms-2">${languageBadge}</span>
          </div>
          <button class="blog-copy-btn btn btn-sm btn-outline-secondary" data-code="${escapeHtml(code.trimEnd())}">
            <i class="far fa-copy me-1"></i>Copy
          </button>
        </div>
        <pre class="blog-terminal-body mb-0"><code>${escapedCode}</code></pre>
      </div>
    `;
  });

  html = html.replace(/<(?!\/?(h[1-6]|p|div|span|button|pre|code|blockquote|ul|ol|li|i|a|figcaption|strong|em|table|thead|tbody|tr|th|td)\b)[^>]*>/g, (m) => escapeHtml(m));

  html = html.replace(/^### (.*$)/gim, '<h3 class="fw-bold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="fw-bold mt-5 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="fw-bold mt-5 mb-3">$1</h1>');

  html = html.replace(/^> (.*$)/gim, '<blockquote class="blog-quote my-3">$1</blockquote>');

  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  html = html.replace(/`([^`]+)`/g, '<code class="blog-inline-code">$1</code>');

  html = html.replace(/^- (.*$)/gim, '<li class="mb-1">$1</li>');
  html = html.replace(/(<li.*<\/li>\s*)+/g, '<ul class="my-3">$&</ul>');

  const lines = html.split(/\r?\n/);
  const processed = [];
  let inPre = false;
  let inUl = false;

  for (let line of lines) {
    if (line.includes('<div class="blog-terminal-window')) inPre = true;
    if (line.includes('</div>') && inPre && !line.includes('<div')) inPre = false;
    if (line.includes('<ul')) inUl = true;
    if (line.includes('</ul>')) inUl = false;

    if (!inPre && !inUl && line.trim() !== '' && !line.trim().startsWith('<') && !line.trim().endsWith('>')) {
      processed.push(`<p class="mb-3">${line.trim()}</p>`);
    } else {
      processed.push(line);
    }
  }

  return processed.join('\n');
}

function initCodeCopyButtons() {
  document.querySelectorAll('.blog-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code') || '';
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
        setTimeout(() => {
          btn.innerHTML = '<i class="far fa-copy me-1"></i>Copy';
        }, 2000);
      });
    });
  });
}

function initCodeExpandableBlocks() {
  const blocks = document.querySelectorAll('.blog-content-card div.highlighter-rouge, .blog-shell div.highlighter-rouge, .blog-terminal-window, div.highlighter-rouge');

  blocks.forEach(block => {
    if (block.dataset.expandableInitialized) return;

    const pre = block.querySelector('pre');
    if (!pre) return;

    const code = pre.querySelector('code');
    const text = (code || pre).textContent || '';
    const lines = text.split(/\r?\n/);
    const lineCount = lines.length;

    if (lineCount <= 18 && pre.scrollHeight <= 420) return;

    block.dataset.expandableInitialized = 'true';
    block.classList.add('code-block-wrapper', 'is-collapsed');

    const overlay = document.createElement('div');
    overlay.className = 'code-expand-overlay';
    block.appendChild(overlay);

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'code-expand-btn-wrapper';

    const btn = document.createElement('button');
    btn.className = 'code-expand-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Expand code block');
    btn.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Expand Code';

    btnWrapper.appendChild(btn);
    block.appendChild(btnWrapper);

    pre.style.maxHeight = '420px';

    btn.addEventListener('click', () => {
      const isCollapsed = block.classList.contains('is-collapsed');

      if (isCollapsed) {
        block.classList.remove('is-collapsed');
        block.classList.add('is-expanded');
        pre.style.maxHeight = (pre.scrollHeight + 50) + 'px';
        btn.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Collapse Code';
        btn.setAttribute('aria-label', 'Collapse code block');
      } else {
        block.classList.remove('is-expanded');
        block.classList.add('is-collapsed');
        pre.style.maxHeight = '420px';
        btn.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Expand Code';
        btn.setAttribute('aria-label', 'Expand code block');

        const rect = block.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight - 150) {
          block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });
  });
}

function slugifyText(text) {
  return (text || '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

function initTableOfContents() {
  const tocNav = document.getElementById('blog-toc-nav');
  const tocSidebar = document.querySelector('.blog-toc-sidebar');
  const articleContent = document.querySelector('.blog-content-card .card-body, .blog-article-body');

  if (!tocNav || !articleContent) return;

  const headings = Array.from(articleContent.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(h => {
    return !h.classList.contains('display-4') && !h.classList.contains('display-5') && !h.closest('.blog-hero');
  });

  if (!headings.length) {
    if (tocSidebar) tocSidebar.style.display = 'none';
    return;
  }

  if (tocSidebar) tocSidebar.style.display = 'block';

  const minLevel = headings.reduce((min, h) => {
    const lvl = parseInt(h.tagName.replace(/h/i, ''), 10) || 1;
    return lvl < min ? lvl : min;
  }, 6);

  let navHtml = '';
  headings.forEach((heading, idx) => {
    if (!heading.id) {
      heading.id = slugifyText(heading.textContent) || `section-${idx}`;
    }

    const lvl = parseInt(heading.tagName.replace(/h/i, ''), 10) || 1;
    const relLevel = Math.min(6, Math.max(1, lvl - minLevel + 1));
    const levelClass = `toc-level-${relLevel}`;
    const cleanText = heading.textContent.replace(/#+$/, '').trim();

    navHtml += `<a href="#${heading.id}" class="blog-toc-link ${levelClass}" data-target="${heading.id}">${escapeHtml(cleanText)}</a>`;
  });

  tocNav.innerHTML = navHtml;

  const tocLinks = tocNav.querySelectorAll('.blog-toc-link');
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const topOffset = targetEl.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: topOffset, behavior: 'smooth' });
        if (history.pushState) {
          history.pushState(null, null, `#${targetId}`);
        }
      }
    });
  });

  function updateActiveToC() {
    const isAtBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 60);
    let activeHeading = null;

    if (isAtBottom && headings.length) {
      activeHeading = headings[headings.length - 1];
    } else {
      const targetThreshold = window.innerHeight * 0.45;
      for (let i = headings.length - 1; i >= 0; i--) {
        const top = headings[i].getBoundingClientRect().top;
        if (top <= targetThreshold) {
          activeHeading = headings[i];
          break;
        }
      }
    }

    tocLinks.forEach(link => {
      if (activeHeading && link.getAttribute('data-target') === activeHeading.id) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveToC, { passive: true });
  updateActiveToC();
}

async function renderPostPage() {
  const container = document.getElementById('post-container');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('post') || params.get('file');

  if (!slug) {
    container.innerHTML = `
      <div class="container mobile-container py-5">
        <div class="blog-empty-state">
          <h3 class="mb-2">Article Not Specified</h3>
          <p class="mb-0 blog-note">No post slug provided in the URL parameter.</p>
          <a href="/blog/" class="btn btn-primary mt-3">Return to Blog</a>
        </div>
      </div>
    `;
    return;
  }

  const post = blogState.posts.find(p => p.slug === slug || (p.file && p.file.includes(slug)));

  let filePath = post && post.file ? post.file : `_writeups/${slug}.md`;
  let markdown = '';

  const possiblePaths = [
    filePath,
    filePath.startsWith('/') ? filePath.slice(1) : '/' + filePath,
    `/_writeups/${slug}.md`,
    `_writeups/${slug}.md`,
    `../_writeups/${slug}.md`,
    `/_exam_reviews/${slug}.md`,
    `_exam_reviews/${slug}.md`,
    `../_exam_reviews/${slug}.md`,
    `/_security_research/${slug}.md`,
    `_security_research/${slug}.md`,
    `../_security_research/${slug}.md`
  ];

  for (const path of uniqueSorted(possiblePaths)) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        markdown = await res.text();
        break;
      }
    } catch (e) { }
  }

  if (!markdown) {
    container.innerHTML = `
      <div class="container mobile-container py-5">
        <div class="blog-empty-state">
          <h3 class="mb-2">Article Content Unavailable</h3>
          <p class="mb-0 blog-note">Could not locate markdown file for <code>${escapeHtml(slug)}</code>.</p>
          <a href="/blog/" class="btn btn-primary mt-3">Return to Blog</a>
        </div>
      </div>
    `;
    return;
  }

  markdown = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const htmlContent = parseMarkdownToHtml(markdown);

  container.innerHTML = `
    <div class="container mobile-container py-5 text-start">
      <div class="row g-4 justify-content-center">
        <div class="col-12 col-lg-4 col-xl-3 order-1 order-lg-2">
          <aside class="blog-toc-sidebar">
            <div class="blog-toc-card card">
              <div class="blog-toc-header">
                <i class="fas fa-list-ul me-2"></i>Table of Contents
              </div>
              <nav id="blog-toc-nav" class="blog-toc-nav"></nav>
            </div>
          </aside>
        </div>
        <div class="col-12 col-lg-8 col-xl-9 order-2 order-lg-1">
          <article class="blog-content-card card">
            <div class="card-body">
              <div class="blog-meta-row mb-3">
                ${post ? renderMetaChips(post) : `<span class="blog-date-chip"><i class="far fa-calendar me-1"></i>Recent</span>`}
              </div>
              <h1 class="display-5 fw-bold mb-4">${post ? escapeHtml(post.title) : escapeHtml(slug)}</h1>
              ${post && post.tags ? `<div class="blog-tag-row mb-4">${renderTagChips(post.tags)}</div>` : ''}
              <div class="section-line mb-4"></div>
              <div class="blog-article-body">
                ${htmlContent}
              </div>
              <div class="d-flex justify-content-between align-items-center mt-5 pt-4 border-top">
                <a href="/blog/" class="card-btn secondary"><i class="fas fa-arrow-left me-2"></i>Back to Blog</a>
                <button class="btn btn-outline-primary btn-sm" onclick="window.scrollTo({top: 0, behavior: 'smooth'})"><i class="fas fa-arrow-up me-2"></i>Top</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  `;

  initAnimations();
  initCodeCopyButtons();
  initCodeExpandableBlocks();
  initTableOfContents();
}

async function loadBlogPosts() {
  if (blogState.posts.length) return blogState.posts;

  const embeddedScript = document.getElementById('jekyll-site-posts');
  if (embeddedScript && embeddedScript.textContent.trim()) {
    try {
      const posts = JSON.parse(embeddedScript.textContent);
      if (posts && Array.isArray(posts) && posts.length) {
        blogState.posts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        return blogState.posts;
      }
    } catch (e) { }
  }

  const urlsToTry = [
    '/assets/json/blog/posts.json',
    'assets/json/blog/posts.json',
    '../assets/json/blog/posts.json',
    '../../assets/json/blog/posts.json'
  ];

  for (const url of uniqueSorted(urlsToTry)) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const posts = await response.json();
        blogState.posts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        return blogState.posts;
      }
    } catch (e) { }
  }

  return [];
}

function renderCurrentBlogPage() {
  const page = document.body.dataset.page;
  if (page === 'landing' || page === 'home') {
    renderLandingPage();
  } else if (page === 'writeups') {
    renderWriteupsPage();
  } else if (page === 'post') {
    renderPostPage();
  } else if (page === 'exam-reviews' || page === 'exam_reviews') {
    renderArchivePage('exam-reviews');
  } else if (page === 'security-research' || page === 'security_research') {
    renderArchivePage('security-research');
  } else if (page) {
    renderArchivePage(page);
  }
}

async function initBlog() {
  try {
    await loadBlogPosts();
  } catch (error) {
    console.error('Failed to load blog posts data:', error);
  }
  renderCurrentBlogPage();
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initAnimations();
  initScrollProgress();
  initBackToTop();
  initCustomCursor();
  initHeroParticles();
  initWriteupTagFilter();
  initTiltEffect();
  initBlog();
  initCodeCopyButtons();
  initCodeExpandableBlocks();
  initTableOfContents();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});

window.addEventListener('load', () => {
  initCodeExpandableBlocks();
  initTableOfContents();
});