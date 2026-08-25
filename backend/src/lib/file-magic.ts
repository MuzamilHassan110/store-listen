const SIGNATURES: Array<{ name: string; test: (buffer: Buffer) => boolean }> = [
  { name: "webm", test: (buffer) => buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3 },
  { name: "wav", test: (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE" },
  { name: "ogg", test: (buffer) => buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS" },
  { name: "mp3", test: (buffer) => buffer.length >= 3 && (buffer.subarray(0, 3).toString("ascii") === "ID3" || buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) },
  { name: "mp4", test: (buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp" },
];

export function isAllowedAudioBuffer(buffer: Buffer): boolean {
  if (!buffer.length) return false;
  return SIGNATURES.some((item) => item.test(buffer));
}
