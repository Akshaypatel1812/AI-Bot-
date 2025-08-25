"use client";
import { useState, useRef, useEffect } from "react";
import { Copy, Check, Code, X } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CodeSnippet = {
  id: string;
  language: string;
  code: string;
  title?: string;
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [framework, setFramework] = useState("html-css-tailwind");
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);
  const [isCodeSidebarOpen, setIsCodeSidebarOpen] = useState(false);
  const [copiedSnippets, setCopiedSnippets] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const frameworkOptions = [
    { value: "html-css-tailwind", label: "HTML + CSS + Tailwind" },
    { value: "html-css-bootstrap", label: "HTML + CSS + Bootstrap" },
    { value: "react", label: "React" },
    { value: "react-tailwind", label: "React + Tailwind" },
    { value: "vue", label: "Vue.js" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
    { value: "javascript", label: "Vanilla JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "node", label: "Node.js" },
    { value: "php", label: "PHP" },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract code blocks from message content
  const extractCodeSnippets = (content: string, messageIndex: number) => {
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const snippets: CodeSnippet[] = [];
    let match;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      if (code) {
        snippets.push({
          id: `msg-${messageIndex}-block-${blockIndex}`,
          language,
          code,
          title: `${language.charAt(0).toUpperCase() + language.slice(1)} Code Block ${blockIndex + 1}`
        });
        blockIndex++;
      }
    }

    return snippets;
  };

  // Update code snippets whenever messages change
  useEffect(() => {
    const allSnippets: CodeSnippet[] = [];
    messages.forEach((msg, index) => {
      if (msg.role === 'assistant') {
        const snippets = extractCodeSnippets(msg.content, index);
        allSnippets.push(...snippets);
      }
    });
    setCodeSnippets(allSnippets);
  }, [messages]);

  const copyToClipboard = async (snippetId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippets(prev => new Set(prev).add(snippetId));
      setTimeout(() => {
        setCopiedSnippets(prev => {
          const newSet = new Set(prev);
          newSet.delete(snippetId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const parseStreamChunk = (line: string): string => {
    try {
      if (!line.trim()) return "";
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return "";
        const parsed = JSON.parse(jsonStr);
        return parsed.choices?.[0]?.delta?.content || "";
      }
      const parsed = JSON.parse(line);
      return parsed.choices?.[0]?.delta?.content || "";
    } catch {
      return "";
    }
  };

  const renderMessageContent = (content: string) => {
    // Split content by code blocks and render them inline like ChatGPT/Claude
    const parts = content.split(/(```[\w]*\n?[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      const codeMatch = part.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        const language = codeMatch[1] || 'plaintext';
        const code = codeMatch[2].trim();
        
        return (
          <div key={index} className="my-4 bg-[#0d1117] rounded-lg border border-gray-700 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-[#161b22] border-b border-gray-700">
              <span className="text-sm text-gray-300 font-mono">{language}</span>
              <button
                onClick={() => copyToClipboard(`inline-${index}`, code)}
                className="text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-gray-700"
                title="Copy code"
              >
                {copiedSnippets.has(`inline-${index}`) ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-100 overflow-x-auto font-mono leading-relaxed">
              <code className={`language-${language}`}>{code}</code>
            </pre>
          </div>
        );
      }
      
      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </span>
      );
    });
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const textarea = document.querySelector("textarea");
    if (textarea) (textarea as HTMLTextAreaElement).style.height = "auto";

    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          framework,
        }),
      });

      if (!response.ok) throw new Error(`API call failed: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body reader available");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const deltaContent = parseStreamChunk(line);
          if (deltaContent) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            setMessages((prev) => {
              const newMessages = [...prev];
              const last = newMessages[newMessages.length - 1];
              if (last?.role === "assistant") {
                newMessages[newMessages.length - 1] = {
                  ...last,
                  content: last.content + deltaContent,
                };
              }
              return newMessages;
            });
          }
        }
      }

      if (buffer.trim()) {
        const deltaContent = parseStreamChunk(buffer);
        if (deltaContent) {
          setMessages((prev) => {
            const newMessages = [...prev];
            const last = newMessages[newMessages.length - 1];
            if (last?.role === "assistant") {
              newMessages[newMessages.length - 1] = {
                ...last,
                content: last.content + deltaContent,
              };
            }
            return newMessages;
          });
        }
      }
    } catch (err) {
      console.error("Error fetching AI response:", err);
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages.at(-1)?.role === "assistant") {
          newMessages[newMessages.length - 1].content =
            "Sorry, I couldn't generate a response. Please try again.";
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Main Chat Sidebar */}
      <aside className="w-64 p-4 border-r border-gray-800 hidden lg:block">
        <h2 className="text-xl font-bold mb-4 text-blue-500">Chats</h2>
        <button
          onClick={() => setMessages([])}
          className="w-full text-left p-2 rounded-lg hover:bg-gray-900 transition-colors"
        >
          New Chat
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Pollinations AI
          </h1>
          {codeSnippets.length > 0 && (
            <button
              onClick={() => setIsCodeSidebarOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 text-white font-medium shadow-lg hover:shadow-blue-500/25"
            >
              <Code size={18} />
              <span className="hidden sm:inline">Code Snippets</span>
              <div className="bg-blue-400 px-2 py-0.5 rounded-full text-xs font-bold min-w-[20px] h-5 flex items-center justify-center">
                {codeSnippets.length}
              </div>
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-gray-950 to-gray-900">
          <div className="w-full max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 p-12">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <Code size={32} className="text-white" />
                </div>
                <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Ready to Code?
                </h3>
                <p className="text-lg text-gray-400 mb-6">Choose a framework and describe what you want to build.</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">React Components</span>
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">HTML Templates</span>
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">Python Scripts</span>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] p-5 rounded-2xl shadow-lg transition-colors duration-200 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700"
                  }`}
                >
                  <div className="prose prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-code:text-gray-100">
                    {msg.role === "assistant" ? renderMessageContent(msg.content) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.role === "assistant" &&
                      isLoading &&
                      i === messages.length - 1 && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Enhanced Input Section */}
        <div className="p-4 md:p-6 border-t border-gray-800 w-full max-w-4xl mx-auto">
          {/* Framework Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Framework/Technology:
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full p-3 bg-gray-800 text-gray-100 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {frameworkOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Input Area */}
          <div className="flex items-end bg-gray-800 border border-gray-700 rounded-lg p-3 gap-3 shadow-lg">
            <textarea
              className="flex-1 p-3 bg-gray-900 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto min-h-[50px] placeholder-gray-400"
              placeholder={`Ask me to create something with ${frameworkOptions.find(f => f.value === framework)?.label}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              style={{ maxHeight: "200px" }}
            />

            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {isLoading ? (
                <svg
                  className="animate-spin h-5 w-5"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Code Snippets Sidebar */}
      {isCodeSidebarOpen && (
        <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-700 flex flex-col z-50 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Code size={20} className="text-blue-400" />
              Code Repository
            </h3>
            <button
              onClick={() => setIsCodeSidebarOpen(false)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-950">
            {codeSnippets.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <Code size={32} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-lg font-medium mb-2">No code yet</p>
                <p className="text-gray-600 text-sm">Code snippets will appear here as you chat!</p>
              </div>
            ) : (
              codeSnippets.map((snippet, index) => (
                <div key={snippet.id} className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden hover:border-blue-500/50 transition-colors group">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white">
                          {snippet.language.charAt(0).toUpperCase() + snippet.language.slice(1)}
                        </h4>
                        <p className="text-xs text-gray-400">{snippet.code.split('\n').length} lines</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(snippet.id, snippet.code)}
                      className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-600 transition-all duration-200 flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
                      title="Copy to clipboard"
                    >
                      {copiedSnippets.has(snippet.id) ? (
                        <>
                          <Check size={14} className="text-green-400" />
                          <span className="text-xs text-green-400">✓</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="p-3 text-xs text-gray-100 overflow-x-auto bg-[#0d1117] max-h-48 font-mono">
                      <code>{snippet.code}</code>
                    </pre>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-gray-800/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-400 font-mono">
                        {snippet.language}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {codeSnippets.length > 0 && (
            <div className="p-4 border-t border-gray-700 bg-gray-800">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allCode = codeSnippets.map((s, i) => `// Snippet ${i + 1}: ${s.language}\n${s.code}`).join('\n\n// ' + '='.repeat(50) + '\n\n');
                    copyToClipboard('all-snippets', allCode);
                  }}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Copy size={14} />
                  Copy All
                </button>
                <button
                  onClick={() => setCodeSnippets([])}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop for mobile */}
      {isCodeSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCodeSidebarOpen(false)}
        />
      )}
    </div>
  );
}