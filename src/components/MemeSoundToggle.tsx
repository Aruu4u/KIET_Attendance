import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { isMuted, setMuted } from "../utils/soundManager";

export default function MemeSoundToggle() {
	const [muted, setMutedState] = useState<boolean>(() => isMuted());

	useEffect(() => {
		const handleToggle = () => setMutedState(isMuted());
		window.addEventListener("spidey_mute_toggled", handleToggle);
		return () => window.removeEventListener("spidey_mute_toggled", handleToggle);
	}, []);

	const toggle = () => {
		const next = !muted;
		setMutedState(next);
		setMuted(next);
	};

	return (
		<button
			type="button"
			onClick={toggle}
			title={muted ? "Unmute Memes & Sounds" : "Mute Memes & Sounds"}
			className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md border-2 border-black active:translate-y-0.5"
			style={{
				background: muted ? "#f3f4f6" : "#fef08a",
				color: "#000",
			}}
		>
			{muted ? (
				<>
					<VolumeX size={15} className="text-red-500" />
					<span>Memes: OFF</span>
				</>
			) : (
				<>
					<Volume2 size={15} className="text-emerald-700 animate-pulse" />
					<span>Memes: ON 🔊</span>
				</>
			)}
		</button>
	);
}
