/**
 * EIPR Quiz Feature — quiz.js
 * ----------------------------
 * Right-click → context menu with 4 modes:
 *   1. Generate Quiz       — 3 MCQs with score + Refer Back to Concept
 *   2. Generate CIE        — 3x 2-Mark + 3x 5-Mark descriptive questions + Suggested Topics
 *   3. Generate SEE        — 3x 8-Mark descriptive questions + Suggested Topics
 *   4. Explain Further     — Educational summary of selection
 *
 * Uses local Ollama (gemma3:1b) with robust client-side fallback for all modes.
 */

const QUIZ_CONFIG = {
    ollamaUrl: 'http://localhost:11434/api/generate',
    model: 'gemma3:1b',
    minQuestions: 10,
    targetQuestions: 12,
    pointsPerCorrect: 10,
};

// ─── State ────────────────────────────────────────────────────────────────────
let quizQuestions = [];
let quizCurrentIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let highlightedTextForQuiz = '';
let activeConceptId = null; // tracks nearest reader-* element for "Refer Back"

// ─── DOM References ────────────────────────────────────────────────────────────
let quizContextMenu, quizModalOverlay;
let quizLoadingScreen, quizQuestionScreen, quizResultScreen, quizDescriptiveScreen;
let quizProgressBar, quizProgressText, quizScoreBadge;
let quizQuestionNumber, quizQuestionText, quizOptionsContainer;
let quizFeedbackBox, quizFeedbackCorrect, quizFeedbackExplanation, quizFeedbackFocus;
let quizNextBtn, quizResultScore, quizResultTotal, quizResultMsg;
let quizCloseBtn, quizResultCloseBtn, quizLoadingMsg;
let quizDescriptiveContent, quizDescriptiveCloseBtn;
let quizReferBackBtn;
let quizModalTitleIcon, quizModalTitleText, quizModalTitle;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    resolveDOM();
    attachContextMenu();
    attachModalControls();
});

function resolveDOM() {
    quizContextMenu         = document.getElementById('quiz-context-menu');
    quizModalOverlay        = document.getElementById('quiz-modal-overlay');
    quizLoadingScreen       = document.getElementById('quiz-loading-screen');
    quizQuestionScreen      = document.getElementById('quiz-question-screen');
    quizResultScreen        = document.getElementById('quiz-result-screen');
    quizDescriptiveScreen   = document.getElementById('quiz-descriptive-screen');
    quizProgressBar         = document.getElementById('quiz-progress-bar');
    quizProgressText        = document.getElementById('quiz-progress-text');
    quizScoreBadge          = document.getElementById('quiz-score-badge');
    quizQuestionNumber      = document.getElementById('quiz-question-number');
    quizQuestionText        = document.getElementById('quiz-question-text');
    quizOptionsContainer    = document.getElementById('quiz-options-container');
    quizFeedbackBox         = document.getElementById('quiz-feedback-box');
    quizFeedbackCorrect     = document.getElementById('quiz-feedback-correct');
    quizFeedbackExplanation = document.getElementById('quiz-feedback-explanation');
    quizFeedbackFocus       = document.getElementById('quiz-feedback-focus');
    quizNextBtn             = document.getElementById('quiz-next-btn');
    quizResultScore         = document.getElementById('quiz-result-score');
    quizResultTotal         = document.getElementById('quiz-result-total');
    quizResultMsg           = document.getElementById('quiz-result-msg');
    quizCloseBtn            = document.getElementById('quiz-close-btn');
    quizResultCloseBtn      = document.getElementById('quiz-result-close-btn');
    quizLoadingMsg          = document.getElementById('quiz-loading-msg');
    quizDescriptiveContent  = document.getElementById('quiz-descriptive-content');
    quizDescriptiveCloseBtn = document.getElementById('quiz-descriptive-close-btn');
    quizReferBackBtn        = document.getElementById('quiz-refer-back-btn');

    // Title elements for mode switching
    const titleDiv = document.querySelector('.quiz-modal-title');
    if (titleDiv) {
        quizModalTitle     = titleDiv;
        quizModalTitleIcon = titleDiv.querySelector('i');
        quizModalTitleText = titleDiv.querySelector('span');
    }
}

// ─── Context Menu Logic ───────────────────────────────────────────────────────
function attachContextMenu() {
    const textbookCard = document.getElementById('textbook-content-card');
    if (!textbookCard) return;

    textbookCard.addEventListener('contextmenu', (e) => {
        const selected = window.getSelection().toString().trim();
        if (selected.length < 20) {
            hideContextMenu();
            return;
        }
        e.preventDefault();
        highlightedTextForQuiz = selected;

        // Find nearest parent with id="reader-*" for Refer Back
        let node = e.target;
        while (node && node !== textbookCard) {
            if (node.id && node.id.startsWith('reader-')) {
                activeConceptId = node.id;
                break;
            }
            node = node.parentElement;
        }
        if (!activeConceptId) activeConceptId = null;

        showContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener('click', (e) => {
        if (!quizContextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    document.getElementById('quiz-context-generate-btn').addEventListener('click', () => {
        hideContextMenu();
        setModalMode('quiz');
        startQuizGeneration(highlightedTextForQuiz);
    });

    document.getElementById('quiz-context-cie-btn').addEventListener('click', () => {
        hideContextMenu();
        setModalMode('cie');
        startDescriptiveGeneration(highlightedTextForQuiz, 'cie');
    });

    document.getElementById('quiz-context-see-btn').addEventListener('click', () => {
        hideContextMenu();
        setModalMode('see');
        startDescriptiveGeneration(highlightedTextForQuiz, 'see');
    });

    document.getElementById('quiz-context-explain-btn').addEventListener('click', () => {
        hideContextMenu();
        setModalMode('explain');
        startDescriptiveGeneration(highlightedTextForQuiz, 'explain');
    });
}

function setModalMode(mode) {
    if (!quizModalTitle) return;
    const modeConfig = {
        quiz:    { icon: 'fa-brain',          text: 'Knowledge Quiz',       cls: '' },
        cie:     { icon: 'fa-pen-ruler',      text: 'Possible CIE Questions',cls: 'cie-mode' },
        see:     { icon: 'fa-graduation-cap', text: 'Possible SEE Questions',cls: 'see-mode' },
        explain: { icon: 'fa-circle-info',    text: 'Explain Further',      cls: 'explain-mode' },
    };
    const cfg = modeConfig[mode] || modeConfig.quiz;
    quizModalTitle.className = 'quiz-modal-title' + (cfg.cls ? ` ${cfg.cls}` : '');
    if (quizModalTitleIcon) quizModalTitleIcon.className = `fa-solid ${cfg.icon}`;
    if (quizModalTitleText) quizModalTitleText.textContent = cfg.text;

    // Show/hide score badge (only for quiz mode)
    if (quizScoreBadge) quizScoreBadge.style.display = (mode === 'quiz') ? '' : 'none';
    // Show/hide progress (only quiz mode)
    const progressTrack = document.querySelector('.quiz-progress-track');
    const progressLabel = document.querySelector('.quiz-progress-label');
    if (progressTrack) progressTrack.style.display = (mode === 'quiz') ? '' : 'none';
    if (progressLabel) progressLabel.style.display = (mode === 'quiz') ? '' : 'none';
}

function showContextMenu(x, y) {
    quizContextMenu.style.display = 'block';
    const menuW = quizContextMenu.offsetWidth || 260;
    const menuH = quizContextMenu.offsetHeight || 160;
    const safeX = Math.min(x, window.innerWidth - menuW - 12);
    const safeY = Math.min(y, window.innerHeight - menuH - 12);
    quizContextMenu.style.left = `${safeX}px`;
    quizContextMenu.style.top  = `${safeY}px`;
    quizContextMenu.classList.add('visible');
}

function hideContextMenu() {
    if (quizContextMenu) {
        quizContextMenu.classList.remove('visible');
        setTimeout(() => { quizContextMenu.style.display = 'none'; }, 180);
    }
}

// ─── Modal Controls ───────────────────────────────────────────────────────────
function attachModalControls() {
    quizCloseBtn.addEventListener('click', closeQuizModal);
    quizResultCloseBtn.addEventListener('click', closeQuizModal);
    quizNextBtn.addEventListener('click', advanceQuestion);
    quizDescriptiveCloseBtn.addEventListener('click', closeQuizModal);
    quizReferBackBtn.addEventListener('click', referBackToConcept);

    quizModalOverlay.addEventListener('click', (e) => {
        if (e.target === quizModalOverlay) closeQuizModal();
    });
}

function openQuizModal() {
    quizModalOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeQuizModal() {
    quizModalOverlay.classList.remove('visible');
    document.body.style.overflow = '';
    quizQuestions = [];
    quizCurrentIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    // Reset title to default
    if (quizModalTitleIcon) quizModalTitleIcon.className = 'fa-solid fa-brain';
    if (quizModalTitleText) quizModalTitleText.textContent = 'Knowledge Quiz';
    if (quizModalTitle) quizModalTitle.className = 'quiz-modal-title';
}

function referBackToConcept() {
    closeQuizModal();
    if (!activeConceptId) return;
    const el = document.getElementById(activeConceptId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        el.classList.add('refer-flash');
        setTimeout(() => el.classList.remove('refer-flash'), 1700);
    }, 400);
}

// ─── Screen Switcher ──────────────────────────────────────────────────────────
function showScreen(name) {
    quizLoadingScreen.style.display     = name === 'loading'     ? 'flex' : 'none';
    quizQuestionScreen.style.display    = name === 'question'    ? 'flex' : 'none';
    quizResultScreen.style.display      = name === 'result'      ? 'flex' : 'none';
    quizDescriptiveScreen.style.display = name === 'descriptive' ? 'flex' : 'none';
}

function setLoadingMessage(msg) {
    quizLoadingMsg.textContent = msg;
}

// ═══════════════════════════════════════════════════════════
//  MODE 1: MCQ QUIZ (3 questions)
// ═══════════════════════════════════════════════════════════

function buildPrompt(text) {
    return `You are an educational quiz generator. Your ONLY job is to output MCQ questions in a strict format.

STRICT FORMAT RULES (follow exactly, no exceptions):
- Each question block must have exactly two lines: a Q line and an A line.
- Q line: starts with "Q: " followed by the question.
- A line: starts with "A: " followed by exactly 4 options separated by " | " and then " | " followed by the correct option letter (A, B, C, or D).
- Do NOT add numbering, headers, explanations, or any other text outside these lines.
- Do NOT use markdown, asterisks, dashes, or bullet points.

EXAMPLE (copy this format exactly):
Q: What is the primary purpose of an injunction in civil law?
A: To impose criminal penalties | To restrain a party from a specific act | To award monetary damages | To compel arbitration | B

Q: Which element is NOT required to prove negligence?
A: Duty of care | Breach of duty | Intent to harm | Causation | C

Now generate exactly 12 MCQ questions covering ALL major concepts in the following text. 
Important: Do NOT write sentence completion or 'fill-in-the-blank' questions (e.g. do not use "Complete: '... _______ ...'"). Do NOT refer to 'the selected passage' or 'the text' inside your questions. Instead, ask direct, formal questions about the concepts, definitions, and legal/business facts present in the text:

---
${text.substring(0, 3000)}
---

Output only the Q/A blocks. Begin now:`;
}

async function callOllama(prompt) {
    const response = await fetch(QUIZ_CONFIG.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: QUIZ_CONFIG.model,
            prompt,
            stream: false,
            options: { temperature: 0.2, top_p: 0.9, num_predict: 2048 }
        })
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}. Is Ollama running?`);
    const data = await response.json();
    return data.response || '';
}

function parseQuizOutput(raw, rawText = '') {
    const lines = raw.split('\n');
    const questions = [];
    let currentQ = null;

    function commitCurrentQ() {
        if (!currentQ) return;
        if (currentQ.question && currentQ.options.length === 4 && currentQ.correctIndex !== -1) {
            const hasEmpty = currentQ.options.some(opt => !opt || opt.trim().length === 0);
            if (!hasEmpty) {
                questions.push({
                    question: currentQ.question,
                    options: currentQ.options.map(o => o.trim()),
                    correctIndex: currentQ.correctIndex,
                    explanation: buildExplanation(currentQ.question, currentQ.options[currentQ.correctIndex]),
                    focusConcept: extractConcept(currentQ.question, rawText)
                });
            }
        }
        currentQ = null;
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const qMatch = line.match(/^Q\s*[:：]\s*(.+)/i) || line.match(/^Question\s*\d*\s*[:：]\s*(.+)/i);
        if (qMatch) { commitCurrentQ(); currentQ = { question: qMatch[1].trim(), options: [], correctIndex: -1 }; continue; }
        if (!currentQ) continue;
        const inlineMatch = line.match(/^A\s*[:：]\s*(.+)/i);
        if (inlineMatch && inlineMatch[1].includes('|')) {
            const parts = inlineMatch[1].split('|').map(s => s.trim()).filter(s => s.length > 0);
            if (parts.length >= 5) {
                currentQ.options = [parts[0], parts[1], parts[2], parts[3]];
                const cl = parts[parts.length - 1].toUpperCase().replace(/[^A-D]/g, '');
                const ci = { A: 0, B: 1, C: 2, D: 3 }[cl];
                if (ci !== undefined) currentQ.correctIndex = ci;
            }
            commitCurrentQ(); continue;
        }
        const optA = line.match(/^[A1]\s*[).\]:：]\s*(.+)/i); const optB = line.match(/^[B2]\s*[).\]:：]\s*(.+)/i);
        const optC = line.match(/^[C3]\s*[).\]:：]\s*(.+)/i); const optD = line.match(/^[D4]\s*[).\]:：]\s*(.+)/i);
        if (optA) { currentQ.options[0] = optA[1].trim(); continue; }
        if (optB) { currentQ.options[1] = optB[1].trim(); continue; }
        if (optC) { currentQ.options[2] = optC[1].trim(); continue; }
        if (optD) { currentQ.options[3] = optD[1].trim(); continue; }
        const ansMatch = line.match(/^(?:Correct\s+)?Answer\s*[:：]\s*([A-D1-4])/i) || line.match(/^Ans\s*[:：]\s*([A-D1-4])/i);
        if (ansMatch) {
            const lm = { A:0,B:1,C:2,D:3,1:0,2:1,3:2,4:3 };
            currentQ.correctIndex = lm[ansMatch[1].toUpperCase()] ?? -1;
            commitCurrentQ();
        }
    }
    commitCurrentQ();
    return questions;
}

function buildExplanation(question, correctOption) {
    const qLower = question.toLowerCase();
    if (qLower.includes('not') || qLower.includes('except') || qLower.includes('incorrect')) {
        return `The other options are valid. "${correctOption}" is the correct choice here as the exception or incorrect case.`;
    }
    return `The correct answer is "${correctOption}". Review the highlighted passage to understand why this concept applies.`;
}

function extractConcept(question, rawText = '') {
    const concepts = [];
    if (typeof hierarchyData !== 'undefined' && hierarchyData) {
        function traverse(node) {
            if (node.title && ['concept','subtopic','topic'].includes(node.node_type)) {
                concepts.push({ title: node.title, clean: node.title.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim() });
            }
            if (node.children) node.children.forEach(traverse);
        }
        traverse(hierarchyData);
    }
    const qLow = question.toLowerCase();
    let best = null, maxLen = 0;
    for (const c of concepts) {
        if (c.clean.length > 4 && qLow.includes(c.clean) && c.clean.length > maxLen) { maxLen = c.clean.length; best = c.title; }
    }
    if (!best && rawText) {
        const rLow = rawText.toLowerCase();
        for (const c of concepts) {
            if (c.clean.length > 4 && rLow.includes(c.clean) && c.clean.length > maxLen) { maxLen = c.clean.length; best = c.title; }
        }
    }
    if (best) return best;
    const stop = new Set(['what','which','who','when','where','how','why','is','are','does','do','the','a','an','of','in','on','at','to','for','with','that','this','was','were','not','and','or','but','can','would','could','should','must']);
    const kw = question.replace(/[^a-zA-Z\s]/g,'').split(/\s+/).filter(w => w.length > 3 && !stop.has(w.toLowerCase()));
    return kw.slice(0,3).map(w => w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ') || 'this topic';
}

function generateFallbackQuestions(text, count) {
    const pool = [
        {
            q: "Which of the following describes the primary objective of Patent Law?",
            opts: ["To protect artistic expression", "To grant exclusivity to functional inventions", "To safeguard brand logos", "To manage business contracts"],
            ans: 1,
            concept: "Patent Law"
        },
        {
            q: "What protects the visual design, shape, and pattern of an industrial product?",
            opts: ["Trademark", "Patent", "Industrial Design Rights", "Copyright"],
            ans: 2,
            concept: "Industrial Design"
        },
        {
            q: "Under Indian Trademark Law, what is a primary relative ground for refusing registration?",
            opts: ["It lacks distinctiveness", "It is identical/similar to an existing registered mark", "It contains generic text only", "It describes the quality of goods"],
            ans: 1,
            concept: "Trademark Infringement"
        },
        {
            q: "Which organization administers international treaties for protecting intellectual property globally?",
            opts: ["WTO", "WIPO", "UNESCO", "UNIDO"],
            ans: 1,
            concept: "WIPO"
        },
        {
            q: "What legal term refers to the unauthorized use of a registered trademark, or colorable imitation thereof?",
            opts: ["Passing Off", "Patent Infringement", "Trademark Infringement", "Fair Use"],
            ans: 2,
            concept: "Trademark Infringement"
        },
        {
            q: "Which of the following is protected by Copyright?",
            opts: ["Inventions", "Underlying ideas", "Original expression of ideas", "Brand names"],
            ans: 2,
            concept: "Copyright Law"
        },
        {
            q: "What common law remedy is available to protect unregistered trademarks from misrepresentation?",
            opts: ["Patent Litigation", "Passing Off", "Design Registration", "Copyright Claim"],
            ans: 1,
            concept: "Passing Off"
        },
        {
            q: "Which of the following is NOT required to prove negligence in tort law?",
            opts: ["Duty of care", "Breach of duty", "Intentional malice to cause injury", "Causation of damage"],
            ans: 2,
            concept: "Negligence"
        },
        {
            q: "What is the primary function of a Non-Disclosure Agreement (NDA) in business?",
            opts: ["To register a new patent", "To secure trade secrets during partnership talks", "To transfer copyright ownership", "To establish corporate tax limits"],
            ans: 1,
            concept: "Trade Secrets"
        },
        {
            q: "Under Indian Copyright Law, what is the general term of protection for literary works?",
            opts: ["Creator's lifetime plus 60 years", "20 years from publication", "10 years from registration", "Creator's lifetime only"],
            ans: 0,
            concept: "Copyright Term"
        },
        {
            q: "Which of the following represents a key characteristic of entrepreneurship?",
            opts: ["Strict aversion to risk", "Innovation and value creation", "Adhering only to established routines", "Avoiding business models"],
            ans: 1,
            concept: "Entrepreneurship"
        },
        {
            q: "What type of patent protects functional aspects, chemical compounds, or software processes?",
            opts: ["Design Patent", "Utility Patent", "Plant Patent", "Copyright registration"],
            ans: 1,
            concept: "Utility Patent"
        }
    ];

    // Shuffle the pool and take the required count
    const questions = shuffleArray(pool).slice(0, count).map(item => ({
        question: item.q,
        options: item.opts,
        correctIndex: item.ans,
        explanation: `This is a fundamental concept in ${item.concept}. Refer back to the textbook sidebar for related chapters.`,
        focusConcept: item.concept
    }));

    return questions;
}

async function startQuizGeneration(text) {
    quizQuestions=[]; quizCurrentIndex=0; quizScore=0; quizAnswered=false;
    openQuizModal(); showScreen('loading');
    setLoadingMessage('🤖 Connecting to Ollama (gemma3:1b)…');
    try {
        const prompt = buildPrompt(text);
        setLoadingMessage(`✍️ Generating ${QUIZ_CONFIG.targetQuestions} MCQs from your selection…`);
        let raw = await callOllama(prompt);
        let parsed = parseQuizOutput(raw, text);
        if (parsed.length < QUIZ_CONFIG.minQuestions) {
            const needed = QUIZ_CONFIG.targetQuestions - parsed.length;
            parsed.push(...generateFallbackQuestions(text, needed));
        }
        quizQuestions = shuffleArray(parsed).slice(0, QUIZ_CONFIG.targetQuestions);
        setLoadingMessage(`✅ ${quizQuestions.length} questions ready!`);
        await sleep(500); renderQuestion(0); showScreen('question');
    } catch(err) {
        setLoadingMessage('⚠️ Ollama offline — using local generator…');
        await sleep(800);
        quizQuestions = generateFallbackQuestions(text, QUIZ_CONFIG.targetQuestions);
        await sleep(400); renderQuestion(0); showScreen('question');
    }
}

// ─── Quiz Renderer ────────────────────────────────────────────────────────────
function renderQuestion(index) {
    const q = quizQuestions[index]; quizAnswered = false;
    const pct = Math.round((index/quizQuestions.length)*100);
    quizProgressBar.style.width = `${pct}%`;
    quizProgressText.textContent = `${index+1} / ${quizQuestions.length}`;
    quizScoreBadge.textContent = `⭐ ${quizScore} pts`;
    quizQuestionNumber.textContent = `Question ${index+1}`;
    quizQuestionText.textContent = q.question;
    quizOptionsContainer.innerHTML = '';
    q.options.forEach((opt,i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn'; btn.id = `quiz-opt-${i}`;
        const letter = ['A','B','C','D'][i];
        btn.innerHTML = `<span class="quiz-opt-letter">${letter}</span><span class="quiz-opt-text">${opt}</span>`;
        btn.addEventListener('click', () => handleAnswer(i));
        quizOptionsContainer.appendChild(btn);
    });
    quizFeedbackBox.style.display = 'none';
    quizNextBtn.style.display = 'none';
    quizReferBackBtn.style.display = activeConceptId ? '' : 'none';
}

function handleAnswer(selectedIndex) {
    if (quizAnswered) return; quizAnswered = true;
    const q = quizQuestions[quizCurrentIndex];
    const isCorrect = selectedIndex === q.correctIndex;
    const optBtns = quizOptionsContainer.querySelectorAll('.quiz-option-btn');
    optBtns.forEach((btn,i) => {
        btn.disabled = true;
        if (i === q.correctIndex) btn.classList.add('correct');
        else if (i === selectedIndex && !isCorrect) btn.classList.add('incorrect');
        else btn.classList.add('dimmed');
    });
    if (isCorrect) {
        quizScore += QUIZ_CONFIG.pointsPerCorrect;
        quizScoreBadge.textContent = `⭐ ${quizScore} pts`;
        quizScoreBadge.classList.add('score-pulse');
        setTimeout(() => quizScoreBadge.classList.remove('score-pulse'), 600);
    }
    quizFeedbackCorrect.textContent = isCorrect ? '✅ Correct!' : `❌ Wrong! Correct: ${['A','B','C','D'][q.correctIndex]}. ${q.options[q.correctIndex]}`;
    quizFeedbackCorrect.className = isCorrect ? 'quiz-feedback-verdict correct-verdict' : 'quiz-feedback-verdict wrong-verdict';
    quizFeedbackExplanation.textContent = q.explanation;
    quizFeedbackFocus.textContent = `📚 Focus on: ${q.focusConcept}`;
    quizFeedbackBox.style.display = 'block';
    const isLast = quizCurrentIndex === quizQuestions.length-1;
    quizNextBtn.textContent = isLast ? '🏁 See Results' : 'Next →';
    quizNextBtn.style.display = 'flex';
}

function advanceQuestion() {
    const isLast = quizCurrentIndex === quizQuestions.length-1;
    if (isLast) showResults();
    else { quizCurrentIndex++; renderQuestion(quizCurrentIndex); }
}

function showResults() {
    const total = quizQuestions.length * QUIZ_CONFIG.pointsPerCorrect;
    const pct = Math.round((quizScore/total)*100);
    quizResultScore.textContent = quizScore;
    quizResultTotal.textContent = total;
    let msg, emoji;
    if (pct>=90) { msg='Outstanding! You mastered this section! 🎓'; emoji='🏆'; }
    else if (pct>=70) { msg='Great work! Review the missed concepts.'; emoji='🌟'; }
    else if (pct>=50) { msg='Good effort! Revisit the highlighted section.'; emoji='📖'; }
    else { msg='Keep practising — re-read and try again!'; emoji='💪'; }
    quizResultMsg.innerHTML = `<span class="result-emoji">${emoji}</span> ${msg}`;
    document.getElementById('quiz-result-pct').textContent = `${pct}%`;
    // Animate the SVG ring using stroke-dashoffset
    const ringCircle = document.querySelector('#quiz-result-ring .ring-fill');
    if (ringCircle) {
        const circumference = 314; // 2 * π * 50
        const offset = circumference - (pct / 100) * circumference;
        ringCircle.style.strokeDashoffset = offset;
        ringCircle.style.transition = 'stroke-dashoffset 0.8s ease';
    }
    showScreen('result');
}

// ═══════════════════════════════════════════════════════════
//  MODE 2 & 3 & 4: DESCRIPTIVE GENERATION (CIE / SEE / Explain)
// ═══════════════════════════════════════════════════════════

// ── Match Concept helper for Suggested Topics ──
function getNearbyConcepts(question, count = 3) {
    const concepts = [];
    if (typeof hierarchyData !== 'undefined' && hierarchyData) {
        function traverse(node) {
            if (node.title && ['concept','subtopic','topic'].includes(node.node_type)) {
                concepts.push(node.title);
            }
            if (node.children) node.children.forEach(traverse);
        }
        traverse(hierarchyData);
    }
    // Simple filter to find related concepts based on matches, otherwise return random nearby ones
    const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    let related = concepts.filter(c => {
        const cLow = c.toLowerCase();
        return qWords.some(w => cLow.includes(w));
    });
    if (related.length < count) {
        // Fallback to random concepts in syllabus to ensure list is populated
        const pool = ["Entrepreneurship", "Patentability Criteria", "Invention", "Copyright Infringement", "Trademark Infringement", "Passing Off", "WIPO", "Trade Secrets", "Industrial Design", "Design Rights", "Moral Rights", "Economic Rights"];
        related.push(...pool.filter(p => !related.includes(p)));
    }
    return shuffleArray(related).slice(0, count);
}

// ── Ollama prompt builder for structural JSON output ──
function buildSystemPrompt(mode, text) {
    const docTitle = typeof activeConceptId !== 'undefined' && activeConceptId ? activeConceptId.replace('reader-','') : 'IPR';
    
    if (mode === 'cie') {
        return `You are an Engineering Examination Question Generator.
The output will be displayed inside an interactive learning application.
Generate exactly 5 Two-Mark questions and exactly 5 Five-Mark questions from the EIPR syllabus based ONLY on the supplied text.

STRICT JSON FORMAT:
{
  "two_mark": [
    {
      "question": "Explain the concept of [Concept] and...",
      "answer": "2 to 4 lines direct, concise explanation...",
      "suggested_next_topics": ["Topic A", "Topic B", "Topic C"]
    }
  ],
  "five_mark": [
    {
      "question": "Discuss the scope of [Concept] protection and explain...",
      "answer": "5 to 10 lines detail including important points...",
      "suggested_next_topics": ["Topic D", "Topic E", "Topic F"]
    }
  ]
}

STRICT RULES:
1. Return VALID JSON ONLY. Do not wrap in markdown blocks or write any introductory text.
2. Every question must have exactly one answer and exactly 3 suggested_next_topics.
3. CIE Questions must follow RVCE exam style.
4. Suggested topics must be conceptually related, nearby chapters/concepts in EIPR.
5. Use only information present in the supplied content:
---
${text.substring(0, 2500)}
---
JSON:`;
    } else {
        return `You are an Engineering Examination Question Generator.
Generate exactly 3 Eight-Mark Questions with structured answers and suggested next topics based ONLY on the supplied text.

STRICT JSON FORMAT:
{
  "see_questions": [
    {
      "question": "Explain the concept of [Concept] and discuss the rights...",
      "answer": "Structured answer with headings, bullet points, and examples where relevant...",
      "suggested_next_topics": ["Topic A", "Topic B", "Topic C"]
    }
  ]
}

STRICT RULES:
1. Return VALID JSON ONLY. Do not wrap in markdown or write additional text.
2. Questions must follow RVCE EIPR exam styles: Compare and Contrast, Explain Procedure, Discuss Legal Remedies, Explain Rights and Obligations.
3. Every question must have exactly one answer and exactly 3 suggested_next_topics.
4. Use only information present in the supplied content:
---
${text.substring(0, 2500)}
---
JSON:`;
    }
}

function buildExplainPrompt(text) {
    return `You are an educational assistant. Provide a clear, detailed explanation of the following selected text in simple language suitable for an engineering student.
Organize your explanation with:
- A brief overview (2-3 sentences)
- Key concepts and definitions
- Real-world examples if applicable
- Why this concept is important for exams

Selected text:
---
${text.substring(0, 2000)}
---
Explain:`;
}

// ── Fallback descriptive generators matching EIPR & RVCE patterns ──
function generateFallbackCIE(text) {
    const sentences = text.split(/[.!?]+\s+/).map(s=>s.trim()).filter(s=>s.length>30&&s.length<200);
    const termRx = /\b[A-Z][a-zA-Z\-\s]{3,30}\b/g;
    const terms = Array.from(new Set((text.match(termRx)||[]).map(t=>t.trim()))).filter(t=>t.length>3&&!/^(The|And|For|This|That|With)$/i.test(t));
    const t0 = terms[0]||'Intellectual Property', t1=terms[1]||'Entrepreneurship', t2=terms[2]||'Invention', t3=terms[3]||'WIPO', t4=terms[4]||'Design Rights';
    const s0 = sentences[0]||'Intellectual property protection is a critical legal framework.';
    const s1 = sentences[1]||'Entrepreneurship drives local economic growth and technological innovation.';
    
    return {
        two_mark: [
            {
                question: `Explain the concept of "${t0}" and its primary objective in civil law.`,
                answer: `"${t0}" refers to legal rights protecting creations of the mind. Its primary objective is to incentivize innovation and creative expression by providing legal exclusivity.`,
                suggested_next_topics: [`Scope of ${t0}`, "Intellectual Property Rights", "Types of IP"]
            },
            {
                question: `Define "${t1}" and list two key characteristics of a successful implementation.`,
                answer: `"${t1}" is the process of setting up and managing a new business venture. Key characteristics include risk-taking ability, innovation, and strategic market positioning.`,
                suggested_next_topics: [`Types of ${t1}`, "Business Opportunities", "Design Thinking"]
            },
            {
                question: `Explain the requirement of novelty under the patentability criteria.`,
                answer: `Novelty requires that an invention must not be anticipated by prior art or previously disclosed anywhere in the public domain before the filing date.`,
                suggested_next_topics: ["Patentability Criteria", "Patent Filing Process", "Inventive Step"]
            },
            {
                question: `State the significance of "${t3}" in international intellectual property administration.`,
                answer: `"${t3}" (World Intellectual Property Organization) coordinates international treaties, administers IP applications globally, and assists in harmonizing protection standards across nations.`,
                suggested_next_topics: ["WIPO Inventions", "Patent Cooperation Treaty", "Types of IP"]
            },
            {
                question: `Define "${t4}" and state the duration of protection.`,
                answer: `"${t4}" protect the aesthetic or visual aspects of an article. Under Indian law, design registration is initially valid for 10 years, extendable by another 5 years.`,
                suggested_next_topics: ["Industrial Design Rights", "Utility Patents", "Designs Act"]
            }
        ],
        five_mark: [
            {
                question: `Explain the concept of Copyright and discuss the economic and moral rights granted to a copyright owner.`,
                answer: `Copyright is a legal right protecting the expression of ideas in original works. It grants: \n• Economic Rights: Allows commercial exploitation (reproduction, public performance, distribution, and translation).\n• Moral Rights: Protects the author's reputation, including the right of paternity (claim authorship) and integrity (object to distortions of the work).`,
                suggested_next_topics: ["Copyright Ownership", "Copyright Infringement", "Moral Rights"]
            },
            {
                question: `Discuss the scope of Trademark protection and identify the grounds for refusal of registration in India.`,
                answer: `A Trademark protects brand identity (names, logos, slogans). Grounds for refusal under Indian law include:\n1. Absolute Grounds: Lacks distinctive character, consists of generic terms, or is descriptive of quality/origin.\n2. Relative Grounds: Similarity to an existing registered trademark, causing public confusion.`,
                suggested_next_topics: ["Trademark Infringement", "Passing Off", "Trademark Registration Procedure"]
            },
            {
                question: `Explain the step-by-step procedure involved in filing a patent application.`,
                answer: `The patent filing procedure involves:\n1. Patent Search: Verifying novelty against existing prior art.\n2. Drafting: Preparing the specification (provisional or complete) describing the invention.\n3. Filing: Submitting application forms at the Patent Office.\n4. Examination: Requesting examination within the stipulated timeline to address office actions.`,
                suggested_next_topics: ["Patentability Requirements", "WIPO Inventions", "Utility Patents"]
            },
            {
                question: `Discuss the legal tools available in India for protecting trade secrets and the role of employee contracts.`,
                answer: `Trade secrets are protected in India under common law through breach of confidence actions. Key tools include:\n1. Non-Disclosure Agreements (NDAs): Binding employees to confidentiality.\n2. Restrictive Covenants: Restricting disclosure of sensitive technical parameters or client databases post-employment. Remedies include temporary and permanent injunctions.`,
                suggested_next_topics: ["Trade Secrets Protection", "NDAs", "Legal Remedies"]
            },
            {
                question: `Differentiate between Industrial Designs and Patents. Provide appropriate examples for each.`,
                answer: `The differences include:\n1. Object of Protection: Patents protect functional/technical inventions (e.g., a new engine process). Industrial Designs protect visual appearance (e.g., shape of a telephone).\n2. Criteria: Patents require novelty, utility, and non-obviousness. Designs require originality and visual appeal.`,
                suggested_next_topics: ["Industrial Design Rights", "Utility Patents", "Patentability Requirements"]
            }
        ]
    };
}

function generateFallbackSEE(text) {
    const termRx = /\b[A-Z][a-zA-Z\-\s]{3,25}\b/g;
    const terms = Array.from(new Set((text.match(termRx)||[]).map(t=>t.trim()))).filter(t=>t.length>3&&!/^(The|And|For|This|That)$/i.test(t));
    const t0 = terms[0]||'Copyright Law';
    const t1 = terms[1]||'Trademark Registration';
    const t2 = terms[2]||'Trade Secrets';

    return {
        see_questions: [
            {
                question: `Explain the concept of Copyright and discuss the scope of protection for literary, dramatic, and artistic works.`,
                answer: `<strong>1. Introduction to Copyright:</strong><br>Copyright is a statutory right granted to creators of original works. It protects expression, not ideas.<br><strong>2. Scope of Protection:</strong><br>• Literary Works: Includes books, computer programs, databases, and compilations.<br>• Dramatic & Musical Works: Protects choreography, screenplays, and underlying musical arrangements.<br>• Artistic Works: Covers paintings, architectural designs, and photographs.<br><strong>3. Rights Conferred:</strong><br>The owner enjoys exclusive rights of reproduction, communication to the public, and making adaptations.`,
                suggested_next_topics: ["Economic Rights", "Copyright Infringement", "Moral Rights"]
            },
            {
                question: `Explain the procedure involved in Trademark registration and discuss the rights conferred after registration.`,
                answer: `<strong>1. Registration Procedure:</strong><br>• Filing: Submitting application containing trademark representation and description of goods/services.<br>• Examination: Registrar checks for absolute and relative grounds of refusal.<br>• Publication: Trademark is advertised in the Trademark Journal for public opposition (4 months).<br>• Registration: Certificate is issued if no opposition succeeds.<br><strong>2. Conferred Rights:</strong><br>The proprietor obtains exclusive right to use the mark and seek statutory remedies for trademark infringement.`,
                suggested_next_topics: ["Trademark Infringement", "Passing Off", "Refusal Grounds"]
            },
            {
                question: `Compare and contrast Industrial Designs and Patents. Discuss the legal tools available to protect Trade Secrets.`,
                answer: `<strong>1. Comparison (Industrial Design vs Patent):</strong><br>• Industrial Design: Protects aesthetic features, shape, configuration, and ornamentation of an article. Does not cover functional aspects.<br>• Patent: Protects technical innovations, processes, or products involving an inventive step.<br><strong>2. Trade Secrets Protection:</strong><br>In India, trade secrets are protected under common law and breach of confidence contracts. Key remedies include permanent injunctions and award of damages.`,
                suggested_next_topics: ["Trade Secrets Protection", "Utility Patents", "Industrial Design Rights"]
            }
        ]
    };
}

function generateFallbackExplain(text) {
    const sentences = text.split(/[.!?]+\s+/).map(s=>s.trim()).filter(s=>s.length>20);
    const terms = Array.from(new Set((text.match(/\b[A-Z][a-zA-Z\-\s]{3,30}\b/g)||[]).map(t=>t.trim()))).filter(t=>t.length>3&&!/^(The|And|For|This)$/i.test(t));
    const keyTerms = terms.slice(0,5).join(', ') || 'the key concept';
    return {
        overview: `The selected passage discusses ${keyTerms}. This is a fundamental concept in the Intellectual Property Rights and Entrepreneurship curriculum.`,
        keyConcepts: sentences.slice(0,4).join(' '),
        example: terms.length ? `For example, "${terms[0]}" is widely encountered in real-world IP disputes and entrepreneurial contexts.` : '',
        examNote: `This topic frequently appears in both CIE and SEE examinations. Understanding ${keyTerms} is essential for scoring well in related questions on definition, comparison, and procedure-based answers.`
    };
}

// ─── Main Descriptive Screen Renderer ──────────────────────────────────────────
function renderDescriptiveScreen(mode, data) {
    quizDescriptiveContent.innerHTML = '';

    if (mode === 'cie') {
        renderCIEContent(data);
    } else if (mode === 'see') {
        renderSEEContent(data);
    } else if (mode === 'explain') {
        renderExplainContent(data);
    }

    showScreen('descriptive');
}

function renderCIEContent(data) {
    const twoMark = data.two_mark || data.twoMark || [];
    const fiveMark = data.five_mark || data.fiveMark || [];

    // Mode header
    quizDescriptiveContent.appendChild(createModeHeader('cie', 'fa-pen-ruler', 'Possible CIE Questions', '5 × 2-Mark  •  5 × 5-Mark'));

    // 2-Mark section
    const sec2 = document.createElement('div');
    sec2.innerHTML = '<div class="dq-section-title">2-Mark Questions</div>';
    twoMark.forEach((q,i) => sec2.appendChild(createDescriptiveCard(q, i+1, 'mark-2')));
    quizDescriptiveContent.appendChild(sec2);

    // 5-Mark section
    const sec5 = document.createElement('div');
    sec5.innerHTML = '<div class="dq-section-title">5-Mark Questions</div>';
    fiveMark.forEach((q,i) => sec5.appendChild(createDescriptiveCard(q, i+1, 'mark-5')));
    quizDescriptiveContent.appendChild(sec5);
}

function renderSEEContent(data) {
    const seeQuestions = data.see_questions || data.seeQuestions || [];

    // Mode header
    quizDescriptiveContent.appendChild(createModeHeader('see', 'fa-graduation-cap', 'Possible SEE Questions', '3 × 8-Mark Questions'));

    // SEE section
    const secS = document.createElement('div');
    secS.innerHTML = '<div class="dq-section-title">8-Mark Questions</div>';
    seeQuestions.forEach((q,i) => secS.appendChild(createDescriptiveCard(q, i+1, 'mark-8')));
    quizDescriptiveContent.appendChild(secS);
}

function renderExplainContent(data) {
    quizDescriptiveContent.appendChild(createModeHeader('explain', 'fa-circle-info', 'Explain Further', 'Educational context from your selection'));

    const card = document.createElement('div');
    card.className = 'dq-explain-card';
    card.innerHTML = `
        <h4>📘 Overview</h4>
        <p>${data.overview}</p>
        ${data.keyConcepts ? `<h4 style="margin-top:12px;">🔑 Key Concepts</h4><p>${data.keyConcepts}</p>` : ''}
        ${data.example ? `<h4 style="margin-top:12px;">💡 Real-World Example</h4><p>${data.example}</p>` : ''}
        ${data.examNote ? `<h4 style="margin-top:12px;">📝 Exam Relevance</h4><p>${data.examNote}</p>` : ''}
    `;
    quizDescriptiveContent.appendChild(card);
}

// ─── Card Builders ─────────────────────────────────────────────────────────────
function createModeHeader(type, icon, label, sub) {
    const hdr = document.createElement('div');
    hdr.className = 'dq-mode-header';
    hdr.innerHTML = `
        <div class="dq-mode-icon ${type}"><i class="fa-solid ${icon}"></i></div>
        <div>
            <div class="dq-mode-label">${label}</div>
            <div class="dq-mode-sub">${sub}</div>
        </div>
    `;
    return hdr;
}

function createDescriptiveCard(q, index, markClass) {
    const card = document.createElement('div');
    card.className = 'dq-card';
    const marksBadge = `<span class="dq-marks-badge ${markClass}">${markClass.replace('mark-','')}M</span>`;
    
    // Suggested Next Topics List HTML
    let topicsHTML = '';
    if (q.suggested_next_topics && q.suggested_next_topics.length > 0) {
        topicsHTML = `<div class="dq-suggested-topics" style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
            <strong style="color: var(--google-green);"><i class="fa-solid fa-list-ul"></i> Suggested Topics:</strong>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                ${q.suggested_next_topics.map(topic => {
                    // Match topic with ID in database for scroll routing if possible
                    const clean = topic.toLowerCase().replace(/[^a-z0-9]/g,'');
                    return `<button class="quiz-refer-back-btn" onclick="referToChapter('${escapeHTML(topic)}')" style="padding: 4px 8px; font-size: 10px;">
                        ${escapeHTML(topic)}
                    </button>`;
                }).join('')}
            </div>
        </div>`;
    }

    card.innerHTML = `
        <div class="dq-card-header">
            <div class="dq-q-index">${index}</div>
            <div style="flex:1">
                <div class="dq-card-meta">${marksBadge}</div>
                <p class="dq-question-text" style="margin-top:8px;">${escapeHTML(q.question)}</p>
            </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button class="dq-show-answer-btn" onclick="toggleAnswer(this)">
                <i class="fa-solid fa-chevron-right"></i> Show Answer
            </button>
        </div>
        <div class="dq-answer-block" style="display:none; margin-top: 12px;">
            <div class="dq-answer-text">${formatAnswer(q.answer)}</div>
            ${topicsHTML}
        </div>
    `;
    return card;
}

window.referToChapter = function(topicName) {
    closeQuizModal();
    // Search the TOC for a matching text block
    const allHeaders = Array.from(document.querySelectorAll('.tb-concept-header, .tb-subtopic-header, .tb-topic-header, .tb-unit-header'));
    const tLow = topicName.toLowerCase().replace(/[^a-z0-9]/g,'');
    let targetEl = null;
    for (const h of allHeaders) {
        const hText = h.textContent.toLowerCase().replace(/[^a-z0-9]/g,'');
        if (hText.includes(tLow) || tLow.includes(hText)) {
            targetEl = h.parentElement;
            break;
        }
    }
    if (!targetEl && activeConceptId) {
        targetEl = document.getElementById(activeConceptId);
    }
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            targetEl.classList.add('refer-flash');
            setTimeout(() => targetEl.classList.remove('refer-flash'), 1700);
        }, 400);
    }
};

function formatAnswer(text) {
    if (!text) return '<em style="opacity:0.5;">Answer not available. Review the selected passage.</em>';
    // Convert newlines to <br>, bold key phrases
    return text.replace(/\n/g,'<br>').replace(/[""]([^""]+)[""]/g,'<strong>"$1"</strong>');
}

function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Global toggle function for show-answer buttons
window.toggleAnswer = function(btn) {
    const ansBlock = btn.parentElement.nextElementSibling;
    const isShown = ansBlock.style.display !== 'none';
    ansBlock.style.display = isShown ? 'none' : 'block';
    btn.innerHTML = isShown
        ? '<i class="fa-solid fa-chevron-right"></i> Show Answer'
        : '<i class="fa-solid fa-chevron-down"></i> Hide Answer';
    btn.classList.toggle('revealed', !isShown);
};

// ─── Main Descriptive Generation Entry Point ───────────────────────────────────
async function startDescriptiveGeneration(text, mode) {
    openQuizModal();
    showScreen('loading');
    const modeLabels = { cie:'CIE Questions', see:'SEE Questions', explain:'explanation' };
    setLoadingMessage(`🤖 Generating ${modeLabels[mode]||mode} from your selection…`);

    try {
        let rawOutput = '';
        if (mode === 'cie') {
            rawOutput = await callOllama(buildSystemPrompt('cie', text));
            let cleanJson = rawOutput.trim();
            // strip markdown formatting if any exists
            if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
            }
            const data = JSON.parse(cleanJson);
            if (!data.two_mark || !data.five_mark) throw new Error("Missing JSON nodes");
            
            // Pad both lists to exactly 5 elements if Ollama returned less
            const fallback = generateFallbackCIE(text);
            while (data.two_mark.length < 5) {
                data.two_mark.push(fallback.two_mark[data.two_mark.length % fallback.two_mark.length]);
            }
            while (data.five_mark.length < 5) {
                data.five_mark.push(fallback.five_mark[data.five_mark.length % fallback.five_mark.length]);
            }
            
            await sleep(400);
            renderDescriptiveScreen('cie', data);

        } else if (mode === 'see') {
            rawOutput = await callOllama(buildSystemPrompt('see', text));
            let cleanJson = rawOutput.trim();
            if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
            }
            const data = JSON.parse(cleanJson);
            if (!data.see_questions) throw new Error("Missing JSON nodes");
            await sleep(400);
            renderDescriptiveScreen('see', data);

        } else if (mode === 'explain') {
            rawOutput = await callOllama(buildExplainPrompt(text));
            const explainData = {
                overview: rawOutput.split('\n').filter(l=>l.trim()).slice(0,2).join(' ') || generateFallbackExplain(text).overview,
                keyConcepts: rawOutput.split('\n').filter(l=>l.trim()).slice(2,5).join(' ') || '',
                example: '',
                examNote: generateFallbackExplain(text).examNote
            };
            await sleep(400);
            renderDescriptiveScreen('explain', explainData);
        }

    } catch(err) {
        console.warn(`Ollama issue or parser failure for ${mode} mode, running structural fallback:`, err);
        setLoadingMessage('⚠️ Ollama offline/error — using built-in generator…');
        await sleep(800);

        if (mode === 'cie') {
            renderDescriptiveScreen('cie', generateFallbackCIE(text));
        } else if (mode === 'see') {
            renderDescriptiveScreen('see', generateFallbackSEE(text));
        } else if (mode === 'explain') {
            renderDescriptiveScreen('explain', generateFallbackExplain(text));
        }
    }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
