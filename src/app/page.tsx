"use client";
import { useState, useRef, useEffect } from "react";
import { Copy, Check, Code, X, Play, FileText } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  codeBlocks?: CodeBlock[];
};

type CodeBlock = {
  id: string;
  language: string;
  code: string;
  title: string;
  messageIndex: number;
  blockIndex: number;
  isStreaming?: boolean;
};

type SidebarTab = "code" | "preview";

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [framework, setFramework] = useState("react");
  const [selectedCodeBlock, setSelectedCodeBlock] = useState<CodeBlock | null>(
    null
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("code");
  const [copiedSnippets, setCopiedSnippets] = useState<Set<string>>(new Set());
  const [streamingCodeBlock, setStreamingCodeBlock] =
    useState<CodeBlock | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const frameworkOptions = [
    { value: "html-css-tailwind", label: "HTML + CSS + TAILWIND" },
    { value: "html-css-bootstrap", label: "HTML + CSS + BOOTSTRAP" },
    { value: "react", label: "React" },
    { value: "vue", label: "Vue.js" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseStreamChunk = (line: string): string => {
    try {
      if (!line.trim() || line === "data: [DONE]") return "";

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

  const processStreamingContent = (
    fullContent: string,
    messageIndex: number,
    isStreaming: boolean = false
  ): {
    processedContent: string;
    codeBlocks: CodeBlock[];
    currentStreamingBlock: CodeBlock | null;
  } => {
    const lines = fullContent.split("\n");
    let processedContent = "";
    const codeBlocks: CodeBlock[] = [];
    let currentStreamingBlock: CodeBlock | null = null;

    let inCodeBlock = false;
    let currentLanguage = "";
    let currentCode = "";
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("```") && !inCodeBlock) {
        inCodeBlock = true;
        currentLanguage = line.slice(3).trim() || "text";
        currentCode = "";

        const newBlock: CodeBlock = {
          id: `msg-${messageIndex}-block-${blockIndex}`,
          language: currentLanguage,
          code: "",
          title: `${
            currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1)
          } Code`,
          messageIndex,
          blockIndex,
          isStreaming: true,
        };

        if (isStreaming) {
          currentStreamingBlock = newBlock;
          if (!isSidebarOpen) {
            setIsSidebarOpen(true);
            setActiveTab("code");
          }
        }

        processedContent += `__CODE_PLACEHOLDER_${newBlock.id}__`;
        blockIndex++;
        continue;
      }

      if (line.startsWith("```") && inCodeBlock) {
        inCodeBlock = false;

        const codeBlock: CodeBlock = {
          id: `msg-${messageIndex}-block-${blockIndex - 1}`,
          language: currentLanguage,
          code: currentCode.trim(),
          title: `${
            currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1)
          } Code`,
          messageIndex,
          blockIndex: blockIndex - 1,
          isStreaming: false,
        };

        codeBlocks.push(codeBlock);

        if (
          currentStreamingBlock &&
          currentStreamingBlock.id === codeBlock.id
        ) {
          currentStreamingBlock = { ...codeBlock, isStreaming: false };
        }

        continue;
      }

      if (inCodeBlock) {
        if (currentCode !== "") currentCode += "\n";
        currentCode += line;

        if (currentStreamingBlock) {
          currentStreamingBlock = {
            ...currentStreamingBlock,
            code: currentCode,
          };
        }
      } else {
        processedContent += line;
        if (i < lines.length - 1) processedContent += "\n";
      }
    }

    if (inCodeBlock && currentStreamingBlock) {
      currentStreamingBlock.code = currentCode;
    }

    return { processedContent, codeBlocks, currentStreamingBlock };
  };

  const copyToClipboard = async (snippetId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippets((prev) => new Set(prev).add(snippetId));
      setTimeout(() => {
        setCopiedSnippets((prev) => {
          const newSet = new Set(prev);
          newSet.delete(snippetId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  useEffect(() => {
    const codeToPreview = streamingCodeBlock || selectedCodeBlock;
    if (
      activeTab === "preview" &&
      codeToPreview &&
      iframeRef.current &&
      codeToPreview.code.trim()
    ) {
      const blob = new Blob([codeToPreview.code], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [streamingCodeBlock, selectedCodeBlock, activeTab]);

  const renderMessageContent = (message: ChatMessage) => {
    const content = message.content;
    const codeBlocks = message.codeBlocks || [];

    const parts = content.split(/(__CODE_PLACEHOLDER_[^_]+__)/);

    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.startsWith("__CODE_PLACEHOLDER_") && part.endsWith("__")) {
            const blockId = part
              .replace("__CODE_PLACEHOLDER_", "")
              .replace("__", "");
            const codeBlock = codeBlocks.find((block) => block.id === blockId);

            if (codeBlock) {
              return (
                <div key={index} className="my-4">
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-sm">
                    <Code size={16} className="text-blue-400" />
                    <span className="text-gray-300">
                      {codeBlock.language.toUpperCase()} code generated
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCodeBlock(codeBlock);
                        setIsSidebarOpen(true);
                        setActiveTab("code");
                      }}
                      className="ml-2 text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  const handleSendMessage = async () => {
    if (input.trim() === "" || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const textarea = document.querySelector("textarea");
    if (textarea) (textarea as HTMLTextAreaElement).style.height = "auto";

    setIsLoading(true);
    const messageIndex = messages.length + 1;

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      codeBlocks: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          language: framework,
        }),
      });

      if (!response.ok) throw new Error(`API call failed: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body reader available");

      let buffer = "";
      let fullContent = "";

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
            fullContent += deltaContent;

            const { processedContent, codeBlocks, currentStreamingBlock } =
              processStreamingContent(fullContent, messageIndex, true);

            if (currentStreamingBlock) {
              setStreamingCodeBlock(currentStreamingBlock);
              if (!selectedCodeBlock) {
                setSelectedCodeBlock(currentStreamingBlock);
              }
            }

            await new Promise((resolve) => setTimeout(resolve, 10));

            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage?.role === "assistant") {
                newMessages[newMessages.length - 1] = {
                  ...lastMessage,
                  content: processedContent,
                  codeBlocks: codeBlocks,
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
          fullContent += deltaContent;
          const { processedContent, codeBlocks, currentStreamingBlock } =
            processStreamingContent(fullContent, messageIndex, false);

          if (currentStreamingBlock) {
            setStreamingCodeBlock(null);
            setSelectedCodeBlock(currentStreamingBlock);
          }

          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.role === "assistant") {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: processedContent,
                codeBlocks: codeBlocks,
              };
            }
            return newMessages;
          });
        }
      }

      setStreamingCodeBlock(null);
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
      setStreamingCodeBlock(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentCodeBlock = () => {
    return streamingCodeBlock || selectedCodeBlock;
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-xl font-bold">AI Chat Interface</h1>
          <button
            onClick={() => {
              setMessages([]);
              setIsSidebarOpen(false);
              setSelectedCodeBlock(null);
              setStreamingCodeBlock(null);
            }}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 p-8">
                <h3 className="text-2xl font-semibold mb-2">
                  How can I help you today?
                </h3>
                <p>Choose a framework and start chatting.</p>
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
                  className={`max-w-[85%] p-4 rounded-xl shadow-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-800 text-gray-100 rounded-bl-none"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    renderMessageContent(msg)
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                  {msg.role === "assistant" &&
                    isLoading &&
                    i === messages.length - 1 && (
                      <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse" />
                    )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Framework/Technology:
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full p-3 bg-gray-800 text-gray-100 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {frameworkOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end bg-gray-800 border border-gray-700 rounded-lg p-3 gap-3">
              <textarea
                className="flex-1 p-3 bg-gray-900 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[50px] max-h-[200px] placeholder-gray-400"
                placeholder={`Ask me to create something with ${
                  frameworkOptions.find((f) => f.value === framework)?.label
                }...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 200) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5"
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
        </div>
      </main>

      {isSidebarOpen && getCurrentCodeBlock() && (
        <div className="fixed inset-y-0 right-0 w-full md:w-1/2 lg:w-2/5 bg-gray-900 border-l border-gray-800 flex flex-col z-50 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Code size={20} className="text-blue-400" />
              {getCurrentCodeBlock()?.title}
              {streamingCodeBlock && (
                <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded animate-pulse">
                  Streaming...
                </span>
              )}
            </h3>
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                setSelectedCodeBlock(null);
                setStreamingCodeBlock(null);
              }}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b border-gray-800 bg-gray-800">
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "code"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText size={16} />
              Code
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "preview"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Play size={16} />
              Preview
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "code" ? (
              <div className="h-full overflow-y-auto p-4 bg-gray-950">
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-700 border-b border-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                        {getCurrentCodeBlock()?.language.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-300">
                        {getCurrentCodeBlock()?.code.split("\n").length || 0}{" "}
                        lines
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const currentBlock = getCurrentCodeBlock();
                        if (currentBlock) {
                          copyToClipboard(currentBlock.id, currentBlock.code);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-all duration-200"
                    >
                      {getCurrentCodeBlock() &&
                      copiedSnippets.has(getCurrentCodeBlock()!.id) ? (
                        <>
                          <Check size={16} className="text-green-400" />
                          <span className="text-xs text-green-400">
                            Copied!
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-sm text-gray-100 overflow-x-auto bg-gray-900 max-h-full relative">
                    <code>{getCurrentCodeBlock()?.code || ""}</code>
                    {streamingCodeBlock && (
                      <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />
                    )}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full bg-white">
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  title="Code Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => {
            setIsSidebarOpen(false);
            setSelectedCodeBlock(null);
            setStreamingCodeBlock(null);
          }}
        />
      )}
    </div>
  );
}
