// ─────────────────────────────────────────────────────────────
// Mock interview page
// ─────────────────────────────────────────────────────────────
// Record an answer, transcribe with Groq Whisper, get coaching
// from Groq Llama, save the result for the Saved page.
//
// Exposes:
//   window.initMock()     — boots the page (called by router)
//   window.teardownMock() — stops the recorder, revokes blob URLs,
//                           clears timers
//
// All DOM lookups happen inside initMock so this file is safe to
// load on any page; nothing runs until the router calls it.

(function () {
  // Web Speech API — available on Chrome, Edge, Safari. Firefox doesn't
  // implement it (or hides it behind a flag). We use it as the primary
  // transcription method when present, and silently fall back to Whisper
  // on stop when it isn't — that way Firefox users still get a working
  // experience, just not the live-typing visual.
  const SpeechRecognitionCtor =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const LIVE_SUPPORTED = !!SpeechRecognitionCtor;

  // Per-page state. Scoped to this IIFE so we can reset it
  // cleanly on every init() without leaking to window.
  //
  // A few fields (audioBlob, audioUrl, chunks, audioForQuestion) are
  // intentionally NOT reset by init/teardown — they survive SPA navigation
  // so a recording made on the mock page is still available when the user
  // visits Practice or Saved and comes back. They're only cleared by
  // clearSession(), by switching to a different question, or by an actual
  // page refresh (which the beforeunload prompt guards against).
  const state = {
    elements: null,
    currentQuestion: null,
    recorder: null,
    stream: null,             // active getUserMedia stream
    chunks: [],
    audioBlob: null,
    audioUrl: null,           // the *current* blob URL, tracked
                              // so we can revoke before replacing it
    audioForQuestion: null,   // question id the current audio was recorded for
    selectedConfidence: "",
    feedback: null,
    timerInterval: null,
    timerStartedAt: null,
    listeners: [],            // for teardown
    isWired: false,
    // Live transcription state
    recognition: null,             // active SpeechRecognition instance
    liveFinalText: "",             // confirmed text accumulated this take
    liveFallbackToWhisper: false,  // set true on SR error -> Whisper on stop
  };

  // ─── Groq key ───────────────────────────────────────────────

  function getGroqKey() {
    if (window.GROQ_API_KEY) return window.GROQ_API_KEY;
    let key = localStorage.getItem(STORAGE_KEYS.GROQ_KEY);
    if (!key) {
      key = prompt("Paste your Groq API key. Phase 1 stores it in localStorage for this browser.");
      if (key) localStorage.setItem(STORAGE_KEYS.GROQ_KEY, key.trim());
    }
    return key;
  }

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
    state.elements.recordingStatus.textContent = message;
    state.elements.statusDot.classList.toggle("recording", mode === "recording");
    if (state.elements.transcriptStatusText) {
      state.elements.transcriptStatusText.textContent = mode === "recording" ? "Recording..." : message;
    }
  }

  function setApiStatus(message) {
    state.elements.apiStatus.textContent = message || "";
  }

  function updateWordCount() {
    if (!state.elements.wordCount) return;
    const count = state.elements.transcriptText.value.trim().split(/\s+/).filter(Boolean).length;
    state.elements.wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
  }

  function formatTimer(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function startTimer() {
    if (!state.elements.recordTimer) return;
    state.timerStartedAt = Date.now();
    state.elements.recordTimer.textContent = "00:00";
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.elements.recordTimer.textContent = formatTimer(Date.now() - state.timerStartedAt);
    }, 250);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  function resetTimer() {
    stopTimer();
    if (state.elements.recordTimer) state.elements.recordTimer.textContent = "00:00";
  }

  // Revoke whichever blob URL is currently held in state.audioUrl
  // and detach it from the <audio> element. Safe to call when no
  // URL is active. Every place that sets state.audioUrl to a new
  // value goes through here first — that's how we plug the leak.
  function revokeAudioUrl() {
    if (state.audioUrl) {
      try { URL.revokeObjectURL(state.audioUrl); } catch { /* already revoked */ }
      state.audioUrl = null;
    }
    if (state.elements?.audioPlayer) {
      state.elements.audioPlayer.removeAttribute("src");
      state.elements.audioPlayer.load?.();
    }
  }

  // ─── Draft persistence ──────────────────────────────────────

  function saveDraft() {
    if (!state.currentQuestion) return;
    const draft = {
      questionId: state.currentQuestion.id,
      transcript: state.elements.transcriptText.value,
      feedback: state.feedback,
      confidence: state.selectedConfidence,
      level: state.elements.levelSelect.value,
      category: state.elements.categorySelect.value,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.MOCK_DRAFT, JSON.stringify(draft));
    } catch {
      // localStorage may be full or unavailable; ignore.
    }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MOCK_DRAFT) || "null");
    } catch {
      return null;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEYS.MOCK_DRAFT); } catch { /* ignore */ }
  }

  // ─── Question selection ─────────────────────────────────────

  function initLevelSelect() {
    state.elements.levelSelect.innerHTML = INTERVIEW_LEVELS.map((level) => {
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
    const categories = getCategoriesForLevel(state.elements.levelSelect.value || "All");
    state.elements.categorySelect.innerHTML = categories.map((cat) => {
      return `<option value="${cat}">${cat}</option>`;
    }).join("");
  }

  function getQuestionById(id) {
    return INTERVIEW_QUESTIONS.find((q) => q.id === id);
  }

  function getQuestionsForSelectedFilters() {
    const level = state.elements.levelSelect.value || "All";
    const category = state.elements.categorySelect.value || "All";
    return INTERVIEW_QUESTIONS.filter((q) => {
      if (level !== "All" && q.level !== level) return false;
      if (category !== "All" && q.category !== category) return false;
      return true;
    });
  }

  function setQuestion(question) {
    state.currentQuestion = question;
    state.elements.questionText.textContent = question.question;
    state.elements.questionTip.textContent = question.tip;
    state.elements.questionCategory.textContent = question.category;
    state.elements.questionLevel.textContent = question.level;
    state.elements.questionLevel.className = `tag ${levelTagClass(question.level)}`;
    renderPracticeNotes(question);
    // Persist the question selection itself. Previously this only happened
    // in chooseRandomQuestion, which meant landing on mock.html?q=xxx from
    // the practice page never saved the draft — navigating away and back
    // then fell through to the "first Beginner question" fallback. Now any
    // setQuestion call (URL param, draft restore, fallback, random pick)
    // writes the current question to localStorage so SPA nav can find it.
    saveDraft();
  }

  function chooseRandomQuestion() {
    const pool = getQuestionsForSelectedFilters();
    if (!pool.length) return;
    const question = pool[Math.floor(Math.random() * pool.length)];
    // Reset the previous question's answer state before switching — its
    // transcript, audio, feedback, and belt highlight don't apply to the
    // new question. Order matters: reset first, then setQuestion (which
    // calls saveDraft on the fresh state).
    resetAnswerState();
    setQuestion(question);
  }

  // Reset all "this question's answer" state: audio, transcript, feedback,
  // and the belt highlight. Used when picking a new random question (the
  // prior take's stuff doesn't apply) and as the core of clearSession
  // (which adds timer/status resets and a saveDraft on top).
  function resetAnswerState() {
    state.chunks = [];
    state.audioBlob = null;
    state.audioForQuestion = null;
    state.feedback = null;
    state.selectedConfidence = "";
    revokeAudioUrl();
    if (state.elements) {
      state.elements.audioPlayer.classList.add("hidden");
      state.elements.transcriptText.value = "";
      state.elements.transcribeBtn.disabled = true;
      updateWordCount();
      // renderFeedback({}) clears the meters, readiness %, and belt
      // highlight via its no-scores branch.
      renderFeedback({});
    }
  }

  function initQuestion() {
    initLevelSelect();
    initCategorySelect();

    // Pull the draft up front; we need to compare it with whatever the URL
    // says before deciding which path wins.
    const draft = loadDraft();
    const params = new URLSearchParams(window.location.search);
    const questionFromUrl = getQuestionById(params.get("q"));

    if (questionFromUrl) {
      // The URL says "be on question X." If the existing draft is *also* for
      // question X, that means this is either a refresh of the same page or
      // a return to the same question — preserve the in-progress work.
      // If the draft is for a different question, the user navigated here
      // explicitly (e.g. "Practice This" on a different question, or
      // "Practice Again" from Saved) — wipe and start fresh.
      const draftMatchesUrl = draft && draft.questionId === questionFromUrl.id;
      if (!draftMatchesUrl) {
        clearDraft();
        setQuestion(questionFromUrl);
        return;
      }
      // Fall through to the draft-restore path below using `draft`.
    }

    // Restore a draft if one exists (covers two cases now: no URL param,
    // or URL param that matches what's already saved as a draft).
    if (draft) {
      const question = getQuestionById(draft.questionId);
      if (question) {
        if (draft.level && [...state.elements.levelSelect.options].some((o) => o.value === draft.level)) {
          state.elements.levelSelect.value = draft.level;
          initCategorySelect();
        }
        if (draft.category && [...state.elements.categorySelect.options].some((o) => o.value === draft.category)) {
          state.elements.categorySelect.value = draft.category;
        }
        setQuestion(question);
        if (draft.transcript) {
          state.elements.transcriptText.value = draft.transcript;
          updateWordCount();
        }
        if (draft.feedback) {
          state.feedback = draft.feedback;
          renderFeedback(draft.feedback);
        }
        // Only restore confidence when feedback is also present. Without
        // backing scores, the belt highlight would be a stale leftover
        // from when users could click the belts manually.
        if (draft.confidence && draft.feedback) selectConfidence(draft.confidence);
        return;
      }
    }

    // No URL param, no usable draft — default to a beginner question.
    setQuestion(
      INTERVIEW_QUESTIONS.find((q) => q.level === "Beginner") || INTERVIEW_QUESTIONS[0]
    );
  }

  // ─── Practice notes pull-through ────────────────────────────

  function renderPracticeNotes(question) {
    const { practiceNotesCard, practiceNotesContent } = state.elements;
    if (!practiceNotesCard || !practiceNotesContent || !question) return;

    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRACTICE_NOTES) || "{}");
    } catch {
      stored = {};
    }

    const saved = stored[question.id];
    const hasContent = saved && (saved.notes || saved.draft);

    if (!hasContent) {
      practiceNotesCard.classList.add("hidden");
      return;
    }

    practiceNotesCard.classList.remove("hidden");
    const parts = [];
    if (saved.notes) {
      parts.push(`<p class="kicker" style="margin-top:.6rem;">Notes</p>`);
      parts.push(`<p class="muted" style="white-space:pre-wrap; margin-bottom:.4rem;">${escapeHtml(saved.notes)}</p>`);
    }
    if (saved.draft) {
      parts.push(`<p class="kicker" style="margin-top:.85rem;">Draft answer</p>`);
      parts.push(`<p class="muted" style="white-space:pre-wrap; margin-bottom:.4rem;">${escapeHtml(saved.draft)}</p>`);
    }
    practiceNotesContent.innerHTML = parts.join("");
  }

  // ─── Recording ──────────────────────────────────────────────

  function getBestMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  // ─── Live transcription via Web Speech API ──────────────────
  // Web Speech runs alongside MediaRecorder. It fires `result` events as
  // the user speaks; we write into the transcript textarea in real time.
  // Interim results (the engine's guess-in-progress) are appended to the
  // final-so-far text and re-rendered on every event, so the user sees
  // text appear letter-by-letter the way Google Docs voice typing does.
  //
  // continuous=true means recognition keeps listening through pauses
  // rather than auto-ending after the first phrase. interimResults=true
  // means we get the live "typing" effect instead of waiting for end-of-
  // sentence finalization.

  function startLiveTranscription() {
    if (!LIVE_SUPPORTED) return;

    state.liveFinalText = "";
    state.liveFallbackToWhisper = false;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.addEventListener("result", (event) => {
      let interim = "";
      // event.resultIndex marks where new results begin in this event.
      // Anything before it has already been processed in earlier events.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          state.liveFinalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (state.elements?.transcriptText) {
        state.elements.transcriptText.value = state.liveFinalText + interim;
        updateWordCount();
        saveDraft();
      }
    });

    recognition.addEventListener("error", (event) => {
      // 'no-speech' fires when the user is silent for a few seconds — this
      // is normal, recognition restarts itself via the 'end' handler.
      // 'aborted' fires on intentional stop. Everything else (network,
      // not-allowed, audio-capture, service-not-allowed) means live
      // transcription is dead for this take; flag for Whisper fallback.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("SpeechRecognition error:", event.error);
        state.liveFallbackToWhisper = true;
      }
    });

    recognition.addEventListener("end", () => {
      // Recognition can auto-end on silence even with continuous=true. If
      // the user is still recording, restart it. If they stopped or we hit
      // an unrecoverable error, leave it dead.
      const stillRecording = state.recorder && state.recorder.state === "recording";
      if (stillRecording && !state.liveFallbackToWhisper) {
        try { recognition.start(); } catch { /* already running, ignore */ }
      }
    });

    try {
      recognition.start();
      state.recognition = recognition;
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      state.liveFallbackToWhisper = true;
    }
  }

  function stopLiveTranscription() {
    if (!state.recognition) return;
    try { state.recognition.stop(); } catch { /* ignore */ }
    state.recognition = null;
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Your browser does not support microphone recording with MediaRecorder.");
      return;
    }

    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.audioBlob = null;

    const mimeType = getBestMimeType();
    state.recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);

    // Capture mime type and question id locally — the stop event can fire
    // *after* teardownMock has run (e.g. user clicked "Practice" mid-take),
    // at which point state.recorder is null and state.currentQuestion is too.
    // Closures keep these values alive regardless.
    const recorderMimeType = state.recorder.mimeType || "audio/webm";
    const questionAtStart = state.currentQuestion?.id ?? null;

    state.recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.chunks.push(event.data);
    });

    state.recorder.addEventListener("stop", () => {
      state.audioBlob = new Blob(state.chunks, { type: recorderMimeType });
      state.audioForQuestion = questionAtStart;

      // ── Blob URL leak fix ──
      // Revoke whatever URL is currently assigned to the player
      // before creating the next one. Without this, every "stop"
      // would orphan a Blob in memory; 50 takes in one session =
      // 50 leaked blobs. revokeAudioUrl() is also called on
      // clearSession() so the cleanup happens at every exit point.
      revokeAudioUrl();
      state.audioUrl = URL.createObjectURL(state.audioBlob);

      // Stop the live transcriber first; any in-flight final results will
      // have already landed in the textarea via the 'result' handler.
      stopLiveTranscription();

      state.stream?.getTracks().forEach((track) => track.stop());
      state.stream = null;
      stopTimer();

      // UI updates only when the mock page is still mounted. If the user
      // navigated to Practice/Saved while recording, teardownMock has
      // already nulled state.elements; the audio blob is preserved in
      // state and will be re-attached when they come back to mock.
      if (state.elements) {
        state.elements.audioPlayer.src = state.audioUrl;
        state.elements.audioPlayer.classList.remove("hidden");
        state.elements.recordBtn.classList.remove("is-recording");
        state.elements.recordBtn.setAttribute("aria-label", "Start recording");
        state.elements.stopBtn.disabled = true;
        // Audio exists, so the re-transcribe button is now useful.
        state.elements.transcribeBtn.disabled = false;

        // Decide whether to call Whisper as a backup. Live succeeded if
        // the browser supports it AND no error flag was set during the
        // take. Otherwise (Firefox, or live errored mid-take), Whisper
        // transcribes the recorded audio.
        const liveWorked = LIVE_SUPPORTED && !state.liveFallbackToWhisper;
        if (liveWorked) {
          setStatus("Recording complete. Transcript ready.");
          // Persist what live just produced.
          saveDraft();
        } else {
          setStatus("Recording complete. Transcribing...");
          transcribeAudio();
        }
      }
    });

    state.recorder.start();
    startTimer();

    // Live mode: clear whatever's in the textarea so the live results
    // don't get glued onto stale text. Then start SpeechRecognition. If
    // it's not supported (Firefox), we just skip it — Whisper will run on
    // stop as the fallback.
    if (LIVE_SUPPORTED) {
      state.elements.transcriptText.value = "";
      updateWordCount();
      startLiveTranscription();
      setStatus("Recording... speak and watch the transcript appear.", "recording");
    } else {
      setStatus("Recording... speak your answer.", "recording");
    }

    state.elements.recordBtn.classList.add("is-recording");
    state.elements.recordBtn.setAttribute("aria-label", "Stop recording");
    state.elements.stopBtn.disabled = false;
  }

  function stopRecording() {
    if (state.recorder && state.recorder.state !== "inactive") {
      state.recorder.stop();
    }
    // The recorder's 'stop' handler also calls stopLiveTranscription, but
    // calling it here too gives an instant UI shutoff — recognition stops
    // emitting interim text the moment the user clicks stop.
    stopLiveTranscription();
  }

  function toggleRecording() {
    if (state.recorder && state.recorder.state === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // ─── Groq Whisper transcription ─────────────────────────────

  async function transcribeAudio() {
    if (!state.audioBlob) {
      alert("Record an answer first.");
      return;
    }
    const key = getGroqKey();
    if (!key) {
      setApiStatus("No API key provided. Add one to transcribe.");
      return;
    }

    setApiStatus("Sending audio to Groq Whisper...");
    state.elements.transcribeBtn.disabled = true;

    try {
      const formData = new FormData();
      const file = new File([state.audioBlob], "answer.webm", { type: state.audioBlob.type || "audio/webm" });
      formData.append("file", file);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "en");
      formData.append("response_format", "json");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      state.elements.transcriptText.value = data.text || "";
      updateWordCount();
      saveDraft();
      setApiStatus("Transcript ready.");
      if (state.elements.transcriptStatusText) state.elements.transcriptStatusText.textContent = "Transcribed.";
    } catch (error) {
      console.error(error);
      setApiStatus("Transcription failed. Check your key, the console, or try a shorter recording.");
    } finally {
      // Re-enable so the user can retry if they want.
      if (state.elements?.transcribeBtn && state.audioBlob) {
        state.elements.transcribeBtn.disabled = false;
      }
    }
  }

  // ─── Coaching feedback ──────────────────────────────────────

  function fallbackFeedback(transcript) {
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    return {
      clarity: Math.min(9, Math.max(4, Math.round(wordCount / 18))),
      structure: wordCount > 80 ? 7 : 5,
      confidence: wordCount > 60 ? 7 : 5,
      strength: "You gave enough context to start shaping this into a stronger interview answer.",
      improve: "Add a clearer beginning, one specific technical detail, and a result at the end.",
      strongerAnswer: "Use STAR: explain the situation, your task, the action you took, and the measurable result.",
      confidenceTip: "Slow down slightly and end with a confident sentence about what you learned.",
    };
  }

  async function requestFeedback() {
    const transcript = state.elements.transcriptText.value.trim();
    if (!transcript) {
      alert("Add a transcript before requesting feedback.");
      return;
    }
    const key = getGroqKey();
    if (!key) {
      setApiStatus("No API key provided. Add one to get feedback.");
      return;
    }

    setApiStatus("Sending transcript for AI feedback...");
    state.elements.feedbackBtn.disabled = true;

    const promptText = `
You are an interview coach for a ${state.currentQuestion.level} developer.
Return ONLY valid JSON with these keys:
clarity: number from 1 to 10
structure: number from 1 to 10
confidence: number from 1 to 10
strength: string
improve: string
strongerAnswer: string
confidenceTip: string

Question: ${state.currentQuestion.question}
Category: ${state.currentQuestion.category}
Level: ${state.currentQuestion.level}
Transcript: ${transcript}
`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a direct but encouraging interview coach. You always respond with valid JSON only." },
            { role: "user", content: promptText },
          ],
          temperature: 0.4,
          max_completion_tokens: 700,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      state.feedback = JSON.parse(content);
      renderFeedback(state.feedback);
      saveDraft();
      setApiStatus("Feedback ready.");
    } catch (error) {
      console.error(error);
      state.feedback = fallbackFeedback(transcript);
      renderFeedback(state.feedback);
      saveDraft();
      setApiStatus("Live AI feedback failed, so a local fallback coaching note was generated.");
    } finally {
      state.elements.feedbackBtn.disabled = false;
    }
  }

  function renderFeedback(data) {
    const clarity = Number(data.clarity) || 0;
    const structure = Number(data.structure) || 0;
    const confidence = Number(data.confidence) || 0;

    state.elements.clarityMeter.style.width = `${clarity * 10}%`;
    state.elements.structureMeter.style.width = `${structure * 10}%`;
    state.elements.confidenceMeter.style.width = `${confidence * 10}%`;

    state.elements.clarityScore.textContent = clarity ? `${clarity}/10` : "—";
    state.elements.structureScore.textContent = structure ? `${structure}/10` : "—";
    state.elements.confidenceScore.textContent = confidence ? `${confidence}/10` : "—";

    state.elements.strengthText.textContent = data.strength || "Feedback will appear here.";
    state.elements.improveText.textContent = data.improve || "Record or paste a transcript first.";
    state.elements.strongerAnswerText.textContent = data.strongerAnswer || "You'll get a clearer example direction after feedback runs.";
    state.elements.confidenceTipText.textContent = data.confidenceTip || "You'll get one delivery tip.";

    if (state.elements.overallReadiness) {
      const readinessCard = document.querySelector(".readiness-card");
      if (clarity || structure || confidence) {
        const overall = Math.round(((clarity + structure + confidence) / 3) * 10);
        state.elements.overallReadiness.textContent = `${overall}%`;

        let tier;
        if (overall < 40) tier = "Needs Work";
        else if (overall < 75) tier = "Almost Ready";
        else tier = "Strong Answer";

        selectConfidence(tier);

        if (readinessCard) {
          readinessCard.dataset.tier = tier;
          readinessCard.style.setProperty("--readiness-pct", `${overall}%`);
          readinessCard.classList.add("has-readiness");
        }
      } else {
        state.elements.overallReadiness.textContent = "—";
        if (readinessCard) {
          readinessCard.style.setProperty("--readiness-pct", "0%");
          readinessCard.classList.remove("has-readiness");
          delete readinessCard.dataset.tier;
        }
        // No scores -> no readiness tier. Clear the belt highlight and the
        // stored confidence so the UI doesn't claim a tier the AI didn't
        // give. This is the single source of truth — anywhere that wants
        // to clear the belts calls renderFeedback({}).
        state.selectedConfidence = "";
        document.querySelectorAll(".belt-grid [data-confidence]").forEach((card) => {
          card.classList.remove("is-selected", "is-current");
        });
      }
    }
  }

  // ─── Confidence + save ──────────────────────────────────────

  function selectConfidence(value) {
    state.selectedConfidence = value;
    document.querySelectorAll("[data-confidence]").forEach((button) => {
      const isSelected = button.dataset.confidence === value;
      button.classList.toggle("is-selected", isSelected);
      button.classList.toggle("is-current", isSelected);
    });
    saveDraft();
  }

  function saveAnswer() {
    const transcript = state.elements.transcriptText.value.trim();
    if (!transcript) {
      alert("Add a transcript before saving.");
      return;
    }
    if (!state.selectedConfidence) {
      alert("Get AI feedback before saving so your readiness level is scored.");
      return;
    }

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_ANSWERS) || "[]");
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      questionId: state.currentQuestion.id,
      question: state.currentQuestion.question,
      category: state.currentQuestion.category,
      level: state.currentQuestion.level,
      type: state.currentQuestion.type,
      tip: state.currentQuestion.tip,
      transcript,
      feedback: state.feedback || fallbackFeedback(transcript),
      confidence: state.selectedConfidence,
    };

    saved.push(entry);
    localStorage.setItem(STORAGE_KEYS.SAVED_ANSWERS, JSON.stringify(saved));
    // Don't clearDraft() — the user just spent effort on this question and
    // we don't want navigating away and back to dump them on a random
    // Beginner question. Re-save the current state so the draft stays in
    // sync with what's on screen.
    saveDraft();
    setApiStatus("Saved. Open the Saved page to review it.");
    window.refreshSidebarStats?.();
  }

  function clearSession() {
    resetAnswerState();
    resetTimer();
    setStatus("Ready to record.");
    setApiStatus("");
    // Save the cleared state (question intact) instead of clearDraft so the
    // user stays on the same question after navigating away and back.
    saveDraft();
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  function on(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    state.listeners.push([target, type, handler]);
  }

  window.initMock = function initMock() {
    state.elements = {
      levelSelect: document.querySelector("#levelSelect"),
      categorySelect: document.querySelector("#categorySelect"),
      newQuestionBtn: document.querySelector("#newQuestionBtn"),
      questionText: document.querySelector("#questionText"),
      questionTip: document.querySelector("#questionTip"),
      questionCategory: document.querySelector("#questionCategory"),
      questionLevel: document.querySelector("#questionLevel"),
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
      practiceNotesContent: document.querySelector("#practiceNotesContent"),
    };

    if (!state.elements.recordBtn || !state.elements.transcriptText) return; // not on mock page

    state.currentQuestion = null;
    state.recorder = null;
    state.stream = null;
    state.selectedConfidence = "";
    state.feedback = null;
    state.timerInterval = null;
    state.timerStartedAt = null;
    state.listeners = [];
    // Intentionally NOT reset on every init — these survive SPA navigation:
    //   state.audioBlob, state.audioUrl, state.chunks, state.audioForQuestion

    // Belt cards are display-only. They reflect the AI's assessment of
    // your answer; clicking them used to let the user override the tier
    // but that defeated the point of the AI scoring. Tier is now set
    // exclusively from renderFeedback() based on the clarity/structure/
    // confidence scores.

    on(state.elements.newQuestionBtn, "click", chooseRandomQuestion);
    on(state.elements.levelSelect, "change", () => {
      initCategorySelect();
      chooseRandomQuestion();
    });
    on(state.elements.categorySelect, "change", chooseRandomQuestion);
    on(state.elements.recordBtn, "click", toggleRecording);
    on(state.elements.stopBtn, "click", stopRecording);
    on(state.elements.clearBtn, "click", clearSession);
    on(state.elements.transcribeBtn, "click", transcribeAudio);
    on(state.elements.feedbackBtn, "click", requestFeedback);
    on(state.elements.saveBtn, "click", saveAnswer);
    on(state.elements.transcriptText, "input", () => {
      updateWordCount();
      saveDraft();
    });

    // Warn before refresh/close/back if there's anything ephemeral about
    // to be lost. Two cases:
    //   1. Mid-recording — the active take dies on refresh.
    //   2. Audio in memory — the blob is JS-only; a refresh wipes it even
    //      if the transcript has already been saved to the draft.
    // Transcript and feedback are already in localStorage via saveDraft,
    // so they DO survive refresh — but the audio file does not, and the
    // user may still want it for playback. Better to warn.
    // Modern browsers ignore custom messages and show a standard prompt,
    // so we just need preventDefault + returnValue to trigger it.
    on(window, "beforeunload", (event) => {
      const recording = state.recorder && state.recorder.state === "recording";
      const hasAudio = state.audioBlob !== null;
      if (recording || hasAudio) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    initQuestion();
    updateWordCount();

    // Restore audio from a previous mount if it's still for the current
    // question. SPA nav: user records, navigates to Practice, comes back —
    // the audio is still here. Different question (e.g. they used
    // "Practice Again" on a saved entry): discard the stale blob so we
    // don't claim a recording belongs to a question it doesn't.
    if (state.audioBlob && state.audioForQuestion === state.currentQuestion?.id) {
      // Re-create the object URL if it was revoked, otherwise just rebind
      // it to the new audio element.
      if (!state.audioUrl) {
        state.audioUrl = URL.createObjectURL(state.audioBlob);
      }
      state.elements.audioPlayer.src = state.audioUrl;
      state.elements.audioPlayer.classList.remove("hidden");
      // Audio is back in scope — the user can re-run it through Whisper if
      // they want a more accurate transcript than what live captured.
      state.elements.transcribeBtn.disabled = false;

      // Edge case: user recorded, navigated away before auto-transcribe
      // could run (teardown's elements-null check blocked it), now they're
      // back. Kick off transcription now if we don't already have one.
      if (!state.elements.transcriptText.value.trim()) {
        setStatus("Resumed recording. Transcribing...");
        transcribeAudio();
      }
    } else if (state.audioBlob) {
      // Stale — wrong question. Clean up so the next recording starts fresh.
      revokeAudioUrl();
      state.audioBlob = null;
      state.chunks = [];
      state.audioForQuestion = null;
    }
  };

  window.teardownMock = function teardownMock() {
    // Stop any in-flight recording cleanly so the mic light goes
    // off when the user navigates away. The stop event will fire
    // asynchronously after this teardown completes; its handler is
    // guarded against missing state.elements, and the resulting
    // audioBlob lands in state for when the user comes back.
    try {
      if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
    } catch { /* ignore */ }
    stopLiveTranscription();
    state.stream?.getTracks?.().forEach((track) => track.stop());
    state.stream = null;

    stopTimer();

    state.listeners.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
    state.listeners = [];

    state.recorder = null;
    state.elements = null;
    state.currentQuestion = null;
    // Preserved across SPA nav (cleared only by clearSession, by switching
    // to a different question on re-mount, or by a full page refresh):
    //   state.audioBlob, state.audioUrl, state.chunks, state.audioForQuestion
  };
})();
