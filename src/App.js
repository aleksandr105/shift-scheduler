import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs, ConfigProvider } from 'antd';
// Updated import for Ant Design Polish locale (compatible with current AntD version).
import plPL from 'antd/locale/pl_PL';
import EmployeeManager from './components/EmployeeManager';
import ScheduleSettings from './components/ScheduleSettings';
import ScheduleTable from './components/ScheduleTable';
import Logo from './components/Logo';
import {
  loadEmployeesByDepartment,
  saveEmployeesByDepartment,
  migrateLegacySchedules,
  getScheduleByDepartment,
  upsertScheduleByDepartment,
} from './utils/localStorageHelper';
import './App.css';

// `Tabs` from Ant Design now supports the `items` prop, so we no longer need the legacy `TabPane` component.

const DEFAULT_DEPARTMENT_NAMES = ['Stacja', 'Wild Bean Cafe'];

function App() {
  const SCHEDULE_SAVE_DEBOUNCE_MS = 400;
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [activeTab, setActiveTab] = useState('employees');
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const [scheduleDepartmentId, setScheduleDepartmentId] = useState(null);
  const isScheduleBootstrapCompletedRef = useRef(false);
  const pendingScheduleWritesRef = useRef(new Map());
  const scheduleFlushTimerRef = useRef(null);

  const buildDepartmentId = departmentName => {
    if (!departmentName || typeof departmentName !== 'string') {
      return null;
    }

    const trimmedName = departmentName.trim();
    if (!trimmedName) {
      return null;
    }

    return trimmedName.toLowerCase().replace(/\s+/g, '-');
  };

  const collectDepartmentNames = employeesList => {
    return [
      ...new Set([
        ...DEFAULT_DEPARTMENT_NAMES,
        ...employeesList
          .map(employee => employee.department)
          .filter(departmentName => departmentName && departmentName.trim() !== ''),
      ]),
    ];
  };

  const normalizeDepartmentId = departmentId => {
    if (departmentId === null || departmentId === undefined || departmentId === '') {
      return null;
    }

    const matchedDepartment = departments.find(dept => String(dept.id) === String(departmentId));
    return matchedDepartment ? matchedDepartment.id : departmentId;
  };

  const clearScheduleFlushTimer = useCallback(() => {
    if (scheduleFlushTimerRef.current !== null) {
      window.clearTimeout(scheduleFlushTimerRef.current);
      scheduleFlushTimerRef.current = null;
    }
  }, []);

  const flushPendingScheduleWrites = useCallback(() => {
    clearScheduleFlushTimer();

    if (pendingScheduleWritesRef.current.size === 0) {
      return;
    }

    const pendingEntries = Array.from(pendingScheduleWritesRef.current.values());
    pendingScheduleWritesRef.current.clear();

    pendingEntries.forEach(({ departmentId, schedulePayload }) => {
      upsertScheduleByDepartment(departmentId, schedulePayload);
    });
  }, [clearScheduleFlushTimer]);

  const enqueueScheduleSave = useCallback(
    (departmentId, schedulePayload) => {
      if (!departmentId || !schedulePayload || typeof schedulePayload !== 'object') {
        return;
      }

      const monthPart =
        Number.isInteger(schedulePayload.month) || typeof schedulePayload.month === 'number'
          ? schedulePayload.month
          : 'na';
      const yearPart =
        Number.isInteger(schedulePayload.year) || typeof schedulePayload.year === 'number'
          ? schedulePayload.year
          : 'na';
      const pendingKey = `${String(departmentId)}::${String(monthPart)}::${String(yearPart)}`;

      pendingScheduleWritesRef.current.set(pendingKey, {
        departmentId,
        schedulePayload,
      });

      clearScheduleFlushTimer();
      scheduleFlushTimerRef.current = window.setTimeout(() => {
        flushPendingScheduleWrites();
      }, SCHEDULE_SAVE_DEBOUNCE_MS);
    },
    [clearScheduleFlushTimer, flushPendingScheduleWrites]
  );

  useEffect(() => {
    const handlePageLeave = () => {
      flushPendingScheduleWrites();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingScheduleWrites();
      }
    };

    const handleBeforePrint = () => {
      flushPendingScheduleWrites();
    };

    window.addEventListener('beforeunload', handlePageLeave);
    window.addEventListener('pagehide', handlePageLeave);
    window.addEventListener('beforeprint', handleBeforePrint);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageLeave);
      window.removeEventListener('pagehide', handlePageLeave);
      window.removeEventListener('beforeprint', handleBeforePrint);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushPendingScheduleWrites();
    };
  }, [flushPendingScheduleWrites]);

  // Загрузка сотрудников при монтировании компонента
  useEffect(() => {
    // Load employees from department-specific storage and combine them
    const departmentNamesToLoad = collectDepartmentNames([]);
    const allEmployees = departmentNamesToLoad.flatMap(departmentName =>
      loadEmployeesByDepartment(departmentName)
    );

    // Remove accidental duplicates by employee id while preserving order
    const deduplicatedEmployees = Array.from(
      new Map(allEmployees.map(employee => [String(employee.id), employee])).values()
    );

    setEmployees(deduplicatedEmployees);
    // Mark that initial load is completed to prevent overwriting saved data
    setInitialLoadCompleted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление списка отделов при изменении сотрудников
  useEffect(() => {
    const uniqueDepartmentNames = collectDepartmentNames(employees);
    const departmentsMap = new Map();

    uniqueDepartmentNames
      .filter(deptName => deptName && deptName.trim() !== '')
      .forEach(deptName => {
        const normalizedDepartmentName = deptName.trim();
        const departmentId = buildDepartmentId(normalizedDepartmentName);
        if (!departmentId || departmentsMap.has(departmentId)) {
          return;
        }

        departmentsMap.set(departmentId, {
          id: departmentId,
          name: normalizedDepartmentName,
        });
      });

    const departmentObjects = Array.from(departmentsMap.values());

    setDepartments(departmentObjects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  // Инициализация хранилища графиков (включая миграцию legacy данных в новый store)
  useEffect(() => {
    if (isScheduleBootstrapCompletedRef.current || departments.length === 0) {
      return;
    }

    const fallbackDepartmentId = departments[0]?.id ?? null;
    const migrationResult = migrateLegacySchedules({
      departments,
      employees,
      fallbackDepartmentId,
    });

    const initialDepartmentId = normalizeDepartmentId(migrationResult.migratedDepartmentId);

    if (initialDepartmentId !== null) {
      setScheduleDepartmentId(initialDepartmentId);

      const initialSchedule = getScheduleByDepartment(initialDepartmentId, migrationResult.store);
      setGeneratedSchedule(initialSchedule);
    } else {
      setScheduleDepartmentId(null);
      setGeneratedSchedule(null);
    }

    isScheduleBootstrapCompletedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, employees]);

  // Подгрузка графика выбранного отдела для страницы графика
  useEffect(() => {
    if (!isScheduleBootstrapCompletedRef.current) {
      return;
    }

    const normalizedDepartmentId = normalizeDepartmentId(scheduleDepartmentId);
    if (!normalizedDepartmentId) {
      setGeneratedSchedule(null);
      return;
    }

    const scheduleForDepartment = getScheduleByDepartment(normalizedDepartmentId);
    setGeneratedSchedule(scheduleForDepartment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDepartmentId]);

  // Сохранение сотрудников при их изменении
  useEffect(() => {
    // Only save to localStorage after initial load is completed to prevent overwriting saved data
    if (initialLoadCompleted) {
      // Save employees to department-specific storage instead of global
      const departmentNamesToPersist = collectDepartmentNames(employees);
      departmentNamesToPersist.forEach(departmentName => {
        const departmentEmployees = employees.filter(emp => emp.department === departmentName);
        saveEmployeesByDepartment(departmentName, departmentEmployees);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, initialLoadCompleted]);

  // Добавляем нового сотрудника в начало списка, чтобы он отображался первым в таблице
  const handleAddEmployee = newEmployee => {
    const updatedEmployees = [{ ...newEmployee, id: Date.now() }, ...employees];
    setEmployees(updatedEmployees);
  };

  const handleDeleteEmployee = employeeId => {
    const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
    setEmployees(updatedEmployees);
  };

  // Сохраняем сгенерированный график только в ветку выбранного отдела и переключаемся на вкладку "Grafik"
  const handleGenerateSchedule = scheduleData => {
    flushPendingScheduleWrites();

    const normalizedDepartmentId = normalizeDepartmentId(selectedDepartment);
    if (!normalizedDepartmentId) return;

    const deptObj = departments.find(d => String(d.id) === String(normalizedDepartmentId));
    const schedulePayload = {
      ...scheduleData,
      departmentId: normalizedDepartmentId,
      departmentName: deptObj ? deptObj.name : null,
      dayShiftRequired: scheduleData?.dayShiftRequired ?? 1,
      nightShiftRequired: scheduleData?.nightShiftRequired ?? 1,
    };

    upsertScheduleByDepartment(normalizedDepartmentId, schedulePayload);
    setGeneratedSchedule(schedulePayload);
    setScheduleDepartmentId(normalizedDepartmentId);
    setActiveTab('schedule-table');
  };

  // Обновление отдельной ячейки итогового графика (для редактирования пользователем)
  const handleScheduleCellChange = (employeeId, dayIndex, newValue) => {
    const normalizedDepartmentId = normalizeDepartmentId(scheduleDepartmentId);
    if (!normalizedDepartmentId || !generatedSchedule) return;

    const deptObj = departments.find(d => String(d.id) === String(normalizedDepartmentId));
    const daysInMonth = new Date(generatedSchedule.year, generatedSchedule.month + 1, 0).getDate();

    if (dayIndex < 0 || dayIndex >= daysInMonth) {
      return;
    }

    const baseSchedule =
      generatedSchedule.schedule && typeof generatedSchedule.schedule === 'object'
        ? generatedSchedule.schedule
        : {};
    const baseEmployeeSchedule = Array.isArray(baseSchedule[employeeId])
      ? baseSchedule[employeeId]
      : [];
    const nextEmployeeSchedule = Array.from(
      { length: daysInMonth },
      (_, index) => baseEmployeeSchedule[index] ?? null
    );
    nextEmployeeSchedule[dayIndex] = newValue || null;

    const updated = {
      ...generatedSchedule,
      departmentId: normalizedDepartmentId,
      departmentName: generatedSchedule.departmentName || deptObj?.name || null,
      schedule: {
        ...baseSchedule,
        [employeeId]: nextEmployeeSchedule,
      },
    };

    setGeneratedSchedule(updated);
    enqueueScheduleSave(normalizedDepartmentId, updated);
  };

  const handleDepartmentChange = departmentId => {
    flushPendingScheduleWrites();

    const normalizedDepartmentId = normalizeDepartmentId(departmentId);
    setSelectedDepartment(normalizedDepartmentId);
    setScheduleDepartmentId(normalizedDepartmentId);
  };

  const handleBeforePrint = useCallback(() => {
    flushPendingScheduleWrites();
  }, [flushPendingScheduleWrites]);

  const handleTabChange = useCallback(
    tabKey => {
      flushPendingScheduleWrites();
      setActiveTab(tabKey);
    },
    [flushPendingScheduleWrites]
  );

  return (
    <ConfigProvider locale={plPL}>
      <div className="App">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '30px',
          }}
        >
          <Logo width={80} />
          <h1 style={{ margin: 0 }}>System zarządzania zmianami pracy</h1>
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'employees',
              label: 'Pracownicy',
              children: (
                <EmployeeManager
                  employees={employees}
                  onAddEmployee={handleAddEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  departments={departments}
                />
              ),
            },
            {
              key: 'schedule-settings',
              label: 'Ustawienia grafiku',
              children: (
                <ScheduleSettings
                  departments={departments}
                  employees={employees}
                  onGenerateSchedule={handleGenerateSchedule}
                  generatedSchedule={generatedSchedule}
                  selectedDepartment={selectedDepartment}
                  onDepartmentChange={handleDepartmentChange}
                />
              ),
            },
            {
              key: 'schedule-table',
              label: 'Grafik',
              children: (
                <ScheduleTable
                  generatedSchedule={generatedSchedule}
                  departments={departments}
                  employees={employees}
                  onCellChange={handleScheduleCellChange}
                  onBeforePrint={handleBeforePrint}
                  selectedDepartment={scheduleDepartmentId}
                  onDepartmentChange={handleDepartmentChange}
                />
              ),
            },
          ]}
        />
        <footer className="app-footer">
          <div>Twórca: Oleksandr Shcherbyna.</div>
          <div>
            W razie pytań i sugestii pisz na:{' '}
            <a href="mailto:aleksandrsherbina105@gmail.com" className="app-footer-link">
              aleksandrsherbina105@gmail.com
            </a>
          </div>
        </footer>
      </div>
    </ConfigProvider>
  );
}

export default App;
