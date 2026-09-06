export function mergeDashboardStatus(current = {}, incoming = {}) {
  return { ...current, ...incoming };
}
