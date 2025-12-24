/**
 * Terminal Return Button
 * A terminal-themed floating button for navigating back to the main portfolio
 */
export function TerminalReturnButton() {
  return (
    <>
      <style>{terminalReturnStyles}</style>
      <a
        href="https://portfolio.basedsecurity.net"
        className="terminal-return-button"
        title="Return to Terminal Portfolio"
      >
        <span className="terminal-prefix">&gt; </span>
        Return to Terminal
      </a>
    </>
  );
}

const terminalReturnStyles = `
  .terminal-return-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #0a0a0a;
    border: 2px solid #00ff00;
    color: #00ff00;
    padding: 12px 24px;
    font-family: "Courier New", monospace;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    z-index: 9999;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .terminal-return-button:hover {
    background: #00ff00;
    color: #0a0a0a;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
    text-decoration: none;
  }

  .terminal-return-button .terminal-prefix {
    opacity: 0.8;
  }

  .terminal-return-button:hover .terminal-prefix {
    opacity: 1;
  }
`;

export default TerminalReturnButton;
