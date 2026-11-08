// Grok-powered AI chat assistant (SpiderBot) for attendance queries.
// Uses the Groq API with llama-3.3-70b-versatile.
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
          canMiss > 0 ? `can miss ${canMiss} more` : `needs ${needMore} more to reach 75%`
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

  const systemPrompt = `You are SpiderBot 🕷️ — a friendly, witty AI assistant built into Arsal's KIET attendance dashboard.
You have the personality of Spider-Man: enthusiastic, helpful, clever, and occasionally crack web-jokes.
Keep responses concise (under 200 words). Use emojis sparingly but effectively.

Your job:
1. Help Arsal understand his attendance data
2. Calculate how many classes he can miss or needs to attend
3. Warn him if any subject is below 75% (the minimum requirement at KIET)
4. Provide study/attendance strategy advice
5. Answer general KIET / college questions

Attendance rules:
- Minimum required: 75% attendance per subject
- Formula for "can miss": floor((present - 0.75 × total) / 0.75) — only if currently above 75%
- Formula for "need to attend": ceil((0.75 × total - present) / 0.25) — if currently below 75%

Current Attendance Data:
${attendanceContext}

Always be supportive and motivating. If Arsal is doing well, celebrate it! If he's at risk, give him a friendly Spider-Man-style warning.`;

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
        max_tokens: 400,
        temperature: 0.75,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ message: "My web-shooters jammed! Groq API error. Try again 🕸️" });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "With great power comes great responsibility... but my response got lost. Try again!";
    return res.status(200).json({ message: reply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ message: 'SpiderBot is temporarily tangled in his web. Try again!' });
  }
}
