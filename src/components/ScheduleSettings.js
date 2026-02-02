import React, { useState, useEffect } from 'react';
import { DatePicker, Select, Button, Table, Space, Card, Typography } from 'antd';
import { generateSchedule } from '../utils/scheduleGenerator';

const { Title } = Typography;
const { Option } = Select;

const ScheduleSettings = ({
  departments,
  employees,
  onGenerateSchedule,
  generatedSchedule,
  selectedDepartment,
  onDepartmentChange,
}) => {
  const [selectedMonthYear, setSelectedMonthYear] = useState(null);
  const [manualConstraints, setManualConstraints] = useState({});
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Обновляем ограничения при изменении сотрудников или выбранного отдела
  useEffect(() => {
    if (selectedMonthYear && selectedDepartment) {
      const filteredEmployees = employees.filter(emp => emp.departmentId === selectedDepartment);

      // Инициализируем ограничения для сотрудников текущего отдела
      const newConstraints = {};
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      filteredEmployees.forEach(employee => {
        if (!manualConstraints[employee.id]) {
          newConstraints[employee.id] = Array(daysInMonth).fill('');
        } else {
          // Сохраняем существующие ограничения, дополняя недостающие дни
          const existingConstraints = manualConstraints[employee.id] || [];
          newConstraints[employee.id] = [...existingConstraints];
          while (newConstraints[employee.id].length < daysInMonth) {
            newConstraints[employee.id].push('');
          }
        }
      });

      setManualConstraints(prev => ({
        ...prev,
        ...newConstraints,
      }));
    }
    // Exclude `manualConstraints` from dependencies to prevent infinite loop.
    // The effect only needs to run when the selected month/year, department, or employee list changes.
  }, [selectedDepartment, employees, selectedMonthYear, month, year]);

  const handleMonthChange = date => {
    if (date) {
      const selectedMonth = date.month();
      const selectedYear = date.year();
      setMonth(selectedMonth);
      setYear(selectedYear);
      setSelectedMonthYear(date);

      // Сброс ограничений при изменении месяца
      const daysInNewMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const updatedConstraints = {};

      Object.keys(manualConstraints).forEach(empId => {
        updatedConstraints[empId] = Array(daysInNewMonth).fill('');
        // Копируем значения, если возможно
        for (let i = 0; i < Math.min(manualConstraints[empId].length, daysInNewMonth); i++) {
          updatedConstraints[empId][i] = manualConstraints[empId][i];
        }
      });

      setManualConstraints(updatedConstraints);
    }
  };

  const handleConstraintChange = (employeeId, dayIndex, value) => {
    setManualConstraints(prev => ({
      ...prev,
      [employeeId]: prev[employeeId].map((val, idx) => (idx === dayIndex ? value : val)),
    }));
  };

  // Generates the schedule for the selected month and department.
  // Fixed filtering: employees store department name in `department`, while
  // `selectedDepartment` holds the department id. Resolve the name first.
  const handleGenerate = async () => {
    if (!selectedMonthYear || !selectedDepartment) {
      setError('Wybierz miesiąc i dział');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const deptObj = departments.find(d => d.id === selectedDepartment);
      const deptName = deptObj ? deptObj.name : null;
      if (!deptName) {
        throw new Error('Nie znaleziono wybranego działu');
      }
      const filteredEmployees = employees.filter(emp => emp.department === deptName);

      const result = await generateSchedule(filteredEmployees, month, year, manualConstraints);
      onGenerateSchedule(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Подготовка данных для таблицы
  const prepareTableData = () => {
    if (!selectedDepartment || !selectedMonthYear) {
      return [];
    }

    const filteredEmployees = employees.filter(emp => emp.departmentId === selectedDepartment);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return filteredEmployees.map(employee => ({
      key: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      ...days.reduce((acc, day, index) => {
        acc[`day_${index}`] = (
          <Select
            value={manualConstraints[employee.id]?.[index] || ''}
            onChange={value => handleConstraintChange(employee.id, index, value)}
            style={{ width: '60px' }}
            size="small"
          >
            <Option value=""> </Option>
            <Option value="0">0</Option>
            <Option value="U">U</Option>
          </Select>
        );
        return acc;
      }, {}),
    }));
  };

  // Подготовка колонок для таблицы
  const prepareColumns = () => {
    if (!selectedMonthYear) {
      return [];
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const columns = [
      {
        title: 'Imię i nazwisko',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 200,
      },
    ];

    for (let i = 0; i < daysInMonth; i++) {
      columns.push({
        title: i + 1,
        dataIndex: `day_${i}`,
        key: `day_${i}`,
        width: 70,
        align: 'center',
      });
    }

    return columns;
  };

  return (
    <Card style={{ marginBottom: 24 }}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Title level={4}>Ustawienia grafiku</Title>

        <Space wrap>
          <DatePicker
            picker="month"
            onChange={handleMonthChange}
            placeholder="Wybierz miesiąc"
            allowClear
          />

          <Select
            placeholder="Wybierz dział"
            value={selectedDepartment}
            onChange={onDepartmentChange}
            style={{ minWidth: 200 }}
            allowClear
          >
            {departments.map(dept => (
              <Option key={dept.id} value={dept.id}>
                {dept.name}
              </Option>
            ))}
          </Select>

          <Button
            type="primary"
            onClick={handleGenerate}
            loading={loading}
            disabled={!selectedMonthYear || !selectedDepartment}
          >
            Generuj grafik
          </Button>
        </Space>

        {error && (
          <div
            style={{ color: 'red', padding: '8px', border: '1px solid red', borderRadius: '4px' }}
          >
            {error}
          </div>
        )}

        {selectedMonthYear && selectedDepartment && (
          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={prepareColumns()}
              dataSource={prepareTableData()}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
            />
          </div>
        )}
      </Space>
    </Card>
  );
};

export default ScheduleSettings;
