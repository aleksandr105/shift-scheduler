export const MAX_NAME_LENGTH = 15;

export const firstNameMaxLengthValidator = (_, value) => {
  if (!value || value.length <= MAX_NAME_LENGTH) {
    return Promise.resolve();
  }

  return Promise.reject(new Error('Imię może mieć maksymalnie 15 znaków.'));
};

export const lastNameMaxLengthValidator = (_, value) => {
  if (!value || value.length <= MAX_NAME_LENGTH) {
    return Promise.resolve();
  }

  return Promise.reject(new Error('Nazwisko może mieć maksymalnie 15 znaków.'));
};
