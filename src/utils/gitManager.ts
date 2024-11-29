const simpleGit = require("simple-git");

export default class GitManager {
  public static async getRemoteUrls(folderPath: string): Promise<string[]> {
    try {
      const git = simpleGit(folderPath);
      const remotes = await git.getRemotes(true);
      if (remotes && remotes.length > 0) {
        return remotes.map((remote: any) => remote.refs.fetch);
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  }
}
