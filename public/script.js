// --- Global Utility Functions ---

/**
 * Displays a temporary message box on the screen
 */
const showMessage = (message, type = 'success') => {
    const msgBox = document.createElement('div');
    msgBox.textContent = message;
    msgBox.className = `message-box ${type}`;
    
    // Inline styling for the message box to ensure visibility
    if (!document.getElementById('msg-box-styles')) {
        const style = document.createElement('style');
        style.id = 'msg-box-styles';
        style.textContent = `
            .message-box {
                position: fixed; top: 20px; right: 20px; padding: 12px 24px;
                border-radius: 8px; color: white; z-index: 2000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 600;
                transition: opacity 0.3s ease;
            }
            .message-box.success { background-color: #4CAF50; }
            .message-box.error { background-color: #EF4444; }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(msgBox);
    setTimeout(() => {
        msgBox.style.opacity = '0';
        setTimeout(() => msgBox.remove(), 300);
    }, 4000);
};

/**
 * Validates required fields in a form
 */
const validateForm = (formId) => {
    const form = document.getElementById(formId);
    let isValid = true;
    let requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(input => {
        input.classList.remove('input-error');
        if (!input.value.trim()) {
            input.classList.add('input-error');
            isValid = false;
        }
    });
    return isValid;
};

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    initNavigation();
    
    // Page-specific initialization logic
    if (path.includes('index.html') || path === '/' || path === '/index.html') {
        initAccordion();
        initRoadmapTabs();
    } else if (path.includes('get-started.html')) {
        initGetStartedForm();
    } else if (path.includes('questions.html')) {
        initQuestionsForm();
    } else if (path.includes('results.html')) {
        initResultsPage();
    }
});

function initNavigation() {
    const hamburger = document.querySelector('.hamburger-menu');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger) {
        hamburger.addEventListener('click', () => navLinks.classList.toggle('active'));
    }
}

// --- FORM 1: STUDENT INFO ---
function initGetStartedForm() {
    const form = document.getElementById('student-info-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm('student-info-form')) return;

        const formData = new FormData(form);
        const studentInfo = Object.fromEntries(formData.entries());
        const submitBtn = form.querySelector('button[type="submit"]');
        
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving Profile...";

        try {
            const response = await fetch('/api/student-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentInfo)
            });

            const data = await response.json();
            if (data.success) {
                // Store studentId for the next step
                sessionStorage.setItem('studentId', data.studentId);
                window.location.href = `questions.html`;
            } else {
                showMessage(data.message || "Error saving details", "error");
            }
        } catch (error) {
            console.error('NETWORK ERROR:', error);
            showMessage("Network Error: Ensure the server is running on http://localhost:3000", 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit & Get Results";
        }
    });
}

// --- FORM 2: CAREER ASSESSMENT ---
function initQuestionsForm() {
    const form = document.getElementById('questions-form');
    const studentId = sessionStorage.getItem('studentId');
    
    if (!studentId && window.location.pathname.includes('questions.html')) {
        window.location.href = 'get-started.html';
        return;
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const answers = {};
        
        // 1. Handle Multi-select checkboxes for universal questions
        const q1Arr = Array.from(form.querySelectorAll('input[name="q1"]:checked')).map(el => el.value);
        const q4Arr = Array.from(form.querySelectorAll('input[name="q4_values"]:checked')).map(el => el.value);
        const q9Arr = Array.from(form.querySelectorAll('input[name="q9_industries"]:checked')).map(el => el.value);

        // 2. Loop through all form entries to collect radio/select/text data
        for (let [key, value] of formData.entries()) {
            if (!['q1', 'q4_values', 'q9_industries'].includes(key)) {
                answers[key] = value;
            }
        }
        
        // 3. Set the combined checkbox values explicitly (Fixes N/A results)
        answers.q1 = q1Arr.join(', ') || "None selected";
        answers.q4 = q4Arr.join(', ') || "None selected";
        answers.q9 = q9Arr.join(', ') || "None selected";

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "AI is analyzing your path...";

        try {
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, answers })
            });

            const data = await response.json();
            if (data.success) {
                sessionStorage.removeItem('studentId');
                window.location.href = `results.html?studentId=${data.studentId}`;
            } else {
                showMessage(data.message || "Assessment failed", 'error');
            }
        } catch (error) {
            console.error('SUBMISSION ERROR:', error);
            showMessage("Network error. Please check your internet and server terminal.", 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Get My Personalized Roadmap';
        }
    });
}

// --- RESULTS DISPLAY ---
function initResultsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('studentId');
    const container = document.getElementById('results-container');
    const loading = document.getElementById('loading-message');

    if (!studentId) {
        showMessage("No profile found. Returning to start.", "error");
        setTimeout(() => window.location.href = 'get-started.html', 2000);
        return;
    }
    
    loading.style.display = 'block';

    fetch(`/api/results/${studentId}`)
        .then(res => res.json())
        .then(data => {
            loading.style.display = 'none';
            if (data.success) {
                renderResults(data.result, data.studentInfo, container);
                container.style.display = 'block';
            } else {
                showMessage("Could not load your results. They may have expired.", "error");
            }
        })
        .catch(err => {
            console.error("RESULTS FETCH ERROR:", err);
            loading.innerText = "Error: Connection lost while loading results.";
        });
}

function renderResults(aiResult, studentInfo, container) {
    const notes = studentInfo.message || 'No specific concerns provided.';
    const interests = studentInfo.q9 || 'General Discovery';

    container.innerHTML = `
        <div class="container">
            <h1 class="text-center section-heading">Your AI Career Roadmap 🚀</h1>
            
            <div class="card p-6 mb-8" style="border-left: 5px solid var(--primary-color);">
                <h3>👤 Profile Snapshot</h3>
                <p><strong>Name:</strong> ${studentInfo.fullName}</p>
                <p><strong>Course/Branch:</strong> ${studentInfo.courseBranch} (Year: ${studentInfo.yearSemester})</p>
                <p><strong>Focus Sectors:</strong> ${interests}</p>
                <p><strong>Your Input:</strong> ${notes}</p>
            </div>

            <h2 class="mb-4">🎯 Top Recommendations</h2>
            <div class="testimonials-grid mb-8" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                ${aiResult.topCareers.map(c => `
                    <div class="card p-5">
                        <h4 style="color: var(--accent-color);">${c.title}</h4>
                        <p style="font-weight: 700; font-size: 1.1rem; margin: 5px 0;">Compatibility: ${c.matchScore}</p>
                        <p class="text-muted small">${c.reasoning}</p>
                    </div>
                `).join('')}
            </div>

            <div class="card roadmap-content p-8">
                <h2 style="color: var(--primary-color);">🗺️ Career Path: ${aiResult.bestCareerRoadmap.careerTitle}</h2>
                <p class="text-muted mb-4">${aiResult.bestCareerRoadmap.description || ''}</p>
                
                ${aiResult.bestCareerRoadmap.phases.map(p => `
                    <div class="roadmap-phase mt-6" style="padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <h4 style="color: var(--text-dark); border-left: 4px solid var(--accent-color); padding-left: 10px;">${p.title}</h4>
                        <ul style="margin-top: 10px; padding-left: 20px;">
                            ${p.details.map(d => `<li style="margin-bottom: 5px;">${d}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
            
            <div class="text-center mt-10">
                <a href="index.html" class="btn btn-primary">Return to Home</a>
            </div>
        </div>
    `;
}

// Accordion and Tabs (Landing page logic)
function initAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });
}

function initRoadmapTabs() {
    // Demo tab switching for index.html if needed
}