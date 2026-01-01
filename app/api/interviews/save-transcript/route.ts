import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interviewId, userId, messages, role, level, techstack } = body;

    if (!interviewId || !userId || !messages) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Format the transcript
    const transcript = (messages as Message[])
      .map((msg) => `${msg.role === "user" ? "Candidate" : "Interviewer"}: ${msg.content}`)
      .join("\n\n");

    // Save to Firebase
    const interviewRef = db.collection("interviews").doc(interviewId);
    
    await interviewRef.update({
      transcript,
      messages,
      finishedAt: new Date().toISOString(),
      status: "completed",
    });

    // Generate feedback using Google Gemini (or your preferred AI)
    const feedbackPrompt = `
You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis.

Interview Details:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack: ${techstack}

Interview Transcript:
${transcript}

Please provide detailed feedback in the following JSON format:
{
  "totalScore": <number 0-100>,
  "categoryScores": [
    {
      "name": "Communication Skills",
      "score": <number 0-100>,
      "comment": "<detailed feedback>"
    },
    {
      "name": "Technical Knowledge",
      "score": <number 0-100>,
      "comment": "<detailed feedback>"
    },
    {
      "name": "Problem Solving",
      "score": <number 0-100>,
      "comment": "<detailed feedback>"
    },
    {
      "name": "Cultural Fit",
      "score": <number 0-100>,
      "comment": "<detailed feedback>"
    },
    {
      "name": "Confidence & Clarity",
      "score": <number 0-100>,
      "comment": "<detailed feedback>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areasForImprovement": ["<area 1>", "<area 2>", "<area 3>"],
  "overallFeedback": "<comprehensive paragraph summarizing the interview performance>"
}
`;

    // Call Google Gemini or your AI service for feedback
    const feedbackResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: feedbackPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (feedbackResponse.ok) {
      const feedbackData = await feedbackResponse.json();
      const feedbackText = feedbackData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (feedbackText) {
        // Parse the JSON feedback
        const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const feedback = JSON.parse(jsonMatch[0]);
          
          // Save feedback to Firebase
          const feedbackRef = db.collection("feedback").doc();
          await feedbackRef.set({
            interviewId,
            userId,
            ...feedback,
            createdAt: new Date().toISOString(),
          });

          // Update interview with feedback reference
          await interviewRef.update({
            feedbackId: feedbackRef.id,
          });

          return NextResponse.json({
            success: true,
            feedbackId: feedbackRef.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Transcript saved, feedback generation pending",
    });
  } catch (error) {
    console.error("Error saving transcript:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
