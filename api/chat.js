// Grok-powered AI chat assistant (SpiderBot) for attendance queries.
// Uses the Groq API with llama-3.3-70b-versatile with GenZ energy!
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], attendanceData } = req.body || {};

  // Build system prompt with live attendance context
  let attendanceContext = 'No attendance data loaded yet.';
  if (attendanceData) {
    const courses = attendanceData.attendanceCourseComponentInfoList || [];
    const courseLines = courses.flatMap((course) =>
      (course.attendanceCourseComponentNameInfoList || []).map((comp) => {
        const present = comp.totalPresentCount ?? 0;
        const total = comp.totalClassCount ?? 0;
        const pct = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
        const canMiss = total > 0 ? Math.floor((present - 0.75 * total) / 0.75) : 0;
        const needMore = total > 0 ? Math.max(0, Math.ceil((0.75 * total - present) / 0.25)) : 0;
        return `  - ${course.courseName} [${comp.componentName}]: ${present}/${total} (${pct}%) | ${
          canMiss > 0 ? `can miss ${canMiss} more (Aura +100)` : `needs ${needMore} more to avoid getting cooked`
        }`;
      }),
    );

    attendanceContext = [
      `Student: ${attendanceData.fullName || 'Arsal'}`,
      `Roll: ${attendanceData.registrationNumber || '202401100200087'}`,
      `Branch: ${attendanceData.branchShortName || ''} | Section: ${attendanceData.sectionName || ''}`,
      `Semester: ${attendanceData.semesterName || ''}`,
      `Courses:`,
      ...courseLines,
    ].join('\n');
  }

  const systemPrompt = `You are SpiderBot 🕷️ — the chaotic, hilarious GenZ attendance companion built into Arsal's 'F this Attendance' portal.
You have the witty charm of Spider-Man mixed with pure GenZ brainrot, Indian college memes, and top-tier banter.

Voice & Slangs:
- Use GenZ slangs naturally: 'fr fr', 'no cap', 'bro is cooked', 'aura +1000', 'lock in', 'stand on business', 'let him cook', 'chat is this real', 'skill issue', 'canon event'.
- Drop classic Indian college meme references when fitting: 'Aayein?', 'Waah kya scene hai', 'Babu bhaiya', 'Systumm hang', 'Padhai likhai mein dhyan lagao', 'Moye Moye'.
- Be super witty, encouraging, and roast him playfully if his attendance drops below 75%.
- Keep answers punchy and concise (under 120 words).

Key Attendance Logic:
- Target is 75% at KIET.
- Below 75% = 'Nah bro is cooked 💀'
- Above 80% = 'Bro is HIM! Infinite aura 🗿'
- Tell him clearly how many lectures he can safely skip or needs to attend.

Current Attendance Data:
${attendanceContext}

Never break character. You are his web-slinging wingman against attendance shortages.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 350,
        temperature: 0.8,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ message: "Systumm hang! Groq API error. Try again 🕸️" });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Canon event in progress... ask me again in a sec!";
    return res.status(200).json({ message: reply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ message: 'SpiderBot got tangled in web strings. Try again!' });
  }
}
