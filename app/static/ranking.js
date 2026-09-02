export function topChatRanking(people, limit = 5) {
  return [...people]
    .sort((left, right) => (right.messages - left.messages) || left.display_name.localeCompare(right.display_name, 'pt-BR'))
    .slice(0, limit);
}

export function inactiveProfileImageIds(cachedIds, people) {
  const activeIds = new Set(people.map((person) => person.id));
  return [...cachedIds].filter((id) => !activeIds.has(id));
}
