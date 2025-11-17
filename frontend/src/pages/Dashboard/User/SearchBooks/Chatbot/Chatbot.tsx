import React, { useState, useEffect, useRef } from "react";
import styles from "./Chatbot.module.css";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

const initialMessages: Message[] = [
  { id: "welcome", text: "Welcome to **LibraX Chatbot**!", sender: "bot" },
  { id: "help", text: "Ask about *book titles*, **authors**, or release dates.", sender: "bot" }
];

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("AI is thinking...");
  const [open, setOpen] = useState(true);

  const msgEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const typingMessages = [
    "AI is thinking...",
    "Analyzing your query...",
    "Fetching data from the library...",
    "Checking available books..."
  ];

  const scrollToBottom = () => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Scroll to bottom when modal opens/closes
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [open]);

  // auto expand textarea
  useEffect(() => {
    if (!textAreaRef.current) return;
    const el = textAreaRef.current;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, [input]);

  const startTypingAnimation = () => {
    let index = 0;
    typingIntervalRef.current = setInterval(() => {
      setTypingText(typingMessages[index]);
      index = (index + 1) % typingMessages.length;
    }, 1200);
  };

  const stopTypingAnimation = () => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = null;
    setTypingText("AI is thinking...");
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now() + "user",
      text: input.trim(),
      sender: "user"
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    startTypingAnimation();

    try {
      const formattedMessages = [...messages, userMsg].map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const response = await fetch("https://librax-chatbot.puter.work/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: formattedMessages })
      });

      const data = await response.json();
      const botReply = data.reply || "No response from AI.";

      setMessages(prev => [
        ...prev,
        { id: Date.now() + "bot", text: botReply, sender: "bot" }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: Date.now() + "err", text: "Error: " + (err.message || "Failed to get AI response"), sender: "bot" }
      ]);
    } finally {
      setIsTyping(false);
      stopTypingAnimation();
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <b>LibraX Chatbot</b>
        <span className={styles.arrow}>{open ? "▼" : "▲"}</span>
      </div>

      {open && (
        <div className={styles.chatBody}>
          <div className={styles.messagesArea}>
            {messages.map(msg => (
              msg.sender === "user" ? (
                <div key={msg.id} className={styles.userBubble}>
                  {msg.text}
                </div>
              ) : (
                <div key={msg.id} className={styles.botBubble}>
                  <div className={`${styles.botBubbleContent} ${styles.markdown}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            ))}

            {isTyping && (
              <div className={styles.botBubble}>
                <span className={styles.typing}>{typingText}</span>
              </div>
            )}

            <div ref={msgEndRef} />
          </div>

          <div className={styles.inputArea}>
            <textarea
              ref={textAreaRef}
              rows={1}
              className={styles.inputBox}
              placeholder="Ask about book titles, authors, or release dates..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              <Send size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;