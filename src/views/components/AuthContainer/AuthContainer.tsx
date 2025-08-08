import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './AuthContainer.css';

const AuthContainer: React.FC = () => {
  const { actions } = useVulnerabilities();

  return (
    <div className="auth-container">
      <div className="auth-message">You are not logged in to Corgea</div>
      <button className="btn btn-primary login-btn" onClick={actions.login}>
        <i className="fas fa-key"></i>
        &nbsp;Login
      </button>
    </div>
  );
};

export default AuthContainer;
