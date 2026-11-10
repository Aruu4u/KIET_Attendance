import { useEffect, useState } from "react";
import Attendance from "./components/Attendance";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import MemeSoundToggle from "./components/MemeSoundToggle";
import SpiderChat from "./components/SpiderChat";
import SpideyCompanion from "./components/SpideyCompanion";
import TnC from "./components/TnC";
import { AttendanceDataContext } from "./contexts/AppContext";
import { TARGET_PERCENTAGE } from "./types/constants";
import type { StudentDetails } from "./types/response";
import {
	clearAuthCookies,
	msUntilAuthExpiry,
	setAuthCookie,
} from "./utils/jwt";
import { fetchAttendanceData } from "./utils/LoginUtils";

const MAX_SETTIMEOUT_DELAY_MS = 2 ** 31 - 1;

function App() {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);
	const [targetPercentage, setTargetPercentageState] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("attendance_target_percentage");
			if (saved === "60" || saved === "75") {
				return Number(saved);
			}
		} catch {
			// Ignore storage errors
		}
		return TARGET_PERCENTAGE;
	});

	const setTargetPercentage = (val: number) => {
		setTargetPercentageState(val);
		try {
			localStorage.setItem("attendance_target_percentage", String(val));
		} catch {
			// Ignore storage errors
		}
	};

	const [isTnCVisible, setIsTnCVisible] = useState<boolean>(false);
	const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

	// Handle token passed via URL (extension flow)
	useEffect(() => {
		const searchParams = new URLSearchParams(window.location.search);
		const urlToken = searchParams.get("token");

		if (urlToken) {
			window.history.replaceState({}, document.title, window.location.pathname);

			const loginWithToken = async () => {
				try {
					clearAuthCookies();
					setAuthCookie(urlToken);
					const data = await fetchAttendanceData(urlToken);

					const updatedStudentDetails: StudentDetails = {
						...data,
						attendanceCourseComponentInfoList:
							data.attendanceCourseComponentInfoList.map((course) => ({
								...course,
								attendanceCourseComponentNameInfoList:
									course.attendanceCourseComponentNameInfoList.map(
										(component) => ({
											...component,
											isProjected: false,
										}),
									),
							})),
					};

					setAttendanceData(updatedStudentDetails);
				} catch (error) {
					console.error("Failed to login with URL token", error);
				}
			};
			loginWithToken();
		}
	}, []);

	// Auto-logout on JWT expiry
	const isLoggedIn = attendanceData !== null;
	useEffect(() => {
		if (!isLoggedIn) return;

		let timer: ReturnType<typeof setTimeout>;

		const schedule = () => {
			const remaining = msUntilAuthExpiry();
			if (remaining === null) return;
			if (remaining <= 0) {
				clearAuthCookies();
				setAttendanceData(null);
				return;
			}
			timer = setTimeout(
				schedule,
				Math.min(remaining, MAX_SETTIMEOUT_DELAY_MS),
			);
		};

		schedule();
		return () => clearTimeout(timer);
	}, [isLoggedIn]);

	return (
		<div className="min-h-screen flex flex-col spidey-light-bg text-black">
			{/* Top Navbar with GenZ Retro Video Game Title + Sound/Meme Mute Toggle */}
			<header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b-4 border-black shadow-[0_4px_0_#000] px-4 py-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-2xl animate-bounce" style={{ animationDuration: '2s' }}>🕷️</span>
					<div>
						<h1 className="font-black text-lg md:text-xl tracking-tight text-black flex items-center gap-1.5 uppercase font-mono">
							<span>F this Attendance</span>
							<span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full border-2 border-black shadow-[1px_1px_0_#000]">
								Fr fr
							</span>
						</h1>
						<p className="text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:block">
							KIET CyberVidya Edition
						</p>
					</div>
				</div>

				{/* Top Right Sound & Meme Toggle Button */}
				<div className="flex items-center gap-2">
					<MemeSoundToggle />
				</div>
			</header>

			<main className="grow flex flex-col justify-center relative">
				<AttendanceDataContext.Provider
					value={{
						attendanceData,
						setAttendanceData,
						targetPercentage,
						setTargetPercentage,
					}}
				>
					{!attendanceData ? (
						isTnCVisible ? (
							<TnC setIsPasswordVisible={setIsTnCVisible} />
						) : (
							<LoginForm setIsTnCVisible={setIsTnCVisible} />
						)
					) : (
						<Attendance />
					)}

					{/* Spidey Companion: Single tap opens chat if logged in; asks for login if on home screen */}
					<SpideyCompanion
						attendanceData={attendanceData}
						onOpenChat={() => setIsChatOpen(true)}
						isChatOpen={isChatOpen}
					/>

					{/* SpiderBot AI Chat Dialog (Opens seamlessly from Spidey) */}
					<SpiderChat
						isOpen={isChatOpen}
						onClose={() => setIsChatOpen(false)}
						attendanceData={attendanceData}
					/>
				</AttendanceDataContext.Provider>
			</main>

			<Footer />
		</div>
	);
}

export default App;
