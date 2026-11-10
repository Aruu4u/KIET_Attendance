// Voice Assistant with "Hey Spidey" Wake Word & Speech-to-Text
import { isMuted } from "./soundManager";

type VoiceCallback = (query: string, rawText: string) => void;
type StatusCallback = (isListening: boolean, message: string) => void;

class SpideyVoiceAssistant {
	// biome-ignore lint/suspicious/noExplicitAny: Web Speech API
	private recognition: any = null;
	private isRunning: boolean = false;
	private queryListeners: Set<VoiceCallback> = new Set();
	private statusListeners: Set<StatusCallback> = new Set();
	private isAwake: boolean = false;
	// biome-ignore lint/suspicious/noExplicitAny: timeout
	private awakeTimeout: any = null;
	// biome-ignore lint/suspicious/noExplicitAny: restart timeout
	private restartTimer: any = null;

	constructor() {
		if (typeof window !== "undefined") {
			this.init();
		}
	}

	private init() {
		// biome-ignore lint/suspicious/noExplicitAny: Web Speech API
		const SpeechRec =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;

		if (!SpeechRec) {
			console.warn("SpeechRecognition not supported in this browser.");
			return;
		}

		try {
			const rec = new SpeechRec();
			rec.continuous = true;
			rec.interimResults = true;
			rec.lang = "en-IN"; // also picks up English & Hinglish well

			rec.onstart = () => {
				this.isRunning = true;
				this.notifyStatus(true, "Spidey is listening... 🎙️");
			};

			// biome-ignore lint/suspicious/noExplicitAny: Web Speech API event
			rec.onresult = (event: any) => {
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const res = event.results[i];
					const transcript = res[0]?.transcript?.trim().toLowerCase() || "";
					const isFinal = res.isFinal;

					// Wake words variations - flexible matching
					const wakeWords = [
						"hey spidey",
						"hey spider",
						"a spidey",
						"hey speedy",
						"spidey",
						"spider",
						"hi spidey",
						"ok spidey",
						"yo spidey",
						"hello spidey",
						"sun spidey",
						"arre spidey"
					];

					const matchedWake = wakeWords.find((w) => transcript.includes(w));

					if (matchedWake) {
						this.isAwake = true;
						clearTimeout(this.awakeTimeout);
						// Keep listening window open for query
						this.awakeTimeout = setTimeout(() => {
							this.isAwake = false;
						}, 12000);

						// Extract query portion after wake word
						const parts = transcript.split(matchedWake);
						const query = parts[parts.length - 1]?.trim();

						if (query && query.length > 2) {
							if (isFinal) {
								this.notifyQuery(query, transcript);
								this.isAwake = false;
							} else {
								this.notifyStatus(true, `Heard: "${query}"...`);
							}
						} else {
							this.notifyStatus(
								true,
								"Yo! Spidey's listening... ask anything! 🕸️",
							);
						}
					} else if (this.isAwake) {
						if (transcript.length > 2) {
							if (isFinal) {
								this.notifyQuery(transcript, transcript);
								this.isAwake = false;
							} else {
								this.notifyStatus(true, `Heard: "${transcript}"...`);
							}
						}
					}
				}
			};

			// biome-ignore lint/suspicious/noExplicitAny: Web Speech API error
			rec.onerror = (e: any) => {
				// Suppress harmless 'no-speech' or 'aborted' errors
				if (e.error === "no-speech" || e.error === "aborted") return;
				console.warn("Speech recognition error:", e.error);
				if (e.error === "not-allowed" || e.error === "service-not-allowed") {
					this.isRunning = false;
					this.notifyStatus(false, "Mic permission needed 🎙️");
				}
			};

			rec.onend = () => {
				// ALWAYS RESTART if supposed to be running (Always-on background listening)
				if (this.isRunning) {
					clearTimeout(this.restartTimer);
					this.restartTimer = setTimeout(() => {
						try {
							rec.start();
						} catch {
							// Ignored if already started
						}
					}, 300);
				}
			};

			this.recognition = rec;
		} catch (e) {
			console.warn("Speech recognition initialization failed:", e);
		}
	}

	public isSupported(): boolean {
		return !!this.recognition;
	}

	public start(): void {
		if (!this.recognition) return;
		this.isRunning = true;
		try {
			this.recognition.start();
		} catch {
			// Already started or busy
		}
	}

	public stop(): void {
		this.isRunning = false;
		this.isAwake = false;
		clearTimeout(this.restartTimer);
		if (this.recognition) {
			try {
				this.recognition.stop();
			} catch {}
		}
		this.notifyStatus(false, "Voice inactive");
	}

	public getIsRunning(): boolean {
		return this.isRunning;
	}

	public onQuery(cb: VoiceCallback): () => void {
		this.queryListeners.add(cb);
		return () => {
			this.queryListeners.delete(cb);
		};
	}

	public onStatus(cb: StatusCallback): () => void {
		this.statusListeners.add(cb);
		return () => {
			this.statusListeners.delete(cb);
		};
	}

	private notifyQuery(query: string, raw: string): void {
		this.queryListeners.forEach((cb) => {
			try {
				cb(query, raw);
			} catch (err) {
				console.error("Voice query listener error:", err);
			}
		});
	}

	private notifyStatus(isListening: boolean, msg: string): void {
		this.statusListeners.forEach((cb) => {
			try {
				cb(isListening, msg);
			} catch (err) {
				console.error("Voice status listener error:", err);
			}
		});
	}

	public speak(text: string): void {
		if (
			typeof window === "undefined" ||
			isMuted() ||
			!("speechSynthesis" in window)
		) {
			return;
		}
		try {
			window.speechSynthesis.cancel();
			// Strip markdown symbols and keep clean
			const clean = text.replace(/[*#_~`|]/g, "").slice(0, 220);
			const utterance = new SpeechSynthesisUtterance(clean);
			utterance.rate = 1.05;
			utterance.pitch = 1.05;
			window.speechSynthesis.speak(utterance);
		} catch {}
	}
}

export const spideyVoice = new SpideyVoiceAssistant();
