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
  // Инициализация и обновление ограничений (manualConstraints) при изменении месяца, года или отдела.
  // Кроме того, автоматически проставляем "0" в пятницы и субботы для сотрудников, у которых установлен флаг
  // `doesNotWorkOnSaturdays`.
  useEffect(() => {
    if (!selectedMonthYear || !selectedDepartment) return;

    // Находим объект отдела, чтобы получить его название (employees хранят название отдела, а не id).
    const deptObj = departments.find(d => d.id === selectedDepartment);
    const deptName = deptObj ? deptObj.name : null;
    if (!deptName) return;

    const filteredEmployees = employees.filter(emp => emp.department === deptName);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const newConstraints = {};

    filteredEmployees.forEach(employee => {
      // Если ограничения уже есть – копируем их, иначе создаём массив пустых строк.
      const existing = manualConstraints[employee.id] || [];
      const arr = existing.slice(0, daysInMonth);
      while (arr.length < daysInMonth) arr.push('');

      // Автоматическое заполнение 0 для пятницы (5) и субботы (6), если сотрудник не работает по субботам.
      // Заполняем только если пользователь ещё не задал значение, позволяя переопределить вручную.
      if (employee.doesNotWorkOnSaturdays) {
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
          const date = new Date(year, month, dayIdx + 1);
          const dow = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
          if (dow === 5 || dow === 6) {
            if (!arr[dayIdx]) {
              arr[dayIdx] = '0';
            }
          }
        }
      }

      newConstraints[employee.id] = arr;
    });

    setManualConstraints(prev => ({
      ...prev,
      ...newConstraints,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, employees, selectedMonthYear, month, year, departments]);

  const handleMonthChange = date => {
    if (date) {
      const selectedMonth = date.month();
      const selectedYear = date.year();
      setMonth(selectedMonth);
      setYear(selectedYear);
      setSelectedMonthYear(date);
      // При смене месяца сбрасываем ограничения – useEffect выше пересоздаст их с учётом автоматических 0.
      setManualConstraints({});
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
    if (!selectedDepartment || !selectedMonthYear) return [];

    const deptObj = departments.find(d => d.id === selectedDepartment);
    const deptName = deptObj ? deptObj.name : null;
    if (!deptName) return [];

    const filteredEmployees = employees.filter(emp => emp.department === deptName);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return filteredEmployees.map(employee => ({
      key: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      ...days.reduce((acc, _, index) => {
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

    // Map JavaScript getDay() index to Russian weekday abbreviations.
    const weekdayMap = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
      const date = new Date(year, month, i + 1);
      const dow = date.getDay(); // 0 = Sun, 1 = Mon, ...
      const weekday = weekdayMap[dow];
      columns.push({
        title: (
          <div style={{ textAlign: 'center' }}>
            <div>{weekday}</div>
            <div>{i + 1}</div>
          </div>
        ),
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
