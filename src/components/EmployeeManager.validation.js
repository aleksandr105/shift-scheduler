import { firstNameMaxLengthValidator, lastNameMaxLengthValidator } from './employeeValidationRules';

describe('EmployeeManager name max-length validators', () => {
  test('firstName: accepts length <= 15', async () => {
    await expect(firstNameMaxLengthValidator(null, 'A'.repeat(15))).resolves.toBeUndefined();
  });

  test('firstName: rejects length > 15', async () => {
    await expect(firstNameMaxLengthValidator(null, 'A'.repeat(16))).rejects.toThrow(
      'Imię może mieć maksymalnie 15 znaków.'
    );
  });

  test('lastName: accepts length <= 15', async () => {
    await expect(lastNameMaxLengthValidator(null, 'B'.repeat(15))).resolves.toBeUndefined();
  });

  test('lastName: rejects length > 15', async () => {
    await expect(lastNameMaxLengthValidator(null, 'B'.repeat(16))).rejects.toThrow(
      'Nazwisko może mieć maksymalnie 15 znaków.'
    );
  });
});
