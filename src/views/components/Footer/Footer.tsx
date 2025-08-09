import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-text">
            Made with <span className="heart">❤</span> in California.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
