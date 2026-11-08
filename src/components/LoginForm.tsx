import axios from "axios";
import Cookies from "js-cookie";
import { Shield, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	PASSWORD_COOKIE_NAME,
	REMEMBER_ME_COOKIE_NAME,
	STUDENT_ID_COOKIE_NAME,
	USERNAME_COOKIE_NAME,
	getApiMode,
	getBaseUrl,
	setApiMode,
} from "../types/constants";
import type {
	EncryptLoginResponse,
	LoginResponse,
	StudentDetails,
} from "../types/response";
import { setAuthCookie } from "../utils/jwt";
import { encryptPassword, fetchAttendanceData } from "../utils/LoginUtils";
import InstallExtensionPage from "./InstallExtensionPage";

// ---- Hardcoded credentials (personal use only) ----
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
	setAttendanceData(updatedStudentDetails);
}

interface LoginFormProps {
	setIsTnCVisible: React.Dispatch<React.SetStateAction<boolean>>;
	onModeChange?: (mode: "proxy" | "live") => void;
	gmailAuthorized: boolean;
}

function LoginForm({ setIsTnCVisible, onModeChange, gmailAuthorized }: LoginFormProps) {
	const otpRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<"credentials" | "otp">("credentials");
	const [transactionId, setTransactionId] = useState<string>("");
	const [apiMode, setApiModeState] = useState<"proxy" | "live">(() => getApiMode());
	const submittedUsernameRef = useRef<string>("");
	const submittedPasswordRef = useRef<string>("");
	const submittedRememberMeRef = useRef<boolean>(true);
	const loginStartTimeRef = useRef<number>(0);
	const [error, setError] = useState<string>("");
	const [isExtensionError, setIsExtensionError] = useState<boolean>(false);
	const [showInstallPage, setShowInstallPage] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [autoLoginStatus, setAutoLoginStatus] = useState<string>("Connecting to CyberVidya...");
	const [otpStatus, setOtpStatus] = useState<string>("");
	const hasAutoLoggedIn = useRef(false);

	const { setAttendanceData } = useAppContext();

	const handleModeToggle = (newMode: "proxy" | "live") => {
		setApiModeState(newMode);
		setApiMode(newMode);
		setError("");
		setIsExtensionError(false);
		onModeChange?.(newMode);
	};

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
			if (apiMode === "live") {
				setError("Please Update the Extension to the latest version 3.6!");
				setIsExtensionError(true);
			} else {
				setError(serverReason || forbiddenMessage);
			}
		} else {
			setError(networkErrorMessage);
		}
	};

	// Load existing session on mount
	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);
		if (token) {
			const loadData = async () => {
				try {
					await loadAttendance(token, setAttendanceData);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
					Cookies.remove(AUTH_COOKIE_NAME);
					Cookies.remove(STUDENT_ID_COOKIE_NAME);
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	// --- Core: complete login after getting token ---
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

	// --- Submit OTP (called manually or automatically) ---
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
			setOtpStatus(`📧 Fetching OTP from Gmail... (attempt ${attempts}/${MAX_ATTEMPTS})`);

			try {
				const res = await fetch(
					`/api/get-otp?after=${loginStartTimeRef.current}`,
				);
				const data = await res.json();

				if (cancelled) return;

				if (data.status === "success" && data.otp) {
					setOtpStatus(`✅ OTP received! Verifying automatically...`);
					await submitOtp(data.otp);
					return;
				}

				if (data.status === "unauthorized") {
					setOtpStatus("");
					setError(
						"⚠️ Gmail not authorized. Please click 'Authorize Gmail' above, then try again.",
					);
					return;
				}

				// Not found yet — retry
				if (attempts < MAX_ATTEMPTS) {
					setTimeout(tryFetchOtp, 3000);
				} else {
					setOtpStatus("");
					setError(
						"Could not auto-fetch OTP after 45 seconds. Please enter it manually.",
					);
				}
			} catch {
				if (!cancelled && attempts < MAX_ATTEMPTS) {
					setTimeout(tryFetchOtp, 3000);
				} else if (!cancelled) {
					setOtpStatus("");
					setError("Failed to fetch OTP automatically. Please enter it manually.");
				}
			}
		};

		// Wait 4 seconds for the email to arrive, then start polling
		const initialTimer = setTimeout(tryFetchOtp, 4000);
		setOtpStatus("⏳ Waiting for OTP email to arrive...");

		return () => {
			cancelled = true;
			clearTimeout(initialTimer);
		};
	}, [step, submitOtp]);

	// --- Auto-login on mount ---
	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);
		if (token || hasAutoLoggedIn.current) return;
		hasAutoLoggedIn.current = true;

		const doAutoLogin = async () => {
			setLoading(true);
			setAutoLoginStatus("🕷️ Connecting to CyberVidya...");

			const enteredUser = HARDCODED_USERNAME;
			const enteredPass = HARDCODED_PASSWORD;

			// Step 1: Try direct login
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
				// Fall through to encrypted login
			}

			// Step 2: Encrypted login (triggers OTP flow)
			try {
				setAutoLoginStatus("🔐 Authenticating with CyberVidya...");
				loginStartTimeRef.current = Date.now();

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
				setAutoLoginStatus("📧 OTP sent! Fetching from Gmail...");
				setStep("otp");
			} catch (loginError) {
				handleAuthError(
					loginError,
					"Invalid username or password.",
					"Access forbidden. Check your credentials.",
					"Login failed. CyberVidya's service isn't responding. Try again.",
				);
				setLoading(false);
			}
		};

		doAutoLogin();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Manual OTP form submit
	const handleOtpSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await submitOtp(otpRef.current?.value || "");
	};

	if (showInstallPage) {
		return <InstallExtensionPage onBack={() => setShowInstallPage(false)} />;
	}

	return (
		<div className="flex flex-col mb-20 mt-20 items-center justify-center p-4">
			<div
				className="w-full max-w-md p-8 style-fade-in"
				style={{
					background: "rgba(6,10,26,0.9)",
					border: "1px solid rgba(204,0,0,0.5)",
					borderRadius: "16px",
					boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
					backdropFilter: "blur(16px)",
				}}
			>
				{/* Spider-Man Logo */}
				<div className="flex flex-col items-center mb-8">
					<div
						className="w-20 h-20 rounded-full flex items-center justify-center mb-3 relative"
						style={{
							background: "linear-gradient(135deg, #cc0000, #8b0000)",
							boxShadow: "0 8px 32px rgba(204,0,0,0.4)",
						}}
					>
						<span className="text-4xl">🕷️</span>
					</div>
					<h2
						className="text-2xl font-black text-center"
						style={{
							background: "linear-gradient(135deg, #cc0000, #e30b0b)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
							letterSpacing: "0.1em",
						}}
					>
						SPIDER ATTENDANCE
					</h2>
					<p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em" }}>
						KIET GROUP OF INSTITUTIONS
					</p>
				</div>

				{/* Gmail auth notice */}
				{!gmailAuthorized && (
					<a
						href="/api/auth/google"
						className="block mb-5 text-center text-sm font-semibold py-2.5 px-4 rounded-xl transition-all hover:opacity-90"
						style={{
							background: "linear-gradient(135deg, rgba(26,58,143,0.8), rgba(26,58,143,0.6))",
							border: "1px solid rgba(26,58,143,0.6)",
							color: "#93c5fd",
							textDecoration: "none",
						}}
					>
						🔗 Authorize Gmail Access for Auto-OTP
					</a>
				)}
				{gmailAuthorized && (
					<div
						className="mb-5 text-center text-sm py-2 px-4 rounded-xl"
						style={{
							background: "rgba(0,150,0,0.1)",
							border: "1px solid rgba(0,200,0,0.3)",
							color: "#6ee7b7",
						}}
					>
						✅ Gmail authorized — OTP will be fetched automatically
					</div>
				)}

				{/* API Mode Toggle */}
				<div className="mb-6 flex flex-col items-center gap-1.5">
					<div
						className="relative grid grid-cols-2 w-64 p-0.5 select-none"
						style={{
							background: "rgba(255,255,255,0.05)",
							border: "1px solid rgba(204,0,0,0.3)",
							borderRadius: "8px",
						}}
					>
						{(["proxy", "live"] as const).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => handleModeToggle(mode)}
								className="relative z-10 py-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center rounded-lg"
								style={{
									color: apiMode === mode ? "white" : "rgba(255,255,255,0.4)",
									background: apiMode === mode ? "rgba(204,0,0,0.8)" : "transparent",
								}}
								aria-pressed={apiMode === mode}
							>
								{mode === "proxy" ? "Proxy" : "Live ERP"}
							</button>
						))}
					</div>
					<p className="text-xs font-semibold uppercase tracking-wider text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
						{apiMode === "proxy" ? "No extension required" : "Extension required"}
					</p>
				</div>

				{/* Loading / Status display */}
				{loading && step === "credentials" && (
					<div className="text-center py-6">
						<div
							className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center web-spin"
							style={{
								border: "2px solid rgba(204,0,0,0.2)",
								borderTop: "2px solid #cc0000",
							}}
						/>
						<p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
							{autoLoginStatus}
						</p>
					</div>
				)}

				{/* OTP step (auto-handled) */}
				{step === "otp" && (
					<div className="space-y-5">
						{/* Auto-fetch status */}
						{otpStatus && (
							<div
								className="text-sm text-center py-3 px-4 rounded-xl"
								style={{
									background: "rgba(26,58,143,0.2)",
									border: "1px solid rgba(26,58,143,0.4)",
									color: "#93c5fd",
								}}
							>
								{otpStatus}
							</div>
						)}

						{/* Loading spinner for OTP step */}
						{loading && (
							<div className="flex items-center justify-center gap-3 py-2">
								<div
									className="w-6 h-6 rounded-full web-spin"
									style={{
										border: "2px solid rgba(204,0,0,0.2)",
										borderTop: "2px solid #cc0000",
									}}
								/>
								<span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
									Verifying OTP...
								</span>
							</div>
						)}

						{/* Manual OTP fallback form */}
						{!loading && (
							<form onSubmit={handleOtpSubmit} className="space-y-4">
								<p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
									Auto-fetch failed? Enter OTP manually:
								</p>
								<div>
									<label
										htmlFor="otp"
										className="block text-xs font-bold mb-1 uppercase tracking-wider"
										style={{ color: "rgba(255,255,255,0.5)" }}
									>
										One-Time Password
									</label>
									<input
										id="otp"
										type="text"
										inputMode="numeric"
										autoComplete="one-time-code"
										maxLength={6}
										ref={otpRef}
										placeholder="XXXXXX"
										className="block w-full rounded-xl px-4 py-3 text-lg tracking-widest font-bold text-center"
										style={{
											background: "rgba(255,255,255,0.07)",
											border: "1px solid rgba(204,0,0,0.4)",
											color: "#f0f0f0",
										}}
										required
									/>
								</div>
								<button
									type="submit"
									disabled={loading}
									className="w-full py-3 px-4 text-sm font-black rounded-xl transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-50"
									style={{
										background: "linear-gradient(135deg, #cc0000, #8b0000)",
										color: "white",
										border: "1px solid rgba(255,255,255,0.1)",
									}}
								>
									Verify OTP →
								</button>
								<button
									type="button"
									onClick={() => {
										setStep("credentials");
										setError("");
										setOtpStatus("");
										setIsExtensionError(false);
										hasAutoLoggedIn.current = false;
									}}
									className="w-full text-center text-sm bg-none border-none p-0 cursor-pointer underline"
									style={{ color: "rgba(255,255,255,0.3)" }}
								>
									← Back to login
								</button>
							</form>
						)}
					</div>
				)}

				{/* Error display */}
				{error && (
					<div
						className="relative text-sm p-3 rounded-xl mt-4"
						style={{
							background: "rgba(204,0,0,0.1)",
							border: "1px solid rgba(204,0,0,0.4)",
							color: "#fca5a5",
						}}
					>
						{isExtensionError && (
							<span
								className="absolute -top-3 -right-3 text-white text-xs font-black px-2.5 py-0.5 rounded-full border border-red-900"
								style={{ background: "#cc0000" }}
							>
								New
							</span>
						)}
						<p>{error}</p>
						{isExtensionError && (
							<button
								type="button"
								onClick={() => setShowInstallPage(true)}
								className="mt-2 font-bold underline cursor-pointer"
								style={{ color: "#fca5a5" }}
							>
								View extension installation guide →
							</button>
						)}
					</div>
				)}

				{/* TnC link (shown when not loading) */}
				{step === "credentials" && !loading && (
					<div className="mt-6">
						<p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
							By using this app, you agree to our{" "}
							<button
								type="button"
								onClick={() => setIsTnCVisible((prev) => !prev)}
								className="underline cursor-pointer"
								style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none" }}
							>
								Terms of Service
							</button>
						</p>
					</div>
				)}

				{/* Icons row */}
				<div className="flex justify-center gap-4 mt-6">
					<Shield size={16} style={{ color: "rgba(204,0,0,0.4)" }} />
					<Zap size={16} style={{ color: "rgba(26,58,143,0.6)" }} />
					<Shield size={16} style={{ color: "rgba(204,0,0,0.4)" }} />
				</div>
			</div>
		</div>
	);
}

export default LoginForm;
