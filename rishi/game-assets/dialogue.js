/* ==================================================
   dialogue.js – All NPC Dialogues (5 Sessions),
   Choice-based conversations, Quest integration
   ================================================== */

/* ── NPC Portraits ─────────────────────────────── */
const NPC_PORTRAITS = {
    elder: "🧙", farmer: "👨‍🌾", teacher: "👩‍🏫",
    merchant: "🧑‍💼", student: "👦",
    bakery: "👩‍🍳",
    prof_spark: "🔬", asha: "👩‍💻",
    ravi: "🌍", mr_kumar: "🏪",
    team_leader: "🦸", investor: "💰", engineer: "⚙️",
    spirit1: "👻", spirit2: "🌀", spirit3: "⚡", spirit4: "🌑",
    myth_keeper: "🐉", startup_mentor: "🎯",
    default: "🗣️"
};

/* ── All Dialogues ─────────────────────────────── */
const dialogues = {

    /* ─── SESSION 1: DREAMER'S VILLAGE ─── */
    elder: [
        { speaker: "Village Elder", text: "Ah, a traveller arrives at last. Welcome to Dreamer's Village, young one. I am the Elder who has watched this place for fifty years." },
        { speaker: "Village Elder", text: "Once, our village thrived. People had purpose, income, and hope. Now many struggle without knowing why." },
        { speaker: "Village Elder", text: "I believe there is an answer — something the great teachers called 'entrepreneurship.' But I am old. I need young eyes to find it." },
        { speaker: "Village Elder", text: "Will you help me? Speak with our Farmer, Teacher, Merchant and Student. Learn their struggles. Then return to me.", isQuestStart: true }
    ],

    elder_complete: [
        { speaker: "Village Elder", text: "You have spoken to everyone. Tell me — what did you discover?" },
        {
            speaker: "Village Elder",
            text: "Each villager described a different problem. The farmer cannot reach customers. The teacher sees wasted potential. The merchant faces falling demand. The student has ideas but no path.",
            choices: [
                { text: "These sound like opportunities, not just problems!", next: "elder_c1" },
                { text: "It sounds like the village just needs more jobs.", next: "elder_c2" }
            ]
        }
    ],
    elder_c1: [
        { speaker: "Village Elder", text: "Exactly! You think like an entrepreneur. Problems ARE opportunities. Someone who sees a problem and creates a solution — that is an entrepreneur." },
        { speaker: "Village Elder", text: "You have earned this village's trust. Take these Problem Reports. The Entrepreneur's Guild to the north may hold further answers.", isQuestComplete: "s1_main" }
    ],
    elder_c2: [
        { speaker: "Village Elder", text: "Jobs are created BY entrepreneurs, young one. If we wait for someone else to create them, we wait forever. We must create value ourselves." },
        { speaker: "Village Elder", text: "Think again. Look at the Farmer's problem — could someone innovative solve it? That someone could be YOU.", continueNext: "elder_c1" }
    ],

    farmer: [
        { speaker: "Farmer", text: "Ah, careful there! Don't trample the seedlings. I've been farming this land for twenty years." },
        { speaker: "Farmer", text: "The crops are good this year. But I earn barely enough. I sell only to buyers who come to me — maybe 20 people a week." },
        { speaker: "Farmer", text: "I sometimes wonder — is there a way to reach customers in the city? To sell my produce directly without middlemen taking most of the profit?" },
        {
            speaker: "Farmer",
            text: "What do you think I should do?",
            choices: [
                { text: "You could sell online or at a city market!", next: "farmer_c1" },
                { text: "Maybe you need to grow more crops.", next: "farmer_c2" }
            ]
        }
    ],
    farmer_c1: [
        { speaker: "Farmer", text: "Online! I never thought of that. My nephew in the city uses something called 'digital marketing'. Maybe that could help me reach more customers!" },
        { speaker: "Farmer", text: "You've given me something to think about. Here, take this report about the farm's problems for the Village Elder.", givesItem: { icon: "📄", name: "Farm Problem Report" } }
    ],
    farmer_c2: [
        { speaker: "Farmer", text: "More crops won't help if I can't sell what I already have! The problem isn't production — it's distribution and reach." },
        { speaker: "Farmer", text: "An entrepreneur would find a new market, not just make more of the same. Something to think about...", continueNext: "farmer_c1" }
    ],

    teacher: [
        { speaker: "Teacher", text: "Welcome! Oh, it's wonderful to have a visitor. Please, sit. I was just finishing today's lesson." },
        { speaker: "Teacher", text: "I teach 30 students here. Bright, capable young people. But they all dream of only one thing — getting a job at the district office or big company." },
        { speaker: "Teacher", text: "No one thinks about creating their own opportunity. They see themselves as job seekers, never job creators." },
        { speaker: "Teacher", text: "What do you think is missing from how we teach young people?",
            choices: [
                { text: "They need to learn about entrepreneurship!", next: "teacher_c1" },
                { text: "More job placements would help.", next: "teacher_c2" }
            ]
        }
    ],
    teacher_c1: [
        { speaker: "Teacher", text: "Yes! Entrepreneurship education. Teaching them to identify problems, create solutions, take calculated risks." },
        { speaker: "Teacher", text: "Value creation over job hunting. That mindset could transform this village. Take this note for the Elder.", givesItem: { icon: "📄", name: "Education Problem Report" } }
    ],
    teacher_c2: [
        { speaker: "Teacher", text: "Job placements help in the short term, but if there are no jobs to place them in, then what? We'd need to create the jobs first." },
        { speaker: "Teacher", text: "Someone with an entrepreneurial mindset creates those jobs. That's what's truly missing.", continueNext: "teacher_c1" }
    ],

    merchant: [
        { speaker: "Merchant", text: "Welcome to my shop! Though 'thriving' is not the word I'd use these days..." },
        { speaker: "Merchant", text: "I used to sell 100 items a week. Now barely 40. Customers have more choices — online stores, bigger shops in the city." },
        { speaker: "Merchant", text: "I keep doing what worked 10 years ago. But the world has changed and I... haven't adapted." },
        { speaker: "Merchant", text: "How do you think a small shop survives in this modern world?",
            choices: [
                { text: "Focus on what makes you unique — personal service, local products!", next: "merchant_c1" },
                { text: "You should lower your prices to compete.", next: "merchant_c2" }
            ]
        }
    ],
    merchant_c1: [
        { speaker: "Merchant", text: "Personal service! You're right. No online store can give the community feel that I can. I could focus on local, unique products that they can't buy elsewhere." },
        { speaker: "Merchant", text: "That is entrepreneurial thinking — finding your niche. Here's my report on market challenges.", givesItem: { icon: "📄", name: "Market Problem Report" } }
    ],
    merchant_c2: [
        { speaker: "Merchant", text: "I can't win a price war with massive companies. They'll always be cheaper. Racing to the bottom destroys everyone." },
        { speaker: "Merchant", text: "Entrepreneurs differentiate — they don't just compete on price. They find what makes them irreplaceable.", continueNext: "merchant_c1" }
    ],

    student: [
        { speaker: "Student", text: "Oh! Hi! Are you new here? I've never seen you before." },
        { speaker: "Student", text: "I have this idea — a mobile app that connects farmers directly to city buyers. No middlemen. Fresh produce, better prices for everyone." },
        { speaker: "Student", text: "But everyone tells me to just study hard and get a stable job. Apps are risky. What if it fails?" },
        { speaker: "Student", text: "Do you think it's worth pursuing an idea even when it's risky?",
            choices: [
                { text: "Absolutely! Calculated risk is part of entrepreneurship.", next: "student_c1" },
                { text: "Maybe play it safe and get the job first.", next: "student_c2" }
            ]
        }
    ],
    student_c1: [
        { speaker: "Student", text: "Calculated risk! So I shouldn't jump blindly — I should research, plan, start small, test it." },
        { speaker: "Student", text: "You know, your idea could literally help the Farmer I just met too! Every problem you heard today could be solved by one innovative solution." },
        { speaker: "Student", text: "Here — take this note about my idea for the Elder. Maybe innovation IS the answer this village needs.", givesItem: { icon: "📄", name: "Innovation Problem Report" } }
    ],
    student_c2: [
        { speaker: "Student", text: "But what if there are no jobs? Or the job makes me miserable? I'd have wasted years..." },
        { speaker: "Student", text: "The farmer needs what I'm thinking of. The merchant too. Maybe solving their problems IS the safe path — because people need it.", continueNext: "student_c1" }
    ],

    /* ─── SESSION 2: ENTREPRENEUR GUILD ─── */
    prof_spark: [
        { speaker: "Prof. Spark", text: "Welcome to the Entrepreneur's Guild! I'm Professor Spark, director of the Innovation Lab." },
        { speaker: "Prof. Spark", text: "You come from Dreamer's Village? Good timing. We study entrepreneurship here — the science and art of creating value." },
        { speaker: "Prof. Spark", text: "My team represents the four major types of entrepreneurs. Speak with each of them. Then return and tell me what connects them all.", isQuestStart: true }
    ],
    prof_spark_complete: [
        { speaker: "Prof. Spark", text: "Excellent! You've met all four. Now tell me — what do all four types of entrepreneurs have in common?",
            choices: [
                { text: "They all solve problems and create value!", next: "spark_c1" },
                { text: "They all make lots of money.", next: "spark_c2" }
            ]
        }
    ],
    spark_c1: [
        { speaker: "Prof. Spark", text: "Perfect! Regardless of type — tech, social, online, or local — every entrepreneur identifies a need and creates something valuable to meet it." },
        { speaker: "Prof. Spark", text: "The method differs. The motivation differs. But the core act — solving a real problem — is universal.", isQuestComplete: "s2_guild" }
    ],
    spark_c2: [
        { speaker: "Prof. Spark", text: "Not quite. Ravi, the Social Entrepreneur, often reinvests all profit back into the community. And some fail financially for years before succeeding." },
        { speaker: "Prof. Spark", text: "The common thread is value creation — improving lives, solving problems, building something that matters.", continueNext: "spark_c1" }
    ],

    asha: [
        { speaker: "Asha – Inventor", text: "Oh hello! I'm in the middle of testing a solar-powered irrigation system for small farms." },
        { speaker: "Asha – Inventor", text: "I'm an Innovation Entrepreneur. I take new technology or creative ideas and build them into products or services." },
        { speaker: "Asha – Inventor", text: "My irrigation system could cut water usage by 60% and triple a small farm's yield. That's the power of applying science to real problems." },
        { speaker: "Asha – Inventor", text: "Innovation entrepreneurs thrive on curiosity. We see something broken in the world and ask: what if it could work better?", isQuestNPC: "inventor" }
    ],

    ravi: [
        { speaker: "Ravi – Social", text: "Good day! I run a social enterprise that trains unemployed youth as delivery riders and gives them fair wages and benefits." },
        { speaker: "Ravi – Social", text: "Social entrepreneurs are driven by impact, not just profit. We use business methods to solve social problems." },
        { speaker: "Ravi – Social", text: "Any profit I make goes back into expanding the programme or improving worker conditions." },
        { speaker: "Ravi – Social", text: "Business can be a force for good — not just wealth. That's what I believe.", isQuestNPC: "social" }
    ],

    mr_kumar: [
        { speaker: "Mr. Kumar – Small Biz", text: "Hello! I run five bakeries across the district. Started with one small shop twenty years ago." },
        { speaker: "Mr. Kumar – Small Biz", text: "Small business owners are the backbone of any economy. We create local jobs, serve local communities, and keep money circulating locally." },
        { speaker: "Mr. Kumar – Small Biz", text: "I don't want to be a global corporation. I want to be the best bakery in this district — reliable, quality, community-rooted." },
        { speaker: "Mr. Kumar – Small Biz", text: "Small doesn't mean unambitious. It means focused.", isQuestNPC: "smallbiz" }
    ],

    online_ent: [
        { speaker: "Priya – Online", text: "Hey! Sorry, just replying to a customer in Singapore. I run an online handicraft store — 3,000 customers across 18 countries." },
        { speaker: "Priya – Online", text: "Online entrepreneurs use digital platforms to sell, market and operate. Low overhead, global reach, 24/7 availability." },
        { speaker: "Priya – Online", text: "I started with ₹5,000 and a phone camera. Now I employ 12 artisans from this very region and ship globally." },
        { speaker: "Priya – Online", text: "The internet removed the barrier between a local artisan and a global customer. That's revolutionary.", isQuestNPC: "online" }
    ],

    /* ─── SESSION 3: MYTH FOREST ─── */
    spirit1: [
        { speaker: "Spirit of Risk 👻", text: "HALT. You wish to pass through the Myth Forest? Then face the first truth: Most people fear risk. So they never start." },
        { speaker: "Spirit of Risk 👻", text: "But an entrepreneur who takes no risk builds nothing. Answer me this — what is the difference between a reckless gamble and an entrepreneurial risk?",
            choices: [
                { text: "A calculated risk involves research, planning, and minimizing downside.", next: "spirit1_c1" },
                { text: "There is no difference — both could fail.", next: "spirit1_c2" }
            ]
        }
    ],
    spirit1_c1: [
        { speaker: "Spirit of Risk 👻", text: "Correct, mortal. A gambler bets blindly. An entrepreneur researches, tests a small prototype, learns, adjusts. Failure is a data point, not a death sentence." },
        { speaker: "Spirit of Risk 👻", text: "You may pass. But the other spirits await.", isQuestNPC: "spirit1" }
    ],
    spirit1_c2: [
        { speaker: "Spirit of Risk 👻", text: "Wrong! A gambler hopes. An entrepreneur plans. Risk can be measured and managed. You must learn this before you lead others." },
        { speaker: "Spirit of Risk 👻", text: "Think again — what separates a disciplined risk-taker from a reckless one?", continueNext: "spirit1_c1" }
    ],

    spirit2: [
        { speaker: "Spirit of Failure 🌀", text: "I am the spirit most feared. Failure. Even the word makes people stop before they begin." },
        { speaker: "Spirit of Failure 🌀", text: "Tell me — name one thing that failure teaches that success cannot.",
            choices: [
                { text: "Failure shows exactly what went wrong, so you don't repeat it.", next: "spirit2_c1" },
                { text: "Failure teaches nothing — success is what matters.", next: "spirit2_c2" }
            ]
        }
    ],
    spirit2_c1: [
        { speaker: "Spirit of Failure 🌀", text: "Yes! Success often obscures the path. Failure illuminates it. Every great entrepreneur — Edison, Ford, Kiran Mazumdar-Shaw — failed many times before succeeding." },
        { speaker: "Spirit of Failure 🌀", text: "Fail fast, learn faster. That is the entrepreneurial motto. Pass.", isQuestNPC: "spirit2" }
    ],
    spirit2_c2: [
        { speaker: "Spirit of Failure 🌀", text: "A dangerous mindset. Entrepreneurs who fear failure avoid experiments. Entrepreneurs who embrace it accelerate. Edison failed 1,000 times before the lightbulb." },
        { speaker: "Spirit of Failure 🌀", text: "Without failure there is no learning. Without learning there is no growth.", continueNext: "spirit2_c1" }
    ],

    spirit3: [
        { speaker: "Spirit of Competition ⚡", text: "I am competition. Most see me as an enemy. But entrepreneurs with wisdom see me differently." },
        { speaker: "Spirit of Competition ⚡", text: "How should an entrepreneur respond to a powerful competitor entering their market?",
            choices: [
                { text: "Differentiate — find a unique niche they can't easily copy.", next: "spirit3_c1" },
                { text: "Give up — you can't beat a bigger competitor.", next: "spirit3_c2" }
            ]
        }
    ],
    spirit3_c1: [
        { speaker: "Spirit of Competition ⚡", text: "Precisely! Amazon can't be your local corner shop. Google can't be your village's trusted advisor. Niche, personalization and community are your weapons." },
        { speaker: "Spirit of Competition ⚡", text: "I am not your enemy. I am what keeps you innovating. Pass.", isQuestNPC: "spirit3" }
    ],
    spirit3_c2: [
        { speaker: "Spirit of Competition ⚡", text: "Surrender? Then you were never a true entrepreneur. Competition is proof that a market exists — proof that people want what you offer." },
        { speaker: "Spirit of Competition ⚡", text: "Focus on differentiation, not confrontation.", continueNext: "spirit3_c1" }
    ],

    spirit4: [
        { speaker: "Spirit of Doubt 🌑", text: "I am the final and deadliest spirit. I live inside you. I whisper: Who are you to build something? What if you are not good enough?" },
        { speaker: "Spirit of Doubt 🌑", text: "How does an entrepreneur silence doubt and take the first step?",
            choices: [
                { text: "Start small — take one action, however tiny, to prove momentum is possible.", next: "spirit4_c1" },
                { text: "Wait until you feel completely confident and ready.", next: "spirit4_c2" }
            ]
        }
    ],
    spirit4_c1: [
        { speaker: "Spirit of Doubt 🌑", text: "Action is the antidote to doubt. Confidence comes FROM doing, not before it. No entrepreneur felt fully ready — they started anyway." },
        { speaker: "Spirit of Doubt 🌑", text: "You have defeated all four spirits. The Myth Keeper awaits. Are you ready?", isQuestNPC: "spirit4" }
    ],
    spirit4_c2: [
        { speaker: "Spirit of Doubt 🌑", text: "Then you will never start. Confidence is not a prerequisite — it is a byproduct of action. Every step you take silences a little of me." },
        { speaker: "Spirit of Doubt 🌑", text: "Waiting for perfect conditions is the enemy of progress. The time is never perfect. Begin anyway.", continueNext: "spirit4_c1" }
    ],

    myth_keeper: [
        { speaker: "Myth Keeper 🐉", text: "So. You defeated my Spirits. You show promise, young entrepreneur." },
        { speaker: "Myth Keeper 🐉", text: "But promise without action is still myth. My final question: What is the single most important quality an entrepreneur must have?" },
        {
            speaker: "Myth Keeper 🐉",
            text: "Choose wisely.",
            choices: [
                { text: "Resilience — the ability to persist through failure, doubt and obstacles.", next: "keeper_c1" },
                { text: "Intelligence — being the smartest person in the room.", next: "keeper_c2" },
                { text: "Luck — being in the right place at the right time.", next: "keeper_c3" }
            ]
        }
    ],
    keeper_c1: [
        { speaker: "Myth Keeper 🐉", text: "CORRECT. Resilience is the foundation of all entrepreneurship. Intelligence helps. Luck matters. But without resilience, nothing survives the first setback." },
        { speaker: "Myth Keeper 🐉", text: "The myths are shattered. Startup Hills and Vision Peak await. You are ready, Champion.", isQuestComplete: "s3_myth" }
    ],
    keeper_c2: [
        { speaker: "Myth Keeper 🐉", text: "Intelligence alone builds nothing. The most intelligent person who quits at the first failure accomplishes less than the average person who persists for years." },
        { speaker: "Myth Keeper 🐉", text: "Think deeper.", continueNext: "keeper_c1" }
    ],
    keeper_c3: [
        { speaker: "Myth Keeper 🐉", text: "Luck favours the prepared. Entrepreneurs create their own luck through preparation, action, and persisting through repeated failure until the right moment arrives." },
        { speaker: "Myth Keeper 🐉", text: "Luck without resilience is wasted. Think again.", continueNext: "keeper_c1" }
    ],

    /* ─── SESSION 4: STARTUP HILLS ─── */
    team_leader: [
        { speaker: "Team Leader 🦸", text: "You made it to Startup Hills! I'm the team leader here. We run three startup camps training the next generation of entrepreneurs." },
        { speaker: "Team Leader 🦸", text: "Leadership in a startup isn't about authority — it's about vision. Your team must understand WHY you're building something before they commit to HOW." },
        { speaker: "Team Leader 🦸", text: "Communicate the vision. Share the mission. Inspire through purpose — not just salary.", isQuestNPC: "teamLeader" }
    ],

    investor: [
        { speaker: "Investor 💰", text: "Ah, an entrepreneur hopeful. Let me tell you what I look for when I invest in a startup." },
        { speaker: "Investor 💰", text: "First — the team. A great idea with a mediocre team fails. A mediocre idea with a great team succeeds." },
        { speaker: "Investor 💰", text: "Second — the market. Is the problem real? Is the market large enough? Have you spoken to real customers?" },
        { speaker: "Investor 💰", text: "Third — the plan. Not perfection — but evidence that you've thought through the risks and opportunities.", isQuestNPC: "investor" }
    ],

    engineer: [
        { speaker: "Engineer ⚙️", text: "Welcome! I'm building the infrastructure behind three of our startups here." },
        { speaker: "Engineer ⚙️", text: "In a startup, the engineer's role is to build things that are reliable, scalable and solvable with available resources." },
        { speaker: "Engineer ⚙️", text: "The best startup solutions are often the simplest ones. Over-engineering kills young ventures." },
        { speaker: "Engineer ⚙️", text: "Build small, test fast, improve continuously. That's the lean startup way.", isQuestNPC: "engineer" }
    ],

    startup_mentor: [
        { speaker: "Startup Mentor 🎯", text: "You've trained with all three. Now — the key lesson of Startup Hills is this:" },
        { speaker: "Startup Mentor 🎯", text: "Entrepreneurship is not a solo act. It's a team sport. No great company was built by one person alone." },
        { speaker: "Startup Mentor 🎯", text: "Vision + Team + Execution + Resilience. That is the startup formula.", isQuestComplete: "s4_hills" }
    ]
};

/* ── Dialogue Engine ───────────────────────────── */
let currentScript = [];
let currentIndex = 0;
let dialogueLocked = false;
let currentNpcId = null;
let typewriterTimer = null;

const dialogueBox  = document.getElementById("dialogue-box");
const npcName      = document.getElementById("npc-name");
const npcPortrait  = document.getElementById("npc-portrait");
const dialogueText = document.getElementById("dialogue-text");
const dialogueChoices = document.getElementById("dialogue-choices");
const nextBtn      = document.getElementById("next-btn");

dialogueBox.style.display = "none";

function startDialogue(npcId) {
    if (dialogueLocked) return;

    currentNpcId = npcId;

    // Check for quest-complete version first
    const questCheck = QuestSystem.checkQuestComplete(npcId);
    if (questCheck && dialogues[npcId + "_complete"]) {
        currentScript = dialogues[npcId + "_complete"];
    } else {
        currentScript = dialogues[npcId] || [];
    }

    if (!currentScript || currentScript.length === 0) {
        QuestSystem.showToast("(No dialogue available)");
        return;
    }

    currentIndex = 0;
    dialogueLocked = true;
    dialogueBox.style.display = "block";

    // Mark NPC as talked to for quest tracking
    QuestSystem.markNPCTalked(npcId);

    showLine(currentScript[0]);
}

function showLine(line) {
    if (!line) { closeDialogue(); return; }

    npcName.textContent = line.speaker || "???";
    // Portrait: try exact NPC id, then fuzzy match on speaker name
    npcPortrait.textContent =
        NPC_PORTRAITS[currentNpcId] ||
        Object.entries(NPC_PORTRAITS).find(([k]) => line.speaker?.toLowerCase().includes(k))?.[1] ||
        NPC_PORTRAITS.default;

    // Typewriter effect — cancel any previous
    if (typewriterTimer) clearInterval(typewriterTimer);
    dialogueText.textContent = "";
    let i = 0;
    const txt = line.text;
    typewriterTimer = setInterval(() => {
        dialogueText.textContent += txt[i];
        i++;
        if (i >= txt.length) { clearInterval(typewriterTimer); typewriterTimer = null; }
    }, 16);

    // Handle choices
    dialogueChoices.innerHTML = "";
    if (line.choices && line.choices.length > 0) {
        dialogueChoices.style.display = "flex";
        nextBtn.style.display = "none";
        line.choices.forEach(choice => {
            const btn = document.createElement("button");
            btn.className = "choice-btn";
            btn.textContent = choice.text;
            btn.addEventListener("click", () => {
                dialogueLocked = false;
                const nextScript = dialogues[choice.next];
                if (nextScript) {
                    currentScript = nextScript;
                    currentIndex = 0;
                    dialogueLocked = true;
                    showLine(currentScript[0]);
                } else {
                    closeDialogue();
                }
            });
            dialogueChoices.appendChild(btn);
        });
    } else {
        dialogueChoices.style.display = "none";
        nextBtn.style.display = "block";
    }

    // Handle items given
    if (line.givesItem) {
        QuestSystem.addItem(line.givesItem);
        QuestSystem.showToast(`Received: ${line.givesItem.icon} ${line.givesItem.name}`);
    }

    // Handle quest NPC marks
    if (line.isQuestNPC) {
        QuestSystem.markNPCTalked(line.isQuestNPC);
    }

    // Handle quest complete trigger — pass the real quest object from dialogue
    if (line.isQuestComplete) {
        const questId = line.isQuestComplete;
        setTimeout(() => {
            QuestSystem.completeQuest({ id: questId, reward: { xp: 80 } });
        }, 900);
    }

    // continueNext — auto-advance to another branch after delay
    if (line.continueNext) {
        nextBtn.style.display = "none";
        setTimeout(() => {
            const nextScript = dialogues[line.continueNext];
            if (nextScript) {
                currentScript = nextScript;
                currentIndex = 0;
                showLine(currentScript[0]);
            } else {
                closeDialogue();
            }
        }, 2400);
    }
}

nextBtn.addEventListener("click", () => {
    // Skip typewriter — show full text immediately on first click
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
        dialogueText.textContent = currentScript[currentIndex]?.text || "";
        return;
    }
    currentIndex++;
    if (currentIndex >= currentScript.length) {
        closeDialogue();
    } else {
        showLine(currentScript[currentIndex]);
    }
});

function closeDialogue() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    dialogueBox.style.display = "none";
    dialogueLocked = false;
    currentScript = [];
    currentIndex = 0;
    currentNpcId = null;
}

// Close on Escape
window.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDialogue();
});

function isDialogueOpen() {
    return dialogueLocked;
}