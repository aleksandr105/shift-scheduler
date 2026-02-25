import React, { useMemo } from 'react';
import styles from './SchedulePrintLayout.module.css';
import { formatShiftCompact } from '../utils/formatShiftCompact';

const weekdayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
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

const PRINT_A4_LANDSCAPE_WIDTH_MM = 297;
const PRINT_PAGE_MARGIN_MM = 4;
const PX_PER_MM = 96 / 25.4;
const PRINT_DATE_COL_WIDTH_PX = 60;
const PRINT_EMPLOYEE_COL_MAX_WIDTH_PX = 75;

const hasSaturdayRestriction = employee => {
  if (!employee) return false;
  if (employee.doesNotWorkOnSaturdays === true) return true;
  if (employee.noSaturdays === true) return true;
  return (
    Array.isArray(employee.constraints) && employee.constraints.includes('Nie pracuje w soboty')
  );
};

const getDefaultShift = (day, employee, month, year) => {
  if (typeof month !== 'number' || typeof year !== 'number') {
    return '';
  }

  const d = new Date(year, month, day);
  const dow = d.getDay();

  if (hasSaturdayRestriction(employee) && (dow === 5 || dow === 6)) {
    return '0';
  }

  return '';
};

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

const SchedulePrintLayout = ({ generatedSchedule, departmentName, employees }) => {
  const { schedule, month, year } = generatedSchedule || {};

  const daysInMonth =
    typeof month === 'number' && typeof year === 'number'
      ? new Date(year, month + 1, 0).getDate()
      : 0;

  const dayRows = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, idx) => {
        const day = idx + 1;
        const dateObj = new Date(year, month, day);
        const dow = dateObj.getDay();
        return {
          day,
          dow,
          isWeekend: dow === 0 || dow === 6,
        };
      }),
    [daysInMonth, month, year]
  );

  if (!departmentName || !Array.isArray(employees) || employees.length === 0 || !daysInMonth) {
    return null;
  }

  const monthName = monthNames[month] || '';
  const printableWidthPx =
    (PRINT_A4_LANDSCAPE_WIDTH_MM - PRINT_PAGE_MARGIN_MM * 2) * PX_PER_MM - PRINT_DATE_COL_WIDTH_PX;
  const printEmployeeColWidthPx = Math.min(
    PRINT_EMPLOYEE_COL_MAX_WIDTH_PX,
    printableWidthPx / employees.length
  );

  return (
    <section
      className={styles.printOnlyLayout}
      aria-label="Wydruk grafiku"
      style={{ '--print-employee-col-width': `${printEmployeeColWidthPx}px` }}
    >
      <h2 className={styles.printTitle}>
        {departmentName} — {monthName} {year}
      </h2>

      <div className={styles.printTableShell}>
        <table className={styles.printTable}>
          <colgroup>
            <col className={styles.printDateCol} />
            {employees.map(employee => (
              <col key={`print-col-${employee.id}`} className={styles.printEmployeeCol} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={styles.printDateHeaderCell}>Data</th>
              {employees.map(employee => {
                const firstName = employee.firstName || '';
                const lastName = employee.lastName || '';
                const fullName = [firstName, lastName].filter(Boolean).join(' ');

                return (
                  <th key={employee.id} className={styles.printEmployeeHeaderCell} title={fullName}>
                    <div className={styles.printEmployeeHeaderWrap}>
                      <span className={styles.printEmployeeHeaderFirstName}>
                        {firstName || '-'}
                      </span>
                      <span className={styles.printEmployeeHeaderLastName}>{lastName || '-'}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dayRows.map(({ day, dow, isWeekend }) => {
              return (
                <tr key={day}>
                  <td
                    className={`${styles.printDateCell} ${isWeekend ? styles.printWeekendDateCell : ''}`}
                  >
                    <span className={styles.printDateCellContent}>
                      <span className={styles.printDateNumber}>{day}</span>
                      <span className={styles.printDateWeekday}>{weekdayNames[dow]}</span>
                    </span>
                  </td>

                  {employees.map(employee => {
                    const dayIndex = day - 1;
                    const persistedValue = schedule?.[employee.id]?.[dayIndex] || '';
                    const value = persistedValue || getDefaultShift(day, employee, month, year);

                    return (
                      <td
                        key={employee.id}
                        className={`${styles.printShiftCell} ${
                          isWeekend ? styles.printWeekendShiftCell : ''
                        } ${getShiftClass(value)}`}
                      >
                        {value ? formatShiftCompact(value) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default SchedulePrintLayout;
