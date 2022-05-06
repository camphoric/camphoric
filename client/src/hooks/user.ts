import React from 'react';

/**
 * useUser hook
 *
 * This hook is not created via a factory, because it's value type is different
 * than all others.
 */
export type UserInfo = ApiUser | ApiAnonymousUser;

export const unauthenticatedUser: ApiAnonymousUser = {
  id: null,
  groups: [],
  is_active: false,
  is_staff: false,
  is_superuser: false,
  last_login: null,
  user_permissions: [],
  username: '',
};

export const UserContext = React.createContext({
  set: (value: UserInfo) => {},
  value: unauthenticatedUser as UserInfo,
});

export function useUser() {
  const user = React.useContext(UserContext);

  return user;
}
