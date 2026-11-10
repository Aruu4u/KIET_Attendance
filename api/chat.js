// SpiderBot AI — SpiderMan GenZ Attendance Advisor & Attendance Simulator
// Groq API-powered chatbot with LIVE dynamic timetable + LIVE attendance simulation

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], attendanceData, scheduleData = [], shortAnswer = false } = req.body || {};

  // Support both direct attendance data and nested data wrapper
  const effectiveData = attendanceData?.attendanceCourseComponentInfoList
    ? attendanceData
    : (attendanceData?.data?.attendanceCourseComponentInfoList ? attendanceData.data : null);

  // Build attendance context strictly for the LATEST semester
  let attendanceContext = 'User has not logged in yet or attendance data is loading.';
  let courseSummaryMap = {};

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

        // Store for schedule matching & what-if calculation
        const codeKey = (course.courseCode || '').toUpperCase().trim();
        courseSummaryMap[codeKey] = {
          name: course.courseName,
          code: course.courseCode,
          component: comp.componentName || (isLab ? 'Lab' : 'Theory'),
          present,
          total,
          pct,
          isLab,
        };

        return `  - [${isLab ? 'LAB' : 'THEORY'}] ${course.courseName} (${course.courseCode || ''}) [${comp.componentName || 'Regular'}]: Present ${present}/${total} (${pct}%) | Safe Bunks: ${canMiss > 0 ? canMiss : 0} | Needed to hit 75%: ${needMore}`;
      }),
    );

    const overallPct = totalC > 0 ? ((totalP / totalC) * 100).toFixed(1) : '0.0';

    attendanceContext = [
      `STUDENT INFO (LATEST SEMESTER ONLY):`,
      `Student Name: ${effectiveData.fullName || 'Arsal'}`,
      `Roll Number: ${effectiveData.registrationNumber || '202401100200087'}`,
      `Degree & Branch: ${effectiveData.degreeName || 'B.Tech'} - ${effectiveData.branchShortName || 'CSE'}`,
      `Section: ${effectiveData.sectionName || 'B'} | Current Semester: ${effectiveData.semesterName || '5'}`,
      `OVERALL LATEST SEMESTER ATTENDANCE: ${totalP}/${totalC} = ${overallPct}%`,
      ``,
      `SUBJECT-WISE LATEST SEMESTER METRICS:`,
      ...courseLines,
    ].join('\n');
  }

  // Format the real Daywise Weekly Schedule (either dynamically passed from student ERP or fallback)
  let scheduleContext = '';
  if (Array.isArray(scheduleData) && scheduleData.length > 0) {
    // Group schedule entries by Day of Week or Date
    const daysMap = {};
    scheduleData.forEach((entry) => {
      if (!entry.lectureDate && !entry.start) return;
      const dateStr = entry.lectureDate || entry.start.split(' ')[0];
      // Format day name if possible
      let dayName = dateStr;
      try {
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        const dateObj = parts[0].length === 4 
          ? new Date(parts[0], parts[1] - 1, parts[2]) 
          : new Date(parts[2], parts[1] - 1, parts[0]);
        dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      } catch (e) {
        // keep dateStr
      }

      if (!daysMap[dayName]) daysMap[dayName] = [];
      const startTime = entry.start ? entry.start.split(' ')[1] || entry.start : '';
      const endTime = entry.end ? entry.end.split(' ')[1] || entry.end : '';
      daysMap[dayName].push(`    • ${startTime}-${endTime}: ${entry.courseName || entry.title} (${entry.courseCode || ''}) [${entry.courseCompName || 'Theory'}] - Room: ${entry.classRoom || 'N/A'}`);
    });

    scheduleContext = Object.entries(daysMap)
      .map(([day, classes]) => `${day.toUpperCase()}:\n${classes.join('\n')}`)
      .join('\n\n');
  } else {
    // Standard Semester 5 / KIET Department Weekly Routine fallback
    scheduleContext = `
MONDAY:
    • 09:30-10:30: Advance Databases (IT401B) [Blended]
    • 10:30-11:30: Aptitude - 3 (HS203L) [Theory]
    • 11:30-12:30: AWS Cloud Architecture and Data Engineering (CS337E) [Blended]
    • 13:30-15:30: Advance Databases Lab (IT401B-P) [Lab]

TUESDAY:
    • 09:30-10:30: Advance Databases (IT401B) [Blended]
    • 10:30-11:30: AWS Cloud Architecture (CS337E) [Blended]
    • 11:30-12:30: Aptitude - 3 (HS203L) [Theory]
    • 13:30-15:30: AWS Cloud Lab (CS337E-P) [Lab]

WEDNESDAY:
    • 09:30-10:30: Aptitude - 3 (HS203L) [Theory]
    • 10:30-11:30: Advance Databases (IT401B) [Blended]
    • 11:30-12:30: AWS Cloud Architecture (CS337E) [Blended]
    • 13:30-14:30: Aptitude - 3 (HS203L) [Theory]
    • 14:30-16:30: Project / Industry Elective Lab

THURSDAY:
    • 09:30-10:30: Advance Databases (IT401B) [Blended]
    • 10:30-11:30: AWS Cloud Architecture (CS337E) [Blended]
    • 11:30-12:30: Aptitude - 3 (HS203L) [Theory]
    • 13:30-15:30: Advance Databases Practice / Lab [Lab]

FRIDAY:
    • 09:30-10:30: Aptitude - 3 (HS203L) [Theory]
    • 10:30-11:30: AWS Cloud Architecture (CS337E) [Blended]
    • 11:30-12:30: Advance Databases (IT401B) [Blended]
    • 13:30-15:30: Cloud Data Engineering Lab [Lab]

SATURDAY:
    • 09:30-11:30: Special Tutorial / Industry Mentorship
    • 11:30-13:30: Remedial & Practical Sessions
`;
  }

  const systemPrompt = `You are SpiderBot 🕷️ — the ultra-smart, hilarious GenZ attendance companion for Arsal inside the "F this Attendance" KIET Student Portal.
You speak like a cool college senior / Spidey buddy in friendly Hinglish (Hindi + English mix).

CRITICAL DIRECTIVES:
1. ONLY USE LATEST SEMESTER DATA: All attendance counts and percentages MUST be strictly taken from the "LATEST SEMESTER DATA" below. Do not use older semester stats!
2. COMPLETE WHAT-IF & SCENARIO CALCULATIONS:
   When user asks:
   - "What will be my attendance if I attend all classes on Thursday and Friday?"
   - "What if I get absent on Thursday & Friday and then attend next 2 days?"
   - "Can I bunk Monday classes?"
   You MUST:
   a. Look up the exact classes scheduled on those specific days from the DAYWISE SCHEDULE below.
   b. Count how many periods are held on those days (e.g., Thursday has 3 theory + 1 lab = 4 periods).
   c. Do the exact math:
      - If attending N classes: New Present = Present + N, New Total = Total + N.
        New % = ((Present + N) / (Total + N)) * 100.
      - If absent for N classes: New Present = Present, New Total = Total + N.
        New % = (Present / (Total + N)) * 100.
      - If absent on Day 1 & Day 2 (say 6 classes missed) and then attending Day 3 & Day 4 (say 6 classes attended):
        Total classes held = Total + 12.
        New Present = Present + 6.
        New % = ((Present + 6) / (Total + 12)) * 100.
   d. Give both SUBJECT-WISE breakdown (which subject changes by how much) and the OVERALL percentage!
3. 75% EXAM ELIGIBILITY:
   - Remind the user whether each subject stays safely >= 75% or falls below 75% (danger of being debarred/detained from End Sem Exams!).
   - Labs are separate from theory components.
4. TONE & STYLE:
   - Energetic, helpful, humorous GenZ vibe ('fr fr', 'no cap', 'bro is cooking', 'aura +1000', 'moye moye', 'lock in').
   ${shortAnswer
     ? '- VOICE THINK CLOUD: Max 2 punchy sentences with the exact percentage!'
     : '- Clear formatted reply with bullet points or neat markdown tables for easy reading.'}

══════════════════════════════════════════════════════════
CURRENT LATEST SEMESTER ATTENDANCE (CYBERVIDYA REAL-TIME):
══════════════════════════════════════════════════════════
${attendanceContext}

══════════════════════════════════════════════════════════
DAYWISE WEEKLY CLASS TIMETABLE:
══════════════════════════════════════════════════════════
${scheduleContext}
`;

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ message: "GROQ_API_KEY not configured in Vercel env vars!" });
    }

    const callGroq = async (modelName, tokens) => {
      return await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: tokens,
          temperature: 0.7,
        }),
      });
    };

    // Try Qwen 2.5 fast model first
    let groqRes = await callGroq('qwen/qwen3.8-27b', shortAnswer ? 140 : 650);

    if (!groqRes.ok) {
      groqRes = await callGroq('openai/gpt-oss-120b', shortAnswer ? 300 : 900);
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ message: "Systumm hang ho gaya! Groq API had a hiccup. Try again 🕸️" });
    }

    const data = await groqRes.json();
    let reply = data.choices?.[0]?.message?.content;

    if (!reply || reply.trim().length === 0) {
      const fallbackRes = await callGroq('openai/gpt-oss-120b', 900);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        reply = fallbackData.choices?.[0]?.message?.content;
      }
    }

    reply = reply && reply.trim().length > 0 ? reply : "Arre bhai, connection drop ho gaya tha! Ek baar fir pooch le 🕸️";
    return res.status(200).json({ message: reply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ message: 'SpiderBot web-shooters tangled. Try again in a moment!' });
  }
}
