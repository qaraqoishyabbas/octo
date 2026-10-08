export const mergeUsersById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const usersById = new Map(current.map((user) => [user.id, user]));

  incoming.forEach((user) => usersById.set(user.id, user));

  return [...usersById.values()];
};
