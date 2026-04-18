export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    detail: (id: string | number) => [...queryKeys.users.all, 'detail', id] as const,
    // The legacy queries use string endpoints directly. For compatibility during migration we can expose the original endpoint string as the key.
    legacy: ['/api/users'] as const,
  },
  departments: {
    all: ['departments'] as const,
    lists: () => [...queryKeys.departments.all, 'list'] as const,
    detail: (id: string | number) => [...queryKeys.departments.all, 'detail', id] as const,
    legacy: ['/api/departments'] as const,
  },
  costCenters: {
    all: ['cost-centers'] as const,
    lists: () => [...queryKeys.costCenters.all, 'list'] as const,
    detail: (id: string | number) => [...queryKeys.costCenters.all, 'detail', id] as const,
    legacy: ['/api/cost-centers'] as const,
  },
  companies: {
    all: ['companies'] as const,
    lists: () => [...queryKeys.companies.all, 'list'] as const,
    detail: (id: string | number) => [...queryKeys.companies.all, 'detail', id] as const,
    legacy: ['/api/companies'] as const,
  }
};
