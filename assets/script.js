let statsAnimated = false;
const dataCache = {
    certifications: null,
    courses: null,
    projects: null,
    about: null
};
let coursesLoaded = 0;
const COURSES_PER_PAGE = 9;
let currentCourseFilter = 'all';

function initTheme() {
    const savedTheme = 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function getNavbarHeight() {
    const navbar = document.querySelector('.navbar');
    return (navbar ? navbar.offsetHeight : 0);
}

function initNavigation() {
    window.addEventListener('scroll', () => {
        const NAVBAR_HEIGHT = getNavbarHeight();
        const sections = document.querySelectorAll('section');
        const scrollPos = window.scrollY + NAVBAR_HEIGHT + 5;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                document.querySelectorAll('.navbar-nav-container .nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const NAVBAR_HEIGHT = getNavbarHeight();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - NAVBAR_HEIGHT;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    const navLinks = document.querySelectorAll('.nav-link');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navbarCollapse.classList.contains('show')) {
                new bootstrap.Collapse(navbarCollapse).hide();
            }
        });
    });

    document.addEventListener('click', (e) => {
        const navbarToggler = document.querySelector('.navbar-toggler');
        if (navbarCollapse.classList.contains('show') && 
            !navbarCollapse.contains(e.target) && 
            !navbarToggler.contains(e.target)) {
            new bootstrap.Collapse(navbarCollapse).hide();
        }
    });
}

window.addEventListener('load', () => {
    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            const NAVBAR_HEIGHT = getNavbarHeight();
            const offsetTop = target.offsetTop - NAVBAR_HEIGHT;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }
});

function initAnimations() {
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const isMobile = window.innerWidth <= 768;
                const mobileAnimation = element.dataset.animationMobile;
                const animation = (isMobile && mobileAnimation) ? 
                    mobileAnimation : 
                    (element.dataset.animation || 'animate-fade-in-up');
                const delay = parseInt(element.dataset.delay || '0');
                
                setTimeout(() => {
                    element.classList.add(animation);
                    
                    setTimeout(() => {
                        element.classList.add('animations-finished');
                    }, 600);
                }, delay);
                
                observer.unobserve(element);
            }
        });
    }, { threshold: 0.1, rootMargin: '50px' });

    animateElements.forEach(element => {
        observer.observe(element);
    });
}

function initTypingAnimation() {
    const roles = [
        'Cybersecurity Specialist',
        'Ethical Hacker',
        'Cyber Defense Analyst', 
        'Continuous Learner'
    ];

    const element = document.getElementById('typed-text');
    if (!element) return;
    
    let currentRoleIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    
    function type() {
        const currentRole = roles[currentRoleIndex];
        
        if (isDeleting) {
            element.innerHTML = currentRole.substring(0, currentCharIndex - 1) + '<span class="blinking-cursor">|</span>';
            currentCharIndex--;
        } else {
            element.innerHTML = currentRole.substring(0, currentCharIndex + 1) + '<span class="blinking-cursor">|</span>';
            currentCharIndex++;
        }
        
        let typeSpeed = isDeleting ? 50 : 100;
        
        if (!isDeleting && currentCharIndex === currentRole.length) {
            typeSpeed = 1350;
            isDeleting = true;
        } else if (isDeleting && currentCharIndex === 0) {
            isDeleting = false;
            currentRoleIndex = (currentRoleIndex + 1) % roles.length;
        }
        
        setTimeout(type, typeSpeed);
    }
    
    type();
}

function initTerminalAnimation() {
    const terminalBody = document.getElementById('terminal-body');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (dataCache.about) {
                    typeTerminalText(dataCache.about.text);
                } else {
                    loadAboutData().then(() => {
                        if (dataCache.about) {
                            typeTerminalText(dataCache.about.text);
                        }
                    });
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(terminalBody);
}

function reserveTerminalHeight(text) {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) return;
    
    const lines = text.split(/<br>|\n/);
    const measureDiv = document.createElement('div');
    measureDiv.className = 'terminal-text';
    measureDiv.style.visibility = 'hidden';
    
    let finalHTML = '';
    lines.forEach(line => {
        finalHTML += line + '<div class="content-spacer"></div>';
    });
    finalHTML += '<span class="terminal-cursor">|</span>';
    measureDiv.innerHTML = finalHTML;
    
    terminalBody.appendChild(measureDiv);
    const finalHeight = terminalBody.offsetHeight;
    terminalBody.style.minHeight = `${finalHeight}px`;
    terminalBody.removeChild(measureDiv);
}

async function loadAboutData() {
    if (dataCache.about) return dataCache.about;
    
    try {
        const response = await fetch('assets/json/about.json');
        const data = await response.json();
        dataCache.about = data;
        
        reserveTerminalHeight(data.text);
        
        return data;
    } catch (error) {
        console.error('Error loading about data:', error);
        return null;
    }
}

function typeTerminalText(text) {
    const terminalBody = document.getElementById('terminal-body');
    
    const lines = text.split(/<br>|\n/);
    const measureDiv = document.createElement('div');
    measureDiv.className = 'terminal-text';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.position = 'absolute';
    measureDiv.style.position = 'static'; 
    
    let finalHTML = '';
    lines.forEach(line => {
        finalHTML += line + '<div class="content-spacer"></div>';
    });
    finalHTML += '<span class="terminal-cursor">|</span>';
    measureDiv.innerHTML = finalHTML;
    
    terminalBody.appendChild(measureDiv);
    const finalHeight = terminalBody.offsetHeight;
    terminalBody.style.minHeight = `${finalHeight}px`;
    terminalBody.removeChild(measureDiv);

    const textDiv = document.createElement('div');
    textDiv.className = 'terminal-text';
    terminalBody.appendChild(textDiv);

    let lineIndex = 0;
    let charIndex = 0;
    
    const isMobile = window.innerWidth <= 768;
    const charsPerTick = isMobile ? 1.2 : 1.7; 
    let charAccumulator = 0;

    function typeLine() {
        if (lineIndex < lines.length) {
            if (charIndex < lines[lineIndex].length) {
                charAccumulator += charsPerTick;
                
                let charsToAdd = '';
                while (charAccumulator >= 1 && charIndex < lines[lineIndex].length) {
                    charsToAdd += lines[lineIndex].charAt(charIndex);
                    charIndex++;
                    charAccumulator--;
                }
                
                if (charsToAdd) {
                    textDiv.innerHTML += charsToAdd;
                }
                
                setTimeout(typeLine, 1);
            } else {
                setTimeout(() => {
                    textDiv.innerHTML += '<div class="content-spacer"></div>';
                    lineIndex++;
                    charIndex = 0;
                    charAccumulator = 0;
                    typeLine();
                }, 300);
            }
        } else {
            const cursor = document.createElement('span');
            cursor.className = 'terminal-cursor';
            cursor.textContent = '|';
            terminalBody.appendChild(cursor);
            

            setTimeout(() => {
                terminalBody.style.minHeight = '200px';
                terminalBody.style.minHeight = 'auto';
            }, 100);
        }
    }

    typeLine();
}

async function loadHighlights() {
    try {
        const response = await fetch('assets/json/highlights.json');
        const highlights = await response.json();
        const grid = document.getElementById('highlights-grid');
        
        highlights.forEach((highlight, index) => {
            const col = document.createElement('div');
            col.className = 'col-lg-4 col-6';
            col.innerHTML = `
                <div class="highlight-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                    <i class="${highlight.icon}"></i>
                    <h5>${highlight.title}</h5>
                    <p>${highlight.description}</p>
                </div>
            `;
            grid.appendChild(col);
        });
        
        initAnimations();
    } catch (error) {
        console.error('Error loading highlights:', error);
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('assets/json/statistics.json');
        const statistics = await response.json();
        const grid = document.getElementById('statistics-grid');
        
        statistics.forEach((stat, index) => {
            const col = document.createElement('div');
            col.className = 'col-lg-4 col-6';
            col.innerHTML = `
                <div class="statistics-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                    <i class="${stat.icon}"></i>
                    <div class="statistics-number" data-target="${stat.value}">${stat.value}</div>
                    <div class="statistics-label">${stat.label}</div>
                </div>
            `;
            grid.appendChild(col);
        });
        
        initStatsAnimation();
        initAnimations();
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadAchievements() {
    try {
        const response = await fetch('assets/json/momentum.json');
        const achievements = await response.json();
        const grid = document.getElementById('achievements-grid');
        
        achievements.forEach((item, index) => {
            const col = document.createElement('div');
            col.className = 'col-lg-4 col-6';
            
            let badgeClass = 'badge-default';
            if (index === 0) badgeClass = 'badge-current';
            else if (index === 1) badgeClass = 'badge-latest';
            else badgeClass = 'badge-key';

            col.innerHTML = `
                <div class="achievement-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                    <div class="achievement-badge ${badgeClass}">${item.badge}</div>
                    <div class="achievement-icon">
                        <i class="${item.icon}"></i>
                    </div>
                    <div class="achievement-content">
                        <span class="achievement-date">${item.date}</span>
                        <h5>${item.title}</h5>
                        <p>${item.description}</p>
                    </div>
                </div>
            `;
            grid.appendChild(col);
        });
        
        initAnimations();
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

function initStatsAnimation() {
    const statNumbers = document.querySelectorAll('.statistics-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !statsAnimated) {
                animateStats();
                statsAnimated = true;
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => observer.observe(stat));
}

function animateStats() {
    const statNumbers = document.querySelectorAll('.statistics-number');
    const duration = 1800;
    
    statNumbers.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const startTime = Date.now();
        
        function updateNumber() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(easeOut * target);
            
            stat.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                stat.textContent = target;
            }
        }
        
        requestAnimationFrame(updateNumber);
    });
}

function initPortfolioTabs() {
    const tabBtns = document.querySelectorAll('#portfolioTabs button');
    const tabContents = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabContents.forEach(content => {
                content.classList.remove('show', 'active');
            });
            
            tabBtns.forEach(b => b.classList.remove('active'));
            
            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            targetContent.classList.add('show', 'active');
            
            currentCourseFilter = 'all';
            updateCourseFilterVisibility(targetTab);
            
            loadTabData(targetTab);
        });
    });
    
    loadTabData('certifications');
}

window.addEventListener('load', () => {
    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            const offsetTop = target.offsetTop - 59;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }
});

async function loadTabData(tabName) {
    try {
        switch(tabName) {
            case 'certifications':
                await loadCertifications();
                break;
            case 'courses':
                await loadCourses();
                break;
            case 'projects':
                await loadProjects();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${tabName}:`, error);
    }
}

async function loadCertifications() {
    try {
        if (dataCache.certifications) {
            renderCertifications(dataCache.certifications);
            return;
        }

        const response = await fetch('assets/json/certifications.json');
        const certifications = await response.json();
        
        dataCache.certifications = certifications;
        renderCertifications(certifications);
    } catch (error) {
        console.error('Error loading certifications:', error);
    }
}

function renderCertifications(certifications) {
    const grid = document.getElementById('certifications-grid');
    grid.innerHTML = '';

    certifications.forEach((cert, index) => {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-6';
        
        const progressPercentage = cert.progress || (cert.finished ? 100 : 0);
        const isPartial = cert.finished === 'partial';

        const upcomingClass = cert.finished ? '' : 'upcoming';
        const cardClass = `card portfolio-card animate-on-scroll ${upcomingClass}`;

        const detailsButtonHtml = cert.detailsLink ? `<a href="${cert.detailsLink}" target="_blank" rel="noopener noreferrer" class="card-btn secondary">View Details</a>` : '';
        let verifyButtonHtml = '';
        if (isPartial) {
            verifyButtonHtml = `<a href="${cert.proofLink}" target="_blank" rel="noopener noreferrer" class="card-btn primary">Verify Path Completion</a>`;
        } else if (cert.proofLink && cert.proofLink !== '#') {
            verifyButtonHtml = `<a href="${cert.proofLink}" target="_blank" rel="noopener noreferrer" class="card-btn primary">Verify Completion</a>`;
        }

        col.innerHTML = `
            <div class="${cardClass}" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                <div class="card-body">
                    <h6 class="card-title">${index + 1}. ${cert.title}</h6>
                    <p class="card-subtitle">${cert.provider}</p>
                    <p class="text-muted medium">${cert.status}</p>
                    <div class="progress-container mb-1">
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                        <span class="progress-text">${progressPercentage}%</span>
                    </div>
                    <div class="d-flex flex-wrap gap-2 justify-content-center">
                        ${detailsButtonHtml}
                        ${verifyButtonHtml}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
    
    initAnimations();
}

async function loadCourses(loadMore = false) {
    document.getElementById('courses-view-more')?.remove();
    try {
        if (loadMore && dataCache.courses) {
            const filteredCourses = getFilteredCourses(dataCache.courses);
            renderCourses(filteredCourses, true);
            return;
        }
        
        if (dataCache.courses && !loadMore) {
            coursesLoaded = 0;
            createCourseFilter();
            updateCourseFilterOptions(dataCache.courses);
            const filteredCourses = getFilteredCourses(dataCache.courses);
            renderCourses(filteredCourses);
            return;
        }
        
        const response = await fetch('assets/json/courses.json');
        const courses = await response.json();
        
        dataCache.courses = courses;
        if (!loadMore) {
            coursesLoaded = 0;
            createCourseFilter();
            updateCourseFilterOptions(courses);
        }
        const filteredCourses = getFilteredCourses(courses);
        renderCourses(filteredCourses, loadMore);
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

function renderCourses(courses, loadMore = false) {
    const grid = document.getElementById('courses-grid');

    if (!loadMore) {
        grid.innerHTML = '';
        coursesLoaded = 0;
    }

    const existingPlaceholder = document.getElementById('courses-view-more-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }
    const existingViewMore = document.getElementById('courses-view-more');
    if (existingViewMore) {
        existingViewMore.remove();
    }

    const startIndex = coursesLoaded;
    const endIndex = Math.min(coursesLoaded + COURSES_PER_PAGE, courses.length);
    const coursesToShow = courses.slice(startIndex, endIndex);

    coursesToShow.forEach((course, index) => {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-6';

        let skillClass = '';
        const type = (course.type || '').toLowerCase();
        if (type.includes('artificial intelligence')) {
            skillClass = 'skill-ai';
        } else if (type.includes('offensive security')) {
            skillClass = 'skill-offensive';
        } else if (type.includes('defensive security')) {
            skillClass = 'skill-defensive';
        } else if (type.includes('information technology')) {
            skillClass = 'skill-it';
        } else if (type.includes('soft skills')) {
            skillClass = 'skill-soft';
        } else {
            skillClass = 'skill-general';
        }

        const courseIndex = startIndex + index + 1;

        col.innerHTML = `
            <div class="card portfolio-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                <div class="card-body">
                    <h6 class="card-title">${courseIndex}. ${course.title}</h6>
                    <p class="card-subtitle">${course.provider}</p>
                    <span class="skill-tag ${skillClass}">${course.type}</span>
                    <div class="d-flex flex-wrap gap-2 mt-3 justify-content-center">
                        ${course.detailsLink ? `<a href="${course.detailsLink}" target="_blank" rel="noopener noreferrer" class="card-btn secondary">View Details</a>` : ''}
                        ${course.certificateLink ? `<a href="${course.certificateLink}" target="_blank" rel="noopener noreferrer" class="card-btn primary">Verify Completion</a>` : ''}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });

    coursesLoaded = endIndex;
    if (coursesLoaded < courses.length) {
        addCoursesViewMoreButton();
    }

    initAnimations();
}

function addCoursesViewMoreButton() {
    const coursesTab = document.getElementById('courses');
    
    const viewMoreDiv = document.createElement('div');
    const check = document.getElementById('courses-view-more');
    if (check) {
        check.remove();
    }
    viewMoreDiv.classList.add('view-more-btn');
    viewMoreDiv.id = 'courses-view-more';
    viewMoreDiv.className = 'view-more-btn';
    viewMoreDiv.innerHTML = `
        <button class="btn" onclick="loadMoreCourses()">
            <i class="fas fa-plus me-2"></i>Load More Courses
        </button>
    `;
    
    coursesTab.appendChild(viewMoreDiv);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(viewMoreDiv);
}

function loadMoreCourses() {
    const filteredCourses = getFilteredCourses(dataCache.courses);
    loadCourses(true);
}

async function loadProjects() {
    try {
        if (dataCache.projects) {
            renderProjects(dataCache.projects);
            return;
        }

        const response = await fetch('assets/json/projects.json');
        const projects = await response.json();
        
        dataCache.projects = projects;
        renderProjects(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = '';

    const existingViewMore = document.getElementById('projects-view-all');
    if (existingViewMore) existingViewMore.remove();
    const existingPlaceholder = document.getElementById('projects-view-all-placeholder');
    if (existingPlaceholder) existingPlaceholder.remove();

    projects.forEach((project, index) => {
        const col = document.createElement('div');
        col.className = 'col-lg-6 col-6';

        const linksHtml = Array.isArray(project.links) && project.links.length > 0
            ? project.links.map(link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card-btn primary me-1 mb-1">${link.title}</a>`).join('')
            : '';

        col.innerHTML = `
            <div class="card portfolio-card project-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                <div class="card-body d-flex flex-column align-items-center text-center">
                    <h6 class="card-title">${index + 1}. ${project.title}</h6>
                    <div class="card-text">${project.description}</div>
                    <div class="skills-container mb-1 d-flex flex-wrap justify-content-center">
                        ${project.skills.map(skill => `<span class="skill-tag me-1 mb-1">${skill}</span>`).join('')}
                    </div>
                    <div class="links-container d-flex flex-wrap justify-content-center">
                        ${linksHtml}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });

    if (projects.length > 0) {
        addProjectsViewAllButton();
    }

    initAnimations();
}

function addProjectsViewAllButton() {
    const projectsSection = document.getElementById('projects');

    const check = document.getElementById('projects-view-all');
    if (check) {
        check.remove();
    }
    
    const viewAllDiv = document.createElement('div');
    viewAllDiv.id = 'projects-view-all';
    viewAllDiv.className = 'view-more-btn';
    viewAllDiv.innerHTML = `
        <a href="https://github.com/AbdulrazzakSwai?tab=repositories" target="_blank" rel="noopener noreferrer" class="btn">
            <i class="fab fa-github me-2"></i>View More
        </a>
    `;
    
    const container = projectsSection.querySelector('.container');
    if (container) {
        container.appendChild(viewAllDiv);
    } else {
        projectsSection.appendChild(viewAllDiv);
    }
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(viewAllDiv);
}



async function loadLastUpdated() {
    try {
        const response = await fetch('https://www.abdulrazzakswai.me/assets/json/last-updated.json');
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();
        document.getElementById('last-updated').textContent = `Last updated on ${data.date}`;
    } catch (error) {
        console.error('Failed to load update info', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initNavigation();
    initAnimations();
    initTypingAnimation();
    initTerminalAnimation();
    initHeroParticles();
    loadAboutData();
    loadHighlights();
    loadStatistics();
    loadAchievements();
    loadCourses();
    loadProjects();
    initPortfolioTabs();
    loadLastUpdated();
    initDecryptionAnimation();
    
    updateCourseFilterVisibility('certifications');

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    createCourseFilter();
    
    initCustomCursor();
    initScrollProgress();
    initBackToTop();
    initTiltEffect();
});

function initCustomCursor() {
    const cursorDot = document.querySelector('[data-cursor-dot]');
    const cursorOutline = document.querySelector('[data-cursor-outline]');
    
    if (!cursorDot || !cursorOutline) return;

    window.addEventListener('mousemove', function(e) {
        const posX = e.clientX;
        const posY = e.clientY;
        
        cursorDot.style.left = `${posX}px`;
        cursorDot.style.top = `${posY}px`;
        
        cursorOutline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });
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
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const elements = node.querySelectorAll('a, button, .btn, input, select, textarea');
                        elements.forEach(el => {
                            el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
                            el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
                        });
                        if (node.matches('a, button, .btn, input, select, textarea')) {
                            node.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
                            node.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
                        }
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

function initScrollProgress() {
    const progressBar = document.querySelector('.scroll-progress');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + "%";
    });
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
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

let currentTiltedCard = null;

function initTiltEffect() {
    document.addEventListener('mousemove', (e) => {
        if (window.innerWidth <= 1024) return;

        const card = e.target.closest('.card, .highlight-card, .statistics-card, .achievement-card');
        
        if (currentTiltedCard && currentTiltedCard !== card) {
            currentTiltedCard.style.transform = '';
            currentTiltedCard.style.transition = '';
            currentTiltedCard = null;
        }
        
        if (!card) return;
        
        if (currentTiltedCard !== card) {
            currentTiltedCard = card;
        }
        
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
            currentTiltedCard.style.transform = '';
            currentTiltedCard.style.transition = '';
            currentTiltedCard = null;
        }
    });
}

function initDecryptionAnimation() {
    const headers = document.querySelectorAll('h2');
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;:,.<>?";
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                if (target.dataset.decrypted === 'true') return;
                
                const originalText = target.innerText;
                let iteration = 0;
                
                const interval = setInterval(() => {
                    target.innerText = originalText
                        .split("")
                        .map((letter, index) => {
                            if(index < iteration) {
                                return originalText[index];
                            }
                            return letters[Math.floor(Math.random() * letters.length)]
                        })
                        .join("");
                    
                    if(iteration >= originalText.length){ 
                        clearInterval(interval);
                        target.dataset.decrypted = 'true';
                    }
                    
                    iteration += 1 / 3;
                }, 30);
                
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });

    headers.forEach(header => observer.observe(header));
}

function createCourseFilter() {
    let filterContainer = document.getElementById('course-filter-container');
    if (filterContainer) {
        return;
    }

    filterContainer = document.createElement('div');
    filterContainer.id = 'course-filter-container';
    filterContainer.className = 'course-filter-container';

    const filterWrapper = document.createElement('div');
    filterWrapper.className = 'course-filter-wrapper';

    const select = document.createElement('select');
    select.id = 'course-filter-select';
    select.className = 'course-filter-select';

    const arrow = document.createElement('i');
    arrow.className = 'fas fa-chevron-down course-filter-arrow';

    filterWrapper.appendChild(select);
    filterWrapper.appendChild(arrow);
    filterContainer.appendChild(filterWrapper);

    const coursesTab = document.getElementById('courses');
    const coursesGrid = document.getElementById('courses-grid');
    coursesTab.insertBefore(filterContainer, coursesGrid);

    select.addEventListener('change', (e) => {
        currentCourseFilter = e.target.value;
        coursesLoaded = 0;
        renderFilteredCourses();
    });
}

function updateCourseFilterOptions(courses) {
    const select = document.getElementById('course-filter-select');
    if (!select) return;

    const fieldCounts = {
        all: courses.length,
        ai: 0,
        offensive: 0,
        defensive: 0,
        it: 0,
        soft: 0,
        general: 0
    };

    courses.forEach(course => {
        const type = (course.type || '').toLowerCase();
        if (type.includes('artificial intelligence')) {
            fieldCounts.ai++;
        } else if (type.includes('offensive security')) {
            fieldCounts.offensive++;
        } else if (type.includes('defensive security')) {
            fieldCounts.defensive++;
        } else if (type.includes('information technology')) {
            fieldCounts.it++;
        } else if (type.includes('soft skills')) {
            fieldCounts.soft++;
        } else {
            fieldCounts.general++;
        }
    });

    const options = [
        { value: 'all', label: `All (${fieldCounts.all})` },
        { value: 'ai', label: `Artificial Intelligence (${fieldCounts.ai})` },
        { value: 'offensive', label: `Offensive Security (${fieldCounts.offensive})` },
        { value: 'defensive', label: `Defensive Security (${fieldCounts.defensive})` },
        { value: 'it', label: `Information Technology (${fieldCounts.it})` },
        { value: 'soft', label: `Soft Skills (${fieldCounts.soft})` },
        { value: 'general', label: `General (${fieldCounts.general})` }
    ];

    select.innerHTML = '';

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        if (option.value === currentCourseFilter) {
            optionElement.selected = true;
        }
        select.appendChild(optionElement);
    });
}

function updateCourseFilterVisibility(currentTab) {
    const filterContainer = document.getElementById('course-filter-container');
    if (!filterContainer) return;

    if (currentTab === 'courses') {
        filterContainer.classList.add('show');
    } else {
        filterContainer.classList.remove('show');
    }
}

function getFilteredCourses(courses) {
    if (currentCourseFilter === 'all') {
        return courses;
    }

    return courses.filter(course => {
        const type = (course.type || '').toLowerCase();
        switch (currentCourseFilter) {
            case 'ai':
                return type.includes('artificial intelligence');
            case 'offensive':
                return type.includes('offensive security');
            case 'defensive':
                return type.includes('defensive security');
            case 'it':
                return type.includes('information technology');
            case 'soft':
                return type.includes('soft skills');
            case 'general':
                return !type.includes('artificial intelligence') &&
                       !type.includes('offensive security') && 
                       !type.includes('defensive security') && 
                       !type.includes('information technology') && 
                       !type.includes('soft skills');
            default:
                return true;
        }
    });
}

function renderFilteredCourses() {
    if (!dataCache.courses) return;
    
    const filteredCourses = getFilteredCourses(dataCache.courses);
    coursesLoaded = 0;
    renderCourses(filteredCourses);
}

function initHeroParticles() {
    const canvas = document.getElementById('global-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let colors = ['#1d4ed8', '#0ea5e9'];
    
    const particleCount = window.innerWidth < 768 ? 35 : 70;
    const connectionDistance = 150;
    const moveSpeed = 0.4;

    function updateColors() {
        const style = getComputedStyle(document.body);
        const primary = style.getPropertyValue('--primary-color').trim();
        const secondary = style.getPropertyValue('--secondary-color').trim();
        if (primary && secondary) {
            colors = [primary, secondary];
        }
    }

    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        
        particles = [];
        const count = window.innerWidth < 768 ? 35 : 70;
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }
    
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
    
    resize();
    window.addEventListener('resize', resize);
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.update();
            p.draw();
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
                    const opacity = 0.2 * (1 - dist / connectionDistance);
                    
                    if (a.type === b.type) {
                        ctx.strokeStyle = colors[a.type];
                    } else {
                        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                        gradient.addColorStop(0, colors[a.type]);
                        gradient.addColorStop(1, colors[b.type]);
                        ctx.strokeStyle = gradient;
                    }
                    
                    ctx.globalAlpha = opacity;
                    ctx.lineWidth = 1;
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}
