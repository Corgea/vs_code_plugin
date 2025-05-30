import * as crypto from "crypto";

export default class CryptoManager {
  public static getGitSHA(fullCode: string): string {
    // Normalize line endings to \n before calculating length
    const normalizedCode = fullCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const fullCodeLen = normalizedCode.length;
    const gitBlobHeader = `blob ${fullCodeLen}\0`;
    const fullContent = gitBlobHeader + normalizedCode;
    const hash = crypto
      .createHash("sha1")
      .update(fullContent, "utf-8")
      .digest("hex");
    return hash;
  }
}
