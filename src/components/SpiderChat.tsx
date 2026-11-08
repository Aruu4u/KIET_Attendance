import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";

interface Message {
	role: "user" | "assistant";
	content: string;
}

const INITIAL_MESSAGE: Message = {
	role: "assistant",
	content:
		"Hey there! I'm SpiderBot 🕷️ — your friendly neighborhood attendance assistant!\n\nAsk me anything: how many classes you can miss, which subjects need attention, or just say hi! 🕸️",
};

export default function SpiderChat() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const { attendanceData } = useAppContext();

	// Scroll to bottom whenever messages update
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	// Focus input when chat opens
	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 100);
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
						"My web-shooter misfired! 🕸️ Check your connection and try again.",
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
					className="fixed bottom-6 right-6 w-14 h-14 rounded-full z-50 flex items-center justify-center text-2xl shadow-2xl transition-all hover:scale-110 active:scale-95"
					style={{
						background: "linear-gradient(135deg, #cc0000, #8b0000)",
						border: "2px solid rgba(255,255,255,0.3)",
						boxShadow:
							"0 8px 32px rgba(204,0,0,0.5), 0 0 0 0 rgba(204,0,0,0.4)",
					}}
				>
					🕷️
				</button>
			)}

			{/* Chat window */}
			{isOpen && (
				<div
					className="fixed bottom-6 right-6 z-50 flex flex-col spider-chat-pop"
					style={{
						width: "340px",
						height: "480px",
						background: "rgba(6, 10, 26, 0.97)",
						border: "1px solid rgba(204, 0, 0, 0.5)",
						borderRadius: "16px",
						boxShadow:
							"0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset",
						backdropFilter: "blur(16px)",
					}}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
						style={{
							background:
								"linear-gradient(135deg, rgba(204,0,0,0.9), rgba(139,0,0,0.95))",
							borderBottom: "1px solid rgba(255,255,255,0.1)",
						}}
					>
						<div className="flex items-center gap-2">
							<span className="text-xl">🕷️</span>
							<div>
								<p className="text-white font-bold text-sm leading-none">
									SpiderBot
								</p>
								<p className="text-red-200 text-xs">Your Attendance Assistant</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-red-200 hover:text-white transition-colors p-1 rounded"
						>
							<X size={16} />
						</button>
					</div>

					{/* Messages */}
					<div className="flex-1 overflow-y-auto p-3 space-y-3 custom-table-scroll">
						{messages.map((msg, i) => (
							<div
								key={i}
								className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
							>
								{msg.role === "assistant" && (
									<span className="text-sm mr-1 mt-1 flex-shrink-0">🕷️</span>
								)}
								<div
									className="max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
									style={{
										background:
											msg.role === "user"
												? "linear-gradient(135deg, #1a3a8f, #0a1a4f)"
												: "rgba(255,255,255,0.08)",
										border:
											msg.role === "user"
												? "1px solid rgba(26,58,143,0.6)"
												: "1px solid rgba(255,255,255,0.1)",
										color: "#f0f0f0",
									}}
								>
									{msg.content}
								</div>
							</div>
						))}

						{isLoading && (
							<div className="flex justify-start items-center gap-1">
								<span className="text-sm">🕷️</span>
								<div
									className="rounded-2xl px-4 py-3"
									style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
								>
									<div className="flex gap-1">
										{[0, 1, 2].map((i) => (
											<div
												key={i}
												className="w-2 h-2 rounded-full"
												style={{
													background: "#cc0000",
													animation: `spider-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
												}}
											/>
										))}
									</div>
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div
						className="p-3 rounded-b-2xl"
						style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
					>
						<div className="flex gap-2">
							<input
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask SpiderBot anything..."
								disabled={isLoading}
								className="flex-1 text-sm rounded-xl px-3 py-2 outline-none disabled:opacity-50"
								style={{
									background: "rgba(255,255,255,0.07)",
									border: "1px solid rgba(204,0,0,0.3)",
									color: "#f0f0f0",
								}}
							/>
							<button
								type="button"
								onClick={sendMessage}
								disabled={isLoading || !input.trim()}
								className="rounded-xl px-3 py-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
								style={{
									background: "linear-gradient(135deg, #cc0000, #8b0000)",
									border: "1px solid rgba(255,255,255,0.1)",
									color: "white",
								}}
							>
								<Send size={15} />
							</button>
						</div>
						<p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
							Powered by Groq AI 🕸️
						</p>
					</div>
				</div>
			)}
		</>
	);
}
