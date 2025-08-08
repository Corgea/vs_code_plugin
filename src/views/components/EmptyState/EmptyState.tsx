import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <p className="text-muted mt-2">{description}</p>
    </div>
  );
};

export default EmptyState;
