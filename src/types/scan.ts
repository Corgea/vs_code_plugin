export default interface Scan {
  id: string;
  project: string;
  repo: string;
  branch: string;
  processed: boolean;
}
