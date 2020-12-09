import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useOrganizations } from '../hooks';
import Spinner from '../../Spinner';

interface Props {
  authToken: string,
}

function OrganizationChooser(props: Props) {
  const { pathname } = useLocation();
  const organizations = useOrganizations();

  if (!organizations.length) return <Spinner />;

  return (
    <div>
      <ul>
        {
          organizations.map(
            (org) => (
              <li key={org.id}>
                <Link to={`${pathname}/${org.id}/event`}>{org.name}</Link>
              </li>
            )
          )
        }
      </ul>
    </div>
  );
};

export default OrganizationChooser;
