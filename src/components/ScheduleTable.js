import React from 'react';
import { Button, Select } from 'antd';
import styles from './ScheduleTable.module.css';

// `onCellChange` is a callback to update a specific cell in the generated schedule.
const ScheduleTable = ({ generatedSchedule, departments, employees, onCellChange }) => {
  if (!generatedSchedule) {
    return (
      <div className={styles.noData}>
        Brak wygenerowanego grafiku. Przejdź do "Ustawienia grafiku", aby go stworzyć.
      </div>
    );
  }

  const { schedule, month, year } = generatedSchedule || {};
  const monthNames = [
    'Styczeń',
    'Luty',
    'Marzec',
    'Kwiecień',
    'Maj',
    'Czerwiec',
    'Lipiec',
    'Sierpień',
    'Wrzesień',
    'Październik',
    'Listopad',
    'Grudzień',
  ];
  const monthName = monthNames[month];

  // Map shift codes to CSS classes for styling. Office shift (9-17) is removed per requirements.
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

  // Return default shift for a given day and employee.
  // According to requirements, "0" (off) is automatically applied only when the employee
  // has the flag `doesNotWorkOnSaturdays` **and** the day is Friday (5) or Saturday (6).
  // In all other cases the cell stays empty unless the user explicitly selects a value.
  const getDefaultShift = (day, employee) => {
    const d = new Date(year, month, day);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (employee.doesNotWorkOnSaturdays && (dow === 5 || dow === 6)) {
      return '0';
    }
    return '';
  };

  const daysInMonth =
    typeof month === 'number' && typeof year === 'number'
      ? new Date(year, month + 1, 0).getDate()
      : 0;
  const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className={styles.printContainer}>
      <div className={styles.noPrint}>
        <Button type="primary" onClick={() => window.print()} style={{ marginBottom: 16 }}>
          Drukuj
        </Button>
      </div>

      {departments.map(dept => {
        const deptEmployees = employees.filter(emp => emp.department === dept.name);
        if (deptEmployees.length === 0) return null;
        return (
          <div key={dept.id} className={styles.departmentSection}>
            <h2 className={styles.tableTitle}>
              Grafik – {dept.name} – {monthName} {year}
            </h2>
            <div className={styles.tableWrapper}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.stickyCol}>Data</th>
                    {deptEmployees.map(emp => (
                      <th key={emp.id}>{emp.lastName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map(day => {
                    const dateObj = new Date(year, month, day);
                    const dow = dateObj.getDay();
                    const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                    const headerLabel = `${day} ${weekdayNames[dow]}`;
                    return (
                      <tr key={day}>
                        <td className={styles.stickyCol}>{headerLabel}</td>
                        {deptEmployees.map(emp => {
                          const currentShift =
                            schedule && schedule[emp.id] ? schedule[emp.id][day - 1] : '';
                          const defaultShift = getDefaultShift(day, emp);
                          const value = currentShift || defaultShift;
                          const handleChange = val => {
                            if (onCellChange) {
                              onCellChange(emp.id, day - 1, val);
                            }
                          };
                          return (
                            <td key={emp.id} className={getShiftClass(value)}>
                              <Select
                                value={value}
                                onChange={handleChange}
                                style={{ width: '100px' }}
                                size="small"
                              >
                                <Select.Option value=""> </Select.Option>
                                <Select.Option value="0">0</Select.Option>
                                <Select.Option value="U">U</Select.Option>
                                <Select.Option value="7-19">07:00–19:00</Select.Option>
                                <Select.Option value="19-7">19:00–07:00</Select.Option>
                              </Select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.boxDay}></span> 07:00–19:00 (Dzienny)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxNight}></span> 19:00–07:00 (Nocny)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxOff}></span> 0 (Wolne)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxVacation}></span> U (Urlop)
              </div>
            </div>
            <div className={styles.pageBreak}></div>
          </div>
        );
      })}
    </div>
  );
};

export default ScheduleTable;
