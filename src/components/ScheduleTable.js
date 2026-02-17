import React from 'react';
import { Button, Select } from 'antd';
import styles from './ScheduleTable.module.css';
import { formatShiftCompact } from '../utils/formatShiftCompact';

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

  // Render exactly one schedule: the last generated one.
  // `generatedSchedule` is generated for a single department, but the UI previously
  // rendered tables for *all* departments, producing an extra empty/old table.
  const resolveDepartmentToRender = () => {
    if (generatedSchedule.departmentName) return generatedSchedule.departmentName;

    // Backward compatibility for older saved schedules that don't have department metadata.
    // Infer the department from employee ids present in `schedule`.
    if (schedule && typeof schedule === 'object') {
      const employeeIdsWithSchedule = new Set(Object.keys(schedule));
      const matchingEmployees = employees.filter(emp =>
        employeeIdsWithSchedule.has(String(emp.id))
      );
      const deptName = matchingEmployees.find(Boolean)?.department;
      if (deptName) return deptName;
    }

    return null;
  };

  const departmentNameToRender = resolveDepartmentToRender();
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

  // Keep compatibility with existing employee flags/data shape.
  const hasSaturdayRestriction = employee => {
    if (!employee) return false;
    if (employee.doesNotWorkOnSaturdays === true) return true;
    if (employee.noSaturdays === true) return true;
    return (
      Array.isArray(employee.constraints) && employee.constraints.includes('Nie pracuje w soboty')
    );
  };

  // Return default shift for a given day and employee.
  // According to requirements, "0" (off) is automatically applied only when the employee
  // has the flag `doesNotWorkOnSaturdays` **and** the day is Friday (5) or Saturday (6).
  // In all other cases the cell stays empty unless the user explicitly selects a value.
  const getDefaultShift = (day, employee) => {
    const d = new Date(year, month, day);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (hasSaturdayRestriction(employee) && (dow === 5 || dow === 6)) {
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

      {(() => {
        const deptName = departmentNameToRender;
        if (!deptName) return null;

        const deptEmployees = employees.filter(emp => emp.department === deptName);
        if (deptEmployees.length === 0) return null;

        return (
          <div className={styles.departmentSection}>
            <h2 className={styles.tableTitle}>
              Grafik – {deptName} – {monthName} {year}
            </h2>
            <div className={styles.tableWrapper}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.stickyCol}>Data</th>
                    {deptEmployees.map(emp => {
                      const firstName = emp.firstName || '';
                      const lastName = emp.lastName || '';
                      const fullName = [firstName, lastName].filter(Boolean).join(' ');
                      return (
                        <th key={emp.id} className={styles.employeeHeaderCell}>
                          <div
                            className={styles.employeeHeaderWrap}
                            title={fullName}
                            data-employee-id={emp.id}
                          >
                            <span className={styles.employeeHeaderFirstName}>{firstName}</span>
                            <span className={styles.employeeHeaderLastName}>{lastName}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dates.map(day => {
                    const dateObj = new Date(year, month, day);
                    const dow = dateObj.getDay();
                    const weekdayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <tr key={day} className={isWeekend ? styles.weekendRow : ''}>
                        <td className={styles.stickyCol}>
                          <div
                            className={
                              isWeekend
                                ? `${styles.settingsDateCell} ${styles.settingsWeekendDateCell}`
                                : styles.settingsDateCell
                            }
                          >
                            <span className={styles.settingsDateNumber}>{day}</span>
                            <span className={styles.settingsDateWeekday}>{weekdayNames[dow]}</span>
                          </div>
                        </td>
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
                          const shiftClass = getShiftClass(value);
                          return (
                            <td
                              key={emp.id}
                              className={`${styles.shiftCell} ${isWeekend ? styles.weekendShiftCell : ''} ${shiftClass}`}
                            >
                              <Select
                                value={value}
                                onChange={handleChange}
                                style={{ width: '100%' }}
                                size="small"
                              >
                                <Select.Option value=""> </Select.Option>
                                <Select.Option value="0">0</Select.Option>
                                <Select.Option value="U">U</Select.Option>
                                <Select.Option value="7-19">
                                  {formatShiftCompact('7-19')}
                                </Select.Option>
                                <Select.Option value="19-7">
                                  {formatShiftCompact('19-7')}
                                </Select.Option>
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
                <span className={styles.boxDay}></span> {formatShiftCompact('7-19')} (Dzienny)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxNight}></span> {formatShiftCompact('19-7')} (Nocny)
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
      })()}
    </div>
  );
};

export default ScheduleTable;
