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
        'Cybersecurity Student',
        'Ethical Hacker',
        'Cyber Defense Analyst', 
        'Web Developer',
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

async function loadAboutData() {
    if (dataCache.about) return dataCache.about;
    
    try {
        const response = await fetch('assets/json/about.json');
        const data = await response.json();
        dataCache.about = data;
        return data;
    } catch (error) {
        console.error('Error loading about data:', error);
        return null;
    }
}

function typeTerminalText(text) {
    const terminalBody = document.getElementById('terminal-body');
    const textDiv = document.createElement('div');
    textDiv.className = 'terminal-text';
    terminalBody.appendChild(textDiv);

    const lines = text.split(/<br>|\n/);
    let lineIndex = 0;
    let charIndex = 0;
    const speed = 25;

    function typeLine() {
        if (lineIndex < lines.length) {
            if (charIndex < lines[lineIndex].length) {
                textDiv.innerHTML += lines[lineIndex].charAt(charIndex);
                charIndex++;
                setTimeout(typeLine, speed);
            } else {
                setTimeout(() => {
                    textDiv.innerHTML += '<br>';
                    lineIndex++;
                    charIndex = 0;
                    typeLine();
                }, 300);
            }
        } else {
            const cursor = document.createElement('span');
            cursor.className = 'terminal-cursor';
            cursor.textContent = '|';
            terminalBody.appendChild(cursor);
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
            col.className = 'col-lg-4 col-md-6';
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
            col.className = 'col-lg-4 col-md-6';
            col.innerHTML = `
                <div class="statistics-card animate-on-scroll" data-animation="animate-scale-in" data-delay="${index * 75}">
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

async function loadTimeline() {
    try {
        const response = await fetch('assets/json/timeline.json');
        const timeline = await response.json();
        const container = document.getElementById('timeline-container');
        
        timeline.forEach((item, index) => {
            const timelineItem = document.createElement('div');
            timelineItem.className = `timeline-card ${item.type} animate-on-scroll`;
            timelineItem.dataset.animation = 'animate-fade-in-up';
            timelineItem.dataset.delay = (index * 75).toString();
            timelineItem.innerHTML = `
                <div class="timeline-badge ${item.type}">
                    <i class="${item.icon} me-2"></i>
                    ${item.type === 'recent' ? 'Recent' : 'Upcoming'}
                </div>
                <h4>${item.title}</h4>
                <p class="timeline-date">${item.date}</p>
                <p class="timeline-description">${item.description}</p>
            `;
            container.appendChild(timelineItem);
        });
        
        initAnimations();
    } catch (error) {
        console.error('Error loading timeline:', error);
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
    const duration = 1700;
    
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
        col.className = 'col-lg-4 col-md-6';
        
        const progressPercentage = cert.progress || (cert.upcoming ? 0 : 100);
        const isCompleted = progressPercentage === 100 && !cert.upcoming;
        const cardClass = `card portfolio-card animate-on-scroll ${cert.upcoming ? 'upcoming' : ''} ${isCompleted ? 'golden-border-shiny' : ''}`;
        
        col.innerHTML = `
            <div class="${cardClass}" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                <div class="card-body">
                    <h6 class="card-title">${index + 1}. ${cert.title}</h6>
                    <p class="card-subtitle">${cert.provider}</p>
                    <p class="text-muted medium">${cert.status}</p>
                    <p class="text-muted medium">${cert.date}</p>
                    <div class="progress-bar mb-3">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        <span class="progress-text">${progressPercentage}%</span>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        ${cert.detailsLink ? `<a href="${cert.detailsLink}" target="_blank" rel="noopener noreferrer" class="card-btn secondary">View Details</a>` : ''}
                        ${cert.proofLink && cert.proofLink !== '#' ? `<a href="${cert.proofLink}" target="_blank" rel="noopener noreferrer" class="card-btn primary">Verify</a>` : ''}
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

    let cardsLoaded = 0;
    const totalCards = coursesToShow.length;

    coursesToShow.forEach((course, index) => {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6';

        let skillClass = '';
        const type = (course.type || '').toLowerCase();
        if (type.includes('offensive security')) {
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
                    <div class="d-flex flex-wrap gap-2 mt-3">
                        ${course.detailsLink ? `<a href="${course.detailsLink}" target="_blank" rel="noopener noreferrer" class="card-btn secondary">View Details</a>` : ''}
                        ${course.certificateLink ? `<a href="${course.certificateLink}" target="_blank" rel="noopener noreferrer" class="card-btn primary">Verify</a>` : ''}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);

        const card = col.querySelector('.portfolio-card');
        if (card) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        cardsLoaded++;
                        obs.unobserve(entry.target);
                        if (cardsLoaded === totalCards && placeholder) {
                            const placeholderObserver = new IntersectionObserver((entries2, obs2) => {
                                entries2.forEach(entry2 => {
                                    if (entry2.isIntersecting) {
                                        setTimeout(() => {
                                            coursesLoaded = endIndex;
                                            if (coursesLoaded < courses.length) {
                                                addCoursesViewMoreButton();
                                            }
                                            obs2.disconnect();
                                        }, 100);
                                    }
                                });
                            }, { threshold: 0.5 });
                            placeholderObserver.observe(placeholder);
                        }
                    }
                });
            }, { threshold: 0.5 });
            observer.observe(card);
        }
    });

    let placeholder = null;
    if (endIndex < courses.length) {
        placeholder = document.createElement('div');
        placeholder.id = 'courses-view-more-placeholder';
        placeholder.style.height = '1px';
        grid.appendChild(placeholder);
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
    
    setTimeout(() => {
        viewMoreDiv.classList.add('show');
    }, 100);
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

    let cardsLoaded = 0;
    const totalCards = projects.length;

    projects.forEach((project, index) => {
        const col = document.createElement('div');
        col.className = 'col-lg-6';

        const linksHtml = Array.isArray(project.links) && project.links.length > 0
            ? project.links.map(link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card-btn primary me-2">${link.title}</a>`).join('')
            : '';

        col.innerHTML = `
            <div class="card portfolio-card animate-on-scroll" data-animation="animate-fade-in-up" data-delay="${index * 75}">
                <div class="card-body">
                    <h6 class="card-title">${index + 1}. ${project.title}</h6>
                    <p class="card-text">${project.description}</p>
                    <div class="mb-3">
                        ${project.skills.map(skill => `<span class="skill-tag me-1 mb-1">${skill}</span>`).join('')}
                    </div>
                    ${linksHtml}
                </div>
            </div>
        `;
        grid.appendChild(col);

        const card = col.querySelector('.portfolio-card');
        if (card) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        cardsLoaded++;
                        obs.unobserve(entry.target);
                        if (cardsLoaded === totalCards && placeholder) {
                            setupPlaceholderObserver();
                        }
                    }
                });
            }, { threshold: 0.5 });
            observer.observe(card);
        }
    });

    let placeholder = null;
    if (projects.length > 0) {
        placeholder = document.createElement('div');
        placeholder.id = 'projects-view-all-placeholder';
        placeholder.style.height = '1px';
        grid.appendChild(placeholder);
    }

    function setupPlaceholderObserver() {
        if (!placeholder) return;
        const placeholderObserver = new IntersectionObserver((entries, obs2) => {
            entries.forEach(entry2 => {
                if (entry2.isIntersecting) {
                    setTimeout(() => {
                        addProjectsViewAllButton();
                        obs2.disconnect();
                    }, 100);
                }
            });
        }, { threshold: 0.5 });
        placeholderObserver.observe(placeholder);
    }

    if (totalCards === 0 || cardsLoaded === totalCards) {
        setupPlaceholderObserver();
    }

    initAnimations();
}

function addProjectsViewAllButton() {
    const projectsTab = document.getElementById('projects');

    const check = document.getElementById('projects-view-all');
    if (check) {
        check.remove();
    }
    
    const viewAllDiv = document.createElement('div');
    viewAllDiv.id = 'projects-view-all';
    viewAllDiv.className = 'view-more-btn';
    viewAllDiv.innerHTML = `
        <a href="https://github.com/AbdulrazzakSwai?tab=repositories" target="_blank" rel="noopener noreferrer" class="btn">
            <i class="fab fa-github me-2"></i>View More Projects
        </a>
    `;
    projectsTab.appendChild(viewAllDiv);
    
    setTimeout(() => {
        viewAllDiv.classList.add('show');
    }, 100);
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
    loadAboutData();
    loadHighlights();
    loadStatistics();
    loadTimeline();
    loadCourses();
    loadProjects();
    initPortfolioTabs();
    loadLastUpdated();
    
    updateCourseFilterVisibility('certifications');

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    createCourseFilter();
});

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
        offensive: 0,
        defensive: 0,
        it: 0,
        soft: 0,
        general: 0
    };

    courses.forEach(course => {
        const type = (course.type || '').toLowerCase();
        if (type.includes('offensive security')) {
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
            case 'offensive':
                return type.includes('offensive security');
            case 'defensive':
                return type.includes('defensive security');
            case 'it':
                return type.includes('information technology');
            case 'soft':
                return type.includes('soft skills');
            case 'general':
                return !type.includes('offensive security') && 
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
