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
	const [speech, setSpeech] = useState<string>("Pull me back like a slingshot to launch! 🏹🕸️");
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	// Spidey Position on screen (in px)
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 40, y: 350 });
	const [isAiming, setIsAiming] = useState<boolean>(false);
	const [isFlying, setIsFlying] = useState<boolean>(false);
	const [rotation, setRotation] = useState<number>(0);
	const [isHangingFromCeiling, setIsHangingFromCeiling] = useState<boolean>(false);

	// Slingshot / Web Mechanics:
	// 1. Web Anchor on top ceiling: shoots from Spidey to top wall on hold
	const [webAnchor, setWebAnchor] = useState<{ x: number; y: number } | null>(null);
	// 2. Growth percentage of web shooting to ceiling (0 to 1)
	const [webShootProgress, setWebShootProgress] = useState<number>(0);

	const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const dragDistance = useRef<number>(0);
	const dragHoldPos = useRef<{ x: number; y: number }>({ x: 40, y: 350 });
	const animationFrameRef = useRef<number | null>(null);
	const shootAnimRef = useRef<number | null>(null);

	// Actual Attendance evaluation: triggers ONLY based on your REAL attendance figures
	useEffect(() => {
		if (!attendanceData) return;
		try {
			const data = attendanceData as {
				attendanceCourseComponentInfoList?: Array<{
					attendanceCourseComponentNameInfoList?: Array<{
						totalPresentCount?: number;
						totalClassCount?: number;
					}>;
				}>;
			};
			let totalPresent = 0;
			let totalClasses = 0;
			data.attendanceCourseComponentInfoList?.forEach((c) => {
				c.attendanceCourseComponentNameInfoList?.forEach((comp) => {
					totalPresent += comp.totalPresentCount || 0;
					totalClasses += comp.totalClassCount || 0;
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

	// Slingshot Pull & Drag Listener
	useEffect(() => {
		const handleMove = (clientX: number, clientY: number) => {
			if (!isAiming) return;
			dragDistance.current += 1;

			const newX = clientX - dragStartOffset.current.x;
			const newY = clientY - dragStartOffset.current.y;
			setPos({ x: newX, y: newY });
			dragHoldPos.current = { x: newX, y: newY };

			// Calculate tension angle based on stretch away from anchor
			if (webAnchor) {
				const dx = webAnchor.x - (newX + 38);
				const dy = webAnchor.y - (newY + 20);
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
				setRotation(Math.max(-50, Math.min(50, angle)));
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

		const handleRelease = (clientX: number, clientY: number) => {
			if (!isAiming) return;
			setIsAiming(false);

			const currentX = clientX - dragStartOffset.current.x;
			const currentY = clientY - dragStartOffset.current.y;

			// Quick tap without pulling back -> open chat
			if (dragDistance.current < 6) {
				setWebAnchor(null);
				setWebShootProgress(0);
				handleSingleTap();
				return;
			}

			// Slingshot Release: calculate stretch vector
			if (webAnchor) {
				const stretchX = webAnchor.x - (currentX + 38);
				const stretchY = webAnchor.y - (currentY + 20);
				const stretchDist = Math.sqrt(stretchX * stretchX + stretchY * stretchY);

				// Launch forward like a rubber band!
				if (stretchDist > 40) {
					setIsFlying(true);
					// Play custom spidey_swing.mp3 on slingshot launch!
					playSound("web_swing", 0.65);
					setSpeech("YEEEE-HAW! Slingshot launch! 🚀🕸️");

					// Physics impulse vector
					const power = Math.min(stretchDist * 0.18, 38);
					const unitX = stretchX / (stretchDist || 1);
					const unitY = stretchY / (stretchDist || 1);

					let vx = unitX * power * 1.5;
					let vy = unitY * power * 1.5;
					let currX = currentX;
					let currY = currentY;

					const screenW = window.innerWidth;
					const screenH = window.innerHeight;

					// Animate flight along trajectory
					const flyStep = () => {
						currX += vx;
						currY += vy;
						vy += 0.85; // Gravity
						vx *= 0.985; // Air resistance

						// Ceiling collision -> hang from ceiling!
						if (currY <= 40) {
							setPos({ x: currX, y: 10 });
							setIsHangingFromCeiling(true);
							setIsFlying(false);
							setWebAnchor(null);
							setWebShootProgress(0);
							setRotation(0);
							setSpeech("Stuck to the ceiling wall! 🧗‍♂️🕸️");
							return;
						}

						// Side walls collision
						if (currX <= 15) {
							setPos({ x: 10, y: Math.max(60, Math.min(screenH - 120, currY)) });
							setIsHangingFromCeiling(false);
							setIsFlying(false);
							setWebAnchor(null);
							setWebShootProgress(0);
							setRotation(90);
							setSpeech("Landed on the left wall! 🧗‍♂️");
							return;
						}
						if (currX >= screenW - 85) {
							setPos({ x: screenW - 75, y: Math.max(60, Math.min(screenH - 120, currY)) });
							setIsHangingFromCeiling(false);
							setIsFlying(false);
							setWebAnchor(null);
							setWebShootProgress(0);
							setRotation(-90);
							setSpeech("Landed on the right wall! 🕷️");
							return;
						}

						// Floor collision
						if (currY >= screenH - 130) {
							setPos({ x: currX, y: screenH - 100 });
							setIsHangingFromCeiling(false);
							setIsFlying(false);
							setWebAnchor(null);
							setWebShootProgress(0);
							setRotation(0);
							setSpeech("Landed on the floor! 🍕");
							return;
						}

						setPos({ x: currX, y: currY });
						animationFrameRef.current = requestAnimationFrame(flyStep);
					};

					animationFrameRef.current = requestAnimationFrame(flyStep);
					return;
				}
			}

			// Mild drag fallback
			setWebAnchor(null);
			setWebShootProgress(0);
			setRotation(0);
		};

		const handleMouseUp = (e: MouseEvent) => {
			handleRelease(e.clientX, e.clientY);
		};

		const handleTouchEnd = (e: TouchEvent) => {
			const touch = e.changedTouches[0];
			if (touch) {
				handleRelease(touch.clientX, touch.clientY);
			} else {
				setIsAiming(false);
				setWebAnchor(null);
				setWebShootProgress(0);
			}
		};

		if (isAiming) {
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
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
		};
	}, [isAiming, webAnchor, attendanceData]);

	// Single tap handler: check if logged in or on home screen
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

	// Start Hold / Slingshot Aim: SHOOT WEB UP TO THE TOP WALL!
	const startHold = (clientX: number, clientY: number) => {
		if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
		if (shootAnimRef.current) cancelAnimationFrame(shootAnimRef.current);

		dragDistance.current = 0;
		setIsAiming(true);
		setIsFlying(false);
		setIsHangingFromCeiling(false);
		setRotation(0);

		dragStartOffset.current = {
			x: clientX - pos.x,
			y: clientY - pos.y,
		};
		dragHoldPos.current = { x: pos.x, y: pos.y };

		// Target anchor right on the ceiling directly above Spidey's current spot
		const targetAnchor = {
			x: Math.max(30, Math.min(window.innerWidth - 30, pos.x + 38)),
			y: 0,
		};
		setWebAnchor(targetAnchor);
		setWebShootProgress(0.1);

		// Animate web shooter shooting from Spidey up to the top wall!
		let start = performance.now();
		const animDuration = 180; // 180ms rapid web shot
		const animateShot = (now: number) => {
			const elapsed = now - start;
			const p = Math.min(1, elapsed / animDuration);
			setWebShootProgress(p);
			if (p < 1) {
				shootAnimRef.current = requestAnimationFrame(animateShot);
			} else {
				setSpeech("Web locked on ceiling! Now pull back to slingshot! 🏹💥");
			}
		};
		shootAnimRef.current = requestAnimationFrame(animateShot);
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		startHold(e.clientX, e.clientY);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			startHold(touch.clientX, touch.clientY);
		}
	};

	// Current hand coordinates
	const handX = pos.x + 38;
	const handY = pos.y + 20;

	// Calculate end of shooting web line
	const currentWebTip = webAnchor
		? {
				x: handX + (webAnchor.x - handX) * webShootProgress,
				y: handY + (webAnchor.y - handY) * webShootProgress,
		  }
		: null;

	// Calculate tension stretch distance
	const stretchDistance = webAnchor
		? Math.sqrt(Math.pow(webAnchor.x - handX, 2) + Math.pow(webAnchor.y - handY, 2))
		: 0;

	return (
		<>
			{/* Slingshot Rubber Band Web SVG */}
			{isAiming && webAnchor && currentWebTip && (
				<svg
					className="fixed inset-0 pointer-events-none z-40 w-full h-full"
					style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.95))" }}
				>
					{/* Top Ceiling Web Splat Anchor (appears when web reaches top) */}
					{webShootProgress >= 0.85 && (
						<g>
							<circle
								cx={webAnchor.x}
								cy={webAnchor.y + 4}
								r="9"
								fill="#f8fafc"
								stroke="#0f172a"
								strokeWidth="2.5"
							/>
							<circle cx={webAnchor.x} cy={webAnchor.y + 4} r="3.5" fill="#94a3b8" />
							<circle cx={webAnchor.x - 7} cy={webAnchor.y + 3} r="4" fill="#f8fafc" />
							<circle cx={webAnchor.x + 7} cy={webAnchor.y + 2} r="4" fill="#f8fafc" />
						</g>
					)}

					{/* Thick stretchy web line (thins down slightly as stretched like rubber) */}
					<line
						x1={handX}
						y1={handY}
						x2={currentWebTip.x}
						y2={currentWebTip.y}
						stroke="#64748b"
						strokeWidth={Math.max(2, 4.5 - stretchDistance * 0.005)}
					/>
					{/* Inner glow core */}
					<line
						x1={handX}
						y1={handY}
						x2={currentWebTip.x}
						y2={currentWebTip.y}
						stroke="#ffffff"
						strokeWidth={Math.max(1, 2.5 - stretchDistance * 0.003)}
						strokeDasharray="6 3"
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

			{/* Spidey Avatar: Pull-to-Slingshot + 3D Fly + Top Wall Hang */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${rotation}deg)`,
					transformOrigin: "38px 20px",
					transition: isAiming || isFlying ? "none" : "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				className="fixed z-40 select-none cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Hold & pull back to slingshot across the screen!"
			>
				{/* Speech bubble */}
				<div
					className={`absolute ${
						isHangingFromCeiling ? "top-full mt-2" : "bottom-full mb-2"
					} left-1/2 -translate-x-1/2 w-48 sm:w-52 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-none ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					<p>{speech}</p>
					<div
						className={`absolute ${
							isHangingFromCeiling
								? "-top-2.5 border-t-3 border-l-3"
								: "-bottom-2.5 border-b-3 border-r-3"
						} left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-black rotate-45`}
					/>
				</div>

				{/* 3D Action Avatar with stretch & launch physics:
				    1. When hung on top ceiling wall: uses updated Top_wall_hang_new.png!
				    2. When pulling slingshot or flying forward: uses updated spidey_swing_new.png with 3D isometric tilt!
				    3. When idle on floor: uses spidey_idle.png
				*/}
				<div
					className={`w-20 h-20 sm:w-24 sm:h-24 filter transition-all duration-150 ${
						isAiming
							? "scale-105 drop-shadow-[0_12px_16px_rgba(0,0,0,0.45)] [transform:perspective(500px)_rotateX(20deg)_rotateY(-15deg)]"
							: isFlying
							? "scale-120 drop-shadow-[0_20px_25px_rgba(0,0,0,0.6)] [transform:perspective(500px)_rotateX(25deg)_rotateY(-20deg)_scale(1.15)]"
							: "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] hover:scale-105 active:scale-95"
					}`}
				>
					<img
						src={
							isHangingFromCeiling
								? "/spidey/Top_wall_hang_new.png"
								: isAiming || isFlying
								? "/spidey/spidey_swing_new.png"
								: "/spidey/spidey_idle.png"
						}
						alt="Spidey Avatar"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
