import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './AuthContainer.css';

const AuthContainer: React.FC = () => {
  const { state, actions } = useVulnerabilities();
  const [enterpriseScope, setEnterpriseScope] = React.useState('');
  const [scopeError, setScopeError] = React.useState('');

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate scope
    if (!enterpriseScope.trim()) {
      setScopeError('Scope is required');
      return;
    }
    
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$/.test(enterpriseScope.trim())) {
      setScopeError('Scope must contain only letters, numbers, and hyphens, and cannot start or end with a hyphen');
      return;
    }

    setScopeError('');
    actions.submitEnterpriseLogin(enterpriseScope.trim());
    setEnterpriseScope('');
  };

  const handleCancel = () => {
    setEnterpriseScope('');
    setScopeError('');
    actions.cancelEnterpriseLogin();
  };

  if (state.isOAuthLoading) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <div className="auth-loading-message">Waiting for authentication...</div>
          <button 
            className="btn btn-secondary cancel-btn" 
            onClick={() => actions.cancelOAuth()}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.showEnterpriseForm) {
    return (
      <div className="auth-container">
        <div className="auth-message">Enter your enterprise scope</div>
        <form onSubmit={handleEnterpriseSubmit} className="enterprise-form">
          <div className="form-group">
            <input
              type="text"
              className={`form-input ${scopeError ? 'error' : ''}`}
              placeholder="your-company"
              value={enterpriseScope}
              onChange={(e) => setEnterpriseScope(e.target.value)}
              autoFocus
            />
            <div className="form-help">
              e.g., 'your-company' for <br/>https://your-company.corgea.app
            </div>
            {scopeError && <div className="form-error">{scopeError}</div>}
          </div>
          <div className="form-buttons">
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-message">You are not logged in to Corgea</div>
      <div className="auth-buttons">
        <button className="btn btn-primary login-btn" onClick={actions.oauthLogin}>
          Login
        </button>
        <button className="btn btn-tertiary enterprise-login-btn" onClick={actions.enterpriseLogin}>
          Enterprise Login
        </button>
      </div>
    </div>
  );
};

export default AuthContainer;
