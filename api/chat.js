// SpiderBot AI — SpiderMan GenZ Attendance Advisor
// Groq API-powered chatbot with LIVE attendance data + KIET timetable knowledge

// ─────────────────────────────────────────────
// HARDCODED WEEKLY TIMETABLE
// Branch: CSE-AI | Section: B | Sem: 3 (Odd 2024-25)
// Source: KIET student portal timetable
// ─────────────────────────────────────────────
const WEEKLY_TIMETABLE = `
KIET GROUP OF INSTITUTIONS — WEEKLY CLASS SCHEDULE
Branch: CSE (AI) | Section: B | Semester: 3 | Academic Year: 2024-25
Roll: 202401100200087 | Student: Arsal

ATTENDANCE RULE: Min 75% per subject to be eligible for End-Semester Exam.
LABS count separately from THEORY (they are graded independently).
Missing a 2-hour lab slot = missing 1 lab attendance unit.

MONDAY:
  09:30–10:30  Mathematics-III (MA3101) [Theory]
  10:30–11:30  Data Structures using C (CS3102) [Theory]
  11:30–12:30  Digital Electronics (EC3103) [Theory]
  01:30–02:30  Python Programming (CS3104) [Theory]
  02:30–04:30  Data Structures Lab (CS3151) [Lab — 2hrs]

TUESDAY:
  09:30–10:30  Mathematics-III (MA3101) [Theory]
  10:30–11:30  Computer Organization & Architecture (CS3103) [Theory]
  11:30–12:30  Digital Electronics (EC3103) [Theory]
  01:30–03:30  Digital Electronics Lab (EC3151) [Lab — 2hrs]
  03:30–04:30  Python Programming (CS3104) [Theory]

WEDNESDAY:
  09:30–11:30  Python Programming Lab (CS3152) [Lab — 2hrs]
  11:30–12:30  Data Structures using C (CS3102) [Theory]
  01:30–02:30  Computer Organization & Architecture (CS3103) [Theory]
  02:30–03:30  Mathematics-III (MA3101) [Theory]
  03:30–04:30  Professional Communication (HU3101) [Theory]

THURSDAY:
  09:30–10:30  Digital Electronics (EC3103) [Theory]
  10:30–11:30  Data Structures using C (CS3102) [Theory]
  11:30–12:30  Computer Organization & Architecture (CS3103) [Theory]
  01:30–03:30  Computer Organization & Architecture Lab (CS3153) [Lab — 2hrs]
  03:30–04:30  Professional Communication (HU3101) [Theory]

FRIDAY:
  09:30–10:30  Professional Communication (HU3101) [Theory]
  10:30–11:30  Mathematics-III (MA3101) [Theory]
  11:30–12:30  Python Programming (CS3104) [Theory]
  01:30–02:30  Data Structures using C (CS3102) [Theory]
  02:30–03:30  Computer Organization & Architecture (CS3103) [Theory]

SATURDAY:
  09:30–10:30  Python Programming (CS3104) [Theory]
  10:30–11:30  Digital Electronics (EC3103) [Theory]
  (Remaining slots vary — check portal for updates)

SUBJECT LEGEND:
  MA3101  — Mathematics-III (Theory)
  CS3102  — Data Structures using C (Theory)
  EC3103  — Digital Electronics (Theory)
  CS3103  — Computer Organization & Architecture (Theory)
  CS3104  — Python Programming (Theory)
  HU3101  — Professional Communication (Theory)
  CS3151  — Data Structures Lab (Lab)
  EC3151  — Digital Electronics Lab (Lab)
  CS3152  — Python Programming Lab (Lab)
  CS3153  — Computer Organization & Architecture Lab (Lab)

HOW TO CALCULATE SAFE BUNKS:
  Formula: Safe_bunks = floor((Present - 0.75 × Total) / 0.75)
  If result is negative, student MUST attend that many consecutive classes to reach 75%.
  Labs and Theory are tracked separately — both must stay above 75%.
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], attendanceData, shortAnswer = false } = req.body || {};

  // Support both direct attendance data and nested data wrapper
  const effectiveData = attendanceData?.attendanceCourseComponentInfoList
    ? attendanceData
    : (attendanceData?.data?.attendanceCourseComponentInfoList ? attendanceData.data : null);

  // Build attendance context from LIVE CyberVidya data
  let attendanceContext = 'User has not logged in yet or attendance data is loading.';
  if (effectiveData && effectiveData.attendanceCourseComponentInfoList) {
    const courses = effectiveData.attendanceCourseComponentInfoList || [];
    let totalP = 0;
    let totalC = 0;

    const courseLines = courses.flatMap((course) =>
      (course.attendanceCourseComponentNameInfoList || []).map((comp) => {
        const present = Number(comp.numberOfPresent ?? comp.totalPresentCount ?? 0) + Number(comp.numberOfExtraAttendance ?? 0);
        const total = Number(comp.numberOfPeriods ?? comp.totalClassCount ?? 0);
        totalP += present;
        totalC += total;
        const pct = total > 0 ? ((present / total) * 100).toFixed(1) : (comp.presentPercentageWith || comp.presentPercentage || '0.0');
        const canMiss = total > 0 ? Math.floor((present - 0.75 * total) / 0.75) : 0;
        const needMore = total > 0 ? Math.max(0, Math.ceil((0.75 * total - present) / 0.25)) : 0;
        const isLab = (comp.componentName || '').toLowerCase().includes('lab') || (course.courseName || '').toLowerCase().includes('lab');
        return `  - [${isLab ? 'LAB' : 'THEORY'}] ${course.courseName} (${course.courseCode || ''}) [${comp.componentName || 'Regular'}]: ${present}/${total} attended (${pct}%) -> ${
          canMiss > 0
            ? `✅ Can safely bunk ${canMiss} more class(es) and stay above 75%`
            : (needMore > 0
                ? `🚨 DANGER! Must attend next ${needMore} consecutive class(es) to hit 75% (exam eligibility at risk!)`
                : `⚠️ Exactly at 75% line! Don't miss even one!`)
        }`;
      }),
    );

    const overallPct = totalC > 0 ? ((totalP / totalC) * 100).toFixed(1) : '0.0';

    attendanceContext = [
      `Student Name: ${effectiveData.fullName || 'Arsal'}`,
      `Roll Number: ${effectiveData.registrationNumber || '202401100200087'}`,
      `Branch: ${effectiveData.branchShortName || 'CSE-AI'} | Section: ${effectiveData.sectionName || 'B'} | Semester: ${effectiveData.semesterName || '3'}`,
      `OVERALL ATTENDANCE: ${totalP}/${totalC} = ${overallPct}%`,
      ``,
      `SUBJECT-WISE LIVE ATTENDANCE:`,
      ...courseLines,
    ].join('\n');
  }

  const systemPrompt = `You are SpiderBot 🕷️ — the chaotic, hilarious GenZ pixel attendance companion inside Arsal's "F this Attendance" portal at KIET Group of Institutions.
You speak like a GenZ college bro mixed with Spider-Man swagger and Indian engineering student memes.

KEY RULES:
- Use GenZ slangs naturally: 'fr fr', 'no cap', 'bro is cooked', 'aura +1000', 'lock in', 'stand on business', 'let him cook', 'canon event', 'skill issue', 'rizz', 'sigma'.
- Indian college memes: 'Aayein?', 'Waah kya scene hai', 'Babu bhaiya', 'Padhai likhai mein dhyan lagao', 'Moye Moye', 'Ek aur cut'.
- Answer DIRECTLY with real numbers from the attendance data below — no vague answers!
- For bunk/skip questions: Use formula → Safe_bunks = floor((Present - 0.75 × Total) / 0.75). Show the math.
- Labs (CS3151, EC3151, CS3152, CS3153) are tracked SEPARATELY from theory — remind user of this.
- Minimum 75% attendance required per subject to sit in End-Semester Exam (ESE).
- Today's date context: November 2026. Use this to reason about remaining classes if asked.
${shortAnswer
  ? '- VOICE MODE (think-cloud bubble): Reply in MAXIMUM 2 sentences, 25 words. Be punchy and direct with the number!'
  : '- Keep replies under 150 words. Use line breaks for readability.'}

═══════════════════════════════════════
LIVE ATTENDANCE DATA (from CyberVidya):
═══════════════════════════════════════
${attendanceContext}

═══════════════════════════════════════
WEEKLY TIMETABLE (use this for day/date bunk planning):
═══════════════════════════════════════
${WEEKLY_TIMETABLE}
`;

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ message: "GROQ_API_KEY not configured in Vercel env vars!" });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: shortAnswer ? 100 : 400,
        temperature: 0.72,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ message: "Systumm hang ho gaya! Groq API had a hiccup. Try again 🕸️" });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Canon event in progress... ask me again in a sec!";
    return res.status(200).json({ message: reply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ message: 'SpiderBot web-shooters tangled. Try again in a moment!' });
  }
}
