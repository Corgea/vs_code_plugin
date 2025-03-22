import * as crypto from "crypto";

export default class CryptoManager {

    public static getGitSHA(fullCode: string): string {
        const fullCodeLen = fullCode.length;
        const gitBlobHeader = `blob ${fullCodeLen}\0`;
        const fullContent = gitBlobHeader + fullCode;
        const hash = crypto.createHash("sha1").update(fullContent, "utf-8").digest("hex");
        return hash;
    }

}