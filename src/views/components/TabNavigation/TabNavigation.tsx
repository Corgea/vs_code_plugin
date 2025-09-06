import React, { useRef, useEffect, useState } from 'react';
import { useVulnerabilities } from '../../context/VulnerabilitiesContext';
import './TabNavigation.css';

const TabNavigation: React.FC = () => {
  const { state, dispatch } = useVulnerabilities();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLUListElement>(null);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  const handleTabClick = (tab: 'code' | 'sca' | 'scanning') => {
    // Don't allow switching to scanning tab if it's disabled
    if (tab === 'scanning' && !state.ideScanningEnabled) {
      return;
    }
    
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    
    // Scroll to active tab if it's not fully visible
    setTimeout(() => scrollToActiveTab(), 100);
  };

  const scrollToActiveTab = () => {
    if (!scrollContainerRef.current || !tabsRef.current) return;

    const activeTab = tabsRef.current.querySelector('.nav-link.active') as HTMLElement;
    if (!activeTab) return;

    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    const containerScrollLeft = container.scrollLeft;
    const tabOffsetLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;

    // Check if tab is fully visible
    const tabLeft = tabOffsetLeft - containerScrollLeft;
    const tabRight = tabLeft + tabWidth;

    if (tabLeft < 0) {
      // Tab is cut off on the left
      container.scrollTo({
        left: tabOffsetLeft - 20,
        behavior: 'smooth'
      });
    } else if (tabRight > containerWidth) {
      // Tab is cut off on the right
      container.scrollTo({
        left: tabOffsetLeft - containerWidth + tabWidth + 20,
        behavior: 'smooth'
      });
    }
  };

  const updateScrollIndicators = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    setShowLeftIndicator(scrollLeft > 0);
    setShowRightIndicator(scrollLeft < maxScrollLeft - 1);
  };

  const scrollLeft = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = Math.min(200, container.clientWidth * 0.6);
    
    container.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = Math.min(200, container.clientWidth * 0.6);
    
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    
    event.preventDefault();
    
    // Filter available tabs based on IDE scanning config
    const allTabs = ['code', 'sca', 'scanning'] as const;
    const availableTabs = state.ideScanningEnabled ? allTabs : (['code', 'sca'] as const);
    const currentIndex = availableTabs.indexOf(state.activeTab as any);
    
    let newIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : availableTabs.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < availableTabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = availableTabs.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      handleTabClick(availableTabs[newIndex]);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initial check
    updateScrollIndicators();

    // Listen for scroll events
    const handleScroll = () => updateScrollIndicators();
    container.addEventListener('scroll', handleScroll);

    // Listen for resize events
    const handleResize = () => {
      updateScrollIndicators();
      scrollToActiveTab();
    };
    window.addEventListener('resize', handleResize);

    // Scroll to active tab on mount
    setTimeout(() => scrollToActiveTab(), 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update indicators when tabs change
  useEffect(() => {
    setTimeout(() => updateScrollIndicators(), 100);
  }, [state.vulnerabilities.length, state.scaVulnerabilities.length, state.scanState.isScanning]);

  // Handle tab switching when IDE scanning is disabled
  useEffect(() => {
    if (!state.ideScanningEnabled && state.activeTab === 'scanning') {
      // Switch to code tab if scanning tab is disabled and currently active
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'code' });
    }
  }, [state.ideScanningEnabled, state.activeTab, dispatch]);

  return (
    <div className="tab-navigation-container">
      <div className="nav-tabs-wrapper">
        {/* Left scroll indicator */}
        <div 
          className={`scroll-indicator left ${showLeftIndicator ? 'visible' : ''}`}
          onClick={scrollLeft}
          role="button"
          aria-label="Scroll tabs left"
        >
          <i className="fas fa-chevron-left"></i>
        </div>

        {/* Right scroll indicator */}
        <div 
          className={`scroll-indicator right ${showRightIndicator ? 'visible' : ''}`}
          onClick={scrollRight}
          role="button"
          aria-label="Scroll tabs right"
        >
          <i className="fas fa-chevron-right"></i>
        </div>

        {/* Scrollable tabs container */}
        <div 
          className="nav-tabs-scroll" 
          ref={scrollContainerRef}
          role="tablist"
          onKeyDown={handleKeyDown}
        >
          <ul className="nav nav-tabs" ref={tabsRef}>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${state.activeTab === 'code' ? 'active' : ''}`}
                onClick={() => handleTabClick('code')}
                type="button"
                role="tab"
                aria-selected={state.activeTab === 'code'}
              >
                <i className="fas fa-code"></i>
                &nbsp;Code
                {state.hasVulnerabilities && (
                  <span className="count-badge">{state.vulnerabilities.length}</span>
                )}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${state.activeTab === 'sca' ? 'active' : ''}`}
                onClick={() => handleTabClick('sca')}
                type="button"
                role="tab"
                aria-selected={state.activeTab === 'sca'}
              >
                <i className="fas fa-cube"></i>
                &nbsp;Dependencies
                {state.hasSCAVulnerabilities && (
                  <span className="count-badge">{state.scaVulnerabilities.length}</span>
                )}
              </button>
            </li>
            {state.ideScanningEnabled && (
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${state.activeTab === 'scanning' ? 'active' : ''}`}
                  onClick={() => handleTabClick('scanning')}
                  type="button"
                  role="tab"
                  aria-selected={state.activeTab === 'scanning'}
                >
                  <i className="fas fa-search"></i>
                  &nbsp;Scanning
                  {state.scanState.isScanning && (
                    <span className="count-badge scanning-indicator">
                      <i className="fas fa-spinner fa-spin"></i>
                    </span>
                  )}
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;
