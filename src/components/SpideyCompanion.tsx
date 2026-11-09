import { useEffect, useRef, useState } from "react";
import { playSound, type SoundType } from "../utils/soundManager";
import { spideyVoice } from "../utils/voiceAssistant";

interface PopMeme {
	id: number;
	image?: string;
	title: string;
	subtitle?: string;
	sound?: SoundType;
}

interface SpideyCompanionProps {
	attendanceData: unknown;
	onOpenChat: () => void;
	isChatOpen?: boolean;
}

export default function SpideyCompanion({
	attendanceData,
	onOpenChat,
	isChatOpen = false,
}: SpideyCompanionProps) {
	const [speech, setSpeech] = useState<string>(
		"Tap me to chat 💬  Double-tap to swing 🕸️\nSay 'Hey Spidey' to ask anything! 🎙️",
	);
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	const SPRITE_SIZE = 76;
	const TOP_CEILING_ZONE = 75;

	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 30, y: 320 });
	const [isSwingingArc, setIsSwingingArc] = useState<boolean>(false);
	const [rotation, setRotation] = useState<number>(0);
	const [poseState, setPoseState] = useState<"idle" | "swing" | "top_hang">("idle");

	const [ceilingAnchor, setCeilingAnchor] = useState<{ x: number; y: number } | null>(null);
	const [webShootProgress, setWebShootProgress] = useState<number>(0);

	// All mutable drag state lives in refs — avoids stale closure issues
	const posRef = useRef({ x: 30, y: 320 });
	const isDraggingRef = useRef(false);
	const dragStartClientRef = useRef({ x: 0, y: 0 });
	const dragStartPosRef = useRef({ x: 0, y: 0 });
	const dragDistanceRef = useRef(0);
	const swingAnimRef = useRef<number | null>(null);
	const shootAnimRef = useRef<number | null>(null);

	// Double-tap: detected at pointerdown level using timestamps (works on mobile too)
	const lastTapTimeRef = useRef<number>(0);
	const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const doubleTapThreshold = 300; // ms

	const clampPosition = (x: number, y: number) => {
		const W = window.innerWidth;
		const H = window.innerHeight;
		return {
			x: Math.max(14, Math.min(W - SPRITE_SIZE - 14, x)),
			y: Math.max(16, Math.min(H - SPRITE_SIZE - 95, y)),
		};
	};

	// Keep posRef in sync with state
	const setPosSynced = (p: { x: number; y: number }) => {
		posRef.current = p;
		setPos(p);
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
			if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);
			if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
		};
	}, []);

	// ── "Hey Spidey" always-on background voice listener ──
	// Starts voice recognition silently on mount so wake word is always ready.
	// Never opens the chatbot — answers ONLY in the think-cloud bubble.
	useEffect(() => {
		// Auto-start voice in background (no mic button needed)
		if (spideyVoice.isSupported() && !spideyVoice.getIsRunning()) {
			spideyVoice.start();
		}

		const unsubStatus = spideyVoice.onStatus((listening, msg) => {
			// Only update bubble if NOT already in a voice answer and chat is closed
			if (!isChatOpen) {
				if (listening) {
					setSpeech(msg);
					setIsPeeping(true);
				}
			}
		});

		const handleVoiceQuery = async (query: string) => {
			// When chatbot is open, SpiderChat handles the query — Spidey stays silent
			if (isChatOpen) return;

			// Chat is CLOSED → answer briefly in the think-cloud. Never open chatbox.
			setSpeech("Thinking... 🕷️💭");
			setIsPeeping(true);
			playSound("spiderman", 0.25);

			try {
				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						messages: [{ role: "user", content: query }],
						attendanceData,
						shortAnswer: true,
					}),
				});
				const data = await res.json();
				const reply = data.message || "Ask me again, bro! 🕸️";
				setSpeech(reply);
				setIsPeeping(true);
				spideyVoice.speak(reply);
			} catch {
				setSpeech("Web-shooters jammed! Try again 🕸️");
				setIsPeeping(true);
			}
		};

		const unsubQuery = spideyVoice.onQuery(handleVoiceQuery);

		return () => {
			unsubStatus();
			unsubQuery();
			// Don't stop voice on unmount — keep it alive globally
		};
	}, [isChatOpen, attendanceData]);

	// ── Attendance meme popups on login ──
	useEffect(() => {
		if (!attendanceData) return;
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			const eff = (attendanceData as any)?.attendanceCourseComponentInfoList
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				? (attendanceData as any)
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				: (attendanceData as any)?.data;
			let p = 0, t = 0;
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			eff?.attendanceCourseComponentInfoList?.forEach((c: any) => {
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				c.attendanceCourseComponentNameInfoList?.forEach((comp: any) => {
					p += Number(comp.numberOfPresent ?? comp.totalPresentCount ?? 0) + Number(comp.numberOfExtraAttendance ?? 0);
					t += Number(comp.numberOfPeriods ?? comp.totalClassCount ?? 0);
				});
			});
			const pct = t > 0 ? (p / t) * 100 : 0;
			const timer = setTimeout(() => {
				if (pct >= 80) {
					setActiveMeme({ id: Date.now(), image: "/sounds/waah-kya-scene-hai.jpg", title: "WAAH KYA SCENE HAI! 🔥", subtitle: `Overall: ${pct.toFixed(1)}% — Bro is HIM!`, sound: "waah_kya_scene" });
					playSound("waah_kya_scene", 0.7);
					setSpeech(`${pct.toFixed(1)}% attendance?! Infinite aura 🗿`);
				} else if (pct < 70) {
					setActiveMeme({ id: Date.now(), title: "FAAAAH! 💀 BRO IS COOKED", subtitle: `Overall: ${pct.toFixed(1)}%`, sound: "faaah" });
					playSound("faaah", 0.6);
					setSpeech(`Only ${pct.toFixed(1)}%?! Chat, bro is cooked fr 😭`);
				} else if (pct < 75) {
					setActiveMeme({ id: Date.now(), image: "/sounds/cat-laugh-meme-1.jpg", title: "DETENTION RISK 😹", subtitle: `Overall: ${pct.toFixed(1)}% — Under 75%!`, sound: "cat_laugh" });
					playSound("cat_laugh", 0.6);
					setSpeech(`${pct.toFixed(1)}%! Even the cat is laughing 💀`);
				} else {
					playSound("oh_my_god", 0.5);
					setSpeech(`${pct.toFixed(1)}% — above 75%! Let him cook 🍳`);
				}
			}, 1500);
			return () => clearTimeout(timer);
		} catch { /* ignore */ }
	}, [attendanceData]);

	useEffect(() => {
		if (activeMeme) {
			const t = setTimeout(() => setActiveMeme(null), 6500);
			return () => clearTimeout(t);
		}
	}, [activeMeme]);

	// ── Swing animation ──
	const triggerWebSwing = (startX: number, startY: number) => {
		if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
		if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);

		setIsSwingingArc(true);
		setPoseState("swing");
		playSound("web_swing", 0.7);
		setSpeech("SWIIIIIING! 🕸️💨");
		setIsPeeping(true);

		const anchorX = Math.max(35, Math.min(window.innerWidth - 35, startX + 36));
		const anchor = { x: anchorX, y: 0 };
		setCeilingAnchor(anchor);
		setWebShootProgress(0.1);

		// Animate web shoot line to ceiling
		const shotStart = performance.now();
		const animateShot = (now: number) => {
			const p = Math.min(1, (now - shotStart) / 110);
			setWebShootProgress(p);
			if (p < 1) shootAnimRef.current = requestAnimationFrame(animateShot);
		};
		shootAnimRef.current = requestAnimationFrame(animateShot);

		// Pendulum swing physics
		const swingDir = startX < window.innerWidth / 2 ? 1 : -1;
		let vx = swingDir * 9;
		let vy = -3.5;
		let cx = startX, cy = startY;
		let frame = 0;
		const maxFrames = 60;
		const restRope = Math.max(110, Math.hypot(startX + 36 - anchorX, startY + 18));

		const swingLoop = () => {
			frame++;
			if (frame < 40) {
				const d = Math.hypot(cx + 36 - anchor.x, cy + 18 - anchor.y);
				if (d > restRope) {
					const tension = (d - restRope) * 0.045;
					vx -= ((cx + 36 - anchor.x) / d) * tension;
					vy -= ((cy + 18 - anchor.y) / d) * tension;
				}
				vy += 0.33;
			} else {
				if (frame === 40) { setCeilingAnchor(null); setWebShootProgress(0); }
				vy += 0.44;
			}
			vx *= 0.966; vy *= 0.966;
			cx += vx; cy += vy;

			const b = clampPosition(cx, cy);
			if (b.x !== cx) { vx = -vx * 0.25; cx = b.x; }
			if (b.y !== cy) { vy = -vy * 0.15; cy = b.y; }

			setPosSynced({ x: cx, y: cy });
			const angle = (Math.atan2(vx, vy) * 180) / Math.PI;
			setRotation(Math.max(-40, Math.min(40, (angle - 90) * 0.4)));

			if (frame >= maxFrames || (frame > 32 && Math.abs(vx) < 0.6 && Math.abs(vy) < 0.9)) {
				swingAnimRef.current = null;
				setIsSwingingArc(false);
				setCeilingAnchor(null);
				setWebShootProgress(0);
				setRotation(0);
				setPoseState("idle");
				setSpeech("Smooth landing! 🍕🕸️");
				setIsPeeping(true);
				return;
			}
			swingAnimRef.current = requestAnimationFrame(swingLoop);
		};
		swingAnimRef.current = requestAnimationFrame(swingLoop);
	};

	// ── Single tap → open chatbot ──
	const triggerChat = () => {
		if (!attendanceData) {
			setSpeech("Login first bro, then we chat! 🔒🕸️");
			setIsPeeping(true);
			playSound("dexter", 0.4);
		} else {
			setSpeech("Opening SpiderBot... 💬🕷️");
			setIsPeeping(true);
			onOpenChat();
		}
	};

	// ── Global pointer listeners (attached once, not re-attached on every render) ──
	useEffect(() => {
		const onMove = (clientX: number, clientY: number) => {
			if (!isDraggingRef.current) return;
			const moved = Math.hypot(clientX - dragStartClientRef.current.x, clientY - dragStartClientRef.current.y);
			dragDistanceRef.current = moved;
			if (moved > 8) {
				const raw = { x: clientX - (dragStartClientRef.current.x - dragStartPosRef.current.x), y: clientY - (dragStartClientRef.current.y - dragStartPosRef.current.y) };
				const clamped = clampPosition(raw.x, raw.y);
				setPosSynced(clamped);
			}
		};

		const onEnd = (clientX: number, clientY: number) => {
			if (!isDraggingRef.current) return;
			isDraggingRef.current = false;

			const moved = dragDistanceRef.current;

			if (moved > 8) {
				// It was a real drag — place Spidey at drop position
				const raw = {
					x: clientX - (dragStartClientRef.current.x - dragStartPosRef.current.x),
					y: clientY - (dragStartClientRef.current.y - dragStartPosRef.current.y),
				};
				const clamped = clampPosition(raw.x, raw.y);
				if (clamped.y <= TOP_CEILING_ZONE) {
					setPosSynced({ x: clamped.x, y: 16 });
					setPoseState("top_hang");
					setRotation(0);
					setSpeech("Chillin' upside down! 🧗‍♂️🕸️");
					setIsPeeping(true);
				} else {
					setPosSynced(clamped);
					setPoseState("idle");
					setRotation(0);
				}
				return;
			}

			// It was a tap — check single vs double
			const now = Date.now();
			const sinceLastTap = now - lastTapTimeRef.current;

			if (sinceLastTap < doubleTapThreshold && sinceLastTap > 0) {
				// ── DOUBLE TAP → Web Swing ──
				if (singleTapTimerRef.current) {
					clearTimeout(singleTapTimerRef.current);
					singleTapTimerRef.current = null;
				}
				lastTapTimeRef.current = 0;
				triggerWebSwing(posRef.current.x, posRef.current.y);
			} else {
				// ── SINGLE TAP (wait to confirm it isn't double) ──
				lastTapTimeRef.current = now;
				if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
				singleTapTimerRef.current = setTimeout(() => {
					singleTapTimerRef.current = null;
					triggerChat();
				}, doubleTapThreshold);
			}
		};

		const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
		const onMouseUp = (e: MouseEvent) => { onEnd(e.clientX, e.clientY); removeListeners(); };
		const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); };
		const onTouchEnd = (e: TouchEvent) => {
			const t = e.changedTouches[0];
			if (t) onEnd(t.clientX, t.clientY);
			else isDraggingRef.current = false;
			removeListeners();
		};

		const removeListeners = () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);
		};

		// Store references so the avatar div's handlers can add them
		(window as any).__spideyAddListeners = () => {
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
			window.addEventListener("touchmove", onTouchMove, { passive: false });
			window.addEventListener("touchend", onTouchEnd);
			window.addEventListener("touchcancel", onTouchEnd);
		};
		(window as any).__spideyRemoveListeners = removeListeners;

		return () => {
			removeListeners();
			delete (window as any).__spideyAddListeners;
			delete (window as any).__spideyRemoveListeners;
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attendanceData, isChatOpen]);

	const startDrag = (clientX: number, clientY: number) => {
		if (isSwingingArc) return; // ignore taps while swinging
		isDraggingRef.current = true;
		dragDistanceRef.current = 0;
		dragStartClientRef.current = { x: clientX, y: clientY };
		dragStartPosRef.current = { ...posRef.current };
		// biome-ignore lint/suspicious/noExplicitAny: convenience ref
		(window as any).__spideyAddListeners?.();
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		startDrag(e.clientX, e.clientY);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
	};

	// Web line rendering
	const handX = pos.x + 36;
	const handY = pos.y + 18;
	const webTip = ceilingAnchor
		? { x: handX + (ceilingAnchor.x - handX) * webShootProgress, y: handY + (ceilingAnchor.y - handY) * webShootProgress }
		: null;

	return (
		<>
			{/* Web strand during swing */}
			{isSwingingArc && ceilingAnchor && webTip && (
				<svg className="fixed inset-0 pointer-events-none z-40 w-full h-full" style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.9))" }}>
					{webShootProgress >= 0.8 && (
						<g>
							<circle cx={ceilingAnchor.x} cy={ceilingAnchor.y + 4} r="8" fill="#fff" stroke="#0f172a" strokeWidth="2.5" />
							<circle cx={ceilingAnchor.x} cy={ceilingAnchor.y + 4} r="3" fill="#94a3b8" />
							<circle cx={ceilingAnchor.x - 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#fff" />
							<circle cx={ceilingAnchor.x + 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#fff" />
						</g>
					)}
					<line x1={handX} y1={handY} x2={webTip.x} y2={webTip.y} stroke="#0f172a" strokeWidth="4" />
					<line x1={handX} y1={handY} x2={webTip.x} y2={webTip.y} stroke="#ffffff" strokeWidth="2" strokeDasharray="6 2" />
				</svg>
			)}

			{/* Attendance alert popup */}
			{activeMeme && (
				<div className="fixed top-18 right-4 z-50 max-w-xs bg-white border-4 border-black shadow-[6px_6px_0_#000] p-3 rounded-2xl animate-bounce" style={{ animationIterationCount: 2 }}>
					<div className="flex justify-between items-start gap-2">
						<div>
							<span className="text-[10px] font-black uppercase bg-red-600 text-white px-2.5 py-0.5 rounded-full border border-black">ATTENDANCE ALERT 🚨</span>
							<h4 className="font-black text-sm text-black mt-1 leading-tight uppercase">{activeMeme.title}</h4>
							{activeMeme.subtitle && <p className="text-xs text-gray-800 font-bold mt-0.5">{activeMeme.subtitle}</p>}
						</div>
						<button type="button" onClick={() => setActiveMeme(null)} className="text-black font-black text-xs hover:text-red-600 cursor-pointer p-1">✕</button>
					</div>
					{activeMeme.image && (
						<div className="mt-2 rounded-xl overflow-hidden border-2 border-black max-h-36">
							<img src={activeMeme.image} alt="meme" className="w-full h-full object-cover" />
						</div>
					)}
				</div>
			)}

			{/* Spidey avatar */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${rotation}deg)`,
					transformOrigin: "36px 18px",
					transition: isSwingingArc ? "none" : "left 0.1s ease, top 0.1s ease",
					touchAction: "none",
					userSelect: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				className="fixed z-40 cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Tap: Chat | Double-tap: Swing | Drag: Move"
			>
				{/* Think-cloud speech bubble */}
				<div
					className={`absolute ${poseState === "top_hang" ? "top-full mt-2" : "bottom-full mb-2"} left-1/2 -translate-x-1/2 w-52 sm:w-60 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-none ${isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					<p className="whitespace-pre-wrap">{speech}</p>
					<div className={`absolute ${poseState === "top_hang" ? "-top-2.5 border-t-3 border-l-3" : "-bottom-2.5 border-b-3 border-r-3"} left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-black rotate-45`} />
				</div>

				{/* Avatar image */}
				<div className={`w-18 h-18 sm:w-20 sm:h-20 filter transition-all duration-200 ${poseState === "swing" ? "scale-110 drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)] [transform:perspective(500px)_rotateX(20deg)_rotateY(-15deg)]" : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] hover:scale-105"}`}>
					<img
						src={poseState === "top_hang" ? "/spidey/Top_wall_hang_new.png" : poseState === "swing" ? "/spidey/spidey_swing_new.png" : "/spidey/spidey_idle.png"}
						alt="Spidey"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
