// localStorageHelper.js
export const STORAGE_KEYS = {
  SCHEDULE: 'shift_scheduler_schedule',
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

export const saveSchedule = schedule => {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
  } catch (error) {
    console.error('Ошибка при сохранении графика:', error);
  }
};

export const loadSchedule = () => {
  try {
    const schedule = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    return schedule ? JSON.parse(schedule) : null;
  } catch (error) {
    console.error('Ошибка при загрузке графика:', error);
    return null;
  }
};
