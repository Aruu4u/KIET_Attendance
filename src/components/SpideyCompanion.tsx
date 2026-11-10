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
		"Tap me to swing 🕸️  Double-tap to chat 💬\nSay 'Hey Spidey' to ask anytime! 🎙️",
	);
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	const SPRITE_SIZE = 76;
	const TOP_CEILING_ZONE = 75;

	// ── Visual state ──
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 30, y: 320 });
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [rotation, setRotation] = useState<number>(0);
	const [poseState, setPoseState] = useState<"idle" | "swing" | "top_hang">("idle");

	// ── Web state ──
	const [ceilingAnchor, setCeilingAnchor] = useState<{ x: number; y: number } | null>(null);
	const [webShootProgress, setWebShootProgress] = useState<number>(0);
	const [isWebTethered, setIsWebTethered] = useState<boolean>(false);

	// ── Refs for instantaneous gesture tracking ──
	const posRef = useRef({ x: 30, y: 320 });
	const isDraggingRef = useRef(false);
	const dragStartClientRef = useRef({ x: 0, y: 0 });
	const dragStartPosRef = useRef({ x: 0, y: 0 });
	const dragDistanceRef = useRef(0);

	// Animation frame refs
	const swingAnimRef = useRef<number | null>(null);
	const shootAnimRef = useRef<number | null>(null);
	const fallAnimRef = useRef<number | null>(null);

	// Double-tap & Single-tap tracking
	const lastTapTimeRef = useRef<number>(0);
	const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ── Tethered swing physics refs ──
	const isWebTetheredRef = useRef(false);
	const swingVelRef = useRef({ vx: 0, vy: 0 });
	const ropeLengthRef = useRef(200);
	const anchorRef = useRef({ x: 0, y: 0 });
	const swingDragRef = useRef(false);
	const lastDragVelRef = useRef({ vx: 0, vy: 0 });
	const prevDragPosRef = useRef({ x: 0, y: 0, t: 0 });

	const clampPosition = (x: number, y: number) => {
		const W = typeof window !== "undefined" ? window.innerWidth : 400;
		const H = typeof window !== "undefined" ? window.innerHeight : 800;
		return {
			x: Math.max(14, Math.min(W - SPRITE_SIZE - 14, x)),
			y: Math.max(16, Math.min(H - SPRITE_SIZE - 95, y)),
		};
	};

	const setPosSynced = (p: { x: number; y: number }) => {
		posRef.current = p;
		setPos(p);
	};

	// Cancel all animation frames helper
	const cancelAllAnimations = () => {
		if (swingAnimRef.current) { cancelAnimationFrame(swingAnimRef.current); swingAnimRef.current = null; }
		if (shootAnimRef.current) { cancelAnimationFrame(shootAnimRef.current); shootAnimRef.current = null; }
		if (fallAnimRef.current) { cancelAnimationFrame(fallAnimRef.current); fallAnimRef.current = null; }
	};

	// Clean up on unmount
	useEffect(() => {
		return () => {
			cancelAllAnimations();
			if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
		};
	}, []);

	// ── Background "Hey Spidey" voice activation — always listening ──
	useEffect(() => {
		const unsubStatus = spideyVoice.onStatus((listening, msg) => {
			if (!isChatOpen && listening) {
				setSpeech(msg);
				setIsPeeping(true);
			}
		});

		const handleVoiceQuery = async (query: string) => {
			if (isChatOpen) return;

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
				const reply = data.message || "Attendance stats ready! 🕸️";
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
		};
	}, [isChatOpen, attendanceData]);

	// ── Attendance evaluation notifications ──
	useEffect(() => {
		if (!attendanceData) return;
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			const eff = (attendanceData as any)?.attendanceCourseComponentInfoList
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				? (attendanceData as any)
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				: (attendanceData as any)?.data;
			let p = 0;
			let t = 0;
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			eff?.attendanceCourseComponentInfoList?.forEach((c: any) => {
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				c.attendanceCourseComponentNameInfoList?.forEach((comp: any) => {
					p +=
						Number(comp.numberOfPresent ?? comp.totalPresentCount ?? 0) +
						Number(comp.numberOfExtraAttendance ?? 0);
					t += Number(comp.numberOfPeriods ?? comp.totalClassCount ?? 0);
				});
			});
			const pct = t > 0 ? (p / t) * 100 : 0;
			const timer = setTimeout(() => {
				if (pct >= 80) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/waah-kya-scene-hai.jpg",
						title: "WAAH KYA SCENE HAI! 🔥",
						subtitle: `Overall: ${pct.toFixed(1)}% — Bro is HIM!`,
						sound: "waah_kya_scene",
					});
					playSound("waah_kya_scene", 0.7);
					setSpeech(`${pct.toFixed(1)}% attendance?! Infinite aura 🗿`);
				} else if (pct < 70) {
					setActiveMeme({
						id: Date.now(),
						title: "FAAAAH! 💀 BRO IS COOKED",
						subtitle: `Overall: ${pct.toFixed(1)}%`,
						sound: "faaah",
					});
					playSound("faaah", 0.6);
					setSpeech(`Only ${pct.toFixed(1)}%?! Chat, bro is cooked fr 😭`);
				} else if (pct < 75) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/cat-laugh-meme-1.jpg",
						title: "DETENTION RISK 😹",
						subtitle: `Overall: ${pct.toFixed(1)}% — Under 75%!`,
						sound: "cat_laugh",
					});
					playSound("cat_laugh", 0.6);
					setSpeech(`${pct.toFixed(1)}%! Even the cat is laughing 💀`);
				} else {
					playSound("oh_my_god", 0.5);
					setSpeech(`${pct.toFixed(1)}% — above 75%! Let him cook 🍳`);
				}
			}, 1500);
			return () => clearTimeout(timer);
		} catch {
			/* ignore */
		}
	}, [attendanceData]);

	useEffect(() => {
		if (activeMeme) {
			const t = setTimeout(() => setActiveMeme(null), 6500);
			return () => clearTimeout(t);
		}
	}, [activeMeme]);

	// ────────────────────────────────────────────────
	//  TETHERED SWING PHYSICS (smooth pendulum with natural settling)
	// ────────────────────────────────────────────────
	const startSwingPhysics = () => {
		const GRAVITY = 0.35;
		const SPRING_K = 0.04;
		const DAMPING = 0.99;

		const loop = () => {
			if (!isWebTetheredRef.current) return;

			// User dragging — keep loop alive but skip physics
			if (swingDragRef.current) {
				swingAnimRef.current = requestAnimationFrame(loop);
				return;
			}

			const anchor = anchorRef.current;
			let { vx, vy } = swingVelRef.current;
			let cx = posRef.current.x;
			let cy = posRef.current.y;

			// Gravity
			vy += GRAVITY;

			// Rope / rubber-band constraint
			const spiderCX = cx + 36;
			const spiderCY = cy + 18;
			const dx = spiderCX - anchor.x;
			const dy = spiderCY - anchor.y;
			const dist = Math.hypot(dx, dy);
			const ropeLen = ropeLengthRef.current;

			if (dist > ropeLen) {
				const stretch = dist - ropeLen;
				const nx = dx / dist;
				const ny = dy / dist;

				// Smooth spring force toward anchor
				vx -= nx * stretch * SPRING_K;
				vy -= ny * stretch * SPRING_K;

				// Radial damping to prevent jitter/glitch
				const radialVel = vx * nx + vy * ny;
				if (radialVel > 0) {
					vx -= nx * radialVel * 0.15;
					vy -= ny * radialVel * 0.15;
				}
			}

			// Smooth damping
			vx *= DAMPING;
			vy *= DAMPING;

			// Deadband: when swing has practically settled, bring to a clean gentle rest
			// This prevents sub-pixel vibrating / rendering jitter!
			if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05 && dist >= ropeLen - 2 && dist <= ropeLen + 2) {
				vx = 0;
				vy = 0;
			}

			cx += vx;
			cy += vy;

			// Wall bounds
			const clamped = clampPosition(cx, cy);
			if (Math.abs(clamped.x - cx) > 0.5) { vx = -vx * 0.25; cx = clamped.x; }
			if (Math.abs(clamped.y - cy) > 0.5) { vy = -vy * 0.15; cy = clamped.y; }

			setPosSynced({ x: cx, y: cy });
			swingVelRef.current = { vx, vy };

			// Natural rotation based on rope angle + velocity
			const ropeAngle = (Math.atan2(dx, dy) * 180) / Math.PI;
			const targetRot = Math.max(-40, Math.min(40, -ropeAngle * 0.6 + vx * 1.5));
			setRotation(targetRot);

			swingAnimRef.current = requestAnimationFrame(loop);
		};

		swingAnimRef.current = requestAnimationFrame(loop);
	};

	// ────────────────────────────────────────────────
	//  DOUBLE-TAP: Shoot web to center-top ceiling
	// ────────────────────────────────────────────────
	const triggerWebSwing = (startX: number, startY: number) => {
		cancelAllAnimations();

		// Detach any existing tether
		isWebTetheredRef.current = false;
		setIsWebTethered(false);
		swingDragRef.current = false;

		setPoseState("swing");
		playSound("web_swing", 0.7);
		setSpeech("THWIP! 🕸️💨");
		setIsPeeping(true);

		// Anchor at CENTER TOP of the viewport
		const anchorX = Math.round(window.innerWidth / 2);
		const anchor = { x: anchorX, y: 0 };
		anchorRef.current = anchor;
		setCeilingAnchor(anchor);
		setWebShootProgress(0);

		// Phase 1: Animate web shooting from hand to ceiling (150ms)
		const shotStart = performance.now();
		const SHOT_DURATION = 150;

		const animateShot = (now: number) => {
			const progress = Math.min(1, (now - shotStart) / SHOT_DURATION);
			setWebShootProgress(progress);
			if (progress < 1) {
				shootAnimRef.current = requestAnimationFrame(animateShot);
			} else {
				shootAnimRef.current = null;
				// Phase 2: Web stuck! Enter tethered mode
				const spiderCenterX = startX + 36;
				const spiderCenterY = startY + 18;
				// Ensure minimum rope length of 140px so Spidey doesn't snap abruptly
				ropeLengthRef.current = Math.max(
					140,
					Math.hypot(spiderCenterX - anchor.x, spiderCenterY - anchor.y)
				);

				// Initial swing velocity (push sideways smoothly based on position)
				const dir = startX < window.innerWidth / 2 ? 1 : -1;
				swingVelRef.current = { vx: dir * 5.5, vy: -1.0 };

				isWebTetheredRef.current = true;
				setIsWebTethered(true);
				setSpeech("Swinging! Drag me or tap to release 🕸️🕷️");
				setIsPeeping(true);

				startSwingPhysics();
			}
		};
		shootAnimRef.current = requestAnimationFrame(animateShot);
	};

	// ────────────────────────────────────────────────
	//  DETACH WEB: Tap while tethered → release & fall
	// ────────────────────────────────────────────────
	const detachWeb = () => {
		isWebTetheredRef.current = false;
		setIsWebTethered(false);
		swingDragRef.current = false;
		setCeilingAnchor(null);
		setWebShootProgress(0);
		cancelAllAnimations();

		setSpeech("Web released! 🕷️✨");
		setIsPeeping(true);
		setPoseState("idle");

		// Fall with current velocity
		let { vx: fvx, vy: fvy } = swingVelRef.current;
		let cx = posRef.current.x;
		let cy = posRef.current.y;

		const fallLoop = () => {
			fvy += 0.5;
			fvx *= 0.97;
			fvy *= 0.97;
			cx += fvx;
			cy += fvy;

			const clamped = clampPosition(cx, cy);
			if (Math.round(clamped.x) !== Math.round(cx)) { fvx = -fvx * 0.2; cx = clamped.x; }
			if (Math.round(clamped.y) !== Math.round(cy)) { fvy = -fvy * 0.2; cy = clamped.y; }

			setPosSynced({ x: cx, y: cy });

			// Settled?
			if (Math.abs(fvx) < 0.3 && Math.abs(fvy) < 0.3) {
				setRotation(0);
				fallAnimRef.current = null;
				return;
			}

			const angle = (Math.atan2(fvx, -fvy) * 180) / Math.PI;
			setRotation(Math.max(-30, Math.min(30, angle * 0.3)));

			fallAnimRef.current = requestAnimationFrame(fallLoop);
		};

		fallAnimRef.current = requestAnimationFrame(fallLoop);
	};

	// ── Single tap: Open chatbot ──
	const triggerChat = () => {
		setSpeech("Opening SpiderBot... 💬🕷️");
		setIsPeeping(true);
		onOpenChat();
	};

	// ────────────────────────────────────────────────
	//  POINTER HANDLER: all gestures (normal + tethered)
	// ────────────────────────────────────────────────
	const handlePointerDown = (clientX: number, clientY: number) => {
		// Start voice listener on first interaction
		if (spideyVoice.isSupported() && !spideyVoice.getIsRunning()) {
			spideyVoice.start();
		}

		// ═══════════════════════════════════════════
		// MODE A: TETHERED (web attached to ceiling)
		// ═══════════════════════════════════════════
		if (isWebTetheredRef.current) {
			isDraggingRef.current = true;
			setIsDragging(true);
			swingDragRef.current = true;
			dragDistanceRef.current = 0;
			dragStartClientRef.current = { x: clientX, y: clientY };
			dragStartPosRef.current = { ...posRef.current };
			prevDragPosRef.current = { x: posRef.current.x, y: posRef.current.y, t: performance.now() };
			lastDragVelRef.current = { vx: 0, vy: 0 };

			const onMove = (mx: number, my: number) => {
				if (!isDraggingRef.current) return;
				const dx = mx - dragStartClientRef.current.x;
				const dy = my - dragStartClientRef.current.y;
				dragDistanceRef.current = Math.hypot(dx, dy);

				if (dragDistanceRef.current > 4) {
					const targetX = dragStartPosRef.current.x + dx;
					const targetY = dragStartPosRef.current.y + dy;
					const clamped = clampPosition(targetX, targetY);
					setPosSynced(clamped);

					// Track velocity for release fling
					const now = performance.now();
					const dt = now - prevDragPosRef.current.t;
					if (dt > 0) {
						lastDragVelRef.current = {
							vx: ((clamped.x - prevDragPosRef.current.x) / Math.max(dt, 8)) * 16,
							vy: ((clamped.y - prevDragPosRef.current.y) / Math.max(dt, 8)) * 16,
						};
						prevDragPosRef.current = { x: clamped.x, y: clamped.y, t: now };
					}
				}
			};

			const onUp = () => {
				isDraggingRef.current = false;
				setIsDragging(false);
				swingDragRef.current = false;

				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
				window.removeEventListener("touchmove", onTouchMove);
				window.removeEventListener("touchend", onTouchEnd);
				window.removeEventListener("touchcancel", onTouchEnd);

				if (dragDistanceRef.current <= 6) {
					// TAP while tethered → detach web
					detachWeb();
				} else {
					// DRAG release → fling with drag velocity
					const { vx, vy } = lastDragVelRef.current;
					swingVelRef.current = {
						vx: Math.max(-18, Math.min(18, vx)),
						vy: Math.max(-18, Math.min(18, vy)),
					};
					// Physics loop is running, it picks up the velocity
				}
			};

			const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
			const onMouseUp = () => onUp();
			const onTouchMove = (e: TouchEvent) => {
				if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
			};
			const onTouchEnd = () => onUp();

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
			window.addEventListener("touchmove", onTouchMove, { passive: false });
			window.addEventListener("touchend", onTouchEnd);
			window.addEventListener("touchcancel", onTouchEnd);
			return;
		}

		// ═══════════════════════════════════════════
		// MODE B: NORMAL (idle / not tethered)
		// ═══════════════════════════════════════════
		isDraggingRef.current = true;
		setIsDragging(true);
		dragDistanceRef.current = 0;
		dragStartClientRef.current = { x: clientX, y: clientY };
		dragStartPosRef.current = { ...posRef.current };

		const onMove = (mx: number, my: number) => {
			if (!isDraggingRef.current) return;
			const dx = mx - dragStartClientRef.current.x;
			const dy = my - dragStartClientRef.current.y;
			dragDistanceRef.current = Math.hypot(dx, dy);

			if (dragDistanceRef.current > 6) {
				const targetX = dragStartPosRef.current.x + dx;
				const targetY = dragStartPosRef.current.y + dy;
				const clamped = clampPosition(targetX, targetY);
				setPosSynced(clamped);
			}
		};

		const onUp = (upClientX: number, upClientY: number) => {
			isDraggingRef.current = false;
			setIsDragging(false);

			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);

			const moved = dragDistanceRef.current;

			// 1. DRAG FINISHED (> 6px)
			if (moved > 6) {
				const dx = upClientX - dragStartClientRef.current.x;
				const dy = upClientY - dragStartClientRef.current.y;
				const finalX = dragStartPosRef.current.x + dx;
				const finalY = dragStartPosRef.current.y + dy;
				const clamped = clampPosition(finalX, finalY);

				if (clamped.y <= TOP_CEILING_ZONE) {
					setPosSynced({ x: clamped.x, y: 16 });
					setPoseState("top_hang");
					setRotation(0);
					setSpeech("Chillin' upside down on the ceiling! 🕸️");
					setIsPeeping(true);
				} else {
					setPosSynced(clamped);
					setPoseState("idle");
					setRotation(0);
				}
				return;
			}

			// 2. TAP DETECTED (≤ 6px movement)
			const now = Date.now();
			const timeSinceLastTap = now - lastTapTimeRef.current;

			if (timeSinceLastTap < 280 && timeSinceLastTap > 0) {
				// DOUBLE TAP → OPEN CHATBOT
				if (singleTapTimerRef.current) {
					clearTimeout(singleTapTimerRef.current);
					singleTapTimerRef.current = null;
				}
				lastTapTimeRef.current = 0;
				triggerChat();
			} else {
				// SINGLE TAP → SHOOT WEB & SWING (after 220ms to rule out double-tap)
				lastTapTimeRef.current = now;
				if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
				singleTapTimerRef.current = setTimeout(() => {
					singleTapTimerRef.current = null;
					triggerWebSwing(posRef.current.x, posRef.current.y);
				}, 220);
			}
		};

		const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
		const onMouseUp = (e: MouseEvent) => onUp(e.clientX, e.clientY);
		const onTouchMove = (e: TouchEvent) => {
			if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
		};
		const onTouchEnd = (e: TouchEvent) => {
			const t = e.changedTouches[0];
			if (t) onUp(t.clientX, t.clientY);
			else {
				isDraggingRef.current = false;
				setIsDragging(false);
			}
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd);
		window.addEventListener("touchcancel", onTouchEnd);
	};

	// ── Web line rendering calculations ──
	const handX = pos.x + 36;
	const handY = pos.y + 18;
	const webTip = ceilingAnchor
		? isWebTethered
			? { x: ceilingAnchor.x, y: ceilingAnchor.y }
			: {
					x: handX + (ceilingAnchor.x - handX) * webShootProgress,
					y: handY + (ceilingAnchor.y - handY) * webShootProgress,
				}
		: null;

	const showWebLine = ceilingAnchor !== null && webTip !== null;

	return (
		<>
			{/* Web shooter line (during shooting + tethered swing) */}
			{showWebLine && (
				<svg
					className="fixed inset-0 pointer-events-none z-40 w-full h-full"
					style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.9))" }}
				>
					{/* Web splat at ceiling anchor */}
					{(webShootProgress >= 0.8 || isWebTethered) && (
						<g>
							<circle
								cx={ceilingAnchor.x}
								cy={ceilingAnchor.y + 4}
								r="8"
								fill="#fff"
								stroke="#0f172a"
								strokeWidth="2.5"
							/>
							<circle
								cx={ceilingAnchor.x}
								cy={ceilingAnchor.y + 4}
								r="3"
								fill="#94a3b8"
							/>
							<circle
								cx={ceilingAnchor.x - 7}
								cy={ceilingAnchor.y + 2}
								r="3.5"
								fill="#fff"
							/>
							<circle
								cx={ceilingAnchor.x + 7}
								cy={ceilingAnchor.y + 2}
								r="3.5"
								fill="#fff"
							/>
						</g>
					)}
					{/* Web line from hand to anchor/tip */}
					<line
						x1={handX}
						y1={handY}
						x2={webTip.x}
						y2={webTip.y}
						stroke="#0f172a"
						strokeWidth="4"
					/>
					<line
						x1={handX}
						y1={handY}
						x2={webTip.x}
						y2={webTip.y}
						stroke="#ffffff"
						strokeWidth="2"
						strokeDasharray="6 2"
					/>
				</svg>
			)}

			{/* Attendance Alert Notification Card */}
			{activeMeme && (
				<div
					className="fixed top-18 right-4 z-50 max-w-xs bg-white border-4 border-black shadow-[6px_6px_0_#000] p-3 rounded-2xl animate-bounce"
					style={{ animationIterationCount: 2 }}
				>
					<div className="flex justify-between items-start gap-2">
						<div>
							<span className="text-[10px] font-black uppercase bg-red-600 text-white px-2.5 py-0.5 rounded-full border border-black">
								ATTENDANCE ALERT 🚨
							</span>
							<h4 className="font-black text-sm text-black mt-1 leading-tight uppercase">
								{activeMeme.title}
							</h4>
							{activeMeme.subtitle && (
								<p className="text-xs text-gray-800 font-bold mt-0.5">
									{activeMeme.subtitle}
								</p>
							)}
						</div>
						<button
							type="button"
							onClick={() => setActiveMeme(null)}
							className="text-black font-black text-xs hover:text-red-600 cursor-pointer p-1"
						>
							✕
						</button>
					</div>
					{activeMeme.image && (
						<div className="mt-2 rounded-xl overflow-hidden border-2 border-black max-h-36">
							<img
								src={activeMeme.image}
								alt="meme"
								className="w-full h-full object-cover"
							/>
						</div>
					)}
				</div>
			)}

			{/* Spidey Interactive Avatar */}
			<div
				style={{
					transform: `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${rotation}deg)`,
					transformOrigin: "36px 18px",
					transition: isDragging || isWebTethered ? "none" : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
					touchAction: "none",
					userSelect: "none",
					willChange: "transform",
					left: 0,
					top: 0,
				}}
				onMouseDown={(e) => {
					e.preventDefault();
					handlePointerDown(e.clientX, e.clientY);
				}}
				onTouchStart={(e) => {
					if (e.touches[0]) {
						handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
					}
				}}
				className="fixed z-40 cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Tap: Swing | Double-tap: Chat | Drag: Move"
			>
				{/* Think-cloud speech bubble */}
				<div
					className={`absolute ${
						poseState === "top_hang" ? "top-full mt-2" : "bottom-full mb-2"
					} left-1/2 -translate-x-1/2 w-52 sm:w-60 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-none ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					<p className="whitespace-pre-wrap">{speech}</p>
					<div
						className={`absolute ${
							poseState === "top_hang"
								? "-top-2.5 border-t-3 border-l-3"
								: "-bottom-2.5 border-b-3 border-r-3"
						} left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-black rotate-45`}
					/>
				</div>

				{/* Avatar Sprite */}
				<div
					className={`w-18 h-18 sm:w-20 sm:h-20 filter transition-all duration-150 ${
						poseState === "swing"
							? "scale-110 drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)] [transform:perspective(500px)_rotateX(20deg)_rotateY(-15deg)]"
							: "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] hover:scale-105"
					}`}
				>
					<img
						src={
							poseState === "top_hang"
								? "/spidey/Top_wall_hang_new.png"
								: poseState === "swing"
								? "/spidey/spidey_swing_new.png"
								: "/spidey/spidey_idle.png"
						}
						alt="Spidey"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
