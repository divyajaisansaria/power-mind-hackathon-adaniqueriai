import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPythonCmd() {
  // Use the venv python
  return path.join(process.cwd(), "..", "backend", "venv", "bin", "python3");
}

async function ensureAudioDir() {
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });
  return audioDir;
}

async function listAudio() {
  const audioDir = await ensureAudioDir();
  const entries = await fs.readdir(audioDir).catch(() => []);
  const mp3s = entries.filter((f) => f.toLowerCase().endsWith(".mp3"));
  const items = await Promise.all(
    mp3s.map(async (f) => {
      const st = await fs.stat(path.join(audioDir, f)).catch(() => null);
      return {
        file: f,
        url: `/audio/${f}`,
        size: st?.size ?? null,
        createdAt: st?.ctime?.toISOString() ?? null,
      };
    })
  );
  // newest first
  items.sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1));
  return items;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("list")) {
    const items = await listAudio();
    return NextResponse.json({ items });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const text: string = (body?.text || "").trim();
    const hostVoice: string | undefined = body?.hostVoice;
    const guestVoice: string | undefined = body?.guestVoice;
    const title: string | undefined = body?.title;     // optional
    const topic: string | undefined = body?.topic;     // optional
    const maxTurns: number | undefined = body?.maxTurns;

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    await ensureAudioDir();

    const pythonCmd = getPythonCmd();
    const scriptPath = path.join(process.cwd(), "..", "python", "generate_podcast.py");

    const args = [scriptPath];
    if (hostVoice) args.push("--host-voice", hostVoice);
    if (guestVoice) args.push("--guest-voice", guestVoice);
    if (title) args.push("--title", title);
    if (topic) args.push("--topic", topic);
    if (typeof maxTurns === "number" && Number.isFinite(maxTurns)) {
      args.push("--max-turns", String(maxTurns));
    }

    // Spawn without any global state -> safe alongside Model-2 runs
    const child = spawn(pythonCmd, args, {
      cwd: process.cwd(),
      shell: process.platform === "win32", // match Model-1 convenience on Windows
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    // feed the text as stdin
    child.stdin.write(text);
    child.stdin.end();

    const code: number = await new Promise((resolve) => {
      child.on("close", (c) => resolve(c ?? 0));
    });

    if (stderr) {
      console.error("[/api/podcast stderr]\n" + stderr);
    }

    if (code !== 0) {
      return NextResponse.json(
        {
          error: "Python script failed",
          detail: (stderr || stdout || "no output").slice(0, 4000),
        },
        { status: 500 }
      );
    }

    // Python prints a single line like "/audio/<file>.mp3"
    const last = (stdout || "").trim().split(/\r?\n/).pop() || "";
    if (!last.startsWith("/audio/") || !last.endsWith(".mp3")) {
      return NextResponse.json(
        {
          error: "Unexpected python output",
          stdout: stdout.slice(0, 800),
          stderr: stderr.slice(0, 800),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ audioUrl: last, ok: true });
  } catch (err: any) {
    console.error("[/api/podcast exception]", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
