"use client";

import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UseElevenLabsOptions {
  onTranscriptUpdate?: (messages: Message[]) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onError?: (error: Error) => void;
}

export type ConversationStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function useElevenLabs(options: UseElevenLabsOptions = {}) {
  const { onTranscriptUpdate, onStatusChange, onError } = options;

  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  const updateStatus = useCallback(
    (newStatus: ConversationStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const newMessage: Message = {
        role,
        content,
        timestamp: new Date(),
      };
      messagesRef.current = [...messagesRef.current, newMessage];
      setMessages(messagesRef.current);
      onTranscriptUpdate?.(messagesRef.current);
    },
    [onTranscriptUpdate]
  );

  const conversation = useConversation({
    onConnect: () => {
      console.log("[ElevenLabs] Connected");
      updateStatus("connected");
    },
    onDisconnect: () => {
      console.log("[ElevenLabs] Disconnected");
      updateStatus("disconnected");
    },
    onMessage: (message) => {
      console.log("[ElevenLabs] Message:", message);

      // Handle user transcript
      if (
        message.type === "user_transcript" ||
        (message.type === "transcript" && message.role === "user")
      ) {
        const transcript =
          message.user_transcript || message.transcript || message.text;
        if (transcript && transcript.trim()) {
          addMessage("user", transcript);
        }
      }

      // Handle agent response
      if (
        message.type === "agent_response" ||
        message.type === "audio" ||
        (message.type === "transcript" && message.role === "assistant")
      ) {
        const text =
          message.agent_response || message.text || message.transcript;
        if (text && text.trim()) {
          addMessage("assistant", text);
        }
      }
    },
    onError: (error) => {
      console.error("[ElevenLabs] Error:", error);
      updateStatus("error");
      onError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });

  // Update speaking/listening states
  const updateConversationState = useCallback(() => {
    setIsSpeaking(conversation.isSpeaking);
    // isListening is typically true when not speaking in a connected state
    setIsListening(status === "connected" && !conversation.isSpeaking);
  }, [conversation.isSpeaking, status]);

  const startConversation = useCallback(
    async (signedUrl: string) => {
      try {
        updateStatus("connecting");
        messagesRef.current = [];
        setMessages([]);

        await conversation.startSession({
          signedUrl,
        });
      } catch (error) {
        console.error("[ElevenLabs] Failed to start:", error);
        updateStatus("error");
        onError?.(
          error instanceof Error ? error : new Error("Failed to start session")
        );
        throw error;
      }
    },
    [conversation, updateStatus, onError]
  );

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      updateStatus("disconnected");
    } catch (error) {
      console.error("[ElevenLabs] Failed to end:", error);
      throw error;
    }
  }, [conversation, updateStatus]);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  return {
    // State
    status,
    messages,
    isSpeaking,
    isListening,

    // Connection status helpers
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isIdle: status === "idle",

    // Actions
    startConversation,
    endConversation,
    clearMessages,

    // Raw conversation object for advanced use
    conversation,
  };
}
