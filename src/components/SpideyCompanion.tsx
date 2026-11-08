import { useEffect, useRef, useState } from "react";
import { getRandomSlang, playSound, type SoundType } from "../utils/soundManager";

interface PopMeme {
	id: number;
	image?: string;
	title: string;
	subtitle?: string;
	sound?: SoundType;
}

export default function SpideyCompanion({
	attendanceData,
}: {
	attendanceData: unknown;
}) {
	const [speech, setSpeech] = useState<string>("Yo! Drag me around the screen! 🕸️");
	const [isPeeping, setIsPeeping] = useState<boolean>(true);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);
	const [holidayBaitVisible, setHolidayBaitVisible] = useState<boolean>(false);

	// Spidey Position on screen (in px)
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: 30, y: 320 });
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [isBackflipping, setIsBackflipping] = useState<boolean>(false);
	const [webTarget, setWebTarget] = useState<{ x: number; y: number } | null>(null);
	const [rotation, setRotation] = useState<number>(0);
	const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	// Trigger holiday bait notice after 25 seconds
	useEffect(() => {
		const baitTimer = setTimeout(() => {
			setHolidayBaitVisible(true);
		}, 25000);
		return () => clearTimeout(baitTimer);
	}, []);

	// Attendance sound checks
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
						subtitle: `Attendance: ${overallPct.toFixed(1)}% — Bro is HIM!`,
						sound: "waah_kya_scene",
					});
					playSound("waah_kya_scene", 0.7);
					setSpeech("Waah kya scene hai! 80%+ attendance?! Infinite aura 🗿");
				} else if (overallPct < 70) {
					setActiveMeme({
						id: Date.now(),
						title: "FAAAAH! 💀 NAH BRO IS COOKED",
						subtitle: `Attendance: ${overallPct.toFixed(1)}% — Academic Downfall!`,
						sound: "faaah",
					});
					playSound("faaah", 0.6);
					setSpeech("FAAAAH! Below 70%?! Chat, is bro cooked beyond repair?! 😭");
				} else if (overallPct < 75) {
					setActiveMeme({
						id: Date.now(),
						image: "/sounds/cat-laugh-meme-1.jpg",
						title: "CAT LAUGH 😹 DETENTION PENDING",
						subtitle: `Attendance: ${overallPct.toFixed(1)}% — Below 75%!`,
						sound: "cat_laugh",
					});
					playSound("cat_laugh", 0.6);
					setSpeech("Below 75%?! Even the cat is laughing at your attendance! 💀");
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

	// Dragging with web-line effect (Supports BOTH Mouse AND Touch on Mobile)
	useEffect(() => {
		const handleMove = (clientX: number, clientY: number) => {
			if (!isDragging) return;
			setWebTarget({ x: clientX, y: clientY });
			const newX = clientX - dragStartOffset.current.x;
			const newY = clientY - dragStartOffset.current.y;
			setPos({ x: newX, y: newY });
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
			setWebTarget(null);

			const screenW = window.innerWidth;
			const screenH = window.innerHeight;
			const finalX = clientX - dragStartOffset.current.x;
			const finalY = clientY - dragStartOffset.current.y;

			// Wall stick or floor sit
			if (finalX < 60) {
				setPos({ x: 10, y: Math.max(60, Math.min(screenH - 120, finalY)) });
				setRotation(90); // Cling to left
				setSpeech("Stuck to the left wall 🧗‍♂️");
			} else if (finalX > screenW - 100) {
				setPos({ x: screenW - 75, y: Math.max(60, Math.min(screenH - 120, finalY)) });
				setRotation(-90); // Cling to right
				setSpeech("Wall crawling in progress 🕷️");
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
				setWebTarget(null);
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
	}, [isDragging]);

	// Mouse drag start
	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setIsDragging(true);
		dragStartOffset.current = {
			x: e.clientX - pos.x,
			y: e.clientY - pos.y,
		};
		playSound("web_swing", 0.35);
		setSpeech("WHEEEEE! Web swinging! 🕸️💨");
		setIsPeeping(true);
	};

	// Touch drag start (Mobile phones & tablets)
	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			setIsDragging(true);
			dragStartOffset.current = {
				x: touch.clientX - pos.x,
				y: touch.clientY - pos.y,
			};
			playSound("web_swing", 0.35);
			setSpeech("WHEEEEE! Swinging on mobile! 📱🕸️");
			setIsPeeping(true);
		}
	};

	// Double click or tap for backflip trick
	const handleBackflip = () => {
		setIsBackflipping(true);
		playSound("web_swing", 0.4);
		setSpeech("Aura +1000 Backflip! 🤸‍♂️✨");
		setIsPeeping(true);
		setTimeout(() => setIsBackflipping(false), 800);
	};

	// Rickroll prank trigger
	const triggerRickrollPrank = () => {
		setHolidayBaitVisible(false);
		setActiveMeme({
			id: Date.now(),
			image: "/sounds/rick-roll_B9ZrDk1.webp",
			title: "🕺 YOU JUST GOT RICKROLLED!",
			subtitle: "No new holiday bro... go attend class! Never gonna let you down! 😭",
			sound: "rickroll",
		});
		playSound("rickroll", 0.7);
		setSpeech("Never gonna give you up... Never gonna give you holiday! 🕺");
		setIsPeeping(true);
	};

	return (
		<>
			{/* Web strand while dragging / swinging towards finger/cursor */}
			{isDragging && webTarget && (
				<svg
					className="fixed inset-0 pointer-events-none z-40 w-full h-full"
					style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.8))" }}
				>
					<line
						x1={pos.x + 35}
						y1={pos.y + 20}
						x2={webTarget.x}
						y2={webTarget.y}
						stroke="#cbd5e1"
						strokeWidth="2.5"
						strokeDasharray="4 2"
					/>
				</svg>
			)}

			{/* Fake Holiday Alert Bait (Click to reveal Rickroll prank) */}
			{holidayBaitVisible && (
				<div
					onClick={triggerRickrollPrank}
					className="fixed top-20 right-4 z-50 cursor-pointer max-w-xs bg-amber-300 border-3 border-black shadow-[6px_6px_0_#000] p-3 rounded-2xl animate-pulse hover:scale-105 active:scale-95 transition-all"
					title="Click to check holiday details"
				>
					<div className="flex items-start gap-2.5">
						<span className="text-2xl">🚨</span>
						<div className="flex-1">
							<div className="flex justify-between items-center">
								<span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full border border-black">
									URGENT NOTICE
								</span>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setHolidayBaitVisible(false);
									}}
									className="text-black font-black text-xs hover:text-red-700"
								>
									✕
								</button>
							</div>
							<h4 className="font-black text-xs text-black mt-1 uppercase">
								KIET: New Semester Holiday Declared!
							</h4>
							<p className="text-[11px] text-gray-900 font-bold underline mt-0.5">
								Tap here to see official list →
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Meme Pop-up Notification */}
			{activeMeme && (
				<div
					className="fixed top-18 right-4 z-50 max-w-xs bg-white border-3 border-black shadow-[6px_6px_0_#000] p-3 rounded-xl animate-bounce"
					style={{ animationIterationCount: 2 }}
				>
					<div className="flex justify-between items-start gap-2">
						<div>
							<span className="text-[10px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">
								ALERT 🚨
							</span>
							<h4 className="font-black text-sm text-black mt-1 leading-tight">
								{activeMeme.title}
							</h4>
							{activeMeme.subtitle && (
								<p className="text-xs text-gray-700 font-semibold mt-0.5">
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
						<div className="mt-2 rounded-lg overflow-hidden border-2 border-black max-h-36">
							<img
								src={activeMeme.image}
								alt="meme"
								className="w-full h-full object-cover"
							/>
						</div>
					)}
				</div>
			)}

			{/* Draggable, Wall-Sticking Spidey PNG Avatar with Full Touch Support */}
			<div
				style={{
					left: `${pos.x}px`,
					top: `${pos.y}px`,
					transform: `rotate(${rotation}deg)`,
					transition: isDragging ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				onDoubleClick={handleBackflip}
				className="fixed z-40 select-none cursor-grab active:cursor-grabbing pointer-events-auto"
				title="Drag me around! Double-tap for backflip!"
			>
				{/* Speech bubble */}
				<div
					className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 sm:w-52 bg-white text-black p-2.5 rounded-2xl border-2 border-black shadow-[4px_4px_0_#000] text-xs font-bold leading-snug transition-all duration-300 pointer-events-none ${
						isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75"
					}`}
					style={{ transform: `rotate(${-rotation}deg)` }}
				>
					<p>{speech}</p>
					<div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b-2 border-r-2 border-black rotate-45" />
				</div>

				{/* Pure Transparent Spidey PNG Character */}
				<div
					className={`w-16 h-16 sm:w-20 sm:h-20 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)] transition-transform duration-500 ${
						isBackflipping ? "rotate-[360deg] scale-125" : ""
					} ${isDragging ? "scale-110 -rotate-12" : "hover:scale-105 active:scale-95"}`}
				>
					<img
						src={isDragging ? "/spidey/spidey_swing.png" : "/spidey/spidey_idle.png"}
						alt="Spidey Character"
						className="w-full h-full object-contain pixelated pointer-events-none"
					/>
				</div>
			</div>
		</>
	);
}
