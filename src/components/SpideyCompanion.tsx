import { useEffect, useRef, useState } from "react";
import { playSound, type SoundType } from "../utils/soundManager";

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
}

export default function SpideyCompanion({
	attendanceData,
	onOpenChat,
}: SpideyCompanionProps) {
	const [speech, setSpeech] = useState<string>("Pull me back like a rubber band to launch! 🏹🕸️");
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
	const [poseState, setPoseState] = useState<"idle" | "swing" | "top_hang">("idle");

	// Web Anchor pinned to the top ceiling
	const [ceilingAnchor, setCeilingAnchor] = useState<{ x: number; y: number } | null>(null);
	const [webShootProgress, setWebShootProgress] = useState<number>(0);

	const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const dragDistance = useRef<number>(0);
	const swingAnimRef = useRef<number | null>(null);
	const shootAnimRef = useRef<number | null>(null);

	// Strict screen bounds clamp: guarantees avatar NEVER moves outside the visible viewport
	const clampPosition = (x: number, y: number) => {
		const screenW = typeof window !== "undefined" ? window.innerWidth : 380;
		const screenH = typeof window !== "undefined" ? window.innerHeight : 720;
		return {
			x: Math.max(14, Math.min(screenW - SPRITE_SIZE - 14, x)),
			y: Math.max(16, Math.min(screenH - SPRITE_SIZE - 95, y)),
		};
	};

	// Clean up all animation frames on unmount only
	useEffect(() => {
		return () => {
			if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
			if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);
		};
	}, []);

	// Attendance sound checks
	useEffect(() => {
		if (!attendanceData) return;
		try {
			const effective = (attendanceData as any)?.attendanceCourseComponentInfoList
				? (attendanceData as any)
				: (attendanceData as any)?.data;
			let totalPresent = 0;
			let totalClasses = 0;
			effective?.attendanceCourseComponentInfoList?.forEach((c: any) => {
				c.attendanceCourseComponentNameInfoList?.forEach((comp: any) => {
					const p = Number(comp.numberOfPresent ?? comp.totalPresentCount ?? 0) + Number(comp.numberOfExtraAttendance ?? 0);
					const t = Number(comp.numberOfPeriods ?? comp.totalClassCount ?? 0);
					totalPresent += p;
					totalClasses += t;
				});
			});

			const overallPct = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 0;

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
					setSpeech(`Waah kya scene hai! ${overallPct.toFixed(1)}% attendance?! Infinite aura 🗿`);
				} else if (overallPct < 70) {
					setActiveMeme({
						id: Date.now(),
						title: "FAAAAH! 💀 NAH BRO IS COOKED",
						subtitle: `Overall Attendance: ${overallPct.toFixed(1)}% — Academic Downfall!`,
						sound: "faaah",
					});
					playSound("faaah", 0.6);
					setSpeech(`FAAAAH! Only ${overallPct.toFixed(1)}%?! Chat, is bro cooked beyond repair?! 😭`);
				} else if (overallPct < 75) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/cat-laugh-meme-1.jpg",
						title: "CAT LAUGH 😹 DETENTION RISK",
						subtitle: `Overall Attendance: ${overallPct.toFixed(1)}% — Under 75%!`,
						sound: "cat_laugh",
					});
					playSound("cat_laugh", 0.6);
					setSpeech(`Attendance: ${overallPct.toFixed(1)}%! Even the cat is laughing 💀`);
				} else {
					playSound("oh_my_god", 0.5);
					setSpeech(`Attendance: ${overallPct.toFixed(1)}%! Safely above 75%. Let him cook! 🍳`);
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
			dragDistance.current += 1;

			const rawX = clientX - dragStartOffset.current.x;
			const rawY = clientY - dragStartOffset.current.y;
			const clamped = clampPosition(rawX, rawY);
			setPos(clamped);

			// Real-time rubber band angle & stretch reaction
			if (ceilingAnchor) {
				const pullDx = ceilingAnchor.x - (clamped.x + 36);
				const pullDy = clamped.y + 18 - ceilingAnchor.y;
				const angle = (Math.atan2(pullDx, pullDy) * 180) / Math.PI;
				setRotation(Math.max(-50, Math.min(50, angle)));

				const dist = Math.hypot(pullDx, pullDy);
				if (dist > 180) {
					setSpeech("MAX TENSION! Release to slingshot! 💥");
				} else {
					setSpeech("Stretch back to load elastic energy! 🏹🕸️");
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

			const currentRaw = {
				x: clientX - dragStartOffset.current.x,
				y: clientY - dragStartOffset.current.y,
			};
			const current = clampPosition(currentRaw.x, currentRaw.y);

			// 1. Quick click without drag (< 6px movement) -> open chat or login prompt
			if (dragDistance.current < 6) {
				setCeilingAnchor(null);
				setWebShootProgress(0);
				setPoseState("idle");
				setRotation(0);
				handleSingleTap();
				return;
			}

			// 2. If dropped right at the TOP CEILING ZONE (y <= TOP_CEILING_ZONE) -> Hang upside down from ceiling
			if (current.y <= TOP_CEILING_ZONE) {
				setCeilingAnchor(null);
				setWebShootProgress(0);
				setPos({ x: current.x, y: 16 });
				setPoseState("top_hang"); // Uses Top_wall_hang_new.png!
				setRotation(0);
				setSpeech("Chillin' upside down on the ceiling! 🧗‍♂️🕸️");
				setIsPeeping(true);
				return;
			}

			// 3. Mid-air release with anchor -> RUBBER-BAND SLINGSHOT & SPIDER-MAN SWING ARC!
			if (ceilingAnchor) {
				setIsSwingingArc(true);
				playSound("web_swing", 0.7); // User's custom swing sound plays when launched!
				setSpeech("SWIIIIIING! 🕸️💨");

				const anchor = { ...ceilingAnchor };
				const pullDx = anchor.x - (current.x + 36);
				const pullDy = anchor.y - (current.y + 18);
				const pullDist = Math.hypot(pullDx, pullDy);

				// Gentle, controlled swing launch (power tuned down)
				const speedScale = Math.min(12, Math.max(3.5, pullDist * 0.06));
				let vx = (pullDx / Math.max(pullDist, 1)) * speedScale;
				let vy = (pullDy / Math.max(pullDist, 1)) * (speedScale * 0.82);

				let currX = current.x;
				let currY = current.y;
				const restRope = Math.max(85, pullDist * 0.88);
				let frame = 0;
				const maxFrames = 62; // ~1 second graceful swing arc

				const swingLoop = () => {
					frame++;

					if (frame < 40) {
						// Web pulls towards ceiling anchor like a pendulum rope
						const distToAnchor = Math.hypot(currX + 36 - anchor.x, currY + 18 - anchor.y);
						if (distToAnchor > restRope) {
							const tension = (distToAnchor - restRope) * 0.045; // soft, smooth rope tension
							const ux = (currX + 36 - anchor.x) / distToAnchor;
							const uy = (currY + 18 - anchor.y) / distToAnchor;
							vx -= ux * tension;
							vy -= uy * tension;
						}
						vy += 0.32; // gentle gravity
					} else {
						// Web detaches smoothly at peak forward arc
						if (frame === 40) {
							setCeilingAnchor(null);
							setWebShootProgress(0);
						}
						vy += 0.42; // gentle descent
					}

					vx *= 0.965; // smooth air drag to decelerate naturally
					vy *= 0.965;
					currX += vx;
					currY += vy;

					// STRICT SCREEN CLAMPING: Spidey will never leave the screen bounds
					const bounded = clampPosition(currX, currY);
					if (bounded.x !== currX) {
						vx = -vx * 0.25; // Soft bounce off screen sides
						currX = bounded.x;
					}
					if (bounded.y !== currY) {
						vy = -vy * 0.15; // Soft landing on screen floor
						currY = bounded.y;
					}

					setPos({ x: currX, y: currY });

					// Dynamic rotation along movement trajectory
					const velAngle = (Math.atan2(vx, vy) * 180) / Math.PI;
					setRotation(Math.max(-40, Math.min(40, (velAngle - 90) * 0.4)));

					// SWING FINISHED: Smooth landing and ALWAYS RESTORE IDLE POSE!
					if (frame >= maxFrames || (frame > 35 && Math.abs(vx) < 0.6 && Math.abs(vy) < 0.9)) {
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
				return;
			}

			// Fallback: normal release
			setCeilingAnchor(null);
			setWebShootProgress(0);
			setPoseState("idle");
			setRotation(0);
			setIsPeeping(true);
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
				setCeilingAnchor(null);
				setWebShootProgress(0);
				setPoseState("idle");
				setRotation(0);
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
			// Do NOT cancel swingAnimRef here so the swing trajectory finishes cleanly even after dragging ends!
		};
	}, [isDragging, ceilingAnchor, attendanceData]);

	// Single tap handler
	const handleSingleTap = () => {
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

	// Start dragging: Shoot web shooter up to ceiling & switch to 3D swinging avatar
	const startDrag = (clientX: number, clientY: number) => {
		if (swingAnimRef.current) cancelAnimationFrame(swingAnimRef.current);
		if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);

		dragDistance.current = 0;
		setIsDragging(true);
		setIsSwingingArc(false);
		setPoseState("swing"); // 3D swing pose activated!
		setRotation(0);

		dragStartOffset.current = {
			x: clientX - pos.x,
			y: clientY - pos.y,
		};

		// Pinned anchor on the ceiling directly above the swing start
		const anchor = {
			x: Math.max(30, Math.min(window.innerWidth - 30, pos.x + 36)),
			y: 0,
		};
		setCeilingAnchor(anchor);
		setWebShootProgress(0.15);

		// Rapid visual web shot line extending to ceiling
		const start = performance.now();
		const animDuration = 120;
		const animateShot = (now: number) => {
			const p = Math.min(1, (now - start) / animDuration);
			setWebShootProgress(p);
			if (p < 1) {
				shootAnimRef.current = requestAnimationFrame(animateShot);
			}
		};
		shootAnimRef.current = requestAnimationFrame(animateShot);
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

	// Web tip while shooting/attached
	const currentWebTip = ceilingAnchor
		? {
				x: handX + (ceilingAnchor.x - handX) * webShootProgress,
				y: handY + (ceilingAnchor.y - handY) * webShootProgress,
		  }
		: null;

	return (
		<>
			{/* Web strand anchored to ceiling */}
			{(isDragging || isSwingingArc) && ceilingAnchor && currentWebTip && (
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
							<circle cx={ceilingAnchor.x} cy={ceilingAnchor.y + 4} r="3" fill="#94a3b8" />
							<circle cx={ceilingAnchor.x - 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#ffffff" />
							<circle cx={ceilingAnchor.x + 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#ffffff" />
						</g>
					)}

					{/* Outer taut elastic web strand */}
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

			{/* Spidey Avatar: Strictly bounded inside screen, Spider-Man pendulum swing, automatic reset to idle */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${rotation}deg)`,
					transformOrigin: "36px 18px",
					transition: isDragging || isSwingingArc ? "none" : "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				className="fixed z-40 select-none cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Pull back like a rubber band to launch & swing! Drop at ceiling to hang upside down!"
			>
				{/* Speech bubble */}
				<div
					className={`absolute ${
						poseState === "top_hang" ? "top-full mt-2" : "bottom-full mb-2"
					} left-1/2 -translate-x-1/2 w-48 sm:w-52 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-none ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					<p>{speech}</p>
					<div
						className={`absolute ${
							poseState === "top_hang"
								? "-top-2.5 border-t-3 border-l-3"
								: "-bottom-2.5 border-b-3 border-r-3"
						} left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-black rotate-45`}
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
