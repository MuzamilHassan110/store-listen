import { describe, expect, it } from "vitest";
import { detectSpeakerSegments, enhanceTranscript } from "./analysis.service.js";

describe("enhanceTranscript", () => {
  it("prefers the AI transcript when it is substantial", () => {
    const result = enhanceTranscript("Salesman: Hello there customer", "hello");
    expect(result).toBe("Salesman: Hello there customer");
  });

  it("falls back to live captions when AI text is too short", () => {
    const result = enhanceTranscript("ok", "Live captions of the full talk");
    expect(result).toBe("Live captions of the full talk");
  });
});

describe("detectSpeakerSegments", () => {
  it("parses salesman and customer labels", () => {
    const transcript = ["Salesman: Welcome in", "Customer: How much is this?", "Salesman: It is 20"].join("\n");
    const segments = detectSpeakerSegments(transcript, 30);

    expect(segments).toHaveLength(3);
    expect(segments[0]?.speaker).toBe("salesman");
    expect(segments[1]?.speaker).toBe("customer");
    expect(segments[2]?.speaker).toBe("salesman");
    expect(segments[0]?.start).toBe(0);
    expect(segments[2]?.end).toBe(30);
  });
});
