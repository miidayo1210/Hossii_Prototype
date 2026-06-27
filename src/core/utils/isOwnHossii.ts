export function isOwnHossii(
  hossii: {
    id: string;
    authorId?: string;
  },
  myAuthorshipIds: ReadonlySet<string>,
  guestProfileId?: string,
): boolean {
  if (myAuthorshipIds.has(hossii.id)) {
    return true;
  }

  if (guestProfileId && hossii.authorId === guestProfileId) {
    return true;
  }

  return false;
}
