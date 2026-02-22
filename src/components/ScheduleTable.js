import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select } from 'antd';
import styles from './ScheduleTable.module.css';
import { formatShiftCompact } from '../utils/formatShiftCompact';
import SchedulePrintLayout from './SchedulePrintLayout';

// `onCellChange` is a callback to update a specific cell in the generated schedule.
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

const SHIFT_OPTIONS = [
  { value: '', label: ' ' },
  { value: '0', label: '0' },
  { value: 'U', label: 'U' },
  { value: '7-19', label: formatShiftCompact('7-19') },
  { value: '19-7', label: formatShiftCompact('19-7') },
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
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  if (hasSaturdayRestriction(employee) && (dow === 5 || dow === 6)) {
    return '0';
  }

  return '';
};

const buildCellKey = (employeeId, dayIndex) => `${String(employeeId)}:${String(dayIndex)}`;

const ScheduleCell = React.memo(function ScheduleCell({
  employeeId,
  dayIndex,
  value,
  isWeekend,
  isPending,
  onChange,
}) {
  const handleChange = useCallback(
    nextValue => {
      onChange(employeeId, dayIndex, nextValue);
    },
    [employeeId, dayIndex, onChange]
  );

  const shiftClass = getShiftClass(value);

  return (
    <td
      className={`${styles.shiftCell} ${isWeekend ? styles.grafikWeekendShiftCell : ''} ${shiftClass}`}
    >
      <div className={styles.shiftCellInner}>
        <Select
          value={value}
          onChange={handleChange}
          options={SHIFT_OPTIONS}
          size="small"
          className={styles.shiftSelect}
        />
        {isPending ? <span className={styles.cellPendingSpinner} aria-label="Zapisywanie" /> : null}
      </div>
    </td>
  );
});

const ScheduleTable = ({
  generatedSchedule,
  departments,
  employees,
  onCellChange,
  onBeforePrint,
  selectedDepartment,
  onDepartmentChange,
}) => {
  const TABLE_WRAPPER_BOTTOM_GAP_PX = 24;
  const TABLE_WRAPPER_MIN_HEIGHT_PX = 240;

  const [optimisticCells, setOptimisticCells] = useState({});
  const [pendingCells, setPendingCells] = useState({});
  const [tableWrapperHeight, setTableWrapperHeight] = useState(null);
  const pendingTokensRef = useRef({});
  const tableWrapperRef = useRef(null);

  const selectedDepartmentObj = departments.find(
    dept => String(dept.id) === String(selectedDepartment)
  );
  const departmentNameToRender = selectedDepartmentObj?.name || null;

  const scheduleData = generatedSchedule || null;
  const { schedule, month, year, dayShiftRequired, nightShiftRequired } = scheduleData || {};
  const parsedDayShiftRequired = Number(dayShiftRequired);
  const parsedNightShiftRequired = Number(nightShiftRequired);
  const displayDayShiftRequired =
    Number.isInteger(parsedDayShiftRequired) &&
    parsedDayShiftRequired >= 1 &&
    parsedDayShiftRequired <= 5
      ? parsedDayShiftRequired
      : 1;
  const displayNightShiftRequired =
    Number.isInteger(parsedNightShiftRequired) &&
    parsedNightShiftRequired >= 1 &&
    parsedNightShiftRequired <= 5
      ? parsedNightShiftRequired
      : 1;

  const monthName = monthNames[month];

  const daysInMonth =
    typeof month === 'number' && typeof year === 'number'
      ? new Date(year, month + 1, 0).getDate()
      : 0;
  const dates = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const deptEmployees = useMemo(
    () =>
      departmentNameToRender
        ? employees.filter(emp => emp.department === departmentNameToRender)
        : [],
    [departmentNameToRender, employees]
  );

  const hasScheduleForDepartment = Boolean(
    scheduleData &&
    departmentNameToRender &&
    scheduleData.departmentId &&
    String(scheduleData.departmentId) === String(selectedDepartment)
  );
  const hasEmployeesInDepartment = deptEmployees.length > 0;
  const canRenderScheduleTable = hasScheduleForDepartment && hasEmployeesInDepartment;
  const noDataMessage = hasScheduleForDepartment
    ? 'Для этого отдела нет сотрудников.'
    : 'Grafik nie został jeszcze wygenerowany.';

  useEffect(() => {
    setOptimisticCells({});
    setPendingCells({});
    pendingTokensRef.current = {};
  }, [
    selectedDepartment,
    generatedSchedule?.departmentId,
    generatedSchedule?.month,
    generatedSchedule?.year,
  ]);

  useEffect(() => {
    if (!schedule || typeof schedule !== 'object') {
      return;
    }

    setOptimisticCells(prev => {
      let hasChanges = false;
      const nextState = { ...prev };

      Object.keys(prev).forEach(key => {
        const [employeeId, dayIndexStr] = key.split(':');
        const dayIndex = Number(dayIndexStr);
        if (!Number.isInteger(dayIndex) || dayIndex < 0) {
          delete nextState[key];
          hasChanges = true;
          return;
        }

        const persistedValue = schedule?.[employeeId]?.[dayIndex] || '';
        if (persistedValue === prev[key]) {
          delete nextState[key];
          hasChanges = true;
        }
      });

      return hasChanges ? nextState : prev;
    });
  }, [schedule]);

  const handleCellChange = useCallback(
    (employeeId, dayIndex, nextValue) => {
      const cellKey = buildCellKey(employeeId, dayIndex);
      const nextNormalizedValue = nextValue || '';
      const pendingToken = `${Date.now()}-${Math.random()}`;
      const pendingStart = Date.now();
      const minimumPendingMs = 140;

      setOptimisticCells(prev => ({
        ...prev,
        [cellKey]: nextNormalizedValue,
      }));
      setPendingCells(prev => ({
        ...prev,
        [cellKey]: true,
      }));
      pendingTokensRef.current[cellKey] = pendingToken;

      const clearPending = () => {
        if (pendingTokensRef.current[cellKey] !== pendingToken) {
          return;
        }

        setPendingCells(prev => {
          if (!prev[cellKey]) return prev;
          const nextState = { ...prev };
          delete nextState[cellKey];
          return nextState;
        });
      };

      Promise.resolve(onCellChange?.(employeeId, dayIndex, nextValue))
        .catch(() => {
          // no-op: keep behavior identical for data layer, only local cell UI reacts
        })
        .finally(() => {
          const elapsed = Date.now() - pendingStart;
          if (elapsed >= minimumPendingMs) {
            clearPending();
            return;
          }

          window.setTimeout(clearPending, minimumPendingMs - elapsed);
        });
    },
    [onCellChange]
  );

  const dayRows = useMemo(() => {
    return dates.map(day => {
      const dateObj = new Date(year, month, day);
      const dow = dateObj.getDay();
      const isWeekend = dow === 0 || dow === 6;

      return {
        day,
        dow,
        isWeekend,
      };
    });
  }, [dates, month, year]);

  const recalculateTableWrapperHeight = useCallback(() => {
    const wrapperNode = tableWrapperRef.current;
    if (!wrapperNode) {
      return;
    }

    const wrapperRect = wrapperNode.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const availableHeight = Math.floor(
      viewportHeight - wrapperRect.top - TABLE_WRAPPER_BOTTOM_GAP_PX
    );
    const nextHeight = Math.max(TABLE_WRAPPER_MIN_HEIGHT_PX, availableHeight);

    setTableWrapperHeight(prevHeight => {
      if (prevHeight === nextHeight) {
        return prevHeight;
      }
      return nextHeight;
    });
  }, [TABLE_WRAPPER_BOTTOM_GAP_PX, TABLE_WRAPPER_MIN_HEIGHT_PX]);

  useEffect(() => {
    if (!canRenderScheduleTable) {
      return;
    }

    recalculateTableWrapperHeight();

    const handleWindowResize = () => {
      recalculateTableWrapperHeight();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [canRenderScheduleTable, dayRows.length, deptEmployees.length, recalculateTableWrapperHeight]);

  const handlePrint = useCallback(() => {
    onBeforePrint?.();
    window.print();
  }, [onBeforePrint]);

  return (
    <div className={styles.printContainer}>
      <div className={`${styles.noPrint} ${styles.scheduleControls}`}>
        <Select
          placeholder="Wybierz dział"
          value={selectedDepartment}
          onChange={onDepartmentChange}
          style={{ minWidth: 220 }}
          allowClear
        >
          {departments.map(dept => (
            <Select.Option key={dept.id} value={dept.id}>
              {dept.name}
            </Select.Option>
          ))}
        </Select>

        <Button type="primary" onClick={handlePrint} disabled={!canRenderScheduleTable}>
          Drukuj
        </Button>
      </div>

      {!canRenderScheduleTable ? (
        <div className={styles.noData}>{noDataMessage}</div>
      ) : (
        <>
          <div className={`${styles.departmentSection} ${styles.screenOnly}`}>
            <h2 className={styles.tableTitle}>
              Grafik – {departmentNameToRender} – {monthName} {year}
            </h2>
            <div style={{ marginBottom: 12 }}>
              Wymagania zmian: dzienna {displayDayShiftRequired}, nocna {displayNightShiftRequired}
            </div>
            <div className={styles.tableCenter}>
              <div
                ref={tableWrapperRef}
                className={styles.tableWrapper}
                style={tableWrapperHeight ? { height: `${tableWrapperHeight}px` } : undefined}
              >
                <table className={styles.scheduleTable}>
                  <colgroup>
                    <col className={styles.dateCol} />
                    {deptEmployees.map(emp => (
                      <col key={`col-${emp.id}`} className={styles.employeeCol} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`${styles.stickyHeaderCell} ${styles.stickyDateHeaderCell}`}>
                        Data
                      </th>
                      {deptEmployees.map(emp => {
                        const firstName = emp.firstName || '';
                        const lastName = emp.lastName || '';
                        const fullName = [firstName, lastName].filter(Boolean).join(' ');
                        return (
                          <th
                            key={emp.id}
                            className={`${styles.employeeHeaderCell} ${styles.stickyHeaderCell}`}
                          >
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
                    {dayRows.map(({ day, dow, isWeekend }) => {
                      return (
                        <tr key={day} className={isWeekend ? styles.grafikWeekendRow : ''}>
                          <td className={styles.stickyDateCell}>
                            <div
                              className={
                                isWeekend
                                  ? `${styles.grafikDateCell} ${styles.grafikWeekendDateCell}`
                                  : styles.grafikDateCell
                              }
                            >
                              <span className={styles.grafikDateNumber}>{day}</span>
                              <span className={styles.grafikDateWeekday}>{weekdayNames[dow]}</span>
                            </div>
                          </td>
                          {deptEmployees.map(emp => {
                            const dayIndex = day - 1;
                            const cellKey = buildCellKey(emp.id, dayIndex);
                            const optimisticValue = optimisticCells[cellKey];
                            const currentShift =
                              schedule && schedule[emp.id] ? schedule[emp.id][dayIndex] : '';
                            const defaultShift = getDefaultShift(day, emp, month, year);
                            const value =
                              optimisticValue !== undefined
                                ? optimisticValue
                                : currentShift || defaultShift;

                            return (
                              <ScheduleCell
                                key={emp.id}
                                employeeId={emp.id}
                                dayIndex={dayIndex}
                                value={value}
                                isWeekend={isWeekend}
                                isPending={Boolean(pendingCells[cellKey])}
                                onChange={handleCellChange}
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.legendCompact}>
              Zmiany: {formatShiftCompact('7-19')} (dzienna), {formatShiftCompact('19-7')} (nocna),
              0 (wolne), U (urlop)
            </div>
            <div className={styles.pageBreak}></div>
          </div>

          <SchedulePrintLayout
            generatedSchedule={scheduleData}
            departmentName={departmentNameToRender}
            employees={deptEmployees}
          />
        </>
      )}
    </div>
  );
};

export default ScheduleTable;
