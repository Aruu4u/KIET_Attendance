// Sound and Meme Manager for GenZ Spidey Attendance
// Stores mute preference in localStorage

const MUTE_KEY = "spidey_meme_muted";

export function isMuted(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(MUTE_KEY) === "true";
}

export function setMuted(muted: boolean): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
	window.dispatchEvent(new Event("spidey_mute_toggled"));
}

let activeAudio: HTMLAudioElement | null = null;

export type SoundType =
	| "rickroll"
	| "waah_kya_scene"
	| "let_her_go"
	| "directed_by"
	| "death"
	| "metal_gear"
	| "oh_my_god"
	| "spiderman"
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
	dexter: "/sounds/dexter.mp3",
	faaah: "/sounds/faaah.mp3",
	cat_laugh: "/sounds/cat-laugh-meme-1.mp3",
};

// Play a sound cleanly (respects mute setting and stops previous overlapping sound)
export function playSound(type: SoundType, volume: number = 0.6): void {
	if (typeof window === "undefined" || isMuted()) return;
	try {
		if (activeAudio) {
			activeAudio.pause();
			activeAudio.currentTime = 0;
		}
		const audio = new Audio(SOUND_PATHS[type]);
		audio.volume = Math.min(1, Math.max(0, volume));
		audio.play().catch(() => {
			// Autoplay policy or user hasn't interacted yet
		});
		activeAudio = audio;
	} catch (e) {
		console.warn("Audio play prevented:", e);
	}
}

// Slangs and Dialogues
export const SPIDEY_SLANGS = [
	"Aura +1000! We are so back fr fr 🕸️",
	"Chat, is bro cooked? 💀",
	"Lock in bro! Stand on business! 😤",
	"Bro is NOT him right now... or is he? 👀",
	"With great power comes great attendance shortage 🕷️",
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
