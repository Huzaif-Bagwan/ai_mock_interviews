"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentProps {
  userName: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
  role?: string;
  level?: string;
  techstack?: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
  role,
  level,
  techstack,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");

  // Build the system prompt based on type
  const getSystemPrompt = () => {
    if (type === "generate") {
      return `You are a professional job interview assistant. Your task is to conduct a mock interview for the following position:
      
Role: ${role}
Experience Level: ${level}
Tech Stack: ${techstack}

Here are the interview questions to ask:
${questions?.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Instructions:
1. Start by greeting the candidate (${userName}) warmly and introducing yourself
2. Ask each question one at a time
3. Listen to their response and provide brief acknowledgment
4. After all questions, thank them and let them know the interview is complete
5. Keep the conversation professional but friendly
6. Do not provide feedback during the interview, just acknowledge their answers

Begin when the candidate is ready.`;
    }
    
    return `You are a helpful AI assistant conducting a conversation with ${userName}.`;
  };

  // ElevenLabs Conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs connected");
      setCallStatus(CallStatus.ACTIVE);
    },
    onDisconnect: () => {
      console.log("ElevenLabs disconnected");
      setCallStatus(CallStatus.FINISHED);
    },
    onMessage: (message) => {
      console.log("Message received:", message);
      
      // Handle different message types from ElevenLabs
      if (message.type === "transcript" && message.transcript) {
        // User transcript
        if (message.role === "user") {
          setMessages((prev) => [
            ...prev,
            { role: "user", content: message.transcript },
          ]);
        }
      }
      
      if (message.type === "agent_response") {
        // Agent response
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: message.text || "" },
        ]);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setCallStatus(CallStatus.INACTIVE);
    },
  });

  // Track speaking state
  useEffect(() => {
    setIsSpeaking(conversation.isSpeaking);
  }, [conversation.isSpeaking]);

  // Start the conversation
  const handleStart = async () => {
    try {
      setCallStatus(CallStatus.CONNECTING);

      // Get signed URL from your API
      const response = await fetch("/api/elevenlabs/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: getSystemPrompt(),
          firstMessage: type === "generate" 
            ? `Hello ${userName}! I'm your AI interviewer today. I'll be conducting a mock interview for the ${role} position. Are you ready to begin?`
            : `Hello ${userName}! How can I help you today?`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get signed URL");
      }

      const { signedUrl } = await response.json();

      // Start the conversation with the signed URL
      await conversation.startSession({
        signedUrl,
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  // End the conversation
  const handleEnd = async () => {
    try {
      await conversation.endSession();
      setCallStatus(CallStatus.FINISHED);

      // Save the interview transcript if this is an interview
      if (type === "generate" && interviewId && messages.length > 0) {
        await saveTranscript();
      }
    } catch (error) {
      console.error("Failed to end conversation:", error);
    }
  };

  // Save transcript to your backend
  const saveTranscript = async () => {
    try {
      const response = await fetch("/api/interviews/save-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          userId,
          messages,
          role,
          level,
          techstack,
        }),
      });

      if (response.ok) {
        // Navigate to feedback page
        router.push(`/interview/${interviewId}/feedback`);
      }
    } catch (error) {
      console.error("Failed to save transcript:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversation.status === "connected") {
        conversation.endSession();
      }
    };
  }, []);

  return (
    <>
      <div className="call-view">
        {/* AI Avatar */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="AI Interviewer"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Avatar */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="User"
              width={540}
              height={540}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {/* Transcript Display */}
      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {messages[messages.length - 1]?.content}
            </p>
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="w-full flex justify-center">
        {callStatus !== CallStatus.ACTIVE ? (
          <button
            className="relative btn-call"
            onClick={handleStart}
            disabled={callStatus === CallStatus.CONNECTING}
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus === CallStatus.CONNECTING && "hidden"
              )}
            />
            <span className="relative">
              {callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED
                ? "Start Interview"
                : "Connecting..."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleEnd}>
            End Interview
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;