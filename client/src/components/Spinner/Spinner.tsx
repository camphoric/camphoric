import React from 'react';

const Spinner = ({text = 'Loading', color = 'antiquewhite'}) => (
  <div className="spinner">
    <svg viewBox="-10 -10 70 70">
      <mask id="myMask">
        <rect x="0" y="0" width="50" height="50" fill="aliceblue" />
        <path d="M25,25 L0,-25 L0,25 Z" fill="black" />
      </mask>
      <circle cx="25" cy="25" r="20" mask="url(#myMask)" stroke={color} fill="none" strokeWidth="5" />
    </svg>
    <div style={{ color: color }}>{text}</div>
  </div>
);

export default Spinner;
