// AI-assisted features described in Chapter 3 (Section 3.4.2) and
// Chapter 4 (Section 4.2.6). Deliberately scoped to administrative
// and clinical-support tasks — no diagnosis, no autonomous treatment
// decisions, matching the AI design philosophy in Section 2.2.4.

function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Matches the weighting described in Appendix A.1 / D.1 of the
// project documentation: name 50%, DOB 30%, phone 20%.
const DUPLICATE_THRESHOLD = 0.85;

function findDuplicateMatches(candidate, existingPatients) {
  return existingPatients
    .map((p) => {
      const nameScore = similarity(candidate.full_name, p.full_name);
      const dobScore = candidate.date_of_birth === p.date_of_birth ? 1 : 0;
      const phoneScore = candidate.phone_number === p.phone_number ? 1 : 0;
      const score = nameScore * 0.5 + dobScore * 0.3 + phoneScore * 0.2;
      return { patient: p, score };
    })
    .filter((m) => m.score >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

// Conditions that trigger a follow-up recommendation, and after how
// many days without a repeat visit — matches Section 3.4.2, FR-12.
const FOLLOWUP_RULES = {
  hypertension: 30,
  diabetes: 30,
  "malaria (severe)": 14,
  "prenatal care": 21,
  asthma: 30,
};

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function needsFollowUp(diagnosis, lastVisitDate) {
  const threshold = FOLLOWUP_RULES[(diagnosis || "").toLowerCase()];
  if (!threshold) return false;
  return daysSince(lastVisitDate) >= threshold;
}

// Rule-based fallback summarizer — used automatically if AI_API_KEY
// is not configured, so the app remains fully functional without a
// paid API key (see Section 4.2.6 for the intended design).
function ruleBasedSummary(notes, diagnosis) {
  const firstSentence = (notes || "").split(".").filter(Boolean)[0] || "Routine consultation conducted";
  const followUpNote = FOLLOWUP_RULES[(diagnosis || "").toLowerCase()]
    ? ` Recommend follow-up visit in ${FOLLOWUP_RULES[diagnosis.toLowerCase()]} days.`
    : "";
  return `${firstSentence.trim()}. Diagnosis: ${diagnosis}.${followUpNote}`.trim();
}

// Optional: real AI-powered summary if AI_API_KEY is set. Falls back
// to the rule-based summarizer on any error, so a flaky API never
// breaks the consultation-saving flow.
async function summarizeConsultation(notes, diagnosis) {
  if (!process.env.AI_API_KEY) {
    return ruleBasedSummary(notes, diagnosis);
  }
  try {
    const response = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.AI_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Summarize this clinical consultation in 2-3 sentences for a medical record. Diagnosis: ${diagnosis}. Notes: ${notes}`,
        }],
      }),
    });
    const data = await response.json();
    return data?.content?.[0]?.text || ruleBasedSummary(notes, diagnosis);
  } catch (err) {
    console.error("AI summarization failed, falling back to rule-based summary:", err.message);
    return ruleBasedSummary(notes, diagnosis);
  }
}

function checkIncompleteInfo(patient) {
  const required = ["full_name", "date_of_birth", "gender", "phone_number", "address"];
  return required.filter((f) => !patient[f] || String(patient[f]).trim() === "");
}

module.exports = {
  similarity,
  findDuplicateMatches,
  needsFollowUp,
  summarizeConsultation,
  checkIncompleteInfo,
  DUPLICATE_THRESHOLD,
  FOLLOWUP_RULES,
};
