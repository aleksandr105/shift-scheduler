import React, { useState, useEffect } from 'react';
import { DatePicker, Select, Button, Table, Space, Card, Typography } from 'antd';
import styles from './ScheduleTable.module.css';
import { generateSchedule } from '../utils/scheduleGenerator';
// Specific locale for DatePicker to ensure month names are displayed in Polish.
import datePickerPl from 'antd/es/date-picker/locale/pl_PL';

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
    setManualConstraints(prev => {
      // Ensure the constraints array exists for the employee; initialise with empty strings for the month length
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const employeeConstraints = prev[employeeId] || new Array(daysInMonth).fill('');
      return {
        ...prev,
        [employeeId]: employeeConstraints.map((val, idx) => (idx === dayIndex ? value : val)),
      };
    });
  };

  // Map shift codes to CSS classes for styling – same as in ScheduleTable.
  const getShiftClass = shift => {
    switch (shift) {
      case '7-19':
        return styles.shiftDay;
      case '19-7':
        return styles.shiftNight;
      case '0':
        return styles.shiftOff;
      case 'U':
        return styles.shiftVacation;
      default:
        return '';
    }
  };

  // Determine default shift for a given day and employee.
  // Returns "0" for Friday (5) or Saturday (6) when the employee does not work on Saturdays.
  const getDefaultShift = (day, employee) => {
    const d = new Date(year, month, day);
    const dow = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (employee.doesNotWorkOnSaturdays && (dow === 5 || dow === 6)) {
      return '0';
    }
    return '';
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
  // Prepare data where each row represents a day of the month.
  const prepareTableData = () => {
    if (!selectedDepartment || !selectedMonthYear) return [];

    const deptObj = departments.find(d => d.id === selectedDepartment);
    const deptName = deptObj ? deptObj.name : null;
    if (!deptName) return [];

    const filteredEmployees = employees.filter(emp => emp.department === deptName);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows = [];
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
      const row = { key: dayIdx };
      // Add a readable label for the first column (will be rendered via column render)
      row.date = dayIdx + 1;
      filteredEmployees.forEach(emp => {
        const manualValue = manualConstraints[emp.id]?.[dayIdx];
        const value =
          manualValue !== undefined && manualValue !== ''
            ? manualValue
            : getDefaultShift(dayIdx + 1, emp);
        const select = (
          <Select
            value={value}
            onChange={val => handleConstraintChange(emp.id, dayIdx, val)}
            style={{ width: '60px' }}
            size="small"
          >
            <Option value=""> </Option>
            <Option value="0">0</Option>
            <Option value="U">U</Option>
          </Select>
        );
        // `shiftCell` is UI-only: ensures no ellipsis for shift labels inside Select.
        // No business logic changes.
        row[emp.id] = <div className={`${styles.shiftCell} ${getShiftClass(value)}`}>{select}</div>;
      });
      rows.push(row);
    }
    return rows;
  };

  // Подготовка колонок для таблицы
  // Columns: first column – date, then one column per employee.
  const prepareColumns = () => {
    if (!selectedMonthYear) return [];

    const deptObj = departments.find(d => d.id === selectedDepartment);
    const deptName = deptObj ? deptObj.name : null;
    if (!deptName) return [];

    const filteredEmployees = employees.filter(emp => emp.department === deptName);
    const columns = [
      {
        title: 'Data',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        width: 80,
        render: (text, record) => {
          const date = new Date(year, month, record.date);
          const dow = date.getDay();
          const weekdayMap = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
          const weekday = weekdayMap[dow];
          const isWeekend = dow === 0 || dow === 6;
          return (
            <div
              className={
                isWeekend
                  ? `${styles.settingsDateCell} ${styles.settingsWeekendDateCell}`
                  : styles.settingsDateCell
              }
            >
              <span className={styles.settingsDateNumber}>{record.date}</span>
              <span className={styles.settingsDateWeekday}>{weekday}</span>
            </div>
          );
        },
      },
    ];

    filteredEmployees.forEach(emp => {
      const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(' ');
      columns.push({
        title: (
          <div className={styles.employeeHeaderWrap} title={fullName}>
            <span className={styles.employeeHeaderSizer} aria-hidden="true">
              {fullName}
            </span>
            <span className={styles.employeeHeaderText}>
              <span className={styles.employeeHeaderTextInner}>{fullName}</span>
            </span>
          </div>
        ),
        dataIndex: emp.id,
        key: emp.id,
        width: 80,
        align: 'center',
        onHeaderCell: () => ({ className: styles.employeeHeaderCell }),
      });
    });

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
            // Use the DatePicker‑specific Polish locale for month names
            locale={datePickerPl}
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
              className={styles.settingsTable}
              columns={prepareColumns()}
              dataSource={prepareTableData()}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              bordered
            />
          </div>
        )}
      </Space>
    </Card>
  );
};

export default ScheduleSettings;
