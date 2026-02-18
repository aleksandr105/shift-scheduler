/**
 * Генерирует график смен на основе сотрудников, месяца, года и ручных ограничений
 * @param {Array} employees - Массив сотрудников
 * @param {number} month - Месяц (0-11)
 * @param {number} year - Год
 * @param {Object} manualConstraints - Ручные ограничения (ключ - ID сотрудника, значение - массив ограничений по дням)
 * @param {number} dayShiftRequired - Требуемое количество сотрудников на дневную смену (1-5)
 * @param {number} nightShiftRequired - Требуемое количество сотрудников на ночную смену (1-5)
 * @returns {Object} Объект графика или ошибку
 */
export const generateSchedule = (
  employees,
  month,
  year,
  manualConstraints = {},
  dayShiftRequired = 1,
  nightShiftRequired = 1
) => {
  const normalizedDayShiftRequired =
    Number.isInteger(Number(dayShiftRequired)) &&
    Number(dayShiftRequired) >= 1 &&
    Number(dayShiftRequired) <= 5
      ? Number(dayShiftRequired)
      : 1;
  const normalizedNightShiftRequired =
    Number.isInteger(Number(nightShiftRequired)) &&
    Number(nightShiftRequired) >= 1 &&
    Number(nightShiftRequired) <= 5
      ? Number(nightShiftRequired)
      : 1;

  // Получаем количество дней в месяце
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Проверяем, есть ли хотя бы один сотрудник
  if (!employees || employees.length === 0) {
    throw new Error('Brak pracowników do wygenerowania grafiku');
  }

  // Фильтруем активных сотрудников (не уволенных)
  const activeEmployees = employees.filter(emp => !emp.terminationDate);

  if (activeEmployees.length === 0) {
    throw new Error('Brak aktywnych pracowników do wygenerowania grafiku');
  }

  // Создаем шаблон графика
  const scheduleTemplate = {};

  // Инициализируем расписание для каждого сотрудника
  activeEmployees.forEach(employee => {
    scheduleTemplate[employee.id] = Array(daysInMonth).fill(null);
  });

  // Заполняем ручные ограничения
  Object.keys(manualConstraints).forEach(employeeId => {
    if (scheduleTemplate[employeeId]) {
      for (let day = 0; day < daysInMonth; day++) {
        if (manualConstraints[employeeId][day] === '0') {
          scheduleTemplate[employeeId][day] = '0'; // Не работает
        } else if (manualConstraints[employeeId][day] === 'U') {
          scheduleTemplate[employeeId][day] = 'U'; // Отпуск
        }
      }
    }
  });

  // Проверяем сотрудников с ограничением "Nie pracuje w soboty".
  // В UI флаг хранится как boolean `doesNotWorkOnSaturdays`. Для совместимости
  // учитываем оба варианты: массив `constraints` и булево поле.
  const saturdayRestrictedEmployees = activeEmployees.filter(emp => {
    if (Array.isArray(emp.constraints) && emp.constraints.includes('Nie pracuje w soboty')) {
      return true;
    }
    return emp.doesNotWorkOnSaturdays === true;
  });

  // Определяем даты суббот
  const saturdays = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 6) {
      // 6 = Суббота
      saturdays.push(day - 1); // Индекс дня (0-based)
    }
  }

  // Применяем ограничение на субботы
  saturdayRestrictedEmployees.forEach(employee => {
    saturdays.forEach(saturdayIndex => {
      if (scheduleTemplate[employee.id][saturdayIndex] === null) {
        scheduleTemplate[employee.id][saturdayIndex] = '0';
      }
    });
  });

  // Подсчитываем количество требуемых смен для каждого дня.
  // По умолчанию (обратная совместимость) используется 1 сотрудник на каждую смену.
  const morningShiftsNeeded = Array(daysInMonth).fill(normalizedDayShiftRequired); // 7-19
  const eveningShiftsNeeded = Array(daysInMonth).fill(normalizedNightShiftRequired); // 19-7

  // Проверяем, достаточно ли сотрудников для покрытия всех смен
  const totalNeededMorning = morningShiftsNeeded.reduce((sum, needed) => sum + needed, 0);
  const totalNeededEvening = eveningShiftsNeeded.reduce((sum, needed) => sum + needed, 0);

  // Подсчитываем доступные слоты с учетом всех ограничений
  let totalAvailableSlots = 0;
  for (let day = 0; day < daysInMonth; day++) {
    for (const employee of activeEmployees) {
      const constraint = manualConstraints[employee.id]?.[day];
      const isSaturdayRestricted =
        saturdayRestrictedEmployees.some(emp => emp.id === employee.id) && saturdays.includes(day);

      // Если сотрудник имеет ограничение, слот недоступен
      if (constraint === '0' || constraint === 'U' || isSaturdayRestricted) {
        continue;
      }

      // Если слот еще не занят ручным ограничением
      if (scheduleTemplate[employee.id][day] === null) {
        totalAvailableSlots++;
      }
    }
  }

  const totalNeeded = totalNeededMorning + totalNeededEvening;
  if (totalAvailableSlots < totalNeeded) {
    throw new Error('Zbyt mało pracowników do pokrycia wszystkich zmian w wybranym miesiącu');
  }

  // Алгоритм распределения смен
  const shifts = ['7-19', '19-7'];

  // Сначала распределяем смены день за днем, чтобы обеспечить равномерное распределение
  for (let day = 0; day < daysInMonth; day++) {
    for (const shift of shifts) {
      const neededForShift = shift === '7-19' ? morningShiftsNeeded[day] : eveningShiftsNeeded[day];

      // Находим доступных сотрудников для этой смены
      const availableForShift = activeEmployees.filter(employee => {
        const currentSchedule = scheduleTemplate[employee.id][day];
        const constraint = manualConstraints[employee.id]?.[day];
        const isSaturdayRestricted =
          saturdayRestrictedEmployees.some(emp => emp.id === employee.id) &&
          saturdays.includes(day);

        // Сотрудник уже назначен на эту дату или имеет ограничение
        if (currentSchedule !== null && currentSchedule !== undefined) {
          return false;
        }

        // Сотрудник имеет ручное ограничение
        if (constraint === '0' || constraint === 'U') {
          return false;
        }

        // Сотрудник ограничен в субботу, и это суббота
        if (isSaturdayRestricted) {
          return false;
        }

        return true;
      });

      // Сортируем доступных сотрудников по количеству назначенных смен (для равномерного распределения)
      availableForShift.sort((a, b) => {
        const aAssigned = scheduleTemplate[a.id].filter(
          slot => slot && slot !== '0' && slot !== 'U'
        ).length;
        const bAssigned = scheduleTemplate[b.id].filter(
          slot => slot && slot !== '0' && slot !== 'U'
        ).length;
        return aAssigned - bAssigned;
      });

      // Назначаем смены тем, кто доступен
      for (let i = 0; i < neededForShift && i < availableForShift.length; i++) {
        const employee = availableForShift[i];
        scheduleTemplate[employee.id][day] = shift;
      }
    }
  }

  // Проверяем, все ли смены покрыты
  const uncoveredShifts = [];
  for (let day = 0; day < daysInMonth; day++) {
    for (const shift of shifts) {
      let assignedCount = 0;
      for (const employeeId of Object.keys(scheduleTemplate)) {
        if (scheduleTemplate[employeeId][day] === shift) {
          assignedCount++;
        }
      }

      const neededForShift = shift === '7-19' ? morningShiftsNeeded[day] : eveningShiftsNeeded[day];
      if (assignedCount < neededForShift) {
        uncoveredShifts.push({
          day: day + 1,
          shift,
          needed: neededForShift,
          assigned: assignedCount,
        });
      }
    }
  }

  // Если есть непокрытые смены, бросаем ошибку с подробным описанием.
  // UI‑компонент `ScheduleSettings` отловит её и отобразит пользователю.
  if (uncoveredShifts.length > 0) {
    const details = uncoveredShifts
      .map(
        s => `dzień ${s.day}, zmiana ${s.shift}: potrzebne ${s.needed}, przydzielone ${s.assigned}`
      )
      .join('; ');
    throw new Error(`Nie udało się pokryć wszystkich zmian. ${details}`);
  }

  return {
    schedule: scheduleTemplate,
    daysInMonth,
    month,
    year,
    dayShiftRequired: normalizedDayShiftRequired,
    nightShiftRequired: normalizedNightShiftRequired,
  };
};
