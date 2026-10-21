// Advice from engineers who passed the FE, collected from r/FE_Exam and LinkedIn posts (October 2026).
// Shown in the Playbook tab and inside the matching sessions.

// The Playbook tab, in the order you need it
export const PLAYBOOK = [
  {
    title: "1 · What to study with",
    why: "Several people passed with these and no paid course.",
    items: [
      ["NCEES practice exams", "Buy every volume you can and redo them. People said the real questions felt extremely similar."],
      ["Patrick Shepherd, “The FE Exam: How to Pass on Your First Try”", "Read the strategy chapters, then use its 4 practice exams. Called the closest thing to the real exam; some choices matched exactly."],
      ["PrepFE", "Good for extra problems, but they get repetitive. Don’t use it alone."],
      ["Lindeburg (FERM)", "Optional. Harder than the exam and over-prepares you."],
      ["Free", "Genie Prep FE cheat sheet, the free Coursera FE course, and the YouTube videos and topic playlists in this plan."],
    ],
  },
  {
    title: "2 · How to study",
    items: [
      ["Concept first, then problems", "Especially if you’ve been out of school a while: watch how the parameters relate, then do problem sets."],
      ["The 2-step rule", "If a practice problem takes more than two steps, you probably won’t see it on the exam. Look for the direct handbook formula."],
      ["Only the handbook, under the clock", "Practice with the FE Reference Handbook PDF and 3 minutes per problem, like the real thing."],
      ["Track weak areas", "After every practice exam, list the topics you missed and log days spent per subject."],
      ["You don’t need months", "One engineer, 10 years out of school with a family, passed on 2–3 hours on weekdays for 1–2 months."],
    ],
  },
  {
    title: "3 · Practice exams",
    items: [
      ["Ready = 70% twice", "About 60% passes. Two practice exams at 70% or more means you’re ready."],
      ["Take them like exam day", "Full length, timed, handbook only, phone away."],
      ["Review every miss and every guess", "Overconfidence cost one person their first attempt."],
      ["Triage a topic if you must", "One person guessed and flagged all of thermo and maximized points everywhere else, and passed."],
    ],
  },
  {
    title: "4 · In the exam",
    items: [
      ["Never leave a blank", "Pick an answer even if you flag it (that’s a 25% chance). Come back if there’s time."],
      ["Skip hard ones first", "Flag anything you have no idea about or that’s taking too long, and move on so your confidence doesn’t drop."],
      ["Middle-number rule", "Totally stuck on a numeric answer? Pick a value between the highest and lowest choices."],
      ["Not all multiple choice", "Some questions are fill-in-the-blank."],
      ["The psychrometric chart shows up", "Know how to read it."],
      ["Use leftover time", "Double-check, then triple-check."],
    ],
  },
  {
    title: "5 · Exam day",
    items: [
      ["Sleep, eat, coffee", "A good night’s sleep and a real breakfast."],
      ["Snacks for the break", "You get one scheduled break around question 55."],
      ["Wear layers", "Test centers are cold."],
      ["Arrive early", "30 minutes before your appointment."],
      ["Book the date first", "It’s what gets people studying. One engineer stalled for two years until booking."],
    ],
  },
];

// Short tips shown inside sessions, by session kind
export const SESSION_TIPS = {
  setup: ["Book the exam date first if you haven’t: the deadline does the motivating.",
    "Get the NCEES practice exam and Shepherd’s “How to Pass on Your First Try”. Read Shepherd’s strategy chapters this week."],
  topic: ["Concept first: watch the video, then do the problems.",
    "More than two steps? Stop and look for the direct handbook formula.",
    "3 minutes per problem, handbook only. Log the misses."],
  block: ["Take the timed half like the real exam: never leave a blank, flag and move on."],
  mock: ["Never leave a blank: answer, flag, move on.",
    "Skip hard ones on the first pass so your confidence holds.",
    "Stuck on a number? Pick one between the highest and lowest choices.",
    "Some questions are fill-in-the-blank. Read them carefully.",
    "Use any time left to double-check."],
  review: ["Rework every miss and every guess, not just the wrong ones.",
    "If a topic keeps costing you, decide whether to triage it and bank points elsewhere."],
  light: ["Pack snacks for the break and wear layers: test centers are cold.",
    "Arrive 30 minutes early. Sleep well and eat breakfast."],
  exam: ["Never leave a blank. Flag and come back.",
    "Some questions are fill-in-the-blank.",
    "Snacks at the break, layers, arrive early."],
};

// Practice exam sources, in the order people recommended them
export const MOCK_SOURCE = (n) => n === 2
  ? "Use the official NCEES FE Other Disciplines practice exam for this one."
  : `Use practice exam ${n === 1 ? 1 : Math.min(n - 1, 4)} from Shepherd’s “How to Pass on Your First Try” (said to be closest to the real exam), or another NCEES volume.`;

// Topic playlists shared on r/FE_Exam
export const PLAYLIST_SOURCE = "Topic playlist shared on r/FE_Exam by someone who passed";

export const SOURCES = "From r/FE_Exam and LinkedIn posts by engineers who passed the FE (October 2026).";
