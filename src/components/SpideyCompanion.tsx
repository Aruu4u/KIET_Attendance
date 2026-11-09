import { Mic, MicOff } from "lucide-react";
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
		"Single tap: Chat 💬\nDouble tap: Web Swing 🕸️\nDrag to move! Say 'Hey Spidey' 🎙️",
	);
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	// Screen Boundary Bounds
	const SPRITE_SIZE = 76;
	const TOP_CEILING_ZONE = 75;

	// Position strictly bounded inside screen
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 30, y: 320 });
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [isSwingingArc, setIsSwingingArc] = useState<boolean>(false);
	const [rotation, setRotation] = useState<number>(0);
	const [poseState, setPoseState] = useState<"idle" | "swing" | "top_hang">(
		"idle",
	);

	// Voice Command states
	const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
	const [isAnsweringVoice, setIsAnsweringVoice] = useState<boolean>(false);

	// Web Anchor pinned to the top ceiling for double-click web swing
	const [ceilingAnchor, setCeilingAnchor] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [webShootProgress, setWebShootProgress] = useState<number>(0);

	const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const dragDistance = useRef<number>(0);
	const swingAnimRef = useRef<number | null>(null);
	const shootAnimRef = useRef<number | null>(null);

	// Single vs Double Click detector
	const lastClickTimeRef = useRef<number>(0);
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Strict screen bounds clamp: guarantees avatar NEVER moves outside the visible viewport
	const clampPosition = (x: number, y: number) => {
		const screenW = typeof window !== "undefined" ? window.innerWidth : 380;
		const screenH = typeof window !== "undefined" ? window.innerHeight : 720;
		return {
			x: Math.max(14, Math.min(screenW - SPRITE_SIZE - 14, x)),
			y: Math.max(16, Math.min(screenH - SPRITE_SIZE - 95, y)),
		};
	};

	// Clean up all animation frames & timers on unmount
	useEffect(() => {
		return () => {
			if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
			if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);
			if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
		};
	}, []);

	// Voice Command ("Hey Spidey") listener integration
	useEffect(() => {
		const unsubStatus = spideyVoice.onStatus((listening, msg) => {
			setIsVoiceActive(listening);
			if (listening && !isAnsweringVoice && !isChatOpen) {
				setSpeech(msg);
				setIsPeeping(true);
			}
		});

		const unsubQuery = async (query: string) => {
			// If chatbot dialog is already open, SpiderChat handles the query
			if (isChatOpen) return;

			// If chatbot is NOT open: Spidey answers directly inside his think cloud!
			setIsAnsweringVoice(true);
			setSpeech("Thinking... 🕷️💭");
			setIsPeeping(true);
			playSound("spiderman", 0.3);

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

				if (!res.ok) throw new Error("API error");
				const data = await res.json();
				const reply = data.message || "Attendance stats ready! 🕸️";
				setSpeech(reply);
				setIsPeeping(true);
				spideyVoice.speak(reply);
			} catch {
				setSpeech("Systumm hang! Ask me again in a sec 🕸️");
				setIsPeeping(true);
			} finally {
				setIsAnsweringVoice(false);
			}
		};

		const unsubQueryHook = spideyVoice.onQuery(unsubQuery);
		setIsVoiceActive(spideyVoice.getIsRunning());

		return () => {
			unsubStatus();
			unsubQueryHook();
		};
	}, [isChatOpen, attendanceData, isAnsweringVoice]);

	// Attendance sound checks
	useEffect(() => {
		if (!attendanceData) return;
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			const effective = (attendanceData as any)?.attendanceCourseComponentInfoList
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				? (attendanceData as any)
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				: (attendanceData as any)?.data;
			let totalPresent = 0;
			let totalClasses = 0;
			// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
			effective?.attendanceCourseComponentInfoList?.forEach((c: any) => {
				// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
				c.attendanceCourseComponentNameInfoList?.forEach((comp: any) => {
					const p =
						Number(comp.numberOfPresent ?? comp.totalPresentCount ?? 0) +
						Number(comp.numberOfExtraAttendance ?? 0);
					const t = Number(comp.numberOfPeriods ?? comp.totalClassCount ?? 0);
					totalPresent += p;
					totalClasses += t;
				});
			});

			const overallPct =
				totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 0;

			const timer = setTimeout(() => {
				if (overallPct >= 80) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/waah-kya-scene-hai.jpg",
						title: "WAAH KYA SCENE HAI! 🔥",
						subtitle: `Overall Attendance: ${overallPct.toFixed(1)}% — Bro is HIM!`,
						sound: "waah_kya_scene",
					});
					playSound("waah_kya_scene", 0.7);
					setSpeech(
						`Waah kya scene hai! ${overallPct.toFixed(1)}% attendance?! Infinite aura 🗿`,
					);
				} else if (overallPct < 70) {
					setActiveMeme({
						id: Date.now(),
						title: "FAAAAH! 💀 NAH BRO IS COOKED",
						subtitle: `Overall Attendance: ${overallPct.toFixed(1)}% — Academic Downfall!`,
						sound: "faaah",
					});
					playSound("faaah", 0.6);
					setSpeech(
						`FAAAAH! Only ${overallPct.toFixed(1)}%?! Chat, is bro cooked beyond repair?! 😭`,
					);
				} else if (overallPct < 75) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/cat-laugh-meme-1.jpg",
						title: "CAT LAUGH 😹 DETENTION RISK",
						subtitle: `Overall Attendance: ${overallPct.toFixed(1)}% — Under 75%!`,
						sound: "cat_laugh",
					});
					playSound("cat_laugh", 0.6);
					setSpeech(
						`Attendance: ${overallPct.toFixed(1)}%! Even the cat is laughing 💀`,
					);
				} else {
					playSound("oh_my_god", 0.5);
					setSpeech(
						`Attendance: ${overallPct.toFixed(1)}%! Safely above 75%. Let him cook! 🍳`,
					);
				}
			}, 1500);

			return () => clearTimeout(timer);
		} catch {
			// ignore
		}
	}, [attendanceData]);

	// Auto-dismiss active meme popup
	useEffect(() => {
		if (activeMeme) {
			const t = setTimeout(() => setActiveMeme(null), 6500);
			return () => clearTimeout(t);
		}
	}, [activeMeme]);

	// Mouse & Touch Dragging Listener
	useEffect(() => {
		const handleMove = (clientX: number, clientY: number) => {
			if (!isDragging) return;
			const moved = Math.hypot(
				clientX - dragStartPos.current.x,
				clientY - dragStartPos.current.y,
			);
			dragDistance.current = moved;

			// Simply drag around without shooting webs or slingshot tension!
			if (moved > 6) {
				const rawX = clientX - dragStartOffset.current.x;
				const rawY = clientY - dragStartOffset.current.y;
				const clamped = clampPosition(rawX, rawY);
				setPos(clamped);
				if (poseState === "top_hang" && clamped.y > TOP_CEILING_ZONE) {
					setPoseState("idle");
				}
			}
		};

		const handleMouseMove = (e: MouseEvent) => {
			handleMove(e.clientX, e.clientY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length > 0) {
				handleMove(e.touches[0].clientX, e.touches[0].clientY);
			}
		};

		const handleEnd = (clientX: number, clientY: number) => {
			if (!isDragging) return;
			setIsDragging(false);

			// 1. DRAG FINISHED (User moved > 6px) -> Simply place him where dragged
			if (dragDistance.current > 6) {
				const rawX = clientX - dragStartOffset.current.x;
				const rawY = clientY - dragStartOffset.current.y;
				const clamped = clampPosition(rawX, rawY);

				if (clamped.y <= TOP_CEILING_ZONE) {
					// Dropped near ceiling -> Hang upside down!
					setPos({ x: clamped.x, y: 16 });
					setPoseState("top_hang");
					setRotation(0);
					setSpeech("Chillin' upside down on the ceiling! 🧗‍♂️🕸️");
					setIsPeeping(true);
				} else {
					// Normal drop position
					setPos(clamped);
					setPoseState("idle");
					setRotation(0);
				}
				return;
			}

			// 2. TAP / CLICK (Moved <= 6px) -> Detect Single Tap vs Double Tap!
			const now = Date.now();
			if (now - lastClickTimeRef.current < 320) {
				// DOUBLE CLICK DETECTED! -> Throw web shooter & swing!
				if (clickTimerRef.current) {
					clearTimeout(clickTimerRef.current);
					clickTimerRef.current = null;
				}
				lastClickTimeRef.current = 0;
				triggerDoubleTapWebSwing();
			} else {
				// SINGLE CLICK CANDIDATE!
				lastClickTimeRef.current = now;
				clickTimerRef.current = setTimeout(() => {
					triggerSingleClickChat();
					clickTimerRef.current = null;
				}, 320);
			}
		};

		const handleMouseUp = (e: MouseEvent) => {
			handleEnd(e.clientX, e.clientY);
		};

		const handleTouchEnd = (e: TouchEvent) => {
			const touch = e.changedTouches[0];
			if (touch) {
				handleEnd(touch.clientX, touch.clientY);
			} else {
				setIsDragging(false);
			}
		};

		if (isDragging) {
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
			window.addEventListener("touchmove", handleTouchMove, { passive: false });
			window.addEventListener("touchend", handleTouchEnd);
			window.addEventListener("touchcancel", handleTouchEnd);
		}
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
			window.removeEventListener("touchcancel", handleTouchEnd);
		};
	}, [isDragging, poseState]);

	// Double Tap Handler: Throw Web Shooter & Spider-Man Swing!
	const triggerDoubleTapWebSwing = () => {
		if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
		if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);

		setIsSwingingArc(true);
		setPoseState("swing"); // 3D swing pose activated!
		playSound("web_swing", 0.7);
		setSpeech("SWIIIIIING! 🕸️💨");
		setIsPeeping(true);

		// Anchor pinned to top ceiling directly above
		const anchorX = Math.max(35, Math.min(window.innerWidth - 35, pos.x + 36));
		const anchor = { x: anchorX, y: 0 };
		setCeilingAnchor(anchor);
		setWebShootProgress(0.1);

		// Rapid visual web shot line extending to ceiling
		const start = performance.now();
		const animDuration = 100;
		const animateShot = (now: number) => {
			const p = Math.min(1, (now - start) / animDuration);
			setWebShootProgress(p);
			if (p < 1) {
				shootAnimRef.current = requestAnimationFrame(animateShot);
			}
		};
		shootAnimRef.current = requestAnimationFrame(animateShot);

		// Smooth, graceful Spider-Man pendulum swing arc
		const swingDir = pos.x < window.innerWidth / 2 ? 1 : -1;
		let vx = swingDir * 8.5;
		let vy = -3.2;
		let currX = pos.x;
		let currY = pos.y;
		let frame = 0;
		const maxFrames = 62;
		const restRope = Math.max(
			110,
			Math.hypot(pos.x + 36 - anchor.x, pos.y + 18 - anchor.y),
		);

		const swingLoop = () => {
			frame++;

			if (frame < 42) {
				// Web pulls towards ceiling anchor like a pendulum rope
				const distToAnchor = Math.hypot(
					currX + 36 - anchor.x,
					currY + 18 - anchor.y,
				);
				if (distToAnchor > restRope) {
					const tension = (distToAnchor - restRope) * 0.045; // gentle rope tension
					const ux = (currX + 36 - anchor.x) / distToAnchor;
					const uy = (currY + 18 - anchor.y) / distToAnchor;
					vx -= ux * tension;
					vy -= uy * tension;
				}
				vy += 0.32; // gentle gravity
			} else {
				// Web detaches smoothly at peak forward arc
				if (frame === 42) {
					setCeilingAnchor(null);
					setWebShootProgress(0);
				}
				vy += 0.42; // gentle descent
			}

			vx *= 0.965;
			vy *= 0.965;
			currX += vx;
			currY += vy;

			// STRICT SCREEN CLAMPING: Spidey will never leave the screen bounds
			const bounded = clampPosition(currX, currY);
			if (bounded.x !== currX) {
				vx = -vx * 0.25;
				currX = bounded.x;
			}
			if (bounded.y !== currY) {
				vy = -vy * 0.15;
				currY = bounded.y;
			}

			setPos({ x: currX, y: currY });

			// Dynamic rotation along movement trajectory
			const velAngle = (Math.atan2(vx, vy) * 180) / Math.PI;
			setRotation(Math.max(-40, Math.min(40, (velAngle - 90) * 0.4)));

			// SWING FINISHED: Smooth landing and ALWAYS RESTORE IDLE POSE!
			if (
				frame >= maxFrames ||
				(frame > 35 && Math.abs(vx) < 0.6 && Math.abs(vy) < 0.9)
			) {
				if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
				swingAnimRef.current = null;
				setIsSwingingArc(false);
				setCeilingAnchor(null);
				setWebShootProgress(0);
				setRotation(0);
				setPoseState("idle"); // Normal posture restored!
				setSpeech("Smooth landing! 🍕🕸️");
				setIsPeeping(true);
				return;
			}

			swingAnimRef.current = requestAnimationFrame(swingLoop);
		};

		swingAnimRef.current = requestAnimationFrame(swingLoop);
	};

	// Single Click Handler: Open Chatbot (or prompt login)
	const triggerSingleClickChat = () => {
		if (!attendanceData) {
			setSpeech("Please login first, then we can chat! 🔒🕸️");
			setIsPeeping(true);
			playSound("dexter", 0.4);
		} else {
			setSpeech("Opening SpiderBot AI... let's talk attendance! 💬");
			setIsPeeping(true);
			onOpenChat();
		}
	};

	// Start dragging: tracks touch/mouse start
	const startDrag = (clientX: number, clientY: number) => {
		if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
		if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);

		dragDistance.current = 0;
		dragStartPos.current = { x: clientX, y: clientY };
		dragStartOffset.current = {
			x: clientX - pos.x,
			y: clientY - pos.y,
		};
		setIsDragging(true);
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		startDrag(e.clientX, e.clientY);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			startDrag(touch.clientX, touch.clientY);
		}
	};

	// Hand coordinates for web attachment
	const handX = pos.x + 36;
	const handY = pos.y + 18;

	// Web tip while shooting/attached during double-click swing
	const currentWebTip = ceilingAnchor
		? {
				x: handX + (ceilingAnchor.x - handX) * webShootProgress,
				y: handY + (ceilingAnchor.y - handY) * webShootProgress,
			}
		: null;

	return (
		<>
			{/* Web strand anchored to ceiling during Double-Click Web Swing */}
			{isSwingingArc && ceilingAnchor && currentWebTip && (
				<svg
					className="fixed inset-0 pointer-events-none z-40 w-full h-full"
					style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.95))" }}
				>
					{/* Ceiling Web Splat Anchor */}
					{webShootProgress >= 0.8 && (
						<g>
							<circle
								cx={ceilingAnchor.x}
								cy={ceilingAnchor.y + 4}
								r="8"
								fill="#ffffff"
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
								fill="#ffffff"
							/>
							<circle
								cx={ceilingAnchor.x + 7}
								cy={ceilingAnchor.y + 2}
								r="3.5"
								fill="#ffffff"
							/>
						</g>
					)}

					{/* Outer taut web line */}
					<line
						x1={handX}
						y1={handY}
						x2={currentWebTip.x}
						y2={currentWebTip.y}
						stroke="#0f172a"
						strokeWidth="4"
					/>
					{/* Bright elastic inner core */}
					<line
						x1={handX}
						y1={handY}
						x2={currentWebTip.x}
						y2={currentWebTip.y}
						stroke="#ffffff"
						strokeWidth="2"
						strokeDasharray="6 2"
					/>
				</svg>
			)}

			{/* Actual Attendance Pop-up Notification */}
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

			{/* Spidey Avatar: Strictly bounded inside screen, single tap for chat, double tap for swing, smooth drag */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${rotation}deg)`,
					transformOrigin: "36px 18px",
					transition:
						isDragging || isSwingingArc
							? "none"
							: "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				className="fixed z-40 select-none cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Single click: Open Chat | Double click: Web Swing | Drag: Move freely"
			>
				{/* Think Cloud Speech Bubble */}
				<div
					className={`absolute ${
						poseState === "top_hang" ? "top-full mt-2" : "bottom-full mb-2"
					} left-1/2 -translate-x-1/2 w-52 sm:w-60 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-auto ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					{/* Think Cloud Header with 'Hey Spidey' Voice Activation Pill */}
					<div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-gray-200 select-none">
						<span className="text-[10px] uppercase font-black text-red-600 flex items-center gap-1">
							🕷️ Spidey
						</span>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								const next = spideyVoice.toggle();
								setIsVoiceActive(next);
							}}
							title="Toggle 'Hey Spidey' Voice Command"
							className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-black cursor-pointer transition-all ${
								isVoiceActive
									? "bg-yellow-300 text-black animate-pulse shadow-sm"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							{isVoiceActive ? <Mic size={10} /> : <MicOff size={10} />}
							<span>{isVoiceActive ? "Listening" : "Hey Spidey"}</span>
						</button>
					</div>

					<p className="whitespace-pre-wrap">{speech}</p>

					{/* Pointer tail */}
					<div
						className={`absolute ${
							poseState === "top_hang"
								? "-top-2.5 border-t-3 border-l-3"
								: "-bottom-2.5 border-b-3 border-r-3"
						} left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-black rotate-45 pointer-events-none`}
					/>
				</div>

				{/* Avatar Sprite Transitions:
				    - poseState === "top_hang": Top_wall_hang_new.png
				    - poseState === "swing": spidey_swing_new.png with 3D perspective
				    - poseState === "idle": automatically resets back to spidey_idle.png!
				*/}
				<div
					className={`w-18 h-18 sm:w-20 sm:h-20 filter transition-all duration-200 ${
						poseState === "swing"
							? "scale-110 drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)] [transform:perspective(500px)_rotateX(20deg)_rotateY(-15deg)]"
							: "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] hover:scale-105 active:scale-95"
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
						alt="Spidey Companion"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
