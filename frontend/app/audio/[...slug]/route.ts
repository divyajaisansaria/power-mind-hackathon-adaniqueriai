import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const parts = params?.slug ?? [];
  if (!parts.length) return new NextResponse("Bad request", { status: 400 });

  // Prevent path traversal
  const rel = parts.join("/");
  if (rel.includes("..")) return new NextResponse("Invalid path", { status: 400 });

  // Always read from /public/audio
  const filePath = path.join(process.cwd(), "public", "audio", rel);

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileSize = stat.size;
  const range = req.headers.get("range");
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Type": contentTypeFor(filePath),
  });

  // Range support (seeking)
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m?.[1] ? parseInt(m[1], 10) : 0;
    let end = m?.[2] ? parseInt(m[2], 10) : fileSize - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;
    if (start >= fileSize) {
      const h = new Headers({ "Content-Range": `bytes */${fileSize}` });
      return new NextResponse(null, { status: 416, headers: h });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = fs.createReadStream(filePath, { start, end });
    return new NextResponse(stream as any, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileSize));
  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as any, { status: 200, headers });
}
