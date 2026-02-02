import React from 'react';
import { Button } from 'antd';
import styles from './ScheduleTable.module.css';

const ScheduleTable = ({ generatedSchedule, departments, employees }) => {
  if (!generatedSchedule) {
    return (
      <div className={styles.noData}>
        Brak wygenerowanego grafiku. Przejdź do "Ustawienia grafiku", aby go stworzyć.
      </div>
    );
  }

  const { schedule, month, year } = generatedSchedule;
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

  const getShiftClass = shift => {
    switch (shift) {
      case '7-19':
        return styles.shiftDay;
      case '19-7':
        return styles.shiftNight;
      case '9-17':
        return styles.shiftOffice;
      case '0':
        return styles.shiftOff;
      case 'U':
        return styles.shiftVacation;
      default:
        return '';
    }
  };

  const isWeekend = day => {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    return dow === 0 || dow === 6; // Sunday or Saturday
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
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
                      <th key={emp.id} className={styles.rotatedTh}>
                        <div className={styles.rotatedText}>{emp.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map(day => (
                    <tr key={day} className={isWeekend(day) ? styles.weekendRow : ''}>
                      <td className={styles.stickyCol}>{day}</td>
                      {deptEmployees.map(emp => {
                        const shift = schedule[emp.id] ? schedule[emp.id][day - 1] : '0';
                        return (
                          <td key={emp.id} className={getShiftClass(shift)}>
                            {shift}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.boxDay}></span> 7-19 (Dzienny)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxNight}></span> 19-7 (Nocny)
              </div>
              <div className={styles.legendItem}>
                <span className={styles.boxOffice}></span> 9-17 (Biuro)
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
