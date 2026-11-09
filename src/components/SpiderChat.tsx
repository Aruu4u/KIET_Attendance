import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { playSound } from "../utils/soundManager";
import { spideyVoice } from "../utils/voiceAssistant";

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface SpiderChatProps {
	isOpen: boolean;
	onClose: () => void;
	attendanceData?: unknown;
}

export default function SpiderChat({
	isOpen,
	onClose,
	attendanceData: propAttendanceData,
}: SpiderChatProps) {
	const { attendanceData: contextAttendanceData } = useAppContext();
	const activeAttendanceData = propAttendanceData || contextAttendanceData;
	const [messages, setMessages] = useState<Message[]>([
		{
			role: "assistant",
			content:
				"Yo Arsal! I'm SpiderBot 🕷️\n\nAsk me anything: how many classes you can skip, which subject is in the danger zone, or your exact attendance stats! Fr fr no cap 🕸️\n\nTip: You can also say 'Hey Spidey' anytime to ask! 🎙️",
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Voice Assistant integration for SpiderChat (no button needed, responds to Hey Spidey)
	useEffect(() => {
		if (!isOpen) return;

		const unsubscribeQuery = (query: string) => {
			if (!query.trim()) return;
			sendDirectMessage(query);
		};

		const unsub = spideyVoice.onQuery(unsubscribeQuery);

		return () => {
			unsub();
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, activeAttendanceData]);

	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			setTimeout(() => inputRef.current?.focus(), 150);
			playSound("spiderman", 0.35);
		}
	}, [isOpen, messages, isLoading]);

	const sendDirectMessage = async (textToSend: string) => {
		const trimmed = textToSend.trim();
		if (!trimmed || isLoading) return;

		const userMessage: Message = { role: "user", content: trimmed };
		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [...messages, userMessage],
					attendanceData: activeAttendanceData,
				}),
			});

			if (!response.ok) throw new Error("API error");

			const data = await response.json();
			const reply = data.message || "Canon event in progress... ask me again!";
			setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
			spideyVoice.speak(reply);
		} catch {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "Systumm hang ho gaya! 🕸️ Groq API had a hiccup. Try again in a moment!",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const sendMessage = () => sendDirectMessage(input);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0_#000] spider-chat-pop"
			style={{ width: "360px", maxWidth: "calc(100vw - 32px)", height: "500px" }}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-red-600 text-white border-b-3 border-black rounded-t-xl select-none">
				<div className="flex items-center gap-2">
					<span className="text-xl">🕷️</span>
					<div>
						<p className="font-black text-sm leading-none flex items-center gap-1 uppercase tracking-wider">
							SpiderBot AI
							<Sparkles size={13} className="text-yellow-300" />
						</p>
						<p className="text-[10px] text-red-100 font-bold uppercase tracking-wider mt-0.5">
							Live Attendance Advisor &bull; Groq
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-white hover:text-black font-black p-1 cursor-pointer transition-colors"
				>
					<X size={18} />
				</button>
			</div>

			{/* Messages List */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 custom-table-scroll">
				{messages.map((msg, i) => (
					<div
						key={i}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						{msg.role === "assistant" && (
							<span className="text-sm mr-1 mt-1 flex-shrink-0">🕷️</span>
						)}
						<div
							className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-semibold leading-relaxed whitespace-pre-wrap border-2 border-black ${
								msg.role === "user"
									? "bg-blue-600 text-white shadow-[2px_2px_0_#000]"
									: "bg-white text-black shadow-[2px_2px_0_#000]"
							}`}
						>
							{msg.content}
						</div>
					</div>
				))}

				{isLoading && (
					<div className="flex justify-start items-center gap-1">
						<span className="text-sm">🕷️</span>
						<div className="bg-white border-2 border-black rounded-2xl px-3 py-2 shadow-[2px_2px_0_#000]">
							<span className="text-xs font-bold text-gray-700 animate-pulse">
								Analyzing your attendance lore... 🍳
							</span>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input Bar */}
			<div className="p-3 bg-white border-t-3 border-black rounded-b-xl">
				<div className="flex gap-2">
					<input
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask or say 'Hey Spidey'..."
						disabled={isLoading}
						className="flex-1 text-xs font-bold bg-gray-50 border-2 border-black rounded-xl px-3 py-2 outline-none focus:bg-white shadow-[2px_2px_0_#000]"
					/>
					<button
						type="button"
						onClick={sendMessage}
						disabled={isLoading || !input.trim()}
						className="bg-black text-white px-3 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0_#000] hover:bg-gray-800 active:translate-y-0.5 cursor-pointer disabled:opacity-40"
					>
						<Send size={14} />
					</button>
				</div>
				<p className="text-center text-[9px] text-gray-500 font-bold mt-1.5 uppercase tracking-wider">
					Uses Live CyberVidya Attendance &bull; Zero Cap 🗿
				</p>
			</div>
		</div>
	);
}
