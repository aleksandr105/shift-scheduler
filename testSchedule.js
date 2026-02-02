/**
 * Simple script to validate schedule generation logic.
 * It runs the generator with a few employees and prints the resulting schedule.
 */
const path = require('path');
const { generateSchedule } = require(path.join(__dirname, 'src', 'utils', 'scheduleGenerator'));

const employees = [
  {
    id: 1,
    firstName: 'Jan',
    lastName: 'Kowalski',
    department: 'Stacja',
    doesNotWorkOnSaturdays: true,
  },
  { id: 2, firstName: 'Anna', lastName: 'Nowak', department: 'Stacja' },
  { id: 3, firstName: 'Piotr', lastName: 'Zielinski', department: 'Stacja' },
  // Additional employee without any restrictions to ensure coverage on Saturdays.
  { id: 4, firstName: 'Kasia', lastName: 'Wójcik', department: 'Stacja' },
];

const month = 0; // January
const year = 2024;

// Manual constraints: employee 2 has a day off on the 1st, employee 3 on the 6th vacation.
const manualConstraints = {
  2: Array(31)
    .fill('')
    .map((_, i) => (i === 0 ? '0' : '')),
  3: Array(31)
    .fill('')
    .map((_, i) => (i === 5 ? 'U' : '')),
};

try {
  const result = generateSchedule(employees, month, year, manualConstraints);
  console.log('Generated schedule for', result.daysInMonth, 'days');
  console.log(JSON.stringify(result.schedule, null, 2));
} catch (e) {
  console.error('Error generating schedule:', e.message);
}
