import React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';
import { RouteList } from '../EventAdmin';

interface Props {
  routes: RouteList;
}

function NavBar (props: Props) {
  const { url } = useRouteMatch();

  return(
    <nav className="navBar">
      <ul>
        {
          props.routes.map(
            ([route, title]) => (
              <li key={route}>
                <NavLink to={`${url}/${route}`}>{title}</NavLink>
              </li>
            )
          )
        }
      </ul>
    </nav>
  );
}

export default NavBar;
