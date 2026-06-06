/**
 * EIPR Fog of War — AI Guide Module (fog-guide.js)
 * ─────────────────────────────────────────────────
 * Manages:
 *   • Sequential topic unlock state (textbook order)
 *   • Progress tracking & persistence (localStorage)
 *   • AI Guide chat (gemma3:1b via Ollama)
 *   • Quick-action buttons & course skeleton awareness
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const FOG_CONFIG = {
    ollamaUrl: 'http://localhost:11434/api/generate',
    model: 'gemma3:1b',
    storageKey: 'eipr_fog_progress',
    chatHistoryKey: 'eipr_fog_chat',
};

// ── FogGuide Singleton ─────────────────────────────────────────────────────────
const FogGuide = (() => {

    // ─── State ─────────────────────────────────────────────────────────────────
    let progressState = {
        completed_topics: [],
        current_recommended: null,
        last_opened: null,
    };

    let chatHistory = [];
    let courseOutline = [];  // flat ordered list of {id, title, depth, parentTitle}
    let isGuideOpen = false;

    // ─── Course Skeleton Builder ───────────────────────────────────────────────
    function buildCourseOutline(node, result = [], parentTitle = '') {
        if (!node) return result;
        result.push({
            id: node.id,
            title: node.title,
            node_type: node.node_type,
            depth: node.depth || 0,
            parentTitle: parentTitle,
            hasContent: !!(node.content && node.content.length > 0),
            childCount: node.children ? node.children.length : 0,
        });
        if (node.children) {
            node.children.forEach(child => buildCourseOutline(child, result, node.title));
        }
        return result;
    }

    // ─── Get All Learnable Topics (depth >= 2 = topics, subtopics, concepts) ──
    function getLearnableTopics() {
        return courseOutline.filter(n =>
            n.node_type === 'topic' ||
            n.node_type === 'subtopic' ||
            n.node_type === 'concept' ||
            n.node_type === 'case_study' ||
            n.node_type === 'example' ||
            n.node_type === 'activity'
        );
    }

    // Get topics for a specific unit
    function getUnitTopics(unitId) {
        const allTopics = getLearnableTopics();
        return allTopics.filter(t => t.id.startsWith(unitId + '.'));
    }

    // ─── Progress Persistence ──────────────────────────────────────────────────
    function loadProgress() {
        try {
            const saved = localStorage.getItem(FOG_CONFIG.storageKey);
            if (saved) {
                progressState = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[FogGuide] Could not load progress:', e);
        }

        try {
            const savedChat = localStorage.getItem(FOG_CONFIG.chatHistoryKey);
            if (savedChat) {
                chatHistory = JSON.parse(savedChat);
            }
        } catch (e) { /* ignore */ }
    }

    function saveProgress() {
        try {
            localStorage.setItem(FOG_CONFIG.storageKey, JSON.stringify(progressState));
        } catch (e) {
            console.warn('[FogGuide] Could not save progress:', e);
        }
    }

    function saveChatHistory() {
        try {
            // Keep last 50 messages
            const toSave = chatHistory.slice(-50);
            localStorage.setItem(FOG_CONFIG.chatHistoryKey, JSON.stringify(toSave));
        } catch (e) { /* ignore */ }
    }

    // ─── Sequential Unlock Logic ───────────────────────────────────────────────
    function getTopicState(topicId) {
        if (progressState.completed_topics.includes(topicId)) return 'completed';
        if (progressState.current_recommended === topicId) return 'recommended';
        if (progressState.last_opened === topicId) return 'open';
        return 'locked';
    }

    function isTopicUnlocked(topicId) {
        const state = getTopicState(topicId);
        return state === 'completed' || state === 'recommended' || state === 'open';
    }

    function markTopicCompleted(topicId) {
        if (!progressState.completed_topics.includes(topicId)) {
            progressState.completed_topics.push(topicId);
        }

        // Find next topic in sequence
        const learnables = getLearnableTopics();
        const currentIdx = learnables.findIndex(t => t.id === topicId);

        if (currentIdx !== -1 && currentIdx < learnables.length - 1) {
            progressState.current_recommended = learnables[currentIdx + 1].id;
        } else {
            progressState.current_recommended = null; // All done!
        }

        saveProgress();
        updateDashboardUI();
        return progressState.current_recommended;
    }

    function setCurrentRecommended(topicId) {
        progressState.current_recommended = topicId;
        saveProgress();
    }

    function setLastOpened(topicId) {
        progressState.last_opened = topicId;
        saveProgress();
    }

    // ─── Progress Calculation ──────────────────────────────────────────────────
    function getOverallProgress() {
        const learnables = getLearnableTopics();
        if (learnables.length === 0) return { completed: 0, total: 0, percent: 0 };
        const completed = progressState.completed_topics.length;
        return {
            completed,
            total: learnables.length,
            percent: Math.round((completed / learnables.length) * 100),
        };
    }

    function getUnitProgress(unitId) {
        const unitTopics = getUnitTopics(unitId);
        if (unitTopics.length === 0) return { completed: 0, total: 0, percent: 0 };
        const completed = unitTopics.filter(t =>
            progressState.completed_topics.includes(t.id)
        ).length;
        return {
            completed,
            total: unitTopics.length,
            percent: Math.round((completed / unitTopics.length) * 100),
        };
    }

    // ─── Course Outline for AI Context ─────────────────────────────────────────
    function getCourseSkeletonText() {
        // Build a concise text representation for the AI guide
        let text = 'Course Structure:\n';
        courseOutline.forEach(n => {
            if (n.node_type === 'course') return;
            const indent = '  '.repeat(Math.max(0, n.depth - 1));
            const status = getTopicState(n.id);
            const marker = status === 'completed' ? '✅' :
                           status === 'recommended' ? '👉' :
                           status === 'open' ? '⭐' : '🔒';
            text += `${indent}${marker} ${n.title}\n`;
        });
        return text;
    }

    function getProgressSummaryText() {
        const prog = getOverallProgress();
        const recommended = courseOutline.find(n => n.id === progressState.current_recommended);
        let text = `Progress: ${prog.completed}/${prog.total} topics completed (${prog.percent}%).\n`;
        if (recommended) {
            text += `Current recommended topic: "${recommended.title}".\n`;
        }
        const lastCompleted = progressState.completed_topics.length > 0
            ? courseOutline.find(n => n.id === progressState.completed_topics[progressState.completed_topics.length - 1])
            : null;
        if (lastCompleted) {
            text += `Last completed: "${lastCompleted.title}".\n`;
        }
        return text;
    }

    // ─── AI Guide Chat ─────────────────────────────────────────────────────────
    async function sendChatMessage(userMessage) {
        chatHistory.push({ role: 'user', content: userMessage });
        saveChatHistory();

        const systemPrompt = `You are Gemma, the EIPR Learning Guide — a friendly, encouraging AI tutor helping students navigate the "Entrepreneurship and Intellectual Property Rights" course.

Your role:
- Guide students through topics in TEXTBOOK ORDER (the order below)
- Explain why each topic matters and connects to previous ones
- Give brief, helpful summaries when asked about a topic
- Encourage the student and celebrate their progress
- Suggest when to take quizzes or review concepts
- Keep responses concise (2-4 sentences max unless asked for detail)

${getCourseSkeletonText()}

${getProgressSummaryText()}

Recent chat context:
${chatHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}`;

        try {
            const response = await fetch(FOG_CONFIG.ollamaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: FOG_CONFIG.model,
                    prompt: userMessage,
                    system: systemPrompt,
                    stream: false,
                }),
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
            const data = await response.json();
            const reply = data.response || 'I couldn\'t generate a response. Please try again.';

            chatHistory.push({ role: 'assistant', content: reply });
            saveChatHistory();
            return reply;
        } catch (error) {
            console.warn('[FogGuide] Ollama error, using fallback:', error);
            const fallback = generateFallbackResponse(userMessage);
            chatHistory.push({ role: 'assistant', content: fallback });
            saveChatHistory();
            return fallback;
        }
    }

    function generateFallbackResponse(userMessage) {
        const msg = userMessage.toLowerCase();
        const prog = getOverallProgress();
        const recommended = courseOutline.find(n => n.id === progressState.current_recommended);

        if (msg.includes('next') || msg.includes('what should') || msg.includes('recommend')) {
            if (recommended) {
                return `📚 Your next recommended topic is "${recommended.title}". Click on it in the graph to start exploring! Keep up the great pace — you've completed ${prog.percent}% of the course.`;
            }
            return `🎉 Amazing! You've completed all available topics! Consider reviewing any topics you found challenging.`;
        }

        if (msg.includes('progress') || msg.includes('how am i') || msg.includes('status')) {
            return `📊 You've completed ${prog.completed} out of ${prog.total} topics (${prog.percent}%). ${prog.percent < 30 ? 'You\'re just getting started — every step counts!' : prog.percent < 70 ? 'Great progress! Keep it up!' : 'Almost there — you\'re doing amazing!'}`;
        }

        if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
            return `👋 Hello! I'm Gemma, your EIPR learning guide. I'm here to help you navigate through the course topics in order. ${recommended ? `Your next recommended topic is "${recommended.title}".` : 'You\'re all caught up!'} Ask me anything!`;
        }

        if (msg.includes('summary') || msg.includes('summarize') || msg.includes('review')) {
            const lastCompleted = progressState.completed_topics.length > 0
                ? courseOutline.find(n => n.id === progressState.completed_topics[progressState.completed_topics.length - 1])
                : null;
            if (lastCompleted) {
                return `📝 Your last completed topic was "${lastCompleted.title}". You've covered ${prog.completed} topics so far. ${recommended ? `Next up is "${recommended.title}" — ready to dive in?` : 'You\'ve completed everything!'}`;
            }
            return `📝 You haven't started any topics yet. Let's begin with the first recommended topic!`;
        }

        if (msg.includes('help') || msg.includes('what can')) {
            return `🤖 I can help you with:\n• "What's next?" — See your recommended topic\n• "Progress" — Check your completion status\n• "Summary" — Review what you've covered\n• "Tell me about [topic]" — Learn about a specific topic\nJust ask away!`;
        }

        // Default
        if (recommended) {
            return `I'm here to help! Your current focus should be "${recommended.title}". You're ${prog.percent}% through the course. Feel free to ask me about any topic or for guidance!`;
        }
        return `I'm here to help! You're ${prog.percent}% through the course. Ask me anything about the topics or your progress!`;
    }

    // ─── Quick Actions ─────────────────────────────────────────────────────────
    function getQuickActions() {
        const recommended = courseOutline.find(n => n.id === progressState.current_recommended);
        const actions = [];

        actions.push({
            label: '📊 My Progress',
            message: 'What is my current progress?',
        });

        if (recommended) {
            actions.push({
                label: '➡️ Next Topic',
                message: 'What should I study next?',
            });
        }

        actions.push({
            label: '📝 Session Summary',
            message: 'Give me a summary of what I\'ve covered so far.',
        });

        actions.push({
            label: '❓ Help',
            message: 'What can you help me with?',
        });

        return actions;
    }

    // ─── Dashboard UI Update ───────────────────────────────────────────────────
    function updateDashboardUI() {
        const prog = getOverallProgress();

        // Update progress bar
        const progressFill = document.getElementById('fog-progress-fill');
        const progressText = document.getElementById('fog-progress-text');
        const progressPct = document.getElementById('fog-progress-pct');

        if (progressFill) progressFill.style.width = `${prog.percent}%`;
        if (progressText) progressText.textContent = `${prog.completed} / ${prog.total} topics`;
        if (progressPct) progressPct.textContent = `${prog.percent}%`;

        // Update recommended topic display
        const recDisplay = document.getElementById('fog-recommended-topic');
        const recommended = courseOutline.find(n => n.id === progressState.current_recommended);
        if (recDisplay) {
            if (recommended) {
                recDisplay.innerHTML = `<i class="fa-solid fa-compass"></i> <span>${recommended.title}</span>`;
                recDisplay.title = recommended.title;
            } else {
                recDisplay.innerHTML = `<i class="fa-solid fa-check-double"></i> <span>All topics completed!</span>`;
            }
        }

        // Update unit progress indicators
        document.querySelectorAll('[data-unit-progress]').forEach(el => {
            const unitId = el.getAttribute('data-unit-progress');
            const unitProg = getUnitProgress(unitId);
            el.textContent = `${unitProg.percent}%`;
        });
    }

    // ─── Chat UI Management ────────────────────────────────────────────────────
    function renderChatHistory() {
        const chatContainer = document.getElementById('fog-chat-messages');
        if (!chatContainer) return;

        chatContainer.innerHTML = '';

        if (chatHistory.length === 0) {
            chatContainer.innerHTML = `
                <div class="fog-chat-welcome">
                    <i class="fa-solid fa-robot"></i>
                    <p>Hi! I'm <strong>Gemma</strong>, your learning guide. Ask me anything about the course or say "next topic" to continue!</p>
                </div>`;
            return;
        }

        chatHistory.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `fog-chat-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;
            bubble.textContent = msg.content;
            chatContainer.appendChild(bubble);
        });

        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function handleChatSubmit(inputEl) {
        const message = inputEl.value.trim();
        if (!message) return;

        inputEl.value = '';
        inputEl.disabled = true;

        // Render user message immediately
        renderChatHistory();

        // Show typing indicator
        const chatContainer = document.getElementById('fog-chat-messages');
        const typingEl = document.createElement('div');
        typingEl.className = 'fog-chat-bubble assistant typing';
        typingEl.innerHTML = '<span class="fog-typing-dots"><span></span><span></span><span></span></span>';
        chatContainer.appendChild(typingEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const reply = await sendChatMessage(message);

        // Remove typing indicator and render
        if (typingEl.parentNode) typingEl.remove();
        renderChatHistory();
        inputEl.disabled = false;
        inputEl.focus();
    }

    // ─── Initialize ────────────────────────────────────────────────────────────
    function init(hierarchyData) {
        courseOutline = buildCourseOutline(hierarchyData);
        loadProgress();

        // If no recommended topic is set, find the first un-completed learnable
        if (!progressState.current_recommended) {
            const learnables = getLearnableTopics();
            const firstUncompleted = learnables.find(t =>
                !progressState.completed_topics.includes(t.id)
            );
            if (firstUncompleted) {
                progressState.current_recommended = firstUncompleted.id;
                saveProgress();
            }
        }

        // Wire up chat UI
        setTimeout(() => {
            const chatInput = document.getElementById('fog-chat-input');
            const chatSendBtn = document.getElementById('fog-chat-send');

            if (chatInput) {
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit(chatInput);
                    }
                });
            }

            if (chatSendBtn && chatInput) {
                chatSendBtn.addEventListener('click', () => handleChatSubmit(chatInput));
            }

            // Quick action buttons
            const quickActionsContainer = document.getElementById('fog-quick-actions');
            if (quickActionsContainer) {
                renderQuickActions(quickActionsContainer);
            }

            // Mark completed button
            const markCompleteBtn = document.getElementById('fog-mark-complete-btn');
            if (markCompleteBtn) {
                markCompleteBtn.addEventListener('click', () => {
                    const topicToComplete = progressState.current_recommended || progressState.last_opened;
                    if (topicToComplete) {
                        const next = markTopicCompleted(topicToComplete);
                        const completedTopic = courseOutline.find(n => n.id === topicToComplete);
                        const nextTopic = next ? courseOutline.find(n => n.id === next) : null;

                        // Add a congratulatory message to chat
                        const congrats = nextTopic
                            ? `🎉 Great job completing "${completedTopic?.title}"! Your next topic is "${nextTopic.title}". Keep going!`
                            : `🏆 Congratulations! You've completed "${completedTopic?.title}" and finished all available topics!`;
                        chatHistory.push({ role: 'assistant', content: congrats });
                        saveChatHistory();
                        renderChatHistory();

                        // Dispatch event for app.js to re-render graph
                        window.dispatchEvent(new CustomEvent('fog-progress-updated'));
                    }
                });
            }

            // Toggle guide panel
            const toggleBtn = document.getElementById('fog-toggle-guide');
            const guidePanel = document.getElementById('fog-guide-panel');
            if (toggleBtn && guidePanel) {
                toggleBtn.addEventListener('click', () => {
                    isGuideOpen = !isGuideOpen;
                    guidePanel.classList.toggle('open', isGuideOpen);
                    toggleBtn.classList.toggle('active', isGuideOpen);
                    if (isGuideOpen) {
                        renderChatHistory();
                        updateDashboardUI();
                    }
                });
            }

            updateDashboardUI();
            renderChatHistory();
        }, 100);
    }

    function renderQuickActions(container) {
        container.innerHTML = '';
        const actions = getQuickActions();
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'fog-quick-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => {
                const chatInput = document.getElementById('fog-chat-input');
                if (chatInput) {
                    chatInput.value = action.message;
                    handleChatSubmit(chatInput);
                }
            });
            container.appendChild(btn);
        });
    }

    // ─── Reset Progress ────────────────────────────────────────────────────────
    function resetProgress() {
        progressState = {
            completed_topics: [],
            current_recommended: null,
            last_opened: null,
        };
        chatHistory = [];

        const learnables = getLearnableTopics();
        if (learnables.length > 0) {
            progressState.current_recommended = learnables[0].id;
        }

        saveProgress();
        saveChatHistory();
        updateDashboardUI();
        renderChatHistory();
        window.dispatchEvent(new CustomEvent('fog-progress-updated'));
    }

    // ─── Public API ────────────────────────────────────────────────────────────
    return {
        init,
        getTopicState,
        isTopicUnlocked,
        markTopicCompleted,
        setLastOpened,
        setCurrentRecommended,
        getOverallProgress,
        getUnitProgress,
        updateDashboardUI,
        renderChatHistory,
        resetProgress,
        getProgressState: () => progressState,
        getCourseOutline: () => courseOutline,
    };
})();
