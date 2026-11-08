import { useEffect, useState } from "react";
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
	const [speech, setSpeech] = useState<string>("Yo! F this Attendance fr fr 🕸️");
	const [isPeeping, setIsPeeping] = useState<boolean>(false);
	const [isSwinging, setIsSwinging] = useState<boolean>(false);
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	// Dynamic position state for Spidey roaming around the screen
	// Pos: x (percentage across screen 5% to 85%), y (percentage from bottom 4% to 75%)
	const [position, setPosition] = useState<{ x: number; y: number }>({
		x: 8,
		y: 8,
	});

	// Fake Holiday Alert Bait (Click to reveal Rickroll prank)
	const [holidayBaitVisible, setHolidayBaitVisible] = useState<boolean>(false);

	// Evaluate attendance and trigger reactions seamlessly
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

			const overallPct =
				totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 0;

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
					setSpeech("Waah kya scene hai! 80%+ attendance?! Bro has infinite aura! 🗿");
				} else if (overallPct < 70) {
					setActiveMeme({
						id: Date.now(),
						title: "FAAAAH! 💀 NAH BRO IS COOKED",
						subtitle: `Attendance: ${overallPct.toFixed(1)}% — Academic Downfall!`,
						sound: "faaah",
					});
					playSound("faaah", 0.6);
					setSpeech("FAAAAH! Attendance below 70%?! Chat, is bro cooked beyond repair?! 😭");
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
				} else {
					playSound("oh_my_god", 0.5);
					setSpeech("Aura +1000! Safely above 75%. Let him cook! 🍳");
				}
			}, 1500);

			return () => clearTimeout(timer);
		} catch {
			// ignore
		}
	}, [attendanceData]);

	// Roaming / Swinging mechanism: every 15-22 seconds Spidey swings to a new spot!
	useEffect(() => {
		const interval = setInterval(() => {
			setIsSwinging(true);
			setIsPeeping(true);
			setSpeech(getRandomSlang());

			// Pick a random corner / position on screen
			const spots = [
				{ x: 6, y: 8 }, // bottom left
				{ x: 18, y: 22 }, // low mid
				{ x: 75, y: 15 }, // bottom right
				{ x: 80, y: 55 }, // mid right
				{ x: 10, y: 50 }, // mid left
				{ x: 45, y: 8 }, // bottom center
			];
			const randomSpot = spots[Math.floor(Math.random() * spots.length)];
			setPosition(randomSpot);

			// Finish swing animation after 3.5s
			setTimeout(() => {
				setIsSwinging(false);
			}, 3500);

			// Hide speech bubble after 7s
			setTimeout(() => {
				setIsPeeping(false);
			}, 7000);
		}, 18000);

		return () => clearInterval(interval);
	}, []);

	// Show catchy Fake Holiday popup bait after 30 seconds
	useEffect(() => {
		const baitTimer = setTimeout(() => {
			setHolidayBaitVisible(true);
		}, 30000);
		return () => clearTimeout(baitTimer);
	}, []);

	// When user clicks the Holiday Bait -> trigger Rickroll prank!
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

	// Auto-dismiss active meme popups after 7s
	useEffect(() => {
		if (activeMeme) {
			const t = setTimeout(() => setActiveMeme(null), 7000);
			return () => clearTimeout(t);
		}
	}, [activeMeme]);

	const handleSpideyClick = () => {
		setIsPeeping(true);
		setIsSwinging((prev) => !prev);
		setSpeech(getRandomSlang());
		playSound("spiderman", 0.4);
	};

	return (
		<>
			{/* Catchy Fake Holiday Notice Bait Popup */}
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

			{/* Meme Pop-up Notification (waah kya scene, cat laugh, rickroll etc) */}
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

			{/* Roaming & Swinging Spidey Avatar */}
			<div
				style={{
					left: `${position.x}%`,
					bottom: `${position.y}%`,
					transition: "left 2.5s cubic-bezier(0.25, 1, 0.5, 1), bottom 2.5s cubic-bezier(0.25, 1, 0.5, 1)",
				}}
				className="fixed z-40 select-none pointer-events-auto"
			>
				{/* Web thread when swinging */}
				{isSwinging && (
					<div
						className="absolute bottom-full left-7 w-0.5 bg-slate-400 opacity-70 origin-bottom animate-pulse"
						style={{ height: "400px", transform: "rotate(-12deg)" }}
					/>
				)}

				<div
					onClick={handleSpideyClick}
					className={`cursor-pointer transition-transform duration-500 relative ${
						isSwinging
							? "rotate-12 scale-110"
							: "hover:scale-110 active:scale-95"
					}`}
					title="Click Spidey for lore and voice lines!"
				>
					{/* Speech bubble */}
					<div
						className={`absolute bottom-full left-0 mb-3 w-52 bg-white text-black p-2.5 rounded-2xl border-2 border-black shadow-[4px_4px_0_#000] text-xs font-bold leading-snug transition-all duration-300 ${
							isPeeping ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
						}`}
					>
						<p>{speech}</p>
						<div className="absolute -bottom-2 left-6 w-3 h-3 bg-white border-b-2 border-r-2 border-black rotate-45" />
					</div>

					{/* Pixel Spidey graphic (swapping between swinging & idle) */}
					<div
						className={`w-16 h-16 rounded-2xl p-1 bg-amber-100 border-2 border-black shadow-[3px_3px_0_#000] flex items-center justify-center transition-all ${
							isSwinging ? "-rotate-6 shadow-[5px_5px_0_#000]" : ""
						}`}
					>
						<img
							src={isSwinging ? "/spidey/spidey_swing.webp" : "/spidey/spidey_idle.jpg"}
							alt="Spidey companion"
							className="w-full h-full object-contain pixelated"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
