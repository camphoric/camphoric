import React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';

function NavBar () {
  const { url } = useRouteMatch();

  return(
    <nav className="navBar">
      <ul>
        <li><NavLink to={`${url}/home`}>Home</NavLink></li>
        <li><NavLink to={`${url}/about`}>About</NavLink></li>
        <li><NavLink to={`${url}/contact`}>Contact</NavLink></li>
      </ul>
    </nav>
  );
}

export default NavBar;
