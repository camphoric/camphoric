import React from 'react';
import { Link } from 'react-router-dom';

import Spinner from '../../Spinner';

interface Props {
  authToken: string,
  path: string,
}

function OrganizationChooser(props: Props) {
  const [organizations, setOrganizations] = React.useState<ApiOrganization[]>([]);

  React.useEffect(() => {
    const getOrganizations = async () => {
      let organizations
      try {
        const response = await fetch(
          '/api/organizations/',
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${props.authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        organizations = await response.json();

        setOrganizations(organizations);
      } catch (e) {
        // throw e;
      }
    };

    getOrganizations();
  }, [props.authToken]);

  if (!organizations.length) return <Spinner />;

  return (
    <div>
      <ul>
        {
          organizations.map(
            (org) => (
              <li key={org.id}>
                <Link to={`${props.path}/organization/${org.id}/event`}>{org.name}</Link>
              </li>
            )
          )
        }
      </ul>
    </div>
  );
};

export default OrganizationChooser;
