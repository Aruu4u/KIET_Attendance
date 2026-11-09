import { useEffect, useRef, useState } from "react";
import { getRandomSlang, playSound, type SoundType } from "../utils/soundManager";

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
	const [speech, setSpeech] = useState<string>("Tap me to chat or drag me to swing! 🕸️");
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	// Spidey Position on screen (in px)
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 30, y: 320 });
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [isBackflipping, setIsBackflipping] = useState<boolean>(false);
	const [rotation, setRotation] = useState<number>(0);

	// Anchor point for the web shooter on the top ceiling / wall
	const [ceilingAnchor, setCeilingAnchor] = useState<{ x: number; y: number } | null>(null);
	// Swing angle calculated from pendulum physics
	const [swingAngle, setSwingAngle] = useState<number>(0);

	const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const dragDistance = useRef<number>(0);

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

	// Dragging with web shooting to the top ceiling wall & swinging
	useEffect(() => {
		const handleMove = (clientX: number, clientY: number) => {
			if (!isDragging) return;
			dragDistance.current += 1;

			const newX = clientX - dragStartOffset.current.x;
			const newY = clientY - dragStartOffset.current.y;
			setPos({ x: newX, y: newY });

			// Calculate swing angle relative to the top ceiling anchor
			if (ceilingAnchor) {
				const dx = newX + 35 - ceilingAnchor.x;
				const dy = newY + 20 - ceilingAnchor.y;
				// Pendulum tilt angle in degrees (-45deg to +45deg)
				const angle = Math.max(-45, Math.min(45, (Math.atan2(dx, dy) * 180) / Math.PI));
				setSwingAngle(angle);
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
			setCeilingAnchor(null);
			setSwingAngle(0);

			const screenW = window.innerWidth;
			const screenH = window.innerHeight;
			const finalX = clientX - dragStartOffset.current.x;
			const finalY = clientY - dragStartOffset.current.y;

			// If it was just a quick tap/click without dragging, open chat
			if (dragDistance.current < 5) {
				handleSingleTap();
				return;
			}

			// Wall stick or floor sit
			if (finalX < 60) {
				setPos({ x: 10, y: Math.max(60, Math.min(screenH - 120, finalY)) });
				setRotation(90); // Cling to left
				setSpeech("Clinging to the left wall 🧗‍♂️");
			} else if (finalX > screenW - 100) {
				setPos({ x: screenW - 75, y: Math.max(60, Math.min(screenH - 120, finalY)) });
				setRotation(-90); // Cling to right
				setSpeech("Wall crawling in 3D 🕷️");
			} else if (finalY > screenH - 140) {
				setPos({ x: finalX, y: screenH - 90 });
				setRotation(0);
				setSpeech("Chillin on the floor rn 🍕");
			} else {
				setRotation(0);
				setSpeech(getRandomSlang());
			}

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
				setSwingAngle(0);
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
	}, [isDragging, ceilingAnchor, attendanceData]);

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

	// Mouse drag start: Shoot web to the TOP CEILING WALL and anchor it!
	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		dragDistance.current = 0;
		setIsDragging(true);

		// Anchor the web shooter to the top wall (y = 0) right above Spidey
		const anchorX = Math.max(40, Math.min(window.innerWidth - 40, e.clientX));
		setCeilingAnchor({ x: anchorX, y: 0 });

		dragStartOffset.current = {
			x: e.clientX - pos.x,
			y: e.clientY - pos.y,
		};
		playSound("web_swing", 0.35);
	};

	// Touch drag start (Mobile): Shoot web to the TOP CEILING WALL and anchor it!
	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			dragDistance.current = 0;
			setIsDragging(true);

			// Anchor the web shooter to the top wall (y = 0)
			const anchorX = Math.max(40, Math.min(window.innerWidth - 40, touch.clientX));
			setCeilingAnchor({ x: anchorX, y: 0 });

			dragStartOffset.current = {
				x: touch.clientX - pos.x,
				y: touch.clientY - pos.y,
			};
			playSound("web_swing", 0.35);
		}
	};

	// Double tap for trick
	const handleDoubleTap = () => {
		setIsBackflipping(true);
		playSound("web_swing", 0.4);
		setSpeech("Aura +1000 Backflip! 🤸‍♂️✨");
		setIsPeeping(true);
		setTimeout(() => setIsBackflipping(false), 800);
	};

	return (
		<>
			{/* Web shooter anchored to the TOP WALL and connected to Spidey's hand */}
			{isDragging && ceilingAnchor && (
				<svg
					className="fixed inset-0 pointer-events-none z-40 w-full h-full"
					style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.95))" }}
				>
					{/* Web Splat Anchor on the Top Wall */}
					<circle
						cx={ceilingAnchor.x}
						cy={ceilingAnchor.y + 4}
						r="8"
						fill="#e2e8f0"
						stroke="#0f172a"
						strokeWidth="2.5"
					/>
					<circle cx={ceilingAnchor.x} cy={ceilingAnchor.y + 4} r="3" fill="#cbd5e1" />
					{/* Secondary anchor splats */}
					<circle cx={ceilingAnchor.x - 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#e2e8f0" />
					<circle cx={ceilingAnchor.x + 7} cy={ceilingAnchor.y + 2} r="3.5" fill="#e2e8f0" />

					{/* Strong, taut Web Rope */}
					<line
						x1={ceilingAnchor.x}
						y1={ceilingAnchor.y + 4}
						x2={pos.x + 38}
						y2={pos.y + 18}
						stroke="#94a3b8"
						strokeWidth="3.5"
					/>
					{/* Inner bright web thread */}
					<line
						x1={ceilingAnchor.x}
						y1={ceilingAnchor.y + 4}
						x2={pos.x + 38}
						y2={pos.y + 18}
						stroke="#f8fafc"
						strokeWidth="1.5"
						strokeDasharray="8 3"
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

			{/* Draggable, Wall-Sticking Spidey 3D/Isometric Swinging Avatar */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${isDragging ? swingAngle : rotation}deg)`,
					transformOrigin: "38px 18px", // Pivots naturally from the web in hand
					transition: isDragging ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				onDoubleClick={handleDoubleTap}
				className="fixed z-40 select-none cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Single tap to chat! Drag to swing from the ceiling!"
			>
				{/* Speech bubble */}
				<div
					className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 sm:w-52 bg-white text-black p-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0_#000] text-xs font-black leading-snug transition-all duration-300 pointer-events-none ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-(isDragging ? swingAngle : rotation)}deg)` }}
				>
					<p>{speech}</p>
					<div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-b-3 border-r-3 border-black rotate-45" />
				</div>

				{/* 3D Action Avatar with perspective swing dynamic shadow */}
				<div
					className={`w-18 h-18 sm:w-22 sm:h-22 filter transition-all duration-300 ${
						isBackflipping ? "rotate-[360deg] scale-125" : ""
					} ${
						isDragging
							? "scale-115 drop-shadow-[0_16px_20px_rgba(0,0,0,0.55)] [transform:perspective(500px)_rotateX(18deg)_rotateY(-12deg)_translateZ(20px)]"
							: "drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] hover:scale-105 active:scale-95"
					}`}
				>
					<img
						src={isDragging ? "/spidey/spidey_swing.png" : "/spidey/spidey_idle.png"}
						alt="Spidey Companion"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
