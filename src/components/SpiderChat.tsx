import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { playSound } from "../utils/soundManager";

interface Message {
	role: "user" | "assistant";
	content: string;
}

const INITIAL_MESSAGE: Message = {
	role: "assistant",
	content:
		"Yo Arsal! I'm SpiderBot 🕷️\n\nDrop your questions — how many classes you can skip, which subject is putting you in the cooked zone, or anything KIET related! Fr fr no cap 🕸️",
};

export default function SpiderChat() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const { attendanceData } = useAppContext();

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 100);
			playSound("spiderman", 0.4);
		}
	}, [isOpen]);

	const sendMessage = async () => {
		const trimmed = input.trim();
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
					attendanceData,
				}),
			});

			if (!response.ok) throw new Error("API error");

			const data = await response.json();
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: data.message },
			]);
		} catch {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content:
						"Systumm hang ho gaya! 🕸️ My web-shooter misfired. Try again!",
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	return (
		<>
			{/* Floating trigger button */}
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					title="Chat with SpiderBot"
					className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl z-50 flex items-center justify-center text-2xl bg-red-500 text-white border-3 border-black shadow-[4px_4px_0_#000] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
				>
					🕷️
				</button>
			)}

			{/* Chat window */}
			{isOpen && (
				<div
					className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0_#000] spider-chat-pop"
					style={{
						width: "350px",
						maxWidth: "calc(100vw - 32px)",
						height: "480px",
					}}
				>
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 bg-red-500 text-white border-b-2 border-black rounded-t-xl">
						<div className="flex items-center gap-2">
							<span className="text-xl">🕷️</span>
							<div>
								<p className="font-black text-sm leading-none flex items-center gap-1">
									SpiderBot
									<Sparkles size={12} className="text-yellow-300" />
								</p>
								<p className="text-[10px] text-red-100 font-bold uppercase tracking-wider">
									Zero-Cap Attendance Advisor
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-white hover:text-black font-black p-1 cursor-pointer"
						>
							<X size={18} />
						</button>
					</div>

					{/* Messages */}
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
									<span className="text-xs font-bold text-gray-500 animate-pulse">
										Bro is cooking a reply... 🍳
									</span>
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div className="p-3 bg-white border-t-2 border-black rounded-b-xl">
						<div className="flex gap-2">
							<input
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask SpiderBot anything..."
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
						<p className="text-center text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-wider">
							Powered by Groq AI &bull; No cap 🗿
						</p>
					</div>
				</div>
			)}
		</>
	);
}
