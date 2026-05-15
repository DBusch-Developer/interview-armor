// One source of truth for every localStorage key the app reads or writes.
// Frozen so a typo on the consumer side throws instead of silently writing
// to the wrong slot. Values are unchanged from the originals so existing
// data in users' browsers keeps working.
window.STORAGE_KEYS = Object.freeze({
  SAVED_ANSWERS: "interviewArmorSavedAnswers",
  PRACTICE_NOTES: "interviewArmorPracticeNotes",
  MOCK_DRAFT: "interviewArmorMockDraft",
  GROQ_KEY: "interviewArmorGroqKey",
});
