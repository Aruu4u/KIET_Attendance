import axios from "axios";
import Cookies from "js-cookie";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	CACHED_ATTENDANCE_KEY,
	COOKIE_EXPIRY,
	PASSWORD_COOKIE_NAME,
	REMEMBER_ME_COOKIE_NAME,
	STUDENT_ID_COOKIE_NAME,
	USERNAME_COOKIE_NAME,
	getBaseUrl,
} from "../types/constants";
import type {
	EncryptLoginResponse,
	LoginResponse,
	StudentDetails,
} from "../types/response";
import { setAuthCookie } from "../utils/jwt";
import { encryptPassword, fetchAttendanceData } from "../utils/LoginUtils";
import InstallExtensionPage from "./InstallExtensionPage";

// Hardcoded student credentials
const HARDCODED_USERNAME = "202401100200087";
const HARDCODED_PASSWORD = "Arsal@2428";

interface ApiErrorResponse {
	error?: { reason?: string };
}

function getServerErrorReason(err: unknown): string | null {
	if (axios.isAxiosError(err)) {
		const data = err.response?.data as ApiErrorResponse | undefined;
		return data?.error?.reason ?? null;
	}
	return null;
}

function isUnsupportedClientVersionError(err: unknown): boolean {
	const reason = getServerErrorReason(err)?.toLowerCase() ?? "";
	return (
		reason.includes("update your mobile application") ||
		reason.includes("version is no longer supported")
	);
}

async function loadAttendance(
	token: string,
	setAttendanceData: React.Dispatch<React.SetStateAction<StudentDetails | null>>,
) {
	const data = await fetchAttendanceData(token);
	const updatedStudentDetails: StudentDetails = {
		...data,
		attendanceCourseComponentInfoList:
			data.attendanceCourseComponentInfoList.map((course) => ({
				...course,
				attendanceCourseComponentNameInfoList:
					course.attendanceCourseComponentNameInfoList.map((component) => ({
						...component,
						isProjected: false,
					})),
			})),
	};
	try {
		localStorage.setItem(CACHED_ATTENDANCE_KEY, JSON.stringify(updatedStudentDetails));
	} catch {
		// ignore storage quota issues
	}
	setAttendanceData(updatedStudentDetails);
}

interface LoginFormProps {
	setIsTnCVisible: React.Dispatch<React.SetStateAction<boolean>>;
	onModeChange?: (mode: "proxy" | "live") => void;
}

function LoginForm({ setIsTnCVisible }: LoginFormProps) {
	const otpRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<"credentials" | "otp">("credentials");
	const [transactionId, setTransactionId] = useState<string>("");
	const submittedUsernameRef = useRef<string>("");
	const submittedPasswordRef = useRef<string>("");
	const submittedRememberMeRef = useRef<boolean>(true);
	const [error, setError] = useState<string>("");
	const [isExtensionError, setIsExtensionError] = useState<boolean>(false);
	const [showInstallPage, setShowInstallPage] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [autoLoginStatus, setAutoLoginStatus] = useState<string>("Connecting to CyberVidya...");
	const [otpStatus, setOtpStatus] = useState<string>("");
	const hasAutoLoggedIn = useRef(false);

	const { setAttendanceData } = useAppContext();

	const handleAuthError = (
		err: unknown,
		badRequestMessage: string,
		forbiddenMessage: string,
		networkErrorMessage: string,
	) => {
		if (!axios.isAxiosError(err)) {
			setError(networkErrorMessage);
			return;
		}
		const serverReason = getServerErrorReason(err);
		const status = err.response?.status;
		if (status === 400) {
			setError(serverReason || badRequestMessage);
		} else if (status === 403) {
			setError(serverReason || forbiddenMessage);
		} else {
			setError(networkErrorMessage);
		}
	};

	// Load existing session or cached attendance on mount to prevent OTP spam
	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);
		if (token) {
			const loadData = async () => {
				try {
					await loadAttendance(token, setAttendanceData);
				} catch (error) {
					// Check if we have cached attendance before nuking session
					try {
						const cached = localStorage.getItem(CACHED_ATTENDANCE_KEY);
						if (cached) {
							const parsed = JSON.parse(cached);
							if (parsed?.attendanceCourseComponentInfoList) {
								setAttendanceData(parsed);
								return;
							}
						}
					} catch {
						// ignore
					}
					setError(error instanceof Error ? error.message : String(error));
					Cookies.remove(AUTH_COOKIE_NAME);
					Cookies.remove(STUDENT_ID_COOKIE_NAME);
				}
			};
			loadData();
		} else {
			// If no token, check if we have cached attendance data from previous login
			try {
				const cached = localStorage.getItem(CACHED_ATTENDANCE_KEY);
				if (cached) {
					const parsed = JSON.parse(cached);
					if (parsed?.attendanceCourseComponentInfoList) {
						setAttendanceData(parsed);
					}
				}
			} catch {
				// ignore
			}
		}
	}, [setAttendanceData]);

	// --- Complete login after getting token ---
	const completeLogin = useCallback(
		async (login: {
			token: string;
			username: string;
			password: string;
			rememberMe: boolean;
			studentId?: number | string;
		}) => {
			const { token, username: user, password, rememberMe, studentId } = login;
			Cookies.remove(STUDENT_ID_COOKIE_NAME);
			if (studentId) {
				Cookies.set(STUDENT_ID_COOKIE_NAME, String(studentId), {
					expires: COOKIE_EXPIRY,
				});
			}
			setAuthCookie(token);
			Cookies.set(USERNAME_COOKIE_NAME, user, { expires: COOKIE_EXPIRY });
			Cookies.set(REMEMBER_ME_COOKIE_NAME, rememberMe.toString(), {
				expires: COOKIE_EXPIRY,
			});
			if (rememberMe) {
				Cookies.set(PASSWORD_COOKIE_NAME, password, { expires: COOKIE_EXPIRY });
			} else {
				Cookies.remove(PASSWORD_COOKIE_NAME);
			}
			try {
				await loadAttendance(token, setAttendanceData);
			} catch (fetchError) {
				console.error(fetchError);
				setError(
					"Login successful, but CyberVidya didn't return attendance data. Please refresh.",
				);
			} finally {
				setLoading(false);
			}
		},
		[setAttendanceData],
	);

	// --- Submit OTP ---
	const submitOtp = useCallback(
		async (otp: string) => {
			setLoading(true);
			setError("");
			setIsExtensionError(false);

			try {
				const otpResponse = await axios.post<LoginResponse>(
					`${getBaseUrl()}/api/auth/verify/otp`,
					{ otp, transactionId, device: "WEB", version: null },
				);
				const token =
					otpResponse.data.token || otpResponse.data.data?.token || "";
				await completeLogin({
					token,
					username: submittedUsernameRef.current,
					password: submittedPasswordRef.current,
					rememberMe: submittedRememberMeRef.current,
				});
			} catch (otpError) {
				handleAuthError(
					otpError,
					"Invalid or expired OTP",
					"Invalid or expired OTP",
					"OTP verification failed. Please try again.",
				);
				setLoading(false);
			}
		},
		[transactionId, completeLogin],
	);

	// --- Auto-fetch OTP from Gmail when OTP step is active ---
	useEffect(() => {
		if (step !== "otp") return;

		let cancelled = false;
		let attempts = 0;
		const MAX_ATTEMPTS = 15;

		const tryFetchOtp = async () => {
			if (cancelled) return;
			attempts++;
			setOtpStatus(`📧 Auto-fetching OTP from Gmail... (${attempts}/${MAX_ATTEMPTS})`);

			try {
				const res = await fetch("/api/get-otp");
				const data = await res.json();

				if (cancelled) return;

				if (data.status === "success" && data.otp) {
					setOtpStatus(`✅ OTP found (${data.otp})! Verifying with CyberVidya...`);
					await submitOtp(data.otp);
					return;
				}

				if (attempts < MAX_ATTEMPTS) {
					setTimeout(tryFetchOtp, 3000);
				} else {
					setOtpStatus("");
					setError(
						"Could not auto-fetch OTP after 45 seconds. Enter manually below.",
					);
				}
			} catch {
				if (!cancelled && attempts < MAX_ATTEMPTS) {
					setTimeout(tryFetchOtp, 3000);
				} else if (!cancelled) {
					setOtpStatus("");
					setError("Failed to fetch OTP automatically. Enter manually below.");
				}
			}
		};

		const initialTimer = setTimeout(tryFetchOtp, 3500);
		setOtpStatus("⏳ Waiting for CyberVidya OTP email...");

		return () => {
			cancelled = true;
			clearTimeout(initialTimer);
		};
	}, [step, submitOtp]);

	// --- Auto-login on mount (skip if cached data or token is active to avoid OTP lockouts) ---
	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);
		const cached = (() => {
			try {
				return localStorage.getItem(CACHED_ATTENDANCE_KEY);
			} catch {
				return null;
			}
		})();
		if (token || cached || hasAutoLoggedIn.current) return;
		hasAutoLoggedIn.current = true;

		const doAutoLogin = async () => {
			setLoading(true);
			setAutoLoginStatus("🕸️ Connecting to CyberVidya...");

			const enteredUser = HARDCODED_USERNAME;
			const enteredPass = HARDCODED_PASSWORD;

			// Direct login attempt
			try {
				const directResponse = await axios.post<LoginResponse>(
					`${getBaseUrl()}/api/auth/login`,
					{ userName: enteredUser, password: enteredPass },
				);
				const directToken =
					directResponse.data.token || directResponse.data.data?.token;
				if (directToken) {
					setAutoLoginStatus("✅ Logged in!");
					await completeLogin({
						token: directToken,
						username: enteredUser,
						password: enteredPass,
						rememberMe: true,
						studentId: directResponse.data.data?.id,
					});
					return;
				}
			} catch (directError) {
				if (
					axios.isAxiosError(directError) &&
					directError.response?.status === 400 &&
					!isUnsupportedClientVersionError(directError)
				) {
					setError(
						getServerErrorReason(directError) || "Invalid username or password.",
					);
					setLoading(false);
					return;
				}
			}

			// Encrypted login (triggers OTP generation)
			try {
				setAutoLoginStatus("🔐 Authenticating & requesting OTP...");

				const loginResponse = await axios.post<EncryptLoginResponse>(
					`${getBaseUrl()}/api/auth/encrypt/login`,
					{
						userName: encryptPassword(enteredUser),
						password: encryptPassword(enteredPass),
						device: "WEB",
						version: null,
						reCaptchaToken: null,
					},
				);

				const loginData = loginResponse.data;
				const directToken = loginData.token || loginData.data?.token;
				if (directToken) {
					setAutoLoginStatus("✅ Logged in!");
					await completeLogin({
						token: directToken,
						username: enteredUser,
						password: enteredPass,
						rememberMe: true,
						studentId: loginData.data?.id,
					});
					return;
				}

				const nextTransactionId = loginData.data?.transactionId;
				if (!nextTransactionId) {
					setError("CyberVidya didn't return an OTP transaction. Try again.");
					setLoading(false);
					return;
				}

				submittedUsernameRef.current = enteredUser;
				submittedPasswordRef.current = enteredPass;
				submittedRememberMeRef.current = true;
				setTransactionId(nextTransactionId);
				setAutoLoginStatus("📧 OTP sent! Auto-fetching from Gmail...");
				setStep("otp");
			} catch (loginError) {
				handleAuthError(
					loginError,
					"Invalid username or password.",
					"Access forbidden. Check credentials.",
					"Login failed. CyberVidya's service isn't responding. Try again.",
				);
				setLoading(false);
			}
		};

		doAutoLogin();
	}, [completeLogin]);

	const handleOtpSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await submitOtp(otpRef.current?.value || "");
	};

	if (showInstallPage) {
		return <InstallExtensionPage onBack={() => setShowInstallPage(false)} />;
	}

	return (
		<div className="flex flex-col mb-16 mt-6 items-center justify-center p-4">
			<div className="w-full max-w-md p-6 sm:p-8 bg-white border-4 border-black shadow-[8px_8px_0_#000] rounded-2xl relative">
				{/* Top badge row: Fixed flex-wrap to prevent overlap on mobile */}
				<div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-2 border-b-2 border-dashed border-gray-200">
					<span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2.5 py-1 rounded-full border-2 border-black shadow-[2px_2px_0_#000] whitespace-nowrap">
						🕸️ KIET Student Portal
					</span>
					<span className="text-[11px] font-black text-gray-700 tracking-wide whitespace-nowrap bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-300">
						Roll: 202401100200087
					</span>
				</div>

				{/* Title & Spidey graphic */}
				<div className="flex flex-col items-center mb-6">
					<div className="w-20 h-20 mb-3 rounded-2xl p-2 bg-red-50 border-3 border-black shadow-[4px_4px_0_#000] flex items-center justify-center">
						<img
							src="/spidey/spidey_idle.png"
							alt="Spidey"
							className="w-full h-full object-contain pixelated"
						/>
					</div>
					<h2 className="text-2xl sm:text-3xl font-black text-center text-black tracking-tight uppercase">
						F this Attendance
					</h2>
					<p className="text-xs text-gray-600 font-bold mt-1 text-center">
						"With great power comes 75% attendance criteria" 😭
					</p>
				</div>

				{/* Automated OTP status badge */}
				<div className="mb-6 text-center text-xs font-bold py-2.5 px-3 rounded-xl border-2 border-black shadow-[2px_2px_0_#000] bg-emerald-100 text-emerald-950 flex items-center justify-center gap-1.5">
					<Sparkles size={14} className="text-emerald-700 shrink-0" />
					<span>Auto-OTP Active &bull; Zero manual entry required</span>
				</div>

				{/* Loading State */}
				{loading && step === "credentials" && (
					<div className="text-center py-6">
						<div className="w-10 h-10 border-4 border-black border-t-red-600 rounded-full mx-auto mb-3 animate-spin" />
						<p className="text-sm font-black text-black">
							{autoLoginStatus}
						</p>
						<p className="text-xs text-gray-500 font-bold mt-1">
							Let him cook... 🍳
						</p>
					</div>
				)}

				{/* OTP Step */}
				{step === "otp" && (
					<div className="space-y-4">
						{otpStatus && (
							<div className="text-xs font-black text-center py-2.5 px-3 rounded-xl border-2 border-black bg-amber-100 text-amber-950 shadow-[2px_2px_0_#000]">
								{otpStatus}
							</div>
						)}

						{loading ? (
							<div className="flex items-center justify-center gap-2 py-3">
								<div className="w-5 h-5 border-3 border-black border-t-red-600 rounded-full animate-spin" />
								<span className="text-xs font-black text-gray-800">
									Verifying OTP with CyberVidya...
								</span>
							</div>
						) : (
							<form onSubmit={handleOtpSubmit} className="space-y-3">
								<div>
									<label
										htmlFor="otp"
										className="block text-xs font-black text-black uppercase mb-1"
									>
										Manual OTP Backup:
									</label>
									<input
										id="otp"
										type="text"
										inputMode="numeric"
										maxLength={6}
										ref={otpRef}
										placeholder="XXXXXX"
										className="w-full text-center tracking-widest text-lg font-black py-2.5 px-3 bg-gray-50 border-2 border-black rounded-xl shadow-[3px_3px_0_#000] focus:outline-none focus:bg-white"
										required
									/>
								</div>
								<button
									type="submit"
									disabled={loading}
									className="w-full py-2.5 px-4 text-xs font-black uppercase text-white bg-red-600 border-2 border-black rounded-xl shadow-[3px_3px_0_#000] hover:bg-red-700 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
								>
									Verify OTP →
								</button>
								<button
									type="button"
									onClick={() => {
										setStep("credentials");
										setError("");
										setOtpStatus("");
										hasAutoLoggedIn.current = false;
									}}
									className="w-full text-center text-xs font-bold text-gray-500 underline cursor-pointer hover:text-black"
								>
									← Back to login
								</button>
							</form>
						)}
					</div>
				)}

				{/* Error Notice */}
				{error && (
					<div className="mt-4 p-3 rounded-xl border-2 border-black bg-red-100 text-red-950 text-xs font-black shadow-[3px_3px_0_#000]">
						<p>{error}</p>
						{isExtensionError && (
							<button
								type="button"
								onClick={() => setShowInstallPage(true)}
								className="mt-2 text-xs font-black underline cursor-pointer block"
							>
								View extension installation guide →
							</button>
						)}
					</div>
				)}

				{/* Footer credits inside card */}
				<div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300 flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase">
					<span>Aura Tracking: ON 🗿</span>
					<button
						type="button"
						onClick={() => setIsTnCVisible((prev) => !prev)}
						className="hover:text-black underline cursor-pointer"
					>
						Terms of Service
					</button>
				</div>
			</div>
		</div>
	);
}

export default LoginForm;
