const STORAGE_KEY = "interviewArmorSavedAnswers";
const PRACTICE_NOTES_KEY = "interviewArmorPracticeNotes";

// Read API key from config.js (which sets window.GROQ_API_KEY)
const GROQ_API_KEY = window.GROQ_API_KEY || "";

const elements = {
  levelSelect: document.querySelector("#levelSelect"),
  categorySelect: document.querySelector("#categorySelect"),
  newQuestionBtn: document.querySelector("#newQuestionBtn"),
  questionText: document.querySelector("#questionText"),
  questionTip: document.querySelector("#questionTip"),
  questionCategory: document.querySelector("#questionCategory"),
  questionLevel: document.querySelector("#questionLevel"),
  heroStartBtn: document.querySelector("#heroStartBtn"),
  recordBtn: document.querySelector("#recordBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  recordingStatus: document.querySelector("#recordingStatus"),
  statusDot: document.querySelector("#statusDot"),
  recordTimer: document.querySelector("#recordTimer"),
  audioPlayer: document.querySelector("#audioPlayer"),
  transcriptText: document.querySelector("#transcriptText"),
  transcriptStatusText: document.querySelector("#transcriptStatusText"),
  wordCount: document.querySelector("#wordCount"),
  transcribeBtn: document.querySelector("#transcribeBtn"),
  feedbackBtn: document.querySelector("#feedbackBtn"),
  apiStatus: document.querySelector("#apiStatus"),
  saveBtn: document.querySelector("#saveBtn"),
  strengthText: document.querySelector("#strengthText"),
  improveText: document.querySelector("#improveText"),
  strongerAnswerText: document.querySelector("#strongerAnswerText"),
  confidenceTipText: document.querySelector("#confidenceTipText"),
  clarityMeter: document.querySelector("#clarityMeter"),
  structureMeter: document.querySelector("#structureMeter"),
  confidenceMeter: document.querySelector("#confidenceMeter"),
  clarityScore: document.querySelector("#clarityScore"),
  structureScore: document.querySelector("#structureScore"),
  confidenceScore: document.querySelector("#confidenceScore"),
  overallReadiness: document.querySelector("#overallReadiness"),
  practiceNotesCard: document.querySelector("#practiceNotesCard"),
  practiceNotesContent: document.querySelector("#practiceNotesContent")
};

let currentQuestion = null;
let recorder = null;
let chunks = [];
let audioBlob = null;
let selectedConfidence = "";
let feedback = null;
let timerInterval = null;
let timerStartedAt = null;

// ─── Helpers ────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function levelTagClass(level) {
  if (level === "Beginner") return "tag-sage";
  if (level === "Intermediate") return "tag-bronze";
  if (level === "Advanced") return "tag-red";
  return "";
}

function setStatus(message, mode = "idle") {
  elements.recordingStatus.textContent = message;
  elements.statusDot.classList.toggle("recording", mode === "recording");
  if (elements.transcriptStatusText) {
    elements.transcriptStatusText.textContent = mode === "recording" ? "Recording..." : message;
  }
}

function setApiStatus(message) {
  elements.apiStatus.textContent = message || "";
}

function updateWordCount() {
  if (!elements.wordCount) return;
  const count = elements.transcriptText.value.trim().split(/\s+/).filter(Boolean).length;
  elements.wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function formatTimer(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  if (!elements.recordTimer) return;
  timerStartedAt = Date.now();
  elements.recordTimer.textContent = "00:00";
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elements.recordTimer.textContent = formatTimer(Date.now() - timerStartedAt);
  }, 250);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  if (elements.recordTimer) elements.recordTimer.textContent = "00:00";
}

// ─── Question selection with level + category cascade ───────

function initLevelSelect() {
  elements.levelSelect.innerHTML = INTERVIEW_LEVELS.map((level) => {
    return `<option value="${level}">${level}</option>`;
  }).join("");
}

function getCategoriesForLevel(level) {
  if (level === "All") return INTERVIEW_CATEGORIES;
  const available = new Set();
  for (const q of INTERVIEW_QUESTIONS) {
    if (q.level === level) available.add(q.category);
  }
  return ["All", ...INTERVIEW_CATEGORIES.filter((c) => c !== "All" && available.has(c))];
}

function initCategorySelect() {
  const categories = getCategoriesForLevel(elements.levelSelect.value || "All");
  elements.categorySelect.innerHTML = categories.map((cat) => {
    return `<option value="${cat}">${cat}</option>`;
  }).join("");
}

function getQuestionById(id) {
  return INTERVIEW_QUESTIONS.find((q) => q.id === id);
}

function getQuestionsForSelectedFilters() {
  const level = elements.levelSelect.value || "All";
  const category = elements.categorySelect.value || "All";
  return INTERVIEW_QUESTIONS.filter((q) => {
    if (level !== "All" && q.level !== level) return false;
    if (category !== "All" && q.category !== category) return false;
    return true;
  });
}

function setQuestion(question) {
  currentQuestion = question;
  elements.questionText.textContent = question.question;
  elements.questionTip.textContent = question.tip;
  elements.questionCategory.textContent = question.category;
  elements.questionLevel.textContent = question.level;
  elements.questionLevel.className = `tag ${levelTagClass(question.level)}`;
  elements.levelSelect.value = question.level;
  initCategorySelect();
  elements.categorySelect.value = question.category;
  renderPracticeNotes(question);
}

function chooseRandomQuestion() {
  const pool = getQuestionsForSelectedFilters();
  if (!pool.length) return;
  const question = pool[Math.floor(Math.random() * pool.length)];
  setQuestion(question);
}

function initQuestion() {
  initLevelSelect();
  initCategorySelect();
  const params = new URLSearchParams(window.location.search);
  const questionFromUrl = getQuestionById(params.get("q"));
  setQuestion(
    questionFromUrl
      || INTERVIEW_QUESTIONS.find((q) => q.level === "Beginner")
      || INTERVIEW_QUESTIONS[0]
  );
}

// ─── Pull prep notes from practice page localStorage ────────

function renderPracticeNotes(question) {
  if (!elements.practiceNotesCard || !elements.practiceNotesContent || !question) return;

  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(PRACTICE_NOTES_KEY) || "{}");
  } catch {
    stored = {};
  }

  const saved = stored[question.id];
  const hasContent = saved && (saved.notes || saved.draft);

  if (!hasContent) {
    elements.practiceNotesCard.classList.add("hidden");
    return;
  }

  elements.practiceNotesCard.classList.remove("hidden");
  const parts = [];
  if (saved.notes) {
    parts.push(`<p class="kicker" style="margin-top:.6rem;">Notes</p>`);
    parts.push(`<p class="muted" style="white-space:pre-wrap; margin-bottom:.4rem;">${escapeHtml(saved.notes)}</p>`);
  }
  if (saved.draft) {
    parts.push(`<p class="kicker" style="margin-top:.85rem;">Draft answer</p>`);
    parts.push(`<p class="muted" style="white-space:pre-wrap; margin-bottom:.4rem;">${escapeHtml(saved.draft)}</p>`);
  }
  elements.practiceNotesContent.innerHTML = parts.join("");
}

// ─── Recording ──────────────────────────────────────────────

function getBestMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert("Your browser does not support microphone recording with MediaRecorder.");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  audioBlob = null;

  const mimeType = getBestMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  recorder.addEventListener("stop", () => {
    audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const url = URL.createObjectURL(audioBlob);
    elements.audioPlayer.src = url;
    elements.audioPlayer.classList.remove("hidden");
    elements.transcribeBtn.disabled = false;

    stream.getTracks().forEach((track) => track.stop());
    stopTimer();
    setStatus("Recording complete. Playback is ready.");
    elements.recordBtn.classList.remove("is-recording");
    elements.recordBtn.disabled = false;
    if (elements.heroStartBtn) elements.heroStartBtn.disabled = false;
    elements.stopBtn.disabled = true;
  });

  recorder.start();
  startTimer();
  setStatus("Recording... speak your answer.", "recording");
  elements.recordBtn.classList.add("is-recording");
  elements.recordBtn.disabled = true;
  if (elements.heroStartBtn) elements.heroStartBtn.disabled = true;
  elements.stopBtn.disabled = false;
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
}

// ─── Groq Whisper transcription ─────────────────────────────

async function transcribeAudio() {
  if (!audioBlob) {
    alert("Record an answer first.");
    return;
  }
  if (!GROQ_API_KEY) {
    setApiStatus("No API key configured. Set window.GROQ_API_KEY in js/config.js.");
    return;
  }

  setApiStatus("Sending audio to Groq Whisper...");
  elements.transcribeBtn.disabled = true;

  try {
    const formData = new FormData();
    const file = new File([audioBlob], "answer.webm", { type: audioBlob.type || "audio/webm" });
    formData.append("file", file);
    formData.append("model", "whisper-large-v3");
    formData.append("language", "en");
    formData.append("response_format", "json");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: formData
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    elements.transcriptText.value = data.text || "";
    updateWordCount();
    setApiStatus("Transcript ready.");
    if (elements.transcriptStatusText) elements.transcriptStatusText.textContent = "Transcribed.";
  } catch (error) {
    console.error(error);
    setApiStatus("Transcription failed. Check your key, the console, or try a shorter recording.");
  } finally {
    elements.transcribeBtn.disabled = false;
  }
}

// ─── Groq Llama coaching feedback ───────────────────────────

function fallbackFeedback(transcript) {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  return {
    clarity: Math.min(9, Math.max(4, Math.round(wordCount / 18))),
    structure: wordCount > 80 ? 7 : 5,
    confidence: wordCount > 60 ? 7 : 5,
    strength: "You gave enough context to start shaping this into a stronger interview answer.",
    improve: "Add a clearer beginning, one specific technical detail, and a result at the end.",
    strongerAnswer: "Use STAR: explain the situation, your task, the action you took, and the measurable result.",
    confidenceTip: "Slow down slightly and end with a confident sentence about what you learned."
  };
}

async function requestFeedback() {
  const transcript = elements.transcriptText.value.trim();
  if (!transcript) {
    alert("Add a transcript before requesting feedback.");
    return;
  }
  if (!GROQ_API_KEY) {
    setApiStatus("No API key configured. Set window.GROQ_API_KEY in js/config.js.");
    return;
  }

  setApiStatus("Sending transcript for AI feedback...");
  elements.feedbackBtn.disabled = true;

  const promptText = `
You are an interview coach for a ${currentQuestion.level} developer.
Return ONLY valid JSON with these keys:
clarity: number from 1 to 10
structure: number from 1 to 10
confidence: number from 1 to 10
strength: string
improve: string
strongerAnswer: string
confidenceTip: string

Question: ${currentQuestion.question}
Category: ${currentQuestion.category}
Level: ${currentQuestion.level}
Transcript: ${transcript}
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a direct but encouraging interview coach. You always respond with valid JSON only."
          },
          { role: "user", content: promptText }
        ],
        temperature: 0.4,
        max_completion_tokens: 700,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    feedback = JSON.parse(content);
    renderFeedback(feedback);
    setApiStatus("Feedback ready.");
  } catch (error) {
    console.error(error);
    feedback = fallbackFeedback(transcript);
    renderFeedback(feedback);
    setApiStatus("Live AI feedback failed, so a local fallback coaching note was generated.");
  } finally {
    elements.feedbackBtn.disabled = false;
  }
}

function renderFeedback(data) {
  const clarity = Number(data.clarity) || 0;
  const structure = Number(data.structure) || 0;
  const confidence = Number(data.confidence) || 0;

  elements.clarityMeter.style.width = `${clarity * 10}%`;
  elements.structureMeter.style.width = `${structure * 10}%`;
  elements.confidenceMeter.style.width = `${confidence * 10}%`;

  elements.clarityScore.textContent = clarity ? `${clarity}/10` : "—";
  elements.structureScore.textContent = structure ? `${structure}/10` : "—";
  elements.confidenceScore.textContent = confidence ? `${confidence}/10` : "—";

  elements.strengthText.textContent = data.strength || "Feedback will appear here.";
  elements.improveText.textContent = data.improve || "Record or paste a transcript first.";
  elements.strongerAnswerText.textContent = data.strongerAnswer || "You'll get a clearer example direction after feedback runs.";
  elements.confidenceTipText.textContent = data.confidenceTip || "You'll get one delivery tip.";

  // Overall readiness = average of three scores, displayed as a percent
  if (elements.overallReadiness) {
    const readinessCard = document.querySelector(".readiness-card");
    if (clarity || structure || confidence) {
      const overall = Math.round(((clarity + structure + confidence) / 3) * 10);
      elements.overallReadiness.textContent = `${overall}%`;

      // Map percent → belt tier
      let tier;
      if (overall < 40) tier = "Needs Work";
      else if (overall < 75) tier = "Almost Ready";
      else tier = "Strong Answer";

      // Auto-highlight the matching belt card (also sets selectedConfidence)
      selectConfidence(tier);

      // Drive the brush bar fill width + arrow position + arrow color
      if (readinessCard) {
        readinessCard.dataset.tier = tier;
        readinessCard.style.setProperty("--readiness-pct", `${overall}%`);
        readinessCard.classList.add("has-readiness");
      }
    } else {
      elements.overallReadiness.textContent = "—";
      if (readinessCard) {
        readinessCard.style.setProperty("--readiness-pct", "0%");
        readinessCard.classList.remove("has-readiness");
        delete readinessCard.dataset.tier;
      }
    }
  }
}

// ─── Confidence selection + save ────────────────────────────

function selectConfidence(value) {
  selectedConfidence = value;
  document.querySelectorAll("[data-confidence]").forEach((button) => {
    const isSelected = button.dataset.confidence === value;
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-current", isSelected);
  });
}

function saveAnswer() {
  const transcript = elements.transcriptText.value.trim();
  if (!transcript) {
    alert("Add a transcript before saving.");
    return;
  }
  if (!selectedConfidence) {
    alert("Choose a readiness level before saving.");
    return;
  }

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.id,
    question: currentQuestion.question,
    category: currentQuestion.category,
    level: currentQuestion.level,
    type: currentQuestion.type,
    tip: currentQuestion.tip,
    transcript,
    feedback: feedback || fallbackFeedback(transcript),
    confidence: selectedConfidence
  };

  saved.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  setApiStatus("Saved. Open the Saved page to review it.");
  if (typeof window.refreshSidebarStats === "function") window.refreshSidebarStats();
}

function clearSession() {
  chunks = [];
  audioBlob = null;
  feedback = null;
  elements.audioPlayer.removeAttribute("src");
  elements.audioPlayer.classList.add("hidden");
  elements.transcriptText.value = "";
  elements.transcribeBtn.disabled = true;
  resetTimer();
  updateWordCount();
  setStatus("Ready to record.");
  setApiStatus("");
  renderFeedback({});
}

// ─── Event wiring ───────────────────────────────────────────

elements.newQuestionBtn.addEventListener("click", chooseRandomQuestion);
elements.levelSelect.addEventListener("change", () => {
  initCategorySelect();
  chooseRandomQuestion();
});
elements.categorySelect.addEventListener("change", chooseRandomQuestion);
elements.recordBtn.addEventListener("click", startRecording);
if (elements.heroStartBtn) elements.heroStartBtn.addEventListener("click", startRecording);
elements.stopBtn.addEventListener("click", stopRecording);
elements.clearBtn.addEventListener("click", clearSession);
elements.transcribeBtn.addEventListener("click", transcribeAudio);
elements.feedbackBtn.addEventListener("click", requestFeedback);
elements.saveBtn.addEventListener("click", saveAnswer);
elements.transcriptText.addEventListener("input", updateWordCount);

document.querySelectorAll("[data-confidence]").forEach((button) => {
  button.addEventListener("click", () => selectConfidence(button.dataset.confidence));
});

initQuestion();
renderFeedback({});
updateWordCount();
