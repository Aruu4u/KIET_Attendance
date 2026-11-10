// SpiderBot AI — SpiderMan GenZ Attendance Advisor & Attendance Simulator
// Groq API-powered chatbot with LIVE dynamic timetable + LIVE attendance simulation
// Tools: calculator, calendar/date, Tavily web search (general queries only)

// ─────────────────────────────────────────────────
//  EXACT WEEKLY TIMETABLE (Section B, Sem 5, CSE)
// ─────────────────────────────────────────────────
const WEEKLY_SCHEDULE = {
  Monday: [
    { subject: "PE (Physical Education)", code: "PE", periods: 2, type: "Theory", time: "09:10–10:50" },
    { subject: "TOC (PM)-B", code: "CS313", periods: 1, type: "Theory", time: "10:50–11:40" },
    { subject: "DL&GA Lab (HC/MAITREE/AMK)", code: "CS312-LAB", periods: 1, type: "Lab", time: "11:40–12:30" },
    { subject: "SE Lab (NS/PJ/PV) [E-506]", code: "CS311L-LAB", periods: 2, type: "Lab", time: "14:20–16:00" },
    { subject: "TOC (PM)-B", code: "CS313", periods: 1, type: "Theory", time: "16:00–16:50" },
  ],
  Tuesday: [
    { subject: "SE (NS)(CS311L)-B", code: "CS311L", periods: 1, type: "Theory", time: "09:10–10:00" },
    { subject: "TOC (PM)-B", code: "CS313", periods: 1, type: "Theory", time: "10:00–10:50" },
    { subject: "PE (Physical Education)", code: "PE", periods: 2, type: "Theory", time: "10:50–12:30" },
    { subject: "SSFE (SK)(HS204L)-B", code: "HS204L", periods: 1, type: "Theory", time: "12:30–13:20" },
    { subject: "ADBMS (SDC)-B", code: "IT401B", periods: 1, type: "Theory", time: "14:20–15:10" },
    { subject: "APT (MG)-B (HS203L)", code: "HS203L", periods: 2, type: "Theory", time: "15:10–16:50" },
  ],
  Wednesday: [
    { subject: "PE (Physical Education)", code: "PE", periods: 2, type: "Theory", time: "09:10–10:50" },
    { subject: "DL&GA (HC)-B", code: "CS312", periods: 1, type: "Theory", time: "10:50–11:40" },
    { subject: "SE (NS)(CS311L)-B", code: "CS311L", periods: 1, type: "Theory", time: "11:40–12:30" },
    { subject: "ADBMS (SDC)-B", code: "IT401B", periods: 1, type: "Theory", time: "12:30–13:20" },
  ],
  Thursday: [
    { subject: "PSL-I (PN)-B", code: "CS314", periods: 2, type: "Theory", time: "09:10–10:50" },
    { subject: "DL&GA (HC)-B", code: "CS312", periods: 1, type: "Theory", time: "10:50–11:40" },
    { subject: "TOC (PM)-B", code: "CS313", periods: 1, type: "Theory", time: "11:40–12:30" },
    { subject: "SSFE (SK)(HS204L)-B", code: "HS204L", periods: 1, type: "Theory", time: "12:30–13:20" },
    { subject: "ADBMS Lab (NY/SDC/VK)", code: "IT401B-LAB", periods: 2, type: "Lab", time: "14:20–16:00" },
  ],
  Friday: [
    { subject: "DL&GA (HC)-B", code: "CS312", periods: 1, type: "Theory", time: "09:10–10:00" },
    { subject: "SE (NS)(CS311L)-B", code: "CS311L", periods: 1, type: "Theory", time: "10:00–10:50" },
    { subject: "ADBMS (SDC)-B", code: "IT401B", periods: 1, type: "Theory", time: "10:50–11:40" },
    { subject: "PSL (PN)-B", code: "CS314", periods: 2, type: "Theory", time: "11:40–13:20" },
  ],
};

// Build human-readable schedule context for the system prompt
function buildScheduleContext() {
  const lines = [];
  for (const [day, classes] of Object.entries(WEEKLY_SCHEDULE)) {
    const totalPeriods = classes.reduce((s, c) => s + c.periods, 0);
    lines.push(`\n${day.toUpperCase()} (${totalPeriods} periods total):`);
    for (const c of classes) {
      lines.push(`  • ${c.time}  [${c.type.toUpperCase()}]  ${c.subject} (${c.code}) — ${c.periods} period${c.periods > 1 ? 's' : ''}`);
    }
  }
  return lines.join('\n');
}

// Build a per-code count of periods per day — used by what-if logic in the prompt
function buildDayPeriodMap() {
  const result = {};
  for (const [day, classes] of Object.entries(WEEKLY_SCHEDULE)) {
    result[day] = {};
    for (const c of classes) {
      const key = c.code.replace('-LAB', '');
      result[day][key] = (result[day][key] || 0) + c.periods;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────
//  TOOL DEFINITIONS (OpenAI-compatible for Groq)
// ─────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Evaluate a safe mathematical expression. Use for attendance percentage calculations, what-if simulations, arithmetic. Input must be a valid JS math expression string.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'A safe math expression, e.g. "((44+3)/(55+5))*100" or "Math.floor((44 - 0.75*55)/0.75)"',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_date_info',
      description: 'Get the current date, day of week, week number, days until a future date, or day of week for a given date. Useful for schedule-based queries.',
      parameters: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            enum: ['current_date', 'day_of_week', 'days_until'],
            description: '"current_date" returns today\'s full info; "day_of_week" returns the weekday for a given date; "days_until" returns how many days until a given date.',
          },
          date: {
            type: 'string',
            description: 'ISO date string YYYY-MM-DD. Required for day_of_week and days_until.',
          },
        },
        required: ['query_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using Tavily for GENERAL knowledge questions only — tech concepts, definitions, news, coding help, etc. DO NOT use for attendance queries, schedule questions, or anything about Arsal\'s personal data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web.',
          },
        },
        required: ['query'],
      },
    },
  },
];

// ─────────────────────────────────────────────────
//  TOOL EXECUTOR
// ─────────────────────────────────────────────────
async function executeTool(toolName, args) {
  if (toolName === 'calculator') {
    try {
      // Safe eval using Function constructor — only math expressions allowed
      const expr = String(args.expression || '').replace(/[^0-9+\-*/().,% MathflooreilsqrtPIabsroundmincmax\s]/g, '');
      // biome-ignore lint/security/noGlobalEval: safe math expression evaluation only
      const result = Function(`"use strict"; return (${expr})`)();
      return { result: typeof result === 'number' ? result : null, expression: expr };
    } catch (e) {
      return { error: `Could not evaluate: ${e.message}` };
    }
  }

  if (toolName === 'get_date_info') {
    // IST offset: UTC+5:30
    const now = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayISO = now.toISOString().split('T')[0];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (args.query_type === 'current_date') {
      return {
        date: todayISO,
        day: days[now.getUTCDay()],
        time_ist: now.toISOString().replace('T', ' ').substring(0, 16) + ' IST',
        week_number: Math.ceil((now.getUTCDate() - now.getUTCDay() + 1) / 7),
        today_schedule: WEEKLY_SCHEDULE[days[now.getUTCDay()]] || 'No classes (weekend/holiday)',
      };
    }

    if (args.query_type === 'day_of_week' && args.date) {
      const d = new Date(args.date + 'T00:00:00Z');
      return { date: args.date, day: days[d.getUTCDay()] };
    }

    if (args.query_type === 'days_until' && args.date) {
      const target = new Date(args.date + 'T00:00:00Z');
      const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      return { date: args.date, days_until: diff, day: days[target.getUTCDay()] };
    }

    return { error: 'Unknown query_type' };
  }

  if (toolName === 'web_search') {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return { error: 'Tavily API key not configured' };

    try {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: args.query,
          search_depth: 'basic',
          max_results: 4,
          include_answer: true,
        }),
      });
      const data = await resp.json();
      return {
        answer: data.answer || '',
        results: (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.substring(0, 300),
        })),
      };
    } catch (e) {
      return { error: `Tavily search failed: ${e.message}` };
    }
  }

  return { error: `Unknown tool: ${toolName}` };
}

// ─────────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────────
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

  // ── Build attendance context ──
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

        return `  - [${isLab ? 'LAB' : 'THEORY'}] ${course.courseName} (${course.courseCode || ''}) [${comp.componentName || 'Regular'}]: Present ${present}/${total} (${pct}%) | Safe Bunks Left: ${canMiss > 0 ? canMiss : 0} | Classes needed to reach 75%: ${needMore}`;
      }),
    );

    const overallPct = totalC > 0 ? ((totalP / totalC) * 100).toFixed(1) : '0.0';
    attendanceContext = [
      `STUDENT INFO (LATEST SEMESTER ONLY):`,
      `Student Name: Arsal`,
      `Roll Number: ${effectiveData.registrationNumber || '202401100200087'}`,
      `Degree & Branch: ${effectiveData.degreeName || 'B.Tech'} - ${effectiveData.branchShortName || 'CSE'}`,
      `Section: ${effectiveData.sectionName || 'B'} | Current Semester: ${effectiveData.semesterName || '5'}`,
      `OVERALL LATEST SEMESTER ATTENDANCE: ${totalP}/${totalC} = ${overallPct}%`,
      ``,
      `SUBJECT-WISE LATEST SEMESTER METRICS:`,
      ...courseLines,
    ].join('\n');
  }

  // ── Build schedule context ──
  const scheduleContext = buildScheduleContext();
  const dayPeriodMap = buildDayPeriodMap();

  // ── System prompt ──
  const systemPrompt = `You are SpiderBot 🕷️ — the ultra-smart, hilarious GenZ attendance companion for Arsal inside the "F this Attendance" KIET Student Portal.
You speak like a cool college senior / Spidey buddy in friendly Hinglish (Hindi + English mix).

YOU HAVE TOOLS — use them actively:
- **calculator**: For ALL attendance math, percentages, what-if simulations. ALWAYS use this tool to do math — do not guess or calculate in your head.
- **get_date_info**: To know today's date/day, check what classes are today, calculate days until exams, etc.
- **web_search**: ONLY for general knowledge — tech concepts, coding doubts, general facts. NEVER use for Arsal's attendance, schedule, or personal queries.

CRITICAL RULES:
1. ONLY USE LATEST SEMESTER DATA for attendance queries. Never use older semester stats.
2. WHAT-IF SCENARIO CALCULATIONS — when user asks things like:
   - "What if I attend all classes on Thursday and Friday?"
   - "What if I bunk Monday?"
   - "What if I am absent for 2 days and attend the next 3?"
   You MUST:
   a. Look up the EXACT classes for those days from the TIMETABLE below.
   b. Count total periods for those days (labs count separately — each lab period = 1 period for attendance).
   c. Use the calculator tool to compute: 
      - Attending N periods: New% = ((present+N)/(total+N))*100
      - Absent for N periods: New% = (present/(total+N))*100
      - Combined: Absent M then attend N: New% = ((present+N)/(total+M+N))*100
   d. Show BOTH subject-wise AND overall impact.
3. 75% EXAM ELIGIBILITY:
   - Warn if any subject drops below 75% (risk of being debarred from End Sem Exams!)
   - Labs are tracked separately from theory.
4. MODE OF ANSWERING (CRITICAL):
   ${shortAnswer
     ? `• AVATAR FLOATING THINK-BUBBLE MODE: 
        - Provide ONLY the direct, crisp, relevant answer in 1-2 short sentences max!
        - ZERO filler, no long introductory text, no tables. Directly give the exact count/answer.`
     : `• CHATBOX DIALOG MODE:
        - Provide a full, detailed, comprehensive breakdown with neat markdown tables, subject-by-subject analysis, and eligibility guidance.`}
5. HANDLING MISSED CLASSES / DATE RANGE QUERIES:
   - When asked "what classes did I miss from [Date A] to [Date B]":
     a. Determine the days of the week falling between those dates (e.g. 28th Oct is Tuesday, 29th Wednesday, 30th Thursday, 31st Friday, etc.).
     b. Match each day against the EXACT DAYWISE WEEKLY TIMETABLE below.
     c. List every subject and lecture held on those days with their period count.
     d. Compute total periods missed using the calculator tool.
     e. If specific absent dates are checked against total recorded absents (Total - Present = ${effectiveData ? 'Total Classes - Present Classes' : 'absent count'}), clearly correlate how many classes were held on those days and the attendance impact!
     f. NEVER say "Let me check the exact dates and classes for that period" without actually listing them! You already have the entire schedule right here in your prompt! Give the answer directly!

TIMETABLE KEY (Periods per day):
${JSON.stringify(dayPeriodMap, null, 2)}

══════════════════════════════════════════════════════════
CURRENT LATEST SEMESTER ATTENDANCE (CYBERVIDYA REAL-TIME):
══════════════════════════════════════════════════════════
${attendanceContext}

══════════════════════════════════════════════════════════
EXACT DAYWISE WEEKLY TIMETABLE (Section B, CSE, Sem 5):
══════════════════════════════════════════════════════════
${scheduleContext}

SUBJECT CODE LEGEND:
  PE       = Physical Education
  CS311L   = Software Engineering (SE) — Theory
  CS311L-LAB = SE Lab
  CS312    = Digital Logic & Graph Algorithms (DL&GA) — Theory
  CS312-LAB = DL&GA Lab
  CS313    = Theory of Computation (TOC) — Theory
  CS314    = Problem Solving Lab-I (PSL-I) — Theory
  IT401B   = Advanced Database Management Systems (ADBMS) — Theory
  IT401B-LAB = ADBMS Lab
  HS204L   = Soft Skills For Employability (SSFE) — Theory
  HS203L   = Aptitude-3 (APT) — Theory
`;

  // ── Call Groq with tool support ──
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY not configured in Vercel env vars!' });
    }

    // Model: llama-3.3-70b has the best tool-calling support on Groq
    const MODEL = 'llama-3.3-70b-versatile';
    const MAX_TOOL_ROUNDS = 4; // prevent infinite loops

    let conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    let finalReply = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const groqBody = {
        model: MODEL,
        messages: conversationMessages,
        max_tokens: shortAnswer ? 200 : 900,
        temperature: 0.65,
        tools: TOOLS,
        tool_choice: 'auto',
      };

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groqBody),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error('Groq API error:', errText);
        // Fallback: try without tools if model issue
        if (round === 0) {
          const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen/qwen3.8-27b',
              messages: conversationMessages,
              max_tokens: shortAnswer ? 200 : 750,
              temperature: 0.65,
            }),
          });
          if (fallbackRes.ok) {
            const fd = await fallbackRes.json();
            finalReply = fd.choices?.[0]?.message?.content || null;
          }
          break;
        }
        break;
      }

      const data = await groqRes.json();
      const choice = data.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) break;

      // If the model is done (no tool calls), extract final reply
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        finalReply = assistantMsg.content || null;
        break;
      }

      // Execute all tool calls in this round
      conversationMessages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* ignore */ }

        const toolResult = await executeTool(toolCall.function.name, toolArgs);
        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
      // Loop back — let the model see the tool results and respond
    }

    finalReply = finalReply && finalReply.trim().length > 0
      ? finalReply
      : 'Arre bhai, connection drop ho gaya tha! Ek baar fir pooch le 🕸️';

    return res.status(200).json({ message: finalReply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ message: 'SpiderBot web-shooters tangled. Try again in a moment! 🕸️' });
  }
}
