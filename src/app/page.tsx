"use client";

import { useState, useRef, useEffect } from "react";

// Define type for chat messages
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Main application component for the AI chat interface
export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState("No Language");

  // Ref for auto-scrolling the chat container
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // A predefined list of programming languages for the selector
  const languages = [
    "No Language",
    "Python",
    "JavaScript",
    "HTML",
    "CSS",
    "React",
    "Rust",
  ];

  // Effect to automatically scroll to the newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handles sending the user's message to the AI
  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    // Add user message to the chat history immediately
    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Construct the system prompt based on the selected language
    let systemPrompt = "You are a helpful assistant.";
    if (language !== "No Language") {
      systemPrompt = `You are a helpful assistant. When asked for code, always provide it in the ${language} language.`;
    }

    try {
      // Create a payload with the entire message history
      const payloadMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        userMessage,
      ];

      // Make the API call to Pollinations.ai
      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai",
          messages: payloadMessages,
          temperature: 0.7,
          stream: false,
          private: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponseContent = data.choices[0].message.content;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponseContent },
      ]);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't generate a response. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside className="w-64 p-4 border-r border-gray-800 hidden md:block">
        <h2 className="text-xl font-bold mb-4 text-blue-500">Chats</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <button
                onClick={() => setMessages([])} // Button to clear the chat history
                className="w-full text-left p-2 rounded-lg hover:bg-gray-900 transition-colors"
              >
                New Chat
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-800 flex justify-center items-center">
          <h1 className="text-xl font-bold">Pollinations AI</h1>
        </div>

        {/* Conversation History Display */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 p-8">
              <h3 className="text-2xl font-semibold mb-2">
                How can I help you today?
              </h3>
              <p>Type a prompt below to get started.</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`w-full max-w-3xl p-4 rounded-xl shadow-lg transition-colors duration-200 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-800 text-gray-100 rounded-bl-none"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input and Controls */}
        <div className="p-4 md:p-6 border-t border-gray-800 flex flex-col items-center gap-2">
          <div className="flex w-full max-w-3xl rounded-lg bg-gray-800 border border-gray-700">
            {/* Main text input area */}
            <textarea
              className="flex-1 p-3 bg-transparent text-gray-100 rounded-lg focus:outline-none resize-none"
              placeholder="Send a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              style={{ maxHeight: "200px" }}
            />
            {/* Buttons container */}
            <div className="flex items-end p-2 space-x-2">
              {/* Language Selection Dropdown */}
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="p-1 pr-6 bg-gray-700 text-gray-300 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              {/* Send button */}
              <button
                onClick={handleSendMessage}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 mx-auto"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
