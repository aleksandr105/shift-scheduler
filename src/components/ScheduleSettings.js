import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DatePicker, Select, Button, Table, Space, Card, Typography, Grid } from 'antd';
import styles from './ScheduleTable.module.css';
import { generateSchedule } from '../utils/scheduleGenerator';
// Specific locale for DatePicker to ensure month names are displayed in Polish.
import datePickerPl from 'antd/es/date-picker/locale/pl_PL';

const { Title } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;
const WEEKDAY_MAP = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const MANUAL_CONSTRAINT_OPTIONS = [
  { value: '', label: ' ' },
  { value: '0', label: '0' },
  { value: 'U', label: 'U' },
];

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

const DateCell = React.memo(({ date, weekday, isWeekend }) => (
  <div
    className={
      isWeekend
        ? `${styles.settingsDateCell} ${styles.settingsWeekendDateCell}`
        : styles.settingsDateCell
    }
  >
    <span className={styles.settingsDateNumber}>{date}</span>
    <span className={styles.settingsDateWeekday}>{weekday}</span>
  </div>
));

const ConstraintCell = React.memo(
  ({ employeeId, dayIndex, value, isWeekend, onChange }) => {
    const handleChange = useCallback(
      nextValue => {
        onChange(employeeId, dayIndex, nextValue);
      },
      [onChange, employeeId, dayIndex]
    );

    const shiftClassName = getShiftClass(value);
    const className = `${styles.shiftCell} ${isWeekend ? styles.weekendShiftCell : ''} ${shiftClassName}`;

    return (
      <div className={className}>
        <Select
          value={value}
          onChange={handleChange}
          options={MANUAL_CONSTRAINT_OPTIONS}
          className={styles.shiftSelect}
          size="small"
        />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.value === nextProps.value &&
    prevProps.isWeekend === nextProps.isWeekend &&
    prevProps.employeeId === nextProps.employeeId &&
    prevProps.dayIndex === nextProps.dayIndex &&
    prevProps.onChange === nextProps.onChange
);

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
  const [dayShiftRequired, setDayShiftRequired] = useState(null);
  const [nightShiftRequired, setNightShiftRequired] = useState(null);
  const [tableData, setTableData] = useState([]);
  const screens = useBreakpoint();

  const tableScale = useMemo(() => {
    if (!screens.md) {
      return {
        dateColWidth: 60,
        employeeColWidth: 36,
      };
    }

    if (!screens.lg) {
      return {
        dateColWidth: 64,
        employeeColWidth: 40,
      };
    }

    if (!screens.xl) {
      return {
        dateColWidth: 68,
        employeeColWidth: 42,
      };
    }

    return {
      dateColWidth: 72,
      employeeColWidth: 44,
    };
  }, [screens.md, screens.lg, screens.xl]);

  const selectedDepartmentObj = useMemo(
    () => departments.find(d => d.id === selectedDepartment) || null,
    [departments, selectedDepartment]
  );
  const departmentName = selectedDepartmentObj ? selectedDepartmentObj.name : null;

  const filteredEmployees = useMemo(() => {
    if (!departmentName) return [];
    return employees.filter(emp => emp.department === departmentName);
  }, [employees, departmentName]);

  const employeesById = useMemo(() => {
    const map = new Map();
    filteredEmployees.forEach(employee => {
      map.set(employee.id, employee);
    });
    return map;
  }, [filteredEmployees]);

  const daysInMonth = useMemo(() => {
    if (month === null || year === null) return 0;
    return new Date(year, month + 1, 0).getDate();
  }, [month, year]);

  const dayRowsMeta = useMemo(() => {
    if (!daysInMonth || month === null || year === null) return [];
    const rows = [];
    for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex++) {
      const date = new Date(year, month, dayIndex + 1);
      const dow = date.getDay();
      rows.push({
        key: dayIndex,
        dayIndex,
        date: dayIndex + 1,
        weekday: WEEKDAY_MAP[dow],
        isWeekend: dow === 0 || dow === 6,
      });
    }
    return rows;
  }, [daysInMonth, month, year]);

  const manualConstraintsRef = useRef(manualConstraints);

  // Keep compatibility with existing employee flags/data shape.
  const hasSaturdayRestriction = useCallback(employee => {
    if (!employee) return false;
    if (employee.doesNotWorkOnSaturdays === true) return true;
    if (employee.noSaturdays === true) return true;
    return (
      Array.isArray(employee.constraints) && employee.constraints.includes('Nie pracuje w soboty')
    );
  }, []);

  const getDefaultShift = useCallback(
    (day, employee) => {
      const d = new Date(year, month, day);
      const dow = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
      if (hasSaturdayRestriction(employee) && (dow === 5 || dow === 6)) {
        return '0';
      }
      return '';
    },
    [hasSaturdayRestriction, month, year]
  );

  const buildTableRows = useCallback(
    (constraints, employeesToRender) => {
      if (!dayRowsMeta.length || !employeesToRender.length) {
        return dayRowsMeta.map(row => ({ ...row }));
      }

      return dayRowsMeta.map(meta => {
        const row = { ...meta };
        employeesToRender.forEach(emp => {
          const manualValue = constraints[emp.id]?.[meta.dayIndex];
          row[emp.id] =
            manualValue !== undefined && manualValue !== ''
              ? manualValue
              : getDefaultShift(meta.date, emp);
        });
        return row;
      });
    },
    [dayRowsMeta, getDefaultShift]
  );

  useEffect(() => {
    manualConstraintsRef.current = manualConstraints;
  }, [manualConstraints]);

  // Обновляем ограничения при изменении сотрудников или выбранного отдела
  // Инициализация и обновление ограничений (manualConstraints) при изменении месяца, года или отдела.
  // Кроме того, автоматически проставляем "0" в пятницы и субботы для сотрудников, у которых установлен флаг
  // `doesNotWorkOnSaturdays`.
  useEffect(() => {
    if (!selectedMonthYear || !selectedDepartment || !departmentName || !daysInMonth) {
      setTableData([]);
      return;
    }

    const baseConstraints = manualConstraintsRef.current;
    const newConstraints = {};

    filteredEmployees.forEach(employee => {
      // Если ограничения уже есть – копируем их, иначе создаём массив пустых строк.
      const existing = baseConstraints[employee.id] || [];
      const arr = existing.slice(0, daysInMonth);
      while (arr.length < daysInMonth) arr.push('');

      // Автоматическое заполнение 0 для пятницы (5) и субботы (6), если сотрудник не работает по субботам.
      // Заполняем только если пользователь ещё не задал значение, позволяя переопределить вручную.
      if (hasSaturdayRestriction(employee)) {
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
          const date = new Date(year, month, dayIdx + 1);
          const dow = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
          if ((dow === 5 || dow === 6) && !arr[dayIdx]) {
            arr[dayIdx] = '0';
          }
        }
      }

      newConstraints[employee.id] = arr;
    });

    const mergedConstraints = {
      ...baseConstraints,
      ...newConstraints,
    };

    setManualConstraints(mergedConstraints);
    setTableData(buildTableRows(mergedConstraints, filteredEmployees));
  }, [
    selectedDepartment,
    selectedMonthYear,
    departmentName,
    daysInMonth,
    filteredEmployees,
    hasSaturdayRestriction,
    month,
    year,
    buildTableRows,
  ]);

  const handleMonthChange = date => {
    if (date) {
      const selectedMonth = date.month();
      const selectedYear = date.year();
      setMonth(selectedMonth);
      setYear(selectedYear);
      setSelectedMonthYear(date);
      // При смене месяца сбрасываем ограничения – useEffect выше пересоздаст их с учётом автоматических 0.
      setManualConstraints({});
      setTableData([]);
      return;
    }

    setSelectedMonthYear(null);
    setMonth(null);
    setYear(null);
    setManualConstraints({});
    setTableData([]);
  };

  const handleConstraintChange = useCallback(
    (employeeId, dayIndex, value) => {
      setManualConstraints(prev => {
        // Ensure the constraints array exists for the employee; initialise with empty strings for the month length
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const employeeConstraints = prev[employeeId] || new Array(daysInMonth).fill('');

        if (employeeConstraints[dayIndex] === value) {
          return prev;
        }

        const nextEmployeeConstraints = employeeConstraints.slice();
        nextEmployeeConstraints[dayIndex] = value;

        return {
          ...prev,
          [employeeId]: nextEmployeeConstraints,
        };
      });

      setTableData(prevRows => {
        const currentRow = prevRows[dayIndex];
        if (!currentRow) return prevRows;

        const employee = employeesById.get(employeeId);
        const defaultShift = employee ? getDefaultShift(dayIndex + 1, employee) : '';
        const displayValue = value === '' ? defaultShift : value;

        if (currentRow[employeeId] === displayValue) {
          return prevRows;
        }

        const nextRows = prevRows.slice();
        nextRows[dayIndex] = {
          ...currentRow,
          [employeeId]: displayValue,
        };
        return nextRows;
      });
    },
    [month, year, employeesById, getDefaultShift]
  );

  // Generates the schedule for the selected month and department.
  // Fixed filtering: employees store department name in `department`, while
  // `selectedDepartment` holds the department id. Resolve the name first.
  const handleGenerate = async () => {
    if (!selectedMonthYear || !selectedDepartment || !dayShiftRequired || !nightShiftRequired) {
      setError('Wybierz miesiąc, dział oraz wymagania zmian (dzienna i nocna)');
      return;
    }

    const parsedDayShiftRequired = Number(dayShiftRequired);
    const parsedNightShiftRequired = Number(nightShiftRequired);
    const isDayShiftValid =
      Number.isInteger(parsedDayShiftRequired) &&
      parsedDayShiftRequired >= 1 &&
      parsedDayShiftRequired <= 5;
    const isNightShiftValid =
      Number.isInteger(parsedNightShiftRequired) &&
      parsedNightShiftRequired >= 1 &&
      parsedNightShiftRequired <= 5;

    if (!isDayShiftValid || !isNightShiftValid) {
      setError('Wymagana liczba pracowników na zmianie musi być w zakresie 1–5');
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

      const result = await generateSchedule(
        filteredEmployees,
        month,
        year,
        manualConstraints,
        parsedDayShiftRequired,
        parsedNightShiftRequired
      );
      onGenerateSchedule(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Columns: first column – date, then one column per employee.
  const columns = useMemo(() => {
    if (!selectedMonthYear || !selectedDepartment || !departmentName) return [];

    const nextColumns = [
      {
        title: 'Data',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        width: tableScale.dateColWidth,
        render: (_, record) => (
          <DateCell date={record.date} weekday={record.weekday} isWeekend={record.isWeekend} />
        ),
      },
    ];

    filteredEmployees.forEach(emp => {
      const firstName = emp.firstName || '';
      const lastName = emp.lastName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      nextColumns.push({
        title: (
          <div
            className={styles.settingsEmployeeHeaderWrap}
            title={fullName}
            data-employee-id={emp.id}
          >
            <span className={styles.settingsEmployeeHeaderFirstName}>{firstName}</span>
            <span className={styles.settingsEmployeeHeaderLastName}>{lastName}</span>
          </div>
        ),
        dataIndex: emp.id,
        key: emp.id,
        width: tableScale.employeeColWidth,
        align: 'center',
        onHeaderCell: () => ({ className: styles.settingsEmployeeHeaderCell }),
        shouldCellUpdate: (record, prevRecord) => record[emp.id] !== prevRecord[emp.id],
        render: (_, record) => (
          <ConstraintCell
            employeeId={emp.id}
            dayIndex={record.dayIndex}
            value={record[emp.id]}
            isWeekend={record.isWeekend}
            onChange={handleConstraintChange}
          />
        ),
      });
    });

    return nextColumns;
  }, [
    selectedMonthYear,
    selectedDepartment,
    departmentName,
    filteredEmployees,
    tableScale,
    handleConstraintChange,
  ]);

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

          <Select
            placeholder="Dzienna zmiana: liczba osób"
            value={dayShiftRequired}
            onChange={value => setDayShiftRequired(value)}
            style={{ minWidth: 220 }}
            allowClear
          >
            {[1, 2, 3, 4, 5].map(value => (
              <Option key={`day-${value}`} value={value}>
                {value}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Nocna zmiana: liczba osób"
            value={nightShiftRequired}
            onChange={value => setNightShiftRequired(value)}
            style={{ minWidth: 220 }}
            allowClear
          >
            {[1, 2, 3, 4, 5].map(value => (
              <Option key={`night-${value}`} value={value}>
                {value}
              </Option>
            ))}
          </Select>

          <Button
            type="primary"
            onClick={handleGenerate}
            loading={loading}
            disabled={
              !selectedMonthYear || !selectedDepartment || !dayShiftRequired || !nightShiftRequired
            }
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
          <div className={styles.settingsTableViewport}>
            <Table
              className={styles.settingsTable}
              columns={columns}
              dataSource={tableData}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              bordered
              rowKey="key"
            />
          </div>
        )}
      </Space>
    </Card>
  );
};

export default ScheduleSettings;
