import React from 'react';
import './PriceTicker.css';

const PriceTicker = (props: {price: number}) => (
  <div className="PriceTicker">
    Total: ${props.price.toFixed(2)}
  </div>
);

export default PriceTicker;