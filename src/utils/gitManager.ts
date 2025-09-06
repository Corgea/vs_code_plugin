const simpleGit = require("simple-git");
const minimatch = require("minimatch");
import { FILE_EXCLUDE_PATTERNS } from "../config/constants";

export interface UncommittedFile {
  path: string;
  status: string; // 'modified', 'added', 'deleted', etc.
}

export default class GitManager {
  private static isFileExcluded(filePath: string, excludePatterns: string[] = FILE_EXCLUDE_PATTERNS): boolean {
    return excludePatterns.some(pattern => {
      try {
        // Normalize the file path to use forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');
        const result = minimatch(normalizedPath, pattern, { 
          matchBase: true, 
          dot: true,
          nocase: true // Case insensitive matching for Windows
        });
        if (result) {
          console.log(`File ${normalizedPath} matched pattern ${pattern}`);
        }
        return result;
      } catch (error) {
        console.warn(`Invalid glob pattern: ${pattern}`, error);
        return false;
      }
    });
  }

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

  public static async getUncommittedFiles(folderPath: string, includeIgnored: boolean = false): Promise<UncommittedFile[]> {
    try {
      const git = simpleGit(folderPath);
      const status = await git.status();
      
      const uncommittedFiles: UncommittedFile[] = [];
      
      // Helper function to add files if they're not excluded
      const addFileIfNotExcluded = (file: string, fileStatus: string) => {
        const isExcluded = this.isFileExcluded(file);
        console.log(`Processing file: ${file}, excluded: ${isExcluded}, includeIgnored: ${includeIgnored}`);
        
        if (includeIgnored || !isExcluded) {
          uncommittedFiles.push({ path: file, status: fileStatus });
        }
      };
      
      // Add modified files
      status.modified.forEach((file: string) => {
        addFileIfNotExcluded(file, 'modified');
      });
      
      // Add new files
      status.not_added.forEach((file: string) => {
        addFileIfNotExcluded(file, 'untracked');
      });
      
      // Add deleted files
      status.deleted.forEach((file: string) => {
        addFileIfNotExcluded(file, 'deleted');
      });
      
      // Add staged files
      status.staged.forEach((file: string) => {
        addFileIfNotExcluded(file, 'staged');
      });
      
      return uncommittedFiles;
    } catch (error) {
      console.error('Error getting uncommitted files:', error);
      return [];
    }
  }
}
