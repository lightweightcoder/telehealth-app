import jsSha from 'jssha';

// helper functions ===============
/**
 * converts cents to dollar format
 * @param {number} cents - cents
 */
export function convertCentsToDollars(cents) {
  const centsString = cents.toString();
  const centsExtracted = centsString.slice(-2);
  const dollarsExtracted = centsString.slice(0, -2);

  const formattedString = `${dollarsExtracted}.${centsExtracted}`;

  return formattedString;
}

/**
 * converts a string + myEnvVar to hash
 * @param {string} input - string to be converted
 */
export function getHash(input) {
  // environment variable to use as a secret word for hashing userId cookie
  // environment variable is currently stored in ~/.profile (see RA module 3.6.4)
  const myEnvVar = process.env.MY_ENV_VAR;

  // create new SHA object
  // eslint-disable-next-line new-cap
  const shaObj = new jsSha('SHA-512', 'TEXT', { encoding: 'UTF8' });

  // create an unhashed cookie string based on user ID and myEnVar
  const unhashedString = `${input}-${myEnvVar}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
}
