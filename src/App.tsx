import { useEffect, useRef, useState } from "react";
import Attendance from "./components/Attendance";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import SpiderChat from "./components/SpiderChat";
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
	const [gmailAuthorized, setGmailAuthorized] = useState<boolean>(false);
	const hasSelectedLiveRef = useRef<boolean>(false);

	// Detect Gmail auth success from URL param or check status
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("gmail_auth") === "success") {
			setGmailAuthorized(true);
			window.history.replaceState({}, document.title, window.location.pathname);
		}
		fetch("/api/get-otp")
			.then((r) => r.json())
			.then((d) => {
				if (d && d.status !== "unauthorized") setGmailAuthorized(true);
			})
			.catch(() => {});
	}, []);

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
		<div className="min-h-screen flex flex-col spider-web-bg">
			{/* Spider-Man themed header banner */}
			<div
				className="overflow-hidden w-full"
				style={{
					background: "linear-gradient(135deg, rgba(204,0,0,0.9), rgba(139,0,0,0.95))",
					borderBottom: "1px solid rgba(204,0,0,0.5)",
				}}
			>
				<div
					className="py-2 text-center text-xs font-bold tracking-widest uppercase text-red-100 flex items-center justify-center gap-2"
				>
					<span>🕷️</span>
					<span>SPIDER ATTENDANCE &bull; KIET GROUP OF INSTITUTIONS</span>
					<span>🕸️</span>
				</div>
			</div>

			<div className="grow flex flex-col justify-center">
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
							<LoginForm
								setIsTnCVisible={setIsTnCVisible}
								onModeChange={(mode) => {
									if (mode === "live") hasSelectedLiveRef.current = true;
								}}
								gmailAuthorized={gmailAuthorized}
							/>
						)
					) : (
						<Attendance />
					)}

					{/* SpiderBot AI Chat widget — available when logged in */}
					{attendanceData && <SpiderChat />}
				</AttendanceDataContext.Provider>
			</div>

			<Footer />
		</div>
	);
}

export default App;
