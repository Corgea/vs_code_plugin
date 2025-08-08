import React from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import Header from '../Header/Header';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import AuthContainer from '../AuthContainer/AuthContainer';
import NoProjectContainer from '../NoProjectContainer/NoProjectContainer';
import TabsContainer from '../TabsContainer/TabsContainer';
import './VulnerabilitiesApp.css';

const VulnerabilitiesApp: React.FC = () => {
  const { state } = useVulnerabilities();

  if (state.isLoading) {
    return (
      <div className="vulnerabilities-app">
        <Header />
        <LoadingSpinner />
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return (
      <div className="vulnerabilities-app">
        <Header />
        <AuthContainer />
      </div>
    );
  }

  if (state.projectNotFound && !state.isInScanningMode) {
    return (
      <div className="vulnerabilities-app">
        <Header />
        <NoProjectContainer />
      </div>
    );
  }

  return (
    <div className="vulnerabilities-app">
      <Header />
      <TabsContainer />
    </div>
  );
};

export default VulnerabilitiesApp;
