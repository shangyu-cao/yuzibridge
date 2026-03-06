import fs from "node:fs";
import path from "node:path";

const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
};

export const resolveUploadsDirectory = () => {
  const projectUploads = path.resolve(process.cwd(), "server", "uploads");
  if (ensureDir(projectUploads)) {
    return projectUploads;
  }

  const tmpUploads = path.resolve("/tmp", "yuzibridge-uploads");
  if (ensureDir(tmpUploads)) {
    return tmpUploads;
  }

  return projectUploads;
};
