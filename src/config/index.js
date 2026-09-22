import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} not provided in .env`);
  }

  return value;
}

export function loadConfig() {
  return {
    inputFile: required('INPUT_FILE'),
    outputFile: required('OUTPUT_FILE'),
    minAge: Number(required('MIN_AGE')),
    cityFilter: required('CITY_FILTER'),
  };
}
