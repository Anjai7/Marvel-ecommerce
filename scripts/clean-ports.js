import { execFileSync } from "node:child_process";

const ports = [5000, 5173];

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function windowsPidsOnPort(port) {
  if (process.platform !== "win32") return [];

  const rows = run("netstat", ["-ano", "-p", "tcp"])
    .split(/\r?\n/)
    .filter((row) => row.includes(`:${port}`) && /LISTENING/i.test(row));

  return [...new Set(rows.map((row) => Number(row.trim().split(/\s+/).at(-1))).filter(Boolean))];
}

function unixPidsOnPort(port) {
  if (process.platform === "win32") return [];

  try {
    return run("lsof", ["-ti", `tcp:${port}`])
      .split(/\r?\n/)
      .map(Number)
      .filter(Boolean);
  } catch {
    return [];
  }
}

for (const port of ports) {
  const pids = process.platform === "win32" ? windowsPidsOnPort(port) : unixPidsOnPort(port);

  if (pids.length === 0) {
    console.log(`Port ${port} is already free.`);
    continue;
  }

  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        run("taskkill", ["/PID", String(pid), "/F"]);
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`Stopped process ${pid} on port ${port}.`);
    } catch (error) {
      console.warn(`Could not stop process ${pid} on port ${port}: ${error.message}`);
    }
  }
}
