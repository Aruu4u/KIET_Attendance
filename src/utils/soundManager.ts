// Sound and Meme Manager for GenZ Spidey Attendance
const MUTE_KEY = "spidey_meme_muted";

export function isMuted(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(MUTE_KEY) === "true";
}

// Track all active audio instances to ensure instant cutoff on mute
const activeAudioSet = new Set<HTMLAudioElement>();
let activeAudio: HTMLAudioElement | null = null;

export function stopAllAudio(): void {
	if (typeof window !== "undefined") {
		// Stop any audio tags in DOM as well
		try {
			document.querySelectorAll("audio").forEach((el) => {
				try {
					el.pause();
					el.currentTime = 0;
				} catch {}
			});
		} catch {}
	}
	activeAudioSet.forEach((audio) => {
		try {
			audio.pause();
			audio.currentTime = 0;
			audio.src = "";
		} catch {}
	});
	activeAudioSet.clear();
	if (activeAudio) {
		try {
			activeAudio.pause();
			activeAudio.currentTime = 0;
			activeAudio.src = "";
		} catch {}
		activeAudio = null;
	}
}

export function setMuted(muted: boolean): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
	if (muted) {
		stopAllAudio();
	}
	window.dispatchEvent(new Event("spidey_mute_toggled"));
}

export type SoundType =
	| "rickroll"
	| "waah_kya_scene"
	| "let_her_go"
	| "directed_by"
	| "death"
	| "metal_gear"
	| "oh_my_god"
	| "spiderman"
	| "web_swing"
	| "dexter"
	| "faaah"
	| "cat_laugh";

const SOUND_PATHS: Record<SoundType, string> = {
	rickroll: "/sounds/rick-roll_B9ZrDk1.mp3",
	waah_kya_scene: "/sounds/waah-kya-scene-hai.mp3",
	let_her_go: "/sounds/let-her-go.mp3",
	directed_by: "/sounds/directed by.mp3",
	death: "/sounds/death.mp3",
	metal_gear: "/sounds/metal-gear-alert-sound-effect_XKoHReZ.mp3",
	oh_my_god: "/sounds/oh-my-god-meme.mp3",
	spiderman: "/sounds/spiderman-meme-song.mp3",
	web_swing: "/sounds/spidey_swing.mp3",
	dexter: "/sounds/dexter.mp3",
	faaah: "/sounds/faaah.mp3",
	cat_laugh: "/sounds/cat-laugh-meme-1.mp3",
};

export function playSound(type: SoundType, volume: number = 0.6): void {
	if (typeof window === "undefined" || isMuted()) return;
	try {
		stopAllAudio();
		const path = SOUND_PATHS[type];
		if (!path) return;
		const audio = new Audio(path);
		audio.volume = Math.min(1, Math.max(0, volume));
		activeAudioSet.add(audio);
		activeAudio = audio;

		audio.onended = () => {
			activeAudioSet.delete(audio);
			if (activeAudio === audio) activeAudio = null;
		};
		audio.onpause = () => {
			activeAudioSet.delete(audio);
			if (activeAudio === audio) activeAudio = null;
		};

		audio.play().catch(() => {
			activeAudioSet.delete(audio);
			if (activeAudio === audio) activeAudio = null;
		});
	} catch (e) {
		console.warn("Audio play error:", e);
	}
}

export const SPIDEY_SLANGS = [
	"Aura +1000! We are so back fr fr 🕸️",
	"Chat, is bro cooked? 💀",
	"Lock in bro! Stand on business! 😤",
	"Bro is NOT him right now... or is he? 👀",
	"With great power comes 75% attendance criteria 🕷️",
	"Nah, this is a canon event. 🍿",
	"Mewing in the back bench rn 🗿",
	"Skill issue detected. Go attend class! 🏃",
	"Rare academic W unlocked! 🏆",
	"What the sigma?! 67% attendance?!",
	"Babu bhaiya, attendance ka chakkar hai! 😭",
	"Systumm hang ho gaya CyberVidya ka! ⚡",
	"Padhai likhai mein dhyan lagao, IAS-YAS bano! 📚",
	"Bro spawned late in class again. 🚪",
	"Let bro cook! Academic comeback loading... 🍳",
	"Too much aura to be marked absent. 🕶️",
];

export function getRandomSlang(): string {
	return SPIDEY_SLANGS[Math.floor(Math.random() * SPIDEY_SLANGS.length)];
}
