import React from 'react';

/**
 * Logo component for the application.
 * @param {Object} props - Component props.
 * @param {number|string} [props.width=120] - Width of the logo.
 * @param {number|string} [props.height] - Height of the logo.
 * @param {string} [props.className] - CSS class for the image.
 * @param {string} [props.alt="BP Logo"] - Alt text for the logo.
 */
const Logo = ({ width = 120, height, className, alt = 'BP Logo' }) => {
  return (
    <img
      src="/Logo/BP-Logo.wine.svg"
      width={width}
      height={height}
      className={className}
      alt={alt}
      role="img"
    />
  );
};

export default Logo;
