import React, { useState, useEffect } from 'react';
import { Tabs, ConfigProvider } from 'antd';
// Updated import for Ant Design Polish locale (compatible with current AntD version).
import plPL from 'antd/locale/pl_PL';
import EmployeeManager from './components/EmployeeManager';
import ScheduleSettings from './components/ScheduleSettings';
import ScheduleTable from './components/ScheduleTable';
import { loadEmployeesByDepartment, saveEmployeesByDepartment } from './utils/localStorageHelper';
import './App.css';

// `Tabs` from Ant Design now supports the `items` prop, so we no longer need the legacy `TabPane` component.

function App() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [activeTab, setActiveTab] = useState('employees');
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);

  // Загрузка сотрудников при монтировании компонента
  useEffect(() => {
    // Load employees from department-specific storage and combine them
    const stacjaEmployees = loadEmployeesByDepartment('Stacja');
    const wildBeanCafeEmployees = loadEmployeesByDepartment('Wild Bean Cafe');

    // Combine all employees from all departments
    const allEmployees = [...stacjaEmployees, ...wildBeanCafeEmployees];

    setEmployees(allEmployees);
    // Mark that initial load is completed to prevent overwriting saved data
    setInitialLoadCompleted(true);
  }, []);

  // Обновление списка отделов при изменении сотрудников
  useEffect(() => {
    // Define all possible departments statically
    const allPossibleDepartments = ['Stacja', 'Wild Bean Cafe'];
    const uniqueDepartments = [
      ...new Set([...allPossibleDepartments, ...employees.map(emp => emp.department)]),
    ];
    const departmentObjects = uniqueDepartments
      .filter(dept => dept && dept.trim() !== '') // Filter out empty departments
      .map((deptName, index) => ({
        id: index + 1,
        name: deptName,
      }));

    setDepartments(departmentObjects);
  }, [employees]);

  // Загрузка сгенерированного графика из localStorage
  useEffect(() => {
    const savedSchedule = localStorage.getItem('generatedSchedule');
    if (savedSchedule) {
      try {
        setGeneratedSchedule(JSON.parse(savedSchedule));
      } catch (e) {
        console.error('Ошибка при загрузке графика:', e);
      }
    }
  }, []);

  // Сохранение сотрудников при их изменении
  useEffect(() => {
    // Only save to localStorage after initial load is completed to prevent overwriting saved data
    if (initialLoadCompleted) {
      // Save employees to department-specific storage instead of global

      const stacjaEmployees = employees.filter(emp => emp.department === 'Stacja');
      const wildBeanCafeEmployees = employees.filter(emp => emp.department === 'Wild Bean Cafe');

      // Save to department-specific keys
      saveEmployeesByDepartment('Stacja', stacjaEmployees);
      saveEmployeesByDepartment('Wild Bean Cafe', wildBeanCafeEmployees);
    }
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

  // Сохраняем сгенерированный график и переключаемся на вкладку "Grafik"
  const handleGenerateSchedule = scheduleData => {
    // Attach department metadata so the schedule page can deterministically render
    // only the last generated schedule (single department) and avoid showing
    // extra empty/old department tables.
    const deptObj = departments.find(d => d.id === selectedDepartment);
    const schedulePayload = {
      ...scheduleData,
      departmentId: selectedDepartment ?? null,
      departmentName: deptObj ? deptObj.name : null,
    };

    setGeneratedSchedule(schedulePayload);
    localStorage.setItem('generatedSchedule', JSON.stringify(schedulePayload));
    setActiveTab('schedule-table');
  };

  // Обновление отдельной ячейки итогового графика (для редактирования пользователем)
  const handleScheduleCellChange = (employeeId, dayIndex, newValue) => {
    if (!generatedSchedule) return;
    const updated = { ...generatedSchedule };
    // Ensure schedule object exists
    if (!updated.schedule) updated.schedule = {};
    if (!updated.schedule[employeeId]) {
      // Initialize with nulls for all days of month
      const daysInMonth = new Date(updated.year, updated.month + 1, 0).getDate();
      updated.schedule[employeeId] = Array(daysInMonth).fill(null);
    }
    updated.schedule[employeeId][dayIndex] = newValue || null;
    setGeneratedSchedule(updated);
    localStorage.setItem('generatedSchedule', JSON.stringify(updated));
  };

  const handleDepartmentChange = departmentId => {
    setSelectedDepartment(departmentId);
  };

  return (
    <ConfigProvider locale={plPL}>
      <div className="App">
        <h1>System zarządzania zmianami pracy</h1>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'employees',
              label: 'Pracownicy',
              children: (
                <EmployeeManager
                  employees={employees}
                  onAddEmployee={handleAddEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  currentDepartment={selectedDepartment}
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
                />
              ),
            },
          ]}
        />
      </div>
    </ConfigProvider>
  );
}

export default App;
