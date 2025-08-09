import React, { useEffect, useRef, useState } from 'react';
import './TerminalOutput.css';

interface TerminalOutputProps {
  output: string[];
}
const cleanAnsiSequences = (text: string[]) => {
  // Remove ANSI escape sequences for display
  return text.map((line) => {
    return line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
               .replace(/\x1b\[[0-9;]*m/g, '')
               .replace(/\[[0-9;]*m/g, '');
  });
};

const collapseTimingOutput = (output: string[]) => {
  const timingPattern = /\(\d+s\)/;
  
  return output
  .filter((line, index) => {
    // Check if current line matches the pattern (number)s
    if (!line.match(timingPattern)) {
      return true; // Not a timing line, keep it
    }
    
    // Find the first non-empty line after current index
    for (let i = index + 1; i < output.length; i++) {
      const nextLine = output[i];
      if (nextLine && nextLine.trim() !== '') {
        // Found first non-empty line, check if it has timing pattern
        if (nextLine.match(timingPattern)) {
          // Next non-empty line has timing pattern, filter out current line
          return false;
        }
        // Next non-empty line doesn't have timing pattern, keep current line
        break;
      }
    }
    
    // No next timing line found, keep this one
    return true;
  });
};
const TerminalOutput: React.FC<TerminalOutputProps> = ({ output }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [internalOutput, setInternalOutput] = useState<string[]>(output);


  useEffect(() => {
    const collapsedOutput = collapseTimingOutput(output);
    const cleanedOutput = cleanAnsiSequences(collapsedOutput);
    setInternalOutput(cleanedOutput);
  }, [output]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [internalOutput]);


  if (!output || output.length === 0) {
    return null;
  }

  return (
    <div className="terminal-output">
      <div className="terminal-header">
        <div className="terminal-title">
          <i className="fas fa-terminal"></i>
          &nbsp;Scan Output
        </div>
      </div>
      <div className="terminal-content" ref={terminalRef}>
        {internalOutput.map((line, index) => (
          <div key={index} className="terminal-line">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalOutput;
