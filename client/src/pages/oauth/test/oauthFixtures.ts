import { anonymousUser, type ApiOAuthRequest, type ApiUser } from 'api-types';

export const OAUTH_REQUEST: ApiOAuthRequest = {
  application: { id: 4, name: 'Camp admin tool' },
  scopes: [
    { name: 'read', description: 'See what your Camphoric permission group lets you see' },
    {
      name: 'write',
      description: 'Make the changes your Camphoric permission group lets you make',
    },
  ],
  write_limited_by_role: false,
};

export const SIGNED_IN: ApiUser = {
  ...anonymousUser,
  id: 7,
  username: 'sample.registrar',
  first_name: 'Sample',
  last_name: 'Registrar',
  is_active: true,
  role: 'registrar',
  pending_contract_organizations: [],
};
