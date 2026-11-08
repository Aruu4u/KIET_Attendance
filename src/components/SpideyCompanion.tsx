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
	const [activeMeme, setActiveMeme] = useState<PopMeme | null>(null);

	// Evaluate attendance and trigger sounds seamlessly (limited/once per condition)
	useEffect(() => {
		if (!attendanceData) return;
		try {
			// Find overall percentage
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
			// ignore evaluation errors
		}
	}, [attendanceData]);

	// Random Spidey swings / peeks and speech bubbles (every 20-35s)
	useEffect(() => {
		const interval = setInterval(() => {
			setIsPeeping(true);
			setSpeech(getRandomSlang());
			setTimeout(() => {
				setIsPeeping(false);
			}, 6000);
		}, 25000);

		return () => clearInterval(interval);
	}, []);

	// Prank popup trigger (Rickroll "New Holiday Update!" once after 40 seconds)
	useEffect(() => {
		const prankTimer = setTimeout(() => {
			setActiveMeme({
				id: Date.now(),
				image: "/sounds/rick-roll_B9ZrDk1.webp",
				title: "🎉 URGENT: KIET NEW HOLIDAY NOTICE!",
				subtitle: "You just got Rickrolled! Stay delulu! 🕺",
				sound: "rickroll",
			});
			playSound("rickroll", 0.6);
			setSpeech("Never gonna give you up... Never gonna let you miss class! 🕺");
		}, 40000);

		return () => clearTimeout(prankTimer);
	}, []);

	// Dismiss active meme after 6 seconds
	useEffect(() => {
		if (activeMeme) {
			const t = setTimeout(() => setActiveMeme(null), 6500);
			return () => clearTimeout(t);
		}
	}, [activeMeme]);

	const handleSpideyClick = () => {
		setIsPeeping((prev) => !prev);
		setSpeech(getRandomSlang());
		playSound("spiderman", 0.5);
	};

	return (
		<>
			{/* Side Meme Pop-up Notification */}
			{activeMeme && (
				<div
					className="fixed top-18 right-4 z-50 max-w-xs bg-white border-3 border-black shadow-[6px_6px_0px_#000] p-3 rounded-xl animate-bounce"
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

			{/* Spidey Avatar: Swings, Peeks, and Talks from bottom-left */}
			<div className="fixed bottom-4 left-4 z-40 flex items-end gap-2 pointer-events-auto select-none">
				{/* Pixel Spidey */}
				<div
					onClick={handleSpideyClick}
					className="cursor-pointer transition-transform hover:scale-110 active:scale-95 group relative"
					title="Click Spidey for Lore & Slangs!"
				>
					{/* Speech bubble */}
					<div
						className={`absolute bottom-full left-0 mb-3 w-52 bg-white text-black p-2.5 rounded-2xl border-2 border-black shadow-[4px_4px_0_#000] text-xs font-bold leading-snug transition-all duration-300 ${
							isPeeping ? "opacity-100 scale-100" : "opacity-90 scale-95"
						}`}
					>
						<p>{speech}</p>
						{/* Speech bubble arrow */}
						<div className="absolute -bottom-2 left-6 w-3 h-3 bg-white border-b-2 border-r-2 border-black rotate-45" />
					</div>

					<div
						className={`w-16 h-16 rounded-2xl p-1 bg-amber-100 border-2 border-black shadow-[3px_3px_0_#000] transition-all duration-500 ${
							isPeeping ? "-translate-y-2 rotate-6" : "hover:-translate-y-1"
						}`}
					>
						<img
							src={isPeeping ? "/spidey/spidey_swing.webp" : "/spidey/spidey_idle.jpg"}
							alt="Spidey companion"
							className="w-full h-full object-contain pixelated"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
