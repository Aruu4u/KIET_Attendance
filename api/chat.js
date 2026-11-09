// Grok/Groq AI chat assistant (SpiderBot) for attendance queries.
// Powered by Groq API with openai/gpt-oss-120b / qwen/qwen3.8-27b
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], attendanceData } = req.body || {};

  // Build system prompt with LIVE attendance context
  let attendanceContext = 'User has not logged in yet or attendance data is loading.';
  if (attendanceData && attendanceData.attendanceCourseComponentInfoList) {
    const courses = attendanceData.attendanceCourseComponentInfoList || [];
    let totalP = 0;
    let totalC = 0;

    const courseLines = courses.flatMap((course) =>
      (course.attendanceCourseComponentNameInfoList || []).map((comp) => {
        const present = comp.totalPresentCount ?? 0;
        const total = comp.totalClassCount ?? 0;
        totalP += present;
        totalC += total;
        const pct = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
        const canMiss = total > 0 ? Math.floor((present - 0.75 * total) / 0.75) : 0;
        const needMore = total > 0 ? Math.max(0, Math.ceil((0.75 * total - present) / 0.25)) : 0;
        return `  - ${course.courseName} (${course.courseCode || ''}) [${comp.componentName}]: ${present}/${total} classes (${pct}%) -> ${
          canMiss > 0 ? `Can safely bunk ${canMiss} classes (Aura +100)` : `Must attend next ${needMore} classes to reach 75%`
        }`;
      }),
    );

    const overallPct = totalC > 0 ? ((totalP / totalC) * 100).toFixed(1) : '0.0';

    attendanceContext = [
      `Student Name: ${attendanceData.fullName || 'Arsal'}`,
      `University Roll Number: ${attendanceData.registrationNumber || '202401100200087'}`,
      `Branch: ${attendanceData.branchShortName || ''} | Section: ${attendanceData.sectionName || ''} | Semester: ${attendanceData.semesterName || ''}`,
      `OVERALL ATTENDANCE: ${totalP}/${totalC} (${overallPct}%)`,
      `Subject-wise breakdown:`,
      ...courseLines,
    ].join('\n');
  }

  const systemPrompt = `You are SpiderBot 🕷️ — the chaotic, hilarious GenZ pixel attendance companion inside Arsal's 'F this Attendance' portal.
You speak like a GenZ college bro mixed with Spider-Man charm and Indian student memes.

Key Personality:
- Use GenZ slangs naturally: 'fr fr', 'no cap', 'bro is cooked', 'aura +1000', 'lock in', 'stand on business', 'let him cook', 'chat is this real', 'canon event', 'skill issue'.
- Add classic Indian engineering college references: 'Aayein?', 'Waah kya scene hai', 'Babu bhaiya', 'Systumm hang', 'Padhai likhai mein dhyan lagao', 'Moye Moye'.
- Answer questions directly using the student's ACTUAL attendance stats below.
- Tell him specifically how many classes he can skip or must attend for any subject he asks about!
- Keep replies punchy, humorous, and under 130 words.

CURRENT REAL ATTENDANCE DATA:
${attendanceContext}
`;

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ message: "GROQ_API_KEY is not configured in Vercel settings!" });
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
        max_tokens: 350,
        temperature: 0.75,
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
