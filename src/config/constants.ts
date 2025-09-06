// File exclusion patterns for security scanning
// These patterns match files that should be ignored during security analysis
export const FILE_EXCLUDE_PATTERNS = [
  "**/tests/**",
  "**/.corgea/**",
  "**/test/**",
  "**/spec/**",
  "**/specs/**",
  "**/node_modules/**",
  "**/tmp/**",
  "**/migrations/**",
  "**/python*/site-packages/**",
  "**/*.mmdb",
  "**/*.css",
  "**/*.less",
  "**/*.scss",
  "**/*.map",
  "**/*.env",
  "**/*.sh",
  "**/.vs/**",
  "**/.vscode/**",
  "**/.idea/**",
];

// Application constants
export const APP_NAME = "Corgea";
export const TERMINAL_NAME = "Corgea";

// UI Constants
export const MODAL_ANIMATION_DURATION = 300;
export const BUTTON_HOVER_TRANSITION = "0.2s";

// File status types
export const FILE_STATUS = {
  MODIFIED: 'modified',
  UNTRACKED: 'untracked',
  DELETED: 'deleted',
  STAGED: 'staged'
} as const;

// Scan stages
export const SCAN_STAGES = {
  INIT: 'init',
  PACKAGE: 'package',
  UPLOAD: 'upload',
  SCAN: 'scan',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;
