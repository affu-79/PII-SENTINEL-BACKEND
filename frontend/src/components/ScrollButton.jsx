import React, { useState, useEffect } from 'react';

function ScrollButton() {
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isVisible, setIsVisible] = useState(true); // Always visible initially

  useEffect(() => {
    const handleScroll = () => {
      // Check both window and scrollable containers
      const mainContent = document.querySelector('.main-content');
      const mainContentWrapper = document.querySelector('.main-content-wrapper');
      const scrollableContainer = mainContentWrapper || mainContent;
      
      let scrollContainer = window;
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      let scrollHeight = document.documentElement.scrollHeight;
      let clientHeight = window.innerHeight;

      // If scrollable container exists and is scrollable, use that instead
      if (scrollableContainer && scrollableContainer.scrollHeight > scrollableContainer.clientHeight) {
        scrollContainer = scrollableContainer;
        scrollTop = scrollableContainer.scrollTop;
        scrollHeight = scrollableContainer.scrollHeight;
        clientHeight = scrollableContainer.clientHeight;
      }

      // Check if page is scrollable
      const isScrollable = scrollHeight > clientHeight;
      
      // Check if at bottom (with 50px threshold)
      const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
      setIsAtBottom(atBottom);
      
      // Always show button (don't hide it)
      setIsVisible(true);
    };

    // Check on mount and resize
    handleScroll();
    
    // Listen to window scroll
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    // Listen to scrollable container scroll
    const mainContent = document.querySelector('.main-content');
    const mainContentWrapper = document.querySelector('.main-content-wrapper');
    const scrollableContainer = mainContentWrapper || mainContent;
    
    if (scrollableContainer) {
      scrollableContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      if (scrollableContainer) {
        scrollableContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleClick = () => {
    const mainContent = document.querySelector('.main-content');
    const mainContentWrapper = document.querySelector('.main-content-wrapper');
    const scrollableContainer = mainContentWrapper || mainContent;
    
    let scrollContainer = window;
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let scrollHeight = document.documentElement.scrollHeight;
    let clientHeight = window.innerHeight;

    // If scrollable container exists and is scrollable, use that instead
    if (scrollableContainer && scrollableContainer.scrollHeight > scrollableContainer.clientHeight) {
      scrollContainer = scrollableContainer;
      scrollTop = scrollableContainer.scrollTop;
      scrollHeight = scrollableContainer.scrollHeight;
      clientHeight = scrollableContainer.clientHeight;
    }

    if (isAtBottom) {
      // Scroll to top
      if (scrollContainer === scrollableContainer && scrollableContainer) {
        scrollableContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    } else {
      // Scroll to bottom
      if (scrollContainer === scrollableContainer && scrollableContainer) {
        scrollableContainer.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      } else {
        window.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <button
      className="scroll-button"
      onClick={handleClick}
      aria-label={isAtBottom ? 'Scroll to top' : 'Scroll to bottom'}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 99999,
        display: 'flex',
        visibility: 'visible',
        opacity: 1
      }}
    >
      {isAtBottom ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  );
}

export default ScrollButton;

