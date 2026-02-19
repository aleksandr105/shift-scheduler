// localStorageHelper.js
export const STORAGE_KEYS = {
  SCHEDULES_STORE: 'shift_scheduler_schedules',
  SCHEDULE: 'shift_scheduler_schedule',
  LEGACY_GENERATED_SCHEDULE: 'generatedSchedule',
};

const SCHEDULES_STORE_VERSION = 1;

const createEmptySchedulesStore = () => ({
  version: SCHEDULES_STORE_VERSION,
  schedules: {},
});

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const safeParseJSON = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeDepartmentId = departmentId => {
  if (departmentId === null || departmentId === undefined || departmentId === '') {
    return null;
  }
  return String(departmentId);
};

const normalizeSchedulesStore = rawStore => {
  if (!isPlainObject(rawStore)) {
    return createEmptySchedulesStore();
  }

  if (isPlainObject(rawStore.schedules)) {
    return {
      version:
        Number.isInteger(rawStore.version) && rawStore.version > 0
          ? rawStore.version
          : SCHEDULES_STORE_VERSION,
      schedules: rawStore.schedules,
    };
  }

  // Backward compatibility for accidental plain-map shape: { [departmentId]: schedulePayload }
  return {
    version: SCHEDULES_STORE_VERSION,
    schedules: rawStore,
  };
};

const findDepartmentById = (departments, departmentId) => {
  const normalizedDepartmentId = normalizeDepartmentId(departmentId);
  if (!normalizedDepartmentId) return null;
  return (
    departments.find(dept => normalizeDepartmentId(dept?.id) === normalizedDepartmentId) || null
  );
};

const findDepartmentByName = (departments, departmentName) => {
  if (!departmentName) return null;
  return departments.find(dept => dept?.name === departmentName) || null;
};

const inferDepartmentNameFromLegacySchedule = (legacySchedule, employees) => {
  if (!legacySchedule || !isPlainObject(legacySchedule.schedule)) {
    return null;
  }

  const employeeIdsInSchedule = new Set(Object.keys(legacySchedule.schedule));
  const matchedEmployee = employees.find(emp => employeeIdsInSchedule.has(String(emp.id)));
  return matchedEmployee?.department || null;
};

const resolveLegacyDepartmentId = ({
  legacySchedule,
  departments = [],
  employees = [],
  fallbackDepartmentId = null,
}) => {
  const directDepartmentId = normalizeDepartmentId(legacySchedule?.departmentId);
  if (directDepartmentId) return directDepartmentId;

  const byDepartmentName = findDepartmentByName(departments, legacySchedule?.departmentName);
  if (byDepartmentName) return normalizeDepartmentId(byDepartmentName.id);

  const inferredDepartmentName = inferDepartmentNameFromLegacySchedule(legacySchedule, employees);
  const byInferredName = findDepartmentByName(departments, inferredDepartmentName);
  if (byInferredName) return normalizeDepartmentId(byInferredName.id);

  const normalizedFallbackDepartmentId = normalizeDepartmentId(fallbackDepartmentId);
  if (normalizedFallbackDepartmentId) return normalizedFallbackDepartmentId;

  if (departments.length > 0) {
    return normalizeDepartmentId(departments[0].id);
  }

  return null;
};

export const getDepartmentStorageKey = departmentName => {
  return `employees_${departmentName.replace(/\s+/g, '')}`;
};

export const saveEmployeesByDepartment = (departmentName, employees) => {
  try {
    const storageKey = getDepartmentStorageKey(departmentName);
    localStorage.setItem(storageKey, JSON.stringify(employees));
  } catch (error) {
    console.error('Ошибка при сохранении сотрудников:', error);
  }
};

export const loadEmployeesByDepartment = departmentName => {
  try {
    const storageKey = getDepartmentStorageKey(departmentName);
    const employeesJson = localStorage.getItem(storageKey);
    const employees = employeesJson ? JSON.parse(employeesJson) : [];
    return employees;
  } catch (error) {
    console.error('Ошибка при загрузке сотрудников:', error);
    return [];
  }
};

export const saveEmployees = employees => {
  try {
    localStorage.setItem('shift_scheduler_employees', JSON.stringify(employees));
  } catch (error) {
    console.error('Ошибка при сохранении сотрудников:', error);
  }
};

export const loadEmployees = () => {
  try {
    const employeesJson = localStorage.getItem('shift_scheduler_employees');
    const employees = employeesJson ? JSON.parse(employeesJson) : [];
    return employees;
  } catch (error) {
    console.error('Ошибка при загрузке сотрудников:', error);
    return [];
  }
};

export const loadSchedulesStore = () => {
  try {
    const rawStore = localStorage.getItem(STORAGE_KEYS.SCHEDULES_STORE);
    if (!rawStore) {
      return createEmptySchedulesStore();
    }

    const parsedStore = safeParseJSON(rawStore, null);
    return normalizeSchedulesStore(parsedStore);
  } catch (error) {
    console.error('Ошибка при загрузке хранилища графиков:', error);
    return createEmptySchedulesStore();
  }
};

export const saveSchedulesStore = store => {
  try {
    const normalizedStore = normalizeSchedulesStore(store);
    localStorage.setItem(STORAGE_KEYS.SCHEDULES_STORE, JSON.stringify(normalizedStore));
    return normalizedStore;
  } catch (error) {
    console.error('Ошибка при сохранении хранилища графиков:', error);
    return createEmptySchedulesStore();
  }
};

export const getScheduleByDepartment = (departmentId, store = null) => {
  const normalizedDepartmentId = normalizeDepartmentId(departmentId);
  if (!normalizedDepartmentId) return null;

  const resolvedStore = store ? normalizeSchedulesStore(store) : loadSchedulesStore();
  return resolvedStore.schedules[normalizedDepartmentId] || null;
};

export const upsertScheduleByDepartment = (departmentId, schedulePayload, store = null) => {
  const normalizedDepartmentId = normalizeDepartmentId(departmentId);
  if (!normalizedDepartmentId || !isPlainObject(schedulePayload)) {
    return store ? normalizeSchedulesStore(store) : loadSchedulesStore();
  }

  const baseStore = store ? normalizeSchedulesStore(store) : loadSchedulesStore();
  const nextStore = {
    ...baseStore,
    schedules: {
      ...baseStore.schedules,
      [normalizedDepartmentId]: schedulePayload,
    },
  };

  return saveSchedulesStore(nextStore);
};

export const migrateLegacySchedules = ({
  departments = [],
  employees = [],
  fallbackDepartmentId = null,
} = {}) => {
  const currentStore = loadSchedulesStore();
  const hasSchedulesInCurrentStore =
    isPlainObject(currentStore.schedules) && Object.keys(currentStore.schedules).length > 0;

  if (hasSchedulesInCurrentStore) {
    return {
      migrated: false,
      migratedDepartmentId: null,
      store: currentStore,
    };
  }

  const legacyKeys = [STORAGE_KEYS.LEGACY_GENERATED_SCHEDULE, STORAGE_KEYS.SCHEDULE];

  let legacySchedule = null;
  for (const key of legacyKeys) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    const parsedValue = safeParseJSON(rawValue, null);
    if (isPlainObject(parsedValue)) {
      legacySchedule = parsedValue;
      break;
    }
  }

  if (!legacySchedule) {
    return {
      migrated: false,
      migratedDepartmentId: null,
      store: currentStore,
    };
  }

  const departmentId = resolveLegacyDepartmentId({
    legacySchedule,
    departments,
    employees,
    fallbackDepartmentId,
  });

  if (!departmentId) {
    return {
      migrated: false,
      migratedDepartmentId: null,
      store: currentStore,
    };
  }

  const departmentObj = findDepartmentById(departments, departmentId);
  const schedulePayload = {
    ...legacySchedule,
    departmentId,
    departmentName: legacySchedule.departmentName || departmentObj?.name || null,
  };

  const migratedStore = upsertScheduleByDepartment(departmentId, schedulePayload, currentStore);

  return {
    migrated: true,
    migratedDepartmentId: departmentId,
    store: migratedStore,
  };
};

// Backward-compatible wrappers.
export const saveSchedule = schedule => {
  const departmentId = schedule?.departmentId;
  if (!departmentId) return;
  upsertScheduleByDepartment(departmentId, schedule);
};

export const loadSchedule = departmentId => {
  return getScheduleByDepartment(departmentId);
};
