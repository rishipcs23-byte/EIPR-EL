/**
 * EIPR Quiz Feature — quiz.js
 * ----------------------------
 * Right-click → Generate Quiz on highlighted text in the Textbook Reader.
 * Uses local Ollama (gemma3:1b) to generate MCQs, then runs an interactive quiz.
 *
 * CONFIG: If your Ollama model tag differs, update QUIZ_CONFIG below.
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

// ─── DOM References (resolved after DOMContentLoaded) ────────────────────────
let quizContextMenu, quizModalOverlay, quizModal;
let quizLoadingScreen, quizQuestionScreen, quizResultScreen;
let quizProgressBar, quizProgressText, quizScoreBadge;
let quizQuestionNumber, quizQuestionText, quizOptionsContainer;
let quizFeedbackBox, quizFeedbackCorrect, quizFeedbackExplanation, quizFeedbackFocus;
let quizNextBtn, quizResultScore, quizResultTotal, quizResultMsg;
let quizCloseBtn, quizResultCloseBtn, quizLoadingMsg;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    resolveDOM();
    attachContextMenu();
    attachModalControls();
});

function resolveDOM() {
    quizContextMenu       = document.getElementById('quiz-context-menu');
    quizModalOverlay      = document.getElementById('quiz-modal-overlay');
    quizLoadingScreen     = document.getElementById('quiz-loading-screen');
    quizQuestionScreen    = document.getElementById('quiz-question-screen');
    quizResultScreen      = document.getElementById('quiz-result-screen');
    quizProgressBar       = document.getElementById('quiz-progress-bar');
    quizProgressText      = document.getElementById('quiz-progress-text');
    quizScoreBadge        = document.getElementById('quiz-score-badge');
    quizQuestionNumber    = document.getElementById('quiz-question-number');
    quizQuestionText      = document.getElementById('quiz-question-text');
    quizOptionsContainer  = document.getElementById('quiz-options-container');
    quizFeedbackBox       = document.getElementById('quiz-feedback-box');
    quizFeedbackCorrect   = document.getElementById('quiz-feedback-correct');
    quizFeedbackExplanation = document.getElementById('quiz-feedback-explanation');
    quizFeedbackFocus     = document.getElementById('quiz-feedback-focus');
    quizNextBtn           = document.getElementById('quiz-next-btn');
    quizResultScore       = document.getElementById('quiz-result-score');
    quizResultTotal       = document.getElementById('quiz-result-total');
    quizResultMsg         = document.getElementById('quiz-result-msg');
    quizCloseBtn          = document.getElementById('quiz-close-btn');
    quizResultCloseBtn    = document.getElementById('quiz-result-close-btn');
    quizLoadingMsg        = document.getElementById('quiz-loading-msg');
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
        showContextMenu(e.clientX, e.clientY);
    });

    // Hide on any click outside
    document.addEventListener('click', (e) => {
        if (!quizContextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // "Generate Quiz" button inside menu
    document.getElementById('quiz-context-generate-btn').addEventListener('click', () => {
        hideContextMenu();
        startQuizGeneration(highlightedTextForQuiz);
    });
}

function showContextMenu(x, y) {
    quizContextMenu.style.display = 'block';
    // Adjust so it doesn't go off screen
    const menuW = quizContextMenu.offsetWidth || 220;
    const menuH = quizContextMenu.offsetHeight || 60;
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
    // Reset state
    quizQuestions = [];
    quizCurrentIndex = 0;
    quizScore = 0;
    quizAnswered = false;
}

// ─── Ollama Prompt Builder ────────────────────────────────────────────────────
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

Now generate exactly ${QUIZ_CONFIG.targetQuestions} MCQ questions covering ALL major concepts in the following text. Each question must test a distinct concept:

---
${text.substring(0, 3500)}
---

Output only the Q/A blocks. Begin now:`;
}

// ─── Ollama API Call ──────────────────────────────────────────────────────────
async function callOllama(prompt) {
    const response = await fetch(QUIZ_CONFIG.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: QUIZ_CONFIG.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                num_predict: 2048,
            }
        })
    });
    if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}. Is Ollama running?`);
    }
    const data = await response.json();
    return data.response || '';
}

// ─── Parser ───────────────────────────────────────────────────────────────────
/**
 * Parses LLM output into question objects.
 * Robust: ignores filler lines, handles multi-line noise between Q/A pairs.
 *
 * Expected per block:
 *   Q: <question>
 *   A: <opt1> | <opt2> | <opt3> | <opt4> | <correct letter A-D>
 *
 * Returns array of { question, options:[4], correctIndex:0-3 }
 */
function parseQuizOutput(raw) {
    const lines = raw.split('\n');
    const questions = [];

    let pendingQuestion = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match Q line
        const qMatch = line.match(/^Q\s*[:：]\s*(.+)/i);
        if (qMatch) {
            pendingQuestion = qMatch[1].trim();
            continue;
        }

        // Match A line (only if we have a pending question)
        if (pendingQuestion !== null) {
            const aMatch = line.match(/^A\s*[:：]\s*(.+)/i);
            if (aMatch) {
                const parts = aMatch[1].split('|').map(s => s.trim()).filter(s => s.length > 0);

                // We need exactly 5 parts: 4 options + 1 correct letter
                if (parts.length === 5) {
                    const correctLetter = parts[4].toUpperCase().replace(/[^A-D]/g, '');
                    const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[correctLetter];

                    if (correctIndex !== undefined) {
                        // Generate a plausible explanation using the question context
                        const explanation = buildExplanation(pendingQuestion, parts[correctIndex]);
                        const focusConcept = extractConcept(pendingQuestion);

                        questions.push({
                            question: pendingQuestion,
                            options: [parts[0], parts[1], parts[2], parts[3]],
                            correctIndex,
                            explanation,
                            focusConcept,
                        });
                    }
                } else if (parts.length >= 5) {
                    // Sometimes the model adds extra text after the letter — handle gracefully
                    const correctLetter = parts[parts.length - 1].charAt(0).toUpperCase();
                    const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[correctLetter];
                    if (correctIndex !== undefined && parts.length >= 5) {
                        const explanation = buildExplanation(pendingQuestion, parts[correctIndex - 1] || parts[0]);
                        const focusConcept = extractConcept(pendingQuestion);
                        questions.push({
                            question: pendingQuestion,
                            options: [parts[0], parts[1], parts[2], parts[3]],
                            correctIndex,
                            explanation,
                            focusConcept,
                        });
                    }
                }
                pendingQuestion = null;
            }
        }
    }

    return questions;
}

/** Build a short explanation sentence for the correct answer */
function buildExplanation(question, correctOption) {
    // Simple template — provides meaningful feedback without needing another LLM call
    const qLower = question.toLowerCase();
    if (qLower.includes('not') || qLower.includes('except') || qLower.includes('incorrect')) {
        return `The other options are valid concepts. "${correctOption}" is the exception because it does not fit the described scenario.`;
    }
    return `The correct answer is "${correctOption}". Review the relevant passage to understand why this concept applies here.`;
}

/** Extract a likely concept keyword from a question string */
function extractConcept(question) {
    // Remove common question words and keep noun phrases
    const stopWords = ['what', 'which', 'who', 'when', 'where', 'how', 'why', 'is', 'are', 'does', 'do',
        'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'that', 'this', 'was', 'were',
        'not', 'and', 'or', 'but', 'can', 'would', 'could', 'should', 'must', 'refers', 'defined',
        'describe', 'term', 'used', 'primarily', 'mainly', 'best', 'following'];
    const words = question.replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
    const keyWords = words.filter(w => w.length > 3 && !stopWords.includes(w.toLowerCase()));
    // Return the first 3 meaningful words as the concept label
    return keyWords.slice(0, 3).join(' ') || 'this topic';
}

// ─── Quiz Generation Entry Point ─────────────────────────────────────────────
async function startQuizGeneration(text) {
    // Reset state
    quizQuestions = [];
    quizCurrentIndex = 0;
    quizScore = 0;
    quizAnswered = false;

    openQuizModal();
    showScreen('loading');
    setLoadingMessage('🤖 Connecting to Ollama (gemma3:1b)...');

    try {
        const prompt = buildPrompt(text);
        setLoadingMessage('✍️ Generating questions from your selection...');

        let rawOutput = await callOllama(prompt);
        let parsed = parseQuizOutput(rawOutput);

        // If we got fewer than minimum, try once more with a more direct prompt
        if (parsed.length < QUIZ_CONFIG.minQuestions) {
            setLoadingMessage(`⚠️ Only got ${parsed.length} questions. Requesting more...`);
            const retryPrompt = buildRetryPrompt(text, parsed.length);
            const retryOutput = await callOllama(retryPrompt);
            const retryParsed = parseQuizOutput(retryOutput);

            // Merge and deduplicate by question text
            const existing = new Set(parsed.map(q => q.question));
            retryParsed.forEach(q => {
                if (!existing.has(q.question)) {
                    parsed.push(q);
                    existing.add(q.question);
                }
            });
        }

        if (parsed.length === 0) {
            throw new Error('Could not parse any questions from the model output. Try selecting more text.');
        }

        // Shuffle questions for variety
        quizQuestions = shuffleArray(parsed);
        setLoadingMessage(`✅ ${quizQuestions.length} questions ready!`);

        await sleep(600);
        renderQuestion(0);
        showScreen('question');

    } catch (err) {
        showScreen('loading');
        setLoadingMessage(`❌ Error: ${err.message}`);
        const retryEl = document.getElementById('quiz-error-hint');
        if (retryEl) retryEl.style.display = 'block';
    }
}

function buildRetryPrompt(text, gotSoFar) {
    return `Generate ${QUIZ_CONFIG.targetQuestions - gotSoFar} more MCQ questions about this text.
Use ONLY this format per question (nothing else):
Q: <question>
A: <option A> | <option B> | <option C> | <option D> | <correct letter A/B/C/D>

Text:
---
${text.substring(0, 2000)}
---
Begin:`;
}

// ─── Quiz Renderer ────────────────────────────────────────────────────────────
function renderQuestion(index) {
    const q = quizQuestions[index];
    quizAnswered = false;

    // Progress
    const percent = Math.round(((index) / quizQuestions.length) * 100);
    quizProgressBar.style.width = `${percent}%`;
    quizProgressText.textContent = `${index + 1} / ${quizQuestions.length}`;
    quizScoreBadge.textContent = `⭐ ${quizScore} pts`;
    quizQuestionNumber.textContent = `Question ${index + 1}`;
    quizQuestionText.textContent = q.question;

    // Build options
    quizOptionsContainer.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.id = `quiz-opt-${i}`;
        const letter = ['A', 'B', 'C', 'D'][i];
        btn.innerHTML = `<span class="quiz-opt-letter">${letter}</span><span class="quiz-opt-text">${opt}</span>`;
        btn.addEventListener('click', () => handleAnswer(i));
        quizOptionsContainer.appendChild(btn);
    });

    // Hide feedback and next button
    quizFeedbackBox.style.display = 'none';
    quizNextBtn.style.display = 'none';
}

function handleAnswer(selectedIndex) {
    if (quizAnswered) return;
    quizAnswered = true;

    const q = quizQuestions[quizCurrentIndex];
    const isCorrect = selectedIndex === q.correctIndex;

    // Style all buttons
    const optBtns = quizOptionsContainer.querySelectorAll('.quiz-option-btn');
    optBtns.forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.correctIndex) {
            btn.classList.add('correct');
        } else if (i === selectedIndex && !isCorrect) {
            btn.classList.add('incorrect');
        } else {
            btn.classList.add('dimmed');
        }
    });

    // Update score
    if (isCorrect) {
        quizScore += QUIZ_CONFIG.pointsPerCorrect;
        quizScoreBadge.textContent = `⭐ ${quizScore} pts`;
        quizScoreBadge.classList.add('score-pulse');
        setTimeout(() => quizScoreBadge.classList.remove('score-pulse'), 600);
    }

    // Show feedback
    quizFeedbackCorrect.textContent = isCorrect
        ? '✅ Correct!'
        : `❌ Wrong! Correct answer: ${['A', 'B', 'C', 'D'][q.correctIndex]}. ${q.options[q.correctIndex]}`;
    quizFeedbackCorrect.className = isCorrect ? 'quiz-feedback-verdict correct-verdict' : 'quiz-feedback-verdict wrong-verdict';
    quizFeedbackExplanation.textContent = q.explanation;
    quizFeedbackFocus.textContent = `📚 Focus on: ${q.focusConcept}`;
    quizFeedbackBox.style.display = 'block';

    // Show Next or Finish button
    const isLast = quizCurrentIndex === quizQuestions.length - 1;
    quizNextBtn.textContent = isLast ? '🏁 See Results' : 'Next →';
    quizNextBtn.style.display = 'flex';
}

function advanceQuestion() {
    const isLast = quizCurrentIndex === quizQuestions.length - 1;
    if (isLast) {
        showResults();
    } else {
        quizCurrentIndex++;
        renderQuestion(quizCurrentIndex);
    }
}

function showResults() {
    const total = quizQuestions.length * QUIZ_CONFIG.pointsPerCorrect;
    const pct = Math.round((quizScore / total) * 100);

    quizResultScore.textContent = quizScore;
    quizResultTotal.textContent = total;

    // Result message
    let msg, emoji;
    if (pct >= 90) { msg = 'Outstanding! You mastered this section! 🎓'; emoji = '🏆'; }
    else if (pct >= 70) { msg = 'Great work! Review the missed concepts.'; emoji = '🌟'; }
    else if (pct >= 50) { msg = 'Good effort! Revisit the highlighted section.'; emoji = '📖'; }
    else { msg = 'Keep practising — re-read the material and try again!'; emoji = '💪'; }

    quizResultMsg.innerHTML = `<span class="result-emoji">${emoji}</span> ${msg}`;
    document.getElementById('quiz-result-pct').textContent = `${pct}%`;

    // Donut progress (CSS custom property)
    document.getElementById('quiz-result-ring').style.setProperty('--pct', pct);

    showScreen('result');
}

// ─── Screen Switcher ──────────────────────────────────────────────────────────
function showScreen(name) {
    quizLoadingScreen.style.display  = name === 'loading'  ? 'flex' : 'none';
    quizQuestionScreen.style.display = name === 'question' ? 'flex' : 'none';
    quizResultScreen.style.display   = name === 'result'   ? 'flex' : 'none';
}

function setLoadingMessage(msg) {
    quizLoadingMsg.textContent = msg;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
