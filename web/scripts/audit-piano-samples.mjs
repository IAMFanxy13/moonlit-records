import { readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ffmpeg = process.argv[2] || "ffmpeg";
const sampleDirectory = resolve(process.argv[3] || "public/audio/salamander");
const checkpoints = [0, 0.5, 1, 2, 3, 4, 6, 8];
const sampleRate = 48_000;

function rmsAt(samples, seconds) {
  const start = Math.floor(seconds * sampleRate);
  if (start >= samples.length) return null;
  const end = Math.min(samples.length, start + Math.floor(sampleRate * 0.25));
  let energy = 0;
  for (let index = start; index < end; index += 1) energy += samples[index] ** 2;
  return Math.sqrt(energy / Math.max(1, end - start));
}

const files = readdirSync(sampleDirectory).filter((name) => name.endsWith(".mp3")).sort();
const output = files.map((name) => {
  const path = join(sampleDirectory, name);
  const decoded = spawnSync(ffmpeg, [
    "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", String(sampleRate), "pipe:1",
  ], { encoding: null, maxBuffer: 128 * 1024 * 1024 });
  if (decoded.error) throw new Error(`Could not start ${ffmpeg}: ${decoded.error.message}`);
  if (decoded.status !== 0) throw new Error(decoded.stderr?.toString() || `${ffmpeg} exited with ${decoded.status}`);
  const bytes = decoded.stdout;
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  let peak = 0;
  let energy = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
  }
  return {
    name: basename(name, ".mp3"),
    bytes: statSync(path).size,
    durationSeconds: samples.length / sampleRate,
    decodedSampleRate: sampleRate,
    peak,
    rms: Math.sqrt(energy / Math.max(1, samples.length)),
    rmsAt: Object.fromEntries(checkpoints.map((time) => [String(time), rmsAt(samples, time)])),
  };
});

console.log(JSON.stringify({ checkpoints, sampleDirectory, samples: output }, null, 2));
