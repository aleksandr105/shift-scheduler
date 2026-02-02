import React, { useState, useEffect, useRef } from 'react';
import { Tabs } from 'antd';
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

  const handleAddEmployee = newEmployee => {
    const updatedEmployees = [...employees, { ...newEmployee, id: Date.now() }];
    setEmployees(updatedEmployees);
  };

  const handleDeleteEmployee = employeeId => {
    const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
    setEmployees(updatedEmployees);
  };

  const handleGenerateSchedule = scheduleData => {
    setGeneratedSchedule(scheduleData);
    // Сохраняем в localStorage
    localStorage.setItem('generatedSchedule', JSON.stringify(scheduleData));
  };

  const handleDepartmentChange = departmentId => {
    setSelectedDepartment(departmentId);
  };

  return (
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
              />
            ),
          },
        ]}
      />
    </div>
  );
}

export default App;
