// import libraries ------------------
import express from 'express';
import methodOverride from 'method-override';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import jsSha from 'jssha';
import multer from 'multer';
import moment from 'moment';
// npm libraries to tie together Multer, and S3 for heroku deployment
import aws from 'aws-sdk';
import multerS3 from 'multer-s3';

// global variables -------------------------------
// environment variable to use as a secret word for hashing userId cookie
// environment variable is currently stored in ~/.profile (see RA module 3.6.4)
const myEnvVar = process.env.MY_ENV_VAR;

// error messages for queries
const queryErrorMessage = 'error 503: service unavilable.<br /> Return to login page <a href="/">here</a>';

// configure the aws-sdk and multerS3 libraries
const s3 = new aws.S3({
  accessKeyId: process.env.ACCESSKEYID,
  secretAccessKey: process.env.SECRETACCESSKEY,
});

// Initialise the DB connection ----------
const { Pool } = pg;

// create separate DB connection configs for production vs non-production environments.
// ensure our server still works on our local machines.
let pgConnectionConfigs;

// test to see if the env var is set. Then we know we are in Heroku
if (process.env.DATABASE_URL) {
  // pg will take in the entire value and use it to connect
  pgConnectionConfigs = {
    connectionString: process.env.DATABASE_URL,
  };
} else {
  // determine how we connect to the local Postgres server
  pgConnectionConfigs = {
    user: process.env.USER, // this user is the computer user that runs this file
    host: 'localhost',
    database: 'telehealth_app',
    port: 5432, // Postgres server always runs on this port by default
  };
}

// initialise the connection configurations
const pool = new Pool(pgConnectionConfigs);

// multer settings ------------------------
// set the name of the upload directory here for multer for heroku deployment
const multerUpload = multer({
  storage: multerS3({
    s3,
    bucket: 'telehealth-app-bucket',
    acl: 'public-read',
    metadata: (request, file, callback) => {
      callback(null, { fieldName: file.fieldname });
    },
    key: (request, file, callback) => {
      callback(null, Date.now().toString());
    },
  }),
});

// Initialise Express ---------------------
// create an express application
const app = express();
// set the port number
const PORT = process.env.PORT || 3004; // for heroku
// const PORT = process.argv[2];
// set the view engine to ejs
app.set('view engine', 'ejs');
// config to accept request form data
app.use(express.urlencoded({ extended: false }));
// override with POST having ?_method=PUT
app.use(methodOverride('_method'));
// config to allow use of public folder
app.use(express.static('public'));
// config to allow use of cookie parser
app.use(cookieParser());
// add the configs so that Express.js will serve files from the uploads directory
app.use(express.static('uploads'));

// global helper functions ===============
/**
 * converts cents to dollar format
 * @param {number} cents - cents
 */
const convertCentsToDollars = (cents) => {
  const centsString = cents.toString();
  const centsExtracted = centsString.slice(-2);
  const dollarsExtracted = centsString.slice(0, -2);

  const formattedString = `${dollarsExtracted}.${centsExtracted}`;

  return formattedString;
};

/**
 * converts a string + myEnvVar to hash
 * @param {string} input - string to be converted
 */
const getHash = (input) => {
  // create new SHA object
  // eslint-disable-next-line new-cap
  const shaObj = new jsSha('SHA-512', 'TEXT', { encoding: 'UTF8' });

  // create an unhashed cookie string based on user ID and myEnVar
  const unhashedString = `${input}-${myEnvVar}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
};

/**
 * set the cookie checking middleware callback
 * and supply logged-in user data to subsequent middleware
 * @param {object} request - route request
 * @param {object} request - route response
 * @param {function} next - next middleware function of app.
 */
const checkAuth = (request, response, next) => {
  // set the default value
  request.middlewareLoggedIn = false;

  // check to see if the cookies you need exists
  if (request.cookies.loggedInHash && request.cookies.userId) {
    // get the hashed value that should be inside the cookie
    const hash = getHash(request.cookies.userId);

    // test the value of the cookie
    if (request.cookies.loggedInHash === hash) {
      // verified that the userId and loggedInHash were set by the server, not someone else
      request.middlewareLoggedIn = true;

      // look for this user in the database
      const values = [request.cookies.userId];

      // try to get the user
      pool.query('SELECT * FROM users WHERE id=$1', values, (error, result) => {
        if (error || result.rows.length < 1) {
          console.log('Error executing query', error.stack);
          response.status(503).send(queryErrorMessage);
          return;
        }

        const user = result.rows[0];

        // eslint-disable-next-line max-len
        // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
        if (user.photo === null) {
          user.photo = '/profile-photos/anonymous-person.jpg';
        } else {
          // user has a photo
          const searchForHttpString = user.photo.search('http');

          // check if the photo url is from AWS S3 or a test photo in heroku repo
          if (searchForHttpString === -1) {
            // if the photo is not a photo uploaded on AWS S3 (i.e. it is a test photo in
            // the heroku repo), change the url so it will render correctly
            user.photo = `/profile-photos/${user.photo}`;
          }
        }

        // set the user as a key in the request object so that it's accessible in the route
        request.user = user;

        console.log('checked Auth!');
        next();
      });

      // make sure we don't get down to the next() below if cookie testing was successful
      return;
    }

    // if the testing of the cookie value failed, redirect to login page
    response.redirect('/');
    console.log('testing of the cookie value failed');
  }

  // if there is no loggedInHash & userId cookie, redirect to login page
  response.redirect('/');
  console.log('no loggedInHash & userId cookies found');
};

// routes ==============================

// start of functionality for user to login --------
// render the login form
app.get('/', (request, response) => {
  console.log('request to render a login form came in');

  // set validation object to prevent ejs from getting errors
  const templateData = {};
  templateData.validation = {};

  response.render('login', templateData);
});

// accept the login form request
app.post('/', (request, response) => {
  console.log('post request to login came in');

  // set object to store messages for invalid email or password input fields
  const templateData = {};

  const values = [request.body.email];

  pool.query('SELECT * from users WHERE email=$1', values, (error, result) => {
    if (error) {
      console.log('Error executing query', error.stack);
      response.status(503).send(queryErrorMessage);
      return;
    }

    console.log('select user query done!');

    const user = result.rows[0];

    // verify input email and password with those in database
    if (result.rows.length !== 0) {
      if (user.password === request.body.password) {
        console.log('email and password matched!');

        // generate a loggedInHash for user id ------
        // create new SHA object
        // eslint-disable-next-line new-cap
        const shaObj = new jsSha('SHA-512', 'TEXT', { encoding: 'UTF8' });
        // create an unhashed cookie string based on user ID and salt
        const unhashedCookieString = `${user.id}-${myEnvVar}`;
        // generate a hashed cookie string using SHA object
        shaObj.update(unhashedCookieString);
        const hashedCookieString = shaObj.getHash('HEX');

        // set the loggedInHash and userId cookies in the response
        response.cookie('loggedInHash', hashedCookieString);
        response.cookie('userId', user.id);

        // if user is a doctor, send a cookie to keep track of what mode the doctor is in
        // the doctor starts in patient mode. This cookie will change the color of the navbar
        // depending on the mode doctor is in. Give cookie any mode because it will always
        // change to patient mode after redirecting to /patient-dashboard
        if (user.is_doctor === true) {
          response.cookie('mode', 'patient');
        }

        // redirect user to patient dashboard
        response.redirect('/patient-dashboard');
      } else {
      // password didn't match
        console.log('password did not match');

        // add message to inform user of invalid email/password
        templateData.invalidMessage = 'Sorry you have keyed in an incorrect email/password';

        // redirect to login page
        response.render('login', templateData);
      }
    }
    else {
      // email didn't match
      console.log('email did not match');

      // add message to inform user of invalid email/password
      templateData.invalidMessage = 'Sorry you have keyed in an incorrect email/password';

      // redirect to login page
      response.render('login', templateData);
    }
  });
});
// end of functionality for user to login --------

// start of functionality for user to signup --------
// render the signup form
app.get('/signup', (request, response) => {
  console.log('request to render signup form came in');

  const { identity } = request.query;

  if (identity === 'patient') {
    // render a patient sign up form
    response.render('patient-signup');
  } else if (identity === 'doctor') {
    // query to get list of clinics
    const clinicsQuery = 'SELECT * FROM clinics';

    // execute query
    pool.query(clinicsQuery, (error, result) => {
      if (error) {
        console.log('Error executing query', error.stack);
        response.status(503).send(queryErrorMessage);
      }

      // store clinics' data
      const clinics = result.rows;

      const templateData = {};
      templateData.clinics = clinics;

      // render a doctor sign up form
      response.render('doctor-signup', templateData);
    });
  }
});

// accept request to signup
app.post('/signup', (request, response) => {
  console.log('request to signup came in!');

  // check if user is a doctor or patient by checking if there is a 'bankNumber' input field
  let isDoctor = false;
  if ('bankNumber' in request.body) {
    isDoctor = true;
  }

  // array to store messages for invalid form inputs
  const invalidMessages = [];

  // object that stores data to be inserted into ejs file
  const templateData = {};
  templateData.invalidMessages = invalidMessages;

  // details of person signing up
  const {
    name, email, password, allergies, creditCardNumber, creditCardExpiry, cvv,
  } = request.body;

  // variables to store additionl details for doctors
  let clinicIds = '';
  let bankNumber = '';
  let consultationPrice = '';
  let doctorRegistrationNumber = '';

  // queries and callbacks---------------------------------------
  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // for checking if email of person signing up is taken ----
  // query to check if email of person signing up is taken
  const isExistingUserQuery = 'SELECT * FROM users WHERE email=$1';

  // values for isExistingUserQuery
  const isExistingUserQueryValues = [`${email}`];

  // callback function for isExistingUserQuery
  const whenIsExistingUserQueryDone = (result) => {
    console.table(result.rows);

    if (isDoctor === false) {
      // check if the email already belongs to an existing user
      if (result.rows.length > 0) {
        // patient signup email already belongs to an existing user

        // add message to inform user that email has been taken
        invalidMessages.push('The email you entered already exists.');

        // render the patient signup form again with invalid form input messages
        response.render('patient-signup', templateData);
      } else {
        // patient signup email does not belong to an existing user
        // so insert the new user details into database
        // and redirect to route that renders patient dashboard (app.get('/patient-dashboard')

        // query to insert new patient details
        const insertPatientQuery = 'INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

        const insertPatientQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`];

        // callback for insertPatientQuery
        const whenInsertPatientQueryDone = (insertResult) => {
          console.log('insert patient query done');
          console.table(insertResult.rows);

          const user = insertResult.rows[0];

          // generate a loggedInHash for user id ------
          // create new SHA object
          // eslint-disable-next-line new-cap
          const shaObj = new jsSha('SHA-512', 'TEXT', { encoding: 'UTF8' });
          // create an unhashed cookie string based on user ID and salt
          const unhashedCookieString = `${user.id}-${myEnvVar}`;
          // generate a hashed cookie string using SHA object
          shaObj.update(unhashedCookieString);
          const hashedCookieString = shaObj.getHash('HEX');

          // set the loggedInHash and userId cookies in the response
          response.cookie('loggedInHash', hashedCookieString);
          response.cookie('userId', user.id);

          // redirect to route that renders patient dashboard
          response.redirect('/patient-dashboard');
        };

        pool
          .query(insertPatientQuery, insertPatientQueryValues)
          .then(whenInsertPatientQueryDone)
          .catch(whenQueryError);
      }
    } else {
      // validation logic for doctor signup
      // get additional details of the doctor and check if doctor selected a clinic(s)
      if ('clinicIds' in request.body) {
        // if doctor selected at least 1 clinic, add the additional details
        clinicIds = request.body.clinicIds;
        bankNumber = request.body.bankNumber;
        consultationPrice = request.body.consultationPrice;
        doctorRegistrationNumber = request.body.doctorRegistrationNumber;
      } else {
        // else doctor did not select any clinics so give an invalid input message
        invalidMessages.push('1 or more clinics need to be selected');
      }

      // check if the email already belongs to an existing user
      if (result.rows.length > 0) {
        // patient signup email already belongs to an existing user
        // add message to inform user that email has been taken
        invalidMessages.push('The email you entered already exists.');
      }

      if (result.rows.length > 0 || !('clinicIds' in request.body)) {
        // email already belongs to an existing user and doctor did not select any clinics

        // query for a list of clinics needed to render the doctor signup form again
        const clinicsQuery = 'SELECT * FROM clinics';

        // callback function for clinicsQuery
        const whenClinicsQueryDone = (selectResult) => {
          console.log('clinics query done!');

          // store clinics data for ejs file
          templateData.clinics = selectResult.rows;

          // render the doctor signup form again with invalid form input messages
          response.render('doctor-signup', templateData);
        };

        pool
          .query(clinicsQuery)
          .then(whenClinicsQueryDone)
          .catch(whenQueryError);
      } else {
        // doctor signup email does not belong to an existing user
        // so insert the new user details into database
        // and redirect to route that renders doctor dashboard (app.get('/doctor-dashboard')

        // variable to store the created doctor's id when insertDoctorQuery is done
        let doctorId = '';

        // query to insert new doctor details
        const insertDoctorQuery = 'INSERT INTO users (name, email, password, is_doctor, allergies, credit_card_number, credit_card_expiry, credit_card_cvv, bank_number, consultation_price_cents, doctor_registration_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *';

        const insertDoctorQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`, `${bankNumber}`, `${consultationPrice}`, `${doctorRegistrationNumber}`];

        // callback for insertDoctorQuery
        const whenInsertDoctorQueryDone = (insertResult) => {
          console.log('insert doctor query done');
          console.table(insertResult.rows);

          const user = insertResult.rows[0];

          // variable to store the created doctor's id
          doctorId = user.id;

          // insert all the clinics' ids into clinic_doctors relational table -----
          if (typeof (clinicIds) === 'string') {
            // only 1 clinic was selected so change it into an array
            const clinicId = clinicIds;
            clinicIds = [clinicId];
          }

          // create and execute the insert query for each clinic selected
          clinicIds.forEach((id) => {
            const insertClinicAndDoctorIdsQuery = 'INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES ($1, $2)';

            const insertClinicAndDoctorIdsQueryValues = [`${id}`, `${doctorId}`];

            pool
              .query(insertClinicAndDoctorIdsQuery, insertClinicAndDoctorIdsQueryValues)
              .catch(whenQueryError);
          });
        };

        // callback for insertClinicAndDoctorIdsQuery
        const whenInsertClinicAndDoctorIdsQueryDone = () => {
          console.log('insertClinicAndDoctorIdsQuery done!');
          // generate a loggedInHash for user id ------
          // create new SHA object
          // eslint-disable-next-line new-cap
          const shaObj = new jsSha('SHA-512', 'TEXT', { encoding: 'UTF8' });
          // create an unhashed cookie string based on user ID and salt
          const unhashedCookieString = `${doctorId}-${myEnvVar}`;
          // generate a hashed cookie string using SHA object
          shaObj.update(unhashedCookieString);
          const hashedCookieString = shaObj.getHash('HEX');

          // set the loggedInHash and userId cookies in the response
          response.cookie('loggedInHash', hashedCookieString);
          response.cookie('userId', doctorId);

          // Give doctor a cookie to keep track of the mode he/she is in
          response.cookie('mode', 'doctor');

          // redirect to route that renders doctor dashboard for the doctor
          response.redirect('/doctor-dashboard');
        };

        pool
          .query(insertDoctorQuery, insertDoctorQueryValues)
          .then(whenInsertDoctorQueryDone)
          .then(whenInsertClinicAndDoctorIdsQueryDone)
          .catch(whenQueryError);
      }
    }
  };

  // execute the queries for patient and doctor signup
  pool
    .query(isExistingUserQuery, isExistingUserQueryValues)
    .then(whenIsExistingUserQueryDone)
    .catch(whenQueryError);
});
// end of functionality for user to signup --------

// render a patient dashboard
app.get('/patient-dashboard', checkAuth, (request, response) => {
  console.log('request to render patient dashboard came in');

  const templateData = {};

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  const consultationsQuery = `SELECT consultations.id, consultations.status, consultations.date, users.name AS doctor_name, users.photo AS doctor_photo FROM consultations INNER JOIN users ON consultations.doctor_id=users.id WHERE patient_id=${request.user.id}`;

  // callback function for consultationsQuery for the patient
  const whenConsultationsQueryDone = (result) => {
    console.table(result.rows);

    // store the consultations data
    templateData.consultations = result.rows;

    // format the date of the consultation and photo of the doctor (if no photo)
    templateData.consultations.forEach((consultation) => {
      // if doctor's photo field in database is empty,
      // give it an anonymous photo for display
      if (consultation.doctor_photo === null) {
        consultation.doctor_photo = 'anonymous-person.jpg';
      }

      // convert the consultation date to the display format (DD/MM/YYYY)
      const rawDate = consultation.date;
      const formattedDate = moment(rawDate).format('DD-MMM-YYYY, h:mm a');
      consultation.date = formattedDate;
    });

    // if user is doctor and user was in doctor mode, change to patient mode (in cookie)
    // else user is patient so no need to set a mode
    if (request.cookies.mode) {
      if (request.cookies.mode === 'doctor') {
        // doctor was in doctor mode so change to patient mode
        response.cookie('mode', 'patient');
      }
    }

    // set the navbar color for patient dashboard
    templateData.navbarColor = '#e3f2fd';

    // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
    if (request.user.photo === null) {
      templateData.user.photo = 'anonymous-person.jpg';
    }

    response.render('patient-dashboard', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the queries
  pool
    .query(consultationsQuery)
    .then(whenConsultationsQueryDone)
    .catch(whenQueryError);
});

// render a doctor dashboard
app.get('/doctor-dashboard', checkAuth, (request, response) => {
  console.log('request to render doctor dashboard came in');

  const templateData = {};

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  const consultationsQuery = `SELECT consultations.id, consultations.status, consultations.date, users.name AS patient_name, users.photo AS patient_photo FROM consultations INNER JOIN users ON consultations.patient_id=users.id WHERE doctor_id=${request.user.id}`;

  // callback function for consultationsQuery for the doctor
  const whenConsultationsQueryDone = (result) => {
    console.table(result.rows);

    // store the consultations data
    templateData.consultations = result.rows;

    // format the date of the consultation and photo of the patient (if no photo)
    templateData.consultations.forEach((consultation) => {
      // if patient's photo field in database is empty,
      // give it an anonymous photo for display
      if (consultation.patient_photo === null) {
        consultation.patient_photo = 'anonymous-person.jpg';
      }

      // convert the consultation date to the display format (DD/MM/YYYY)
      const rawDate = consultation.date;
      const formattedDate = moment(rawDate).format('DD-MMM-YYYY, h:mm a');
      consultation.date = formattedDate;
    });

    // if doctor was in patient mode, change to doctor mode (in cookie)
    if (request.cookies.mode === 'patient') {
      // doctor was in doctor mode so change to patient mode
      response.cookie('mode', 'doctor');
    }

    // set the navbar color for doctor dashboard
    templateData.navbarColor = '#FBE7C6';

    // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
    if (request.user.photo === null) {
      templateData.user.photo = 'anonymous-person.jpg';
    }

    response.render('doctor-dashboard', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the queries
  pool
    .query(consultationsQuery)
    .then(whenConsultationsQueryDone)
    .catch(whenQueryError);
});

// render a list of clinics
app.get('/clinics', checkAuth, (request, response) => {
  console.log('request to render a list of clinics came in');

  const templateData = {};

  // for use in header.ejs
  templateData.navbarColor = '#e3f2fd';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  const clinicsQuery = 'SELECT * FROM clinics';

  // callback function for clinicsQuery
  const whenClinicsQueryDone = (selectError, selectResult) => {
    if (selectError) {
      console.log('Error executing query', selectError.stack);
      response.status(503).send(queryErrorMessage);
      return;
    }

    // store clinics data for ejs
    templateData.clinics = selectResult.rows;

    response.render('clinics', templateData);
  };

  // execute the sql query to show a list of clinics
  pool.query(clinicsQuery, whenClinicsQueryDone);
});

// render a list of doctors of a clnic
app.get('/clinics/:id', checkAuth, (request, response) => {
  console.log('request to render a list of doctors came in');

  const templateData = {};

  // for use in header.ejs
  templateData.navbarColor = '#e3f2fd';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  const clinicId = request.params.id;

  const doctorsQuery = `SELECT users.id, users.name, users.photo FROM users INNER JOIN clinic_doctors ON users.id=clinic_doctors.doctor_id WHERE clinic_doctors.clinic_id=${clinicId}`;

  const clinicQuery = `SELECT * FROM clinics WHERE id=${clinicId}`;

  // callback function for doctorsQuery
  const whenDoctorsQueryDone = (result) => {
    console.table(result.rows);

    // store the doctors' data
    templateData.doctors = result.rows;

    // if doctor's photo field in database is empty,
    // give it an anonymous photo for display
    templateData.doctors.forEach((doctor) => {
      if (doctor.photo === null) {
        doctor.photo = 'anonymous-person.jpg';
      }
    });

    return pool.query(clinicQuery);
  };

  // callback function for clinicQuery
  const whenClinicQueryDone = (result) => {
    console.table(result.rows);

    // store the clinic's data
    const clinic = result.rows[0];
    templateData.clinic = clinic;

    // render clinic.ejs
    response.render('clinic', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the sql query to show a list of clinics
  pool
    .query(doctorsQuery)
    .then(whenDoctorsQueryDone)
    .then(whenClinicQueryDone)
    .catch(whenQueryError);
});

// start of functionality for patient to create a new consultation --------
// render a form to create a new consultation
app.get('/new-consultation/:clinicName/:doctorId', checkAuth, (request, response) => {
  console.log('request to render a new consultation form came in');

  const templateData = {};

  // for use in header.ejs
  templateData.navbarColor = '#e3f2fd';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  // store the clinic name to display in a consultation
  templateData.clinicName = request.params.clinicName;

  const { doctorId } = request.params; // doctorId is a number in string data type
  const patientId = request.user.id;

  const patientAndDoctorQuery = `SELECT id, name, is_doctor FROM users WHERE id IN (${doctorId}, ${patientId})`;

  // callback function for patientAndDoctorQuery
  const whenPatientAndDoctorQueryDone = (result) => {
    console.table(result.rows);

    // store the patient's and doctor's data
    result.rows.forEach((user) => {
      if (user.id === Number(doctorId)) {
        templateData.doctor = user;
      } else {
        templateData.patient = user;
      }
    });

    response.render('new-consultation', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the sql query to show a list of clinics
  pool
    .query(patientAndDoctorQuery)
    .then(whenPatientAndDoctorQueryDone)
    .catch(whenQueryError);
});

// accept the form request to create a new consultation
app.post('/consultation', checkAuth, (request, response) => {
  console.log('post request to create a new consultation came in');

  // to store the clinic's id
  let clinicId = '';

  const { clinicName } = request.body;
  console.log(clinicName);
  const { doctorId } = request.body;

  // set the query to find the clinic's id
  const clinicIdQuery = `SELECT id FROM clinics WHERE name='${clinicName}'`;

  // callback function for clinicIdQuery
  const whenclinicIdQueryDone = (result) => {
    console.table(result.rows);

    clinicId = result.rows[0].id;

    // set the query to find the doctor's consultation price
    const consultationPriceQuery = `SELECT consultation_price_cents FROM users WHERE id=${doctorId}`;

    return pool.query(consultationPriceQuery);
  };

  // callback function for consultationPriceQuery
  const whenConsultationPriceQueryDone = (result) => {
    const consultationPriceCents = result.rows[0].consultation_price_cents;

    // eslint-disable-next-line max-len
    const insertConsultationQueryValues = [request.body.patientId, doctorId, clinicId, request.body.dateTime, 'requested', request.body.description, consultationPriceCents, consultationPriceCents, 0];

    const insertConsultationQuery = 'INSERT INTO consultations (patient_id, doctor_id, clinic_id, date, status, description, consultation_price_cents, total_price_cents, medicines_price_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';

    return pool.query(insertConsultationQuery, insertConsultationQueryValues);
  };

  // callback function for insertConsultationQuery
  const whenInsertConsultationQueryDone = (result) => {
    const consultationId = result.rows[0].id;

    // redirect to the route that renders a consultation
    response.redirect(`/consultation/${consultationId}`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(clinicIdQuery)
    .then(whenclinicIdQueryDone)
    .then(whenConsultationPriceQueryDone)
    .then(whenInsertConsultationQueryDone)
    .catch(whenQueryError);
});
// end of functionality for patient to create a new consultation --------

// render a consultation
app.get('/consultation/:id', checkAuth, (request, response) => {
  console.log('request to render a consultation came in');

  const consultationId = request.params.id;

  const templateData = {};

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // set messages to null so ejs will not return error if there are no messages for the consultation
  templateData.messages = null;
  // set formInputValue to null so ejs will not return err if templateData.formInputValue is unused
  templateData.formInputValue = null;

  const consultationQuery = `SELECT * FROM consultations WHERE id=${consultationId}`;

  // callback function for consultationQuery
  const whenConsultationQueryDone = (result) => {
    console.table(result.rows);

    const consultation = result.rows[0];

    templateData.consultation = consultation;

    // format the date output ----------
    const rawDate = result.rows[0].date;
    const formattedDate = moment(rawDate).format('dddd, MMMM Do YYYY, h:mm a');
    templateData.consultation.date = formattedDate;

    // format the consultation prices
    const consultationPrice = convertCentsToDollars(consultation.consultation_price_cents);
    const medicinesPrice = convertCentsToDollars(consultation.medicines_price_cents);
    const totalPrice = convertCentsToDollars(consultation.total_price_cents);

    templateData.consultation.consultationPrice = consultationPrice;
    templateData.consultation.medicinesPrice = medicinesPrice;
    templateData.consultation.totalPrice = totalPrice;

    const doctorId = consultation.doctor_id;
    const patientId = consultation.patient_id;

    // set the buttons to render in show-consultation.ejs depending if user is a doctor or patient
    // and status of the consultation
    // formInputValue is the status of the consult that will be updated in the database
    // buttonInputValue is the value to display in the button --------------------------------
    if (request.user.id === patientId) {
      if (consultation.status === 'requested' || consultation.status === 'upcoming') {
        templateData.formInputValue = 'cancelled';
        templateData.buttonInputValue = 'cancel consult';
      }
    } else if (request.user.id === doctorId) {
      if (consultation.status === 'requested') {
        templateData.formInputValue = 'upcoming';
        templateData.buttonInputValue = 'accept consult';
      } else if (consultation.status === 'upcoming') {
        templateData.formInputValue = 'ongoing';
        templateData.buttonInputValue = 'start consult';
      }
    }

    // set next query for patient and doctor names ------
    const patientAndDoctorNamesQuery = `SELECT id, name, is_doctor FROM users WHERE id IN (${doctorId}, ${patientId})`;

    return pool.query(patientAndDoctorNamesQuery);
  };

  // callback for patientAndDoctorNamesQuery
  const whenPatientAndDoctorNamesQueryDone = (result) => {
    console.table(result.rows);

    // store the patient's and doctor's names
    result.rows.forEach((user) => {
      if (user.id === Number(templateData.consultation.doctor_id)) {
        templateData.consultation.doctorName = user.name;
      } else {
        templateData.consultation.patientName = user.name;
      }
    });

    // get the clinic id from whenConsultationQueryDone
    const clinicId = templateData.consultation.clinic_id;

    // set next query for clinic data
    const clinicQuery = `SELECT * FROM clinics WHERE id=${clinicId}`;

    return pool.query(clinicQuery);
  };

  // callback for clinicNameQuery
  const whenclinicQueryDone = (result) => {
    console.table(result.rows);

    // store the clinic data
    const clinic = result.rows[0];
    templateData.consultation.clinic = clinic;

    // set next query for prescriptions and corresponding medicine names ------
    const prescriptionsAndMedicineNamesQuery = `SELECT prescriptions.quantity, prescriptions.instruction, medications.name AS medicinename FROM prescriptions INNER JOIN medications ON prescriptions.medicine_id=medications.id WHERE consultation_id=${consultationId} ORDER BY prescriptions.id ASC`;

    return pool.query(prescriptionsAndMedicineNamesQuery);
  };

  // callback for prescriptionsAndMedicineNamesQuery
  const whenPrescriptionsAndMedicineNamesQueryDone = (result) => {
    console.table(result.rows);

    if (result.rows.length > 0) {
      // store the prescriptions and medicine names
      templateData.consultation.prescriptions = result.rows;
    }

    // set next query for messages ------
    const messagesQuery = `SELECT messages.id, messages.description, messages.created_at, users.name FROM messages INNER JOIN users ON messages.sender_id=users.id WHERE messages.consultation_id=${consultationId} ORDER BY messages.created_at ASC`;

    return pool.query(messagesQuery);
  };

  // callback for messagesQuery
  const whenMessagesQueryDone = (result) => {
    console.table(result.rows);

    if (result.rows.length > 0) {
      // format the message date
      result.rows.forEach((message) => {
        const rawDate = message.created_at;
        const formattedDate = moment(rawDate).format('MMM DD, YYYY - h:mma');
        message.created_at = formattedDate;
      });

      // store the patient's and doctor's messages
      templateData.messages = result.rows;
    }

    // set corressponding navbar color according to user's identity and mode
    if (request.cookies.mode && request.cookies.mode === 'doctor') {
      // doctor is in doctor mode
      // set the navbar color for doctor mode
      templateData.navbarColor = '#FBE7C6';
    } else {
      // user is in patient mode / patient is not a doctor
      // set the navbar color
      templateData.navbarColor = '#e3f2fd';
    }

    // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
    if (request.user.photo === null) {
      templateData.user.photo = 'anonymous-person.jpg';
    }

    response.render('show-consultation', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(consultationQuery)
    .then(whenConsultationQueryDone)
    .then(whenPatientAndDoctorNamesQueryDone)
    .then(whenclinicQueryDone)
    .then(whenPrescriptionsAndMedicineNamesQueryDone)
    .then(whenMessagesQueryDone)
    .catch(whenQueryError);
});

// accept a request to update consultation status to upcoming, ongoing, cancelled or ended
app.put('/consultation/:id', checkAuth, (request, response) => {
  console.log('request to update status of a consultation came in');

  const consultationId = request.params.id;

  const { updatedStatus } = request.body;

  const updateConsultationQuery = `UPDATE consultations SET status='${updatedStatus}' WHERE id=${consultationId} RETURNING *`;

  // callback for updateConsultationQuery
  const whenUpdateConsultationQueryDone = (result) => {
    console.table(result.rows);

    // redirect user to a route depending on the updated status of the consultation
    if (updatedStatus === 'upcoming' || updatedStatus === 'cancelled' || updatedStatus === 'ended') {
      response.redirect(`/consultation/${consultationId}`);
    } else if (updatedStatus === 'ongoing') {
      response.redirect(`/consultation/${consultationId}/edit`);
    } else {
      console.log('error occurred when updating status');
      response.status(503).send(queryErrorMessage);
    }
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(updateConsultationQuery)
    .then(whenUpdateConsultationQueryDone)
    .catch(whenQueryError);
});

// accept a request from user to post a message
app.post('/consultation/:id', checkAuth, (request, response) => {
  console.log('request from patient to post a message came in');

  const senderId = Number(request.cookies.userId);
  const consultationId = request.params.id;
  const { message } = request.body;

  const insertMessageQueryValues = [senderId, consultationId, `${message}`];

  // query to insert message into database
  const insertMessageQuery = 'INSERT INTO messages (sender_id, consultation_id, description) VALUES ($1, $2, $3) RETURNING *';

  // callback for insertMessageQuery
  const whenInsertMessageQueryDone = (result) => {
    console.table(result.rows);

    // query to find all messages of this consultation that were sent by this sender
    const selectSenderIdentityQuery = `SELECT consultations.patient_id, consultations.doctor_id FROM consultations INNER JOIN messages ON consultations.id=messages.consultation_id WHERE messages.sender_id=${senderId}`;

    return pool.query(selectSenderIdentityQuery);
  };

  // callback for selectSenderIdentityQuery
  const whenSelectSenderIdentityQueryDone = (result) => {
    console.table(result.rows);

    // find out if message sender is patient or doctor then redirect to correct route
    if (senderId === result.rows[0].patient_id) {
      response.redirect(`/consultation/${consultationId}`);
    } else if (senderId === result.rows[0].doctor_id) {
      response.redirect(`/consultation/${consultationId}/edit`);
    } else {
      console.log('error occurred when updating status');
      response.status(503).send(queryErrorMessage);
    }
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(insertMessageQuery, insertMessageQueryValues)
    .then(whenInsertMessageQueryDone)
    .then(whenSelectSenderIdentityQueryDone)
    .catch(whenQueryError);
});

// render an editable consultation form for the doctor
app.get('/consultation/:id/edit', checkAuth, (request, response) => {
  console.log('request to render a editable consultation form came in');

  const consultationId = request.params.id;

  const templateData = {};

  // set the navbar color for doctor mode
  templateData.navbarColor = '#FBE7C6';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  // set messages to null so ejs will not return error if there are no messages for the consultation
  templateData.messages = null;

  const consultationQuery = `SELECT * FROM consultations WHERE id=${consultationId}`;

  // callback function for consultationQuery
  const whenConsultationQueryDone = (result) => {
    console.table(result.rows);

    const consultation = result.rows[0];

    templateData.consultation = consultation;

    // format the date output ----------
    const rawDate = result.rows[0].date;
    const formattedDate = moment(rawDate).format('dddd, MMMM Do YYYY, h:mm a');
    templateData.consultation.date = formattedDate;

    // format the consultation prices
    const consultationPrice = convertCentsToDollars(consultation.consultation_price_cents);
    const medicinesPrice = convertCentsToDollars(consultation.medicines_price_cents);
    const totalPrice = convertCentsToDollars(consultation.total_price_cents);

    templateData.consultation.consultationPrice = consultationPrice;
    templateData.consultation.medicinesPrice = medicinesPrice;
    templateData.consultation.totalPrice = totalPrice;

    const doctorId = consultation.doctor_id;
    const patientId = consultation.patient_id;

    // set next query for patient and doctor names ------
    const patientAndDoctorNamesQuery = `SELECT id, name, is_doctor FROM users WHERE id IN (${doctorId}, ${patientId})`;

    return pool.query(patientAndDoctorNamesQuery);
  };

  // callback for patientAndDoctorNamesQuery
  const whenPatientAndDoctorNamesQueryDone = (result) => {
    console.table(result.rows);

    // store the patient's and doctor's names
    result.rows.forEach((user) => {
      if (user.id === Number(templateData.consultation.doctor_id)) {
        templateData.consultation.doctorName = user.name;
      } else {
        templateData.consultation.patientName = user.name;
      }
    });

    // get the clinic id from whenConsultationQueryDone
    const clinicId = templateData.consultation.clinic_id;

    // set next query for clinic data
    const clinicQuery = `SELECT * FROM clinics WHERE id=${clinicId}`;

    return pool.query(clinicQuery);
  };

  // callback for clinicNameQuery
  const whenclinicQueryDone = (result) => {
    console.table(result.rows);

    // store the clinic data
    const clinic = result.rows[0];
    templateData.consultation.clinic = clinic;

    // set next query for messages ------
    const messagesQuery = `SELECT messages.id, messages.description, messages.created_at, users.name FROM messages INNER JOIN users ON messages.sender_id=users.id WHERE messages.consultation_id=${consultationId} ORDER BY messages.created_at ASC`;

    return pool.query(messagesQuery);
  };

  // callback for messagesQuery
  const whenMessagesQueryDone = (result) => {
    console.table(result.rows);

    if (result.rows.length > 0) {
      // format the message date
      result.rows.forEach((message) => {
        const rawDate = message.created_at;
        const formattedDate = moment(rawDate).format('MMM DD, YYYY - h:mma');
        message.created_at = formattedDate;
      });

      // store the patient's and doctor's messages
      templateData.messages = result.rows;
    }

    // set the next query to find prescriptions of that consultation
    const prescriptionsQuery = `SELECT * FROM prescriptions WHERE consultation_id=${consultationId} ORDER BY id ASC`;

    // execute the query
    return pool.query(prescriptionsQuery);
  };

  // callback for messagesQuery
  const whenPrescriptionsQueryDone = (result) => {
    console.table(result.rows);

    if (result.rows.length > 0) {
      templateData.consultation.prescriptions = result.rows;
    }

    // set the next query to find a list of medications
    const medicationsQuery = 'SELECT * FROM medications';

    // execute the query
    return pool.query(medicationsQuery);
  };

  // callback for medicationsQuery
  const whenMedicationsQueryDone = (result) => {
    console.table(result.rows);

    // store the patient's and doctor's messages
    templateData.medications = result.rows;

    response.render('edit-consultation', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(consultationQuery)
    .then(whenConsultationQueryDone)
    .then(whenPatientAndDoctorNamesQueryDone)
    .then(whenclinicQueryDone)
    .then(whenMessagesQueryDone)
    .then(whenPrescriptionsQueryDone)
    .then(whenMedicationsQueryDone)
    .catch(whenQueryError);
});

// accept a request to add/update a consultation diagnosis
app.put('/consultation/:id/diagnosis', checkAuth, (request, response) => {
  console.log('request to add/update a consultation diagnosis came in');

  const consultationId = request.params.id;
  const { diagnosis } = request.body;

  const updateDiagnosisQueryValues = [`${diagnosis}`, consultationId];

  const updateDiagnosisQuery = 'UPDATE consultations SET diagnosis=$1 WHERE id=$2';

  // callback function for updateDiagnosisQuery
  const whenUpdateDiagnosisQueryDone = () => {
    console.log('updated diagnosis!');

    response.redirect(`/consultation/${consultationId}/edit`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the query
  pool
    .query(updateDiagnosisQuery, updateDiagnosisQueryValues)
    .then(whenUpdateDiagnosisQueryDone)
    .catch(whenQueryError);
});

// accept a request to add a prescription
app.post('/consultation/:id/prescription', checkAuth, (request, response) => {
  console.log('request to add a prescription came in');

  const consultationId = request.params.id;

  // get the prescription details
  const {
    medicine, quantity, instruction,
  } = request.body;

  // get the medicine id and medicine price in cents
  const medicineIdAndPrice = medicine.split('_');
  const medicineId = medicineIdAndPrice[0];
  const medicinePriceCents = Number(medicineIdAndPrice[1]);

  const insertPrescriptionQuery = 'INSERT INTO prescriptions (consultation_id, medicine_id, quantity, instruction) VALUES ($1, $2, $3, $4) RETURNING *';

  const insertPrescriptionQueryValues = [consultationId, medicineId, quantity, `${instruction}`];

  // callback function for insertPrescriptionQuery
  const whenInsertPrescriptionQueryDone = (result) => {
    console.table(result.rows);

    // to extract the consultation and accumulated medicine prices
    const selectConsultationPriceQuery = `SELECT consultation_price_cents, medicines_price_cents FROM consultations WHERE id=${consultationId}`;

    // execute the query
    return pool.query(selectConsultationPriceQuery);
  };

  // callback function for selectConsultationPriceQuery
  const whenSelectConsultationPriceQueryDone = (result) => {
    console.table(result.rows);
    console.log('selectConsultationPriceQUery done');

    // calculate updated prices of medicines and for the whole consultation ----
    const medicinesPriceCents = medicinePriceCents * quantity;
    const consultationPriceCents = result.rows[0].consultation_price_cents;
    const accumulatedMedicinesPriceCents = result.rows[0].medicines_price_cents;
    // eslint-disable-next-line max-len
    const updatedAccumulatedMedicinesPriceCents = accumulatedMedicinesPriceCents + medicinesPriceCents;
    const totalPriceCents = updatedAccumulatedMedicinesPriceCents + consultationPriceCents;

    // set the next query to update the total_price_cents and medicines_price_cents of the consult
    const updateConsultationQuery = 'UPDATE consultations SET total_price_cents=$1, medicines_price_cents=$2 WHERE id=$3 RETURNING *';

    // eslint-disable-next-line max-len
    const updateConsultationQueryValues = [totalPriceCents, updatedAccumulatedMedicinesPriceCents, consultationId];

    // execute the query
    return pool.query(updateConsultationQuery, updateConsultationQueryValues);
  };

  const whenUpdateConsultationQueryDone = (result) => {
    console.log('updated consultation total_price_cents and medicines_price_cents!');
    console.table(result.rows);

    response.redirect(`/consultation/${consultationId}/edit`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  pool
    .query(insertPrescriptionQuery, insertPrescriptionQueryValues)
    .then(whenInsertPrescriptionQueryDone)
    .then(whenSelectConsultationPriceQueryDone)
    .then(whenUpdateConsultationQueryDone)
    .catch(whenQueryError);
});

// accept a request to update a prescription
app.put('/consultation/:id/prescription', checkAuth, (request, response) => {
  console.log('request to update a prescription came in');

  const consultationId = request.params.id;
  const { prescriptionId } = request.body;

  // get the updated medicine details from the form
  const { medicine } = request.body;
  const newMedicineQty = request.body.quantity;

  // get the updated medicine price and medicine id
  const newMedicineIdAndPrice = medicine.split('_');
  const newMedicineId = newMedicineIdAndPrice[0];
  const newMedicinePriceCents = Number(newMedicineIdAndPrice[1]);

  // calculate total price of updated medicine ----
  const newMedicinesPriceCents = newMedicinePriceCents * newMedicineQty;

  // for finding total medicine price of the old prescription
  let oldMedicineQty = '';
  let oldMedicinePriceCents = '';
  let oldMedicinesPriceCents = '';

  // query for finding the total medicine price of the old prescription
  const selectOldPrescriptionMedicineQuery = `SELECT prescriptions.quantity, medications.price_cents FROM prescriptions INNER JOIN medications ON prescriptions.medicine_id=medications.id WHERE prescriptions.id=${prescriptionId}`;

  // callback function for selectOldPrescriptionMedicineQuery
  const whenSelectOldPrescriptionMedicineQueryDone = (result) => {
    console.table(result.rows);

    // find the total medicine price of the old prescription
    oldMedicineQty = result.rows[0].quantity;
    oldMedicinePriceCents = result.rows[0].price_cents;
    oldMedicinesPriceCents = oldMedicineQty * oldMedicinePriceCents;

    // get the new instruction
    const newInstruction = request.body.instruction;

    // query to update the prescription in the database
    const updatePrescriptionQuery = `UPDATE prescriptions SET medicine_id=$1, quantity=$2, instruction=$3 WHERE id=${prescriptionId} RETURNING *`;

    const updatePrescriptionQueryValues = [newMedicineId, newMedicineQty, `${newInstruction}`];

    // execute query to update the prescription
    return pool.query(updatePrescriptionQuery, updatePrescriptionQueryValues);
  };

  // callback function for updatePrescriptionQuery
  const whenUpdatePrescriptionQueryValuesDone = (result) => {
    console.table(result.rows);

    // query to find consultation price and old total medicines price
    const oldPricesQuery = `SELECT consultation_price_cents, medicines_price_cents FROM consultations WHERE id=${consultationId}`;

    // execute query
    return pool.query(oldPricesQuery);
  };

  // callback function for updatePrescriptionQuery
  const whenOldPricesQueryDone = (result) => {
    console.table(result.rows);

    const consultationPriceCents = result.rows[0].consultation_price_cents;
    const oldAccumulatedMedicinesPriceCents = result.rows[0].medicines_price_cents;

    // find new total price of medicines
    // eslint-disable-next-line max-len
    const newAccumulatedMedicinesPriceCents = oldAccumulatedMedicinesPriceCents - oldMedicinesPriceCents + newMedicinesPriceCents;

    // find new total price of consultation
    const newTotalPriceCents = newAccumulatedMedicinesPriceCents + consultationPriceCents;

    // query to update the consultation prices
    const updateConsultationQuery = 'UPDATE consultations SET total_price_cents=$1, medicines_price_cents=$2 WHERE id=$3';

    // eslint-disable-next-line max-len
    const updateConsultationQueryValues = [newTotalPriceCents, newAccumulatedMedicinesPriceCents, consultationId];

    // execute query to update the consultation prices
    return pool.query(updateConsultationQuery, updateConsultationQueryValues);
  };

  // callback function for updateConsultationQuery
  const whenUpdateConsultationQueryDone = () => {
    console.log('updated consultation!');

    // redirect to render the updated consultation form
    response.redirect(`/consultation/${consultationId}/edit`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  pool
    .query(selectOldPrescriptionMedicineQuery)
    .then(whenSelectOldPrescriptionMedicineQueryDone)
    .then(whenUpdatePrescriptionQueryValuesDone)
    .then(whenOldPricesQueryDone)
    .then(whenUpdateConsultationQueryDone)
    .catch(whenQueryError);
});

// accept a request to delete a prescription
app.delete('/consultation/:id/prescription', checkAuth, (request, response) => {
  console.log('request to delete a prescription came in');

  const consultationId = request.params.id;
  const { prescriptionId } = request.body;

  // for finding total medicine price of the prescription to be deleted
  let medicineQty = '';
  let medicinePriceCents = '';
  let medicinesPriceCents = '';

  // query for finding the total medicine price of the prescription to be deleted
  const selectPrescriptionAndMedicineQuery = `SELECT prescriptions.quantity, medications.price_cents FROM prescriptions INNER JOIN medications ON prescriptions.medicine_id=medications.id WHERE prescriptions.id=${prescriptionId}`;

  // callback function for selectPrescriptionAndMedicineQuery
  const whenSelectPrescriptionAndMedicineQueryDone = (result) => {
    console.table(result.rows);

    // find the total medicine price of the prescription to be deleted
    medicineQty = result.rows[0].quantity;
    medicinePriceCents = result.rows[0].price_cents;
    medicinesPriceCents = medicineQty * medicinePriceCents;

    // query to find consultation price and old total medicines price
    const oldPricesQuery = `SELECT consultation_price_cents, medicines_price_cents FROM consultations WHERE id=${consultationId}`;

    // execute query
    return pool.query(oldPricesQuery);
  };

  // callback function for oldPricesQuery
  const whenOldPricesQueryDone = (result) => {
    console.table(result.rows);

    const consultationPriceCents = result.rows[0].consultation_price_cents;
    const oldAccumulatedMedicinesPriceCents = result.rows[0].medicines_price_cents;

    // find new total price of medicines
    // eslint-disable-next-line max-len
    const newAccumulatedMedicinesPriceCents = oldAccumulatedMedicinesPriceCents - medicinesPriceCents;

    // find new total price of consultation
    const newTotalPriceCents = newAccumulatedMedicinesPriceCents + consultationPriceCents;

    // query to update the consultation prices
    const updateConsultationQuery = 'UPDATE consultations SET total_price_cents=$1, medicines_price_cents=$2 WHERE id=$3';

    // eslint-disable-next-line max-len
    const updateConsultationQueryValues = [newTotalPriceCents, newAccumulatedMedicinesPriceCents, consultationId];

    // execute query to update the consultation prices
    return pool.query(updateConsultationQuery, updateConsultationQueryValues);
  };

  // callback function for updateConsultationQuery
  const whenUpdateConsultationQueryDone = (result) => {
    console.table(result.rows);
    console.log('updated consultation!');

    // query to delete the prescription from database
    const deletePrescriptionQuery = `DELETE FROM prescriptions WHERE id=${prescriptionId} RETURNING *`;

    // execute query
    return pool.query(deletePrescriptionQuery);
  };

  // callback function for deletePrescriptionQuery
  const whenDeletePrescriptionQueryDone = (result) => {
    console.table(result.rows);
    console.log('deleted prescription!');

    // redirect to render the updated consultation form
    response.redirect(`/consultation/${consultationId}/edit`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  pool
    .query(selectPrescriptionAndMedicineQuery)
    .then(whenSelectPrescriptionAndMedicineQueryDone)
    .then(whenOldPricesQueryDone)
    .then(whenUpdateConsultationQueryDone)
    .then(whenDeletePrescriptionQueryDone)
    .catch(whenQueryError);
});

// render a list of consultations of a certain status for a patient
app.get('/patient-consultations/:status', checkAuth, (request, response) => {
  console.log('request to render patient consultations came in');

  const templateData = {};

  // set the navbar color for patient / patient mode
  templateData.navbarColor = '#e3f2fd';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  const consultationStatus = request.params.status;

  // store the consultation status for ejs file
  if (consultationStatus === 'ended') {
    templateData.consultationStatus = 'past';
  } else {
    templateData.consultationStatus = consultationStatus;
  }

  const consultationsQuery = `SELECT consultations.id, consultations.date, users.name AS doctor_name, users.photo AS doctor_photo FROM consultations INNER JOIN users ON consultations.doctor_id=users.id WHERE consultations.patient_id=${request.user.id} AND consultations.status='${consultationStatus}'`;

  // callback function for consultationsQuery for the patient
  const whenConsultationsQueryDone = (result) => {
    console.table(result.rows);

    // store the consultations data
    templateData.consultations = result.rows;

    // format the date of the consultation and photo of the doctor (if no photo)
    templateData.consultations.forEach((consultation) => {
      // if doctor's photo field in database is empty,
      // give it an anonymous photo for display
      if (consultation.doctor_photo === null) {
        consultation.doctor_photo = 'anonymous-person.jpg';
      }

      // convert the consultation date to the display format (DD/MM/YYYY)
      const rawDate = consultation.date;
      const formattedDate = moment(rawDate).format('DD-MMM-YYYY, h:mm a');
      consultation.date = formattedDate;
    });

    response.render('patient-consultations', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the queries
  pool
    .query(consultationsQuery)
    .then(whenConsultationsQueryDone)
    .catch(whenQueryError);
});

// render a list of consultations of a certain status for a doctor
app.get('/doctor-consultations/:status', checkAuth, (request, response) => {
  console.log('request to render doctor consultations came in');

  const templateData = {};

  // set the navbar color for patient / patient mode
  templateData.navbarColor = '#FBE7C6';

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  const consultationStatus = request.params.status;

  // store the consultation status for ejs file
  if (consultationStatus === 'ended') {
    templateData.consultationStatus = 'past';
  } else {
    templateData.consultationStatus = consultationStatus;
  }

  const consultationsQuery = `SELECT consultations.id, consultations.date, users.name AS patient_name, users.photo AS patient_photo FROM consultations INNER JOIN users ON consultations.patient_id=users.id WHERE consultations.doctor_id=${request.user.id} AND consultations.status='${consultationStatus}'`;

  // callback function for consultationsQuery for the patient
  const whenConsultationsQueryDone = (result) => {
    console.table(result.rows);

    // store the consultations data
    templateData.consultations = result.rows;

    // format the date of the consultation and photo of the patient (if no photo)
    templateData.consultations.forEach((consultation) => {
      // if patient's photo field in database is empty,
      // give it an anonymous photo for display
      if (consultation.patient_photo === null) {
        consultation.patient_photo = 'anonymous-person.jpg';
      }

      // convert the consultation date to the display format (DD/MM/YYYY)
      const rawDate = consultation.date;
      const formattedDate = moment(rawDate).format('DD-MMM-YYYY, h:mm a');
      consultation.date = formattedDate;
    });

    response.render('doctor-consultations', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // execute the queries
  pool
    .query(consultationsQuery)
    .then(whenConsultationsQueryDone)
    .catch(whenQueryError);
});

// accept a request to render a profile page
app.get('/profile', checkAuth, (request, response) => {
  console.log('request to render profile came in!');

  const templateData = {};

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs and user's data for profile.ejs
  templateData.user = request.user;

  // if user's photo field in database is empty, give it an anonymous photo
  if (request.user.photo === null) {
    templateData.user.photo = 'anonymous-person.jpg';
  }

  // if user is doctor and user is in doctor mode (in cookie)
  // else user is patient / doctor is in patient mode so no need to set a mode
  if (request.cookies.mode) {
    if (request.cookies.mode === 'doctor') {
      // doctor was in doctor mode
      // set the navbar color for header.ejs
      templateData.navbarColor = '#FBE7C6';
    } else {
      // doctor is in patient mode
      // set the navbar color for header.ejs
      templateData.navbarColor = '#e3f2fd';
    }
  } else {
    // set the navbar color for header.ejs
    templateData.navbarColor = '#e3f2fd';
  }

  // variable to store clinic_ids of the doctor from clinic_doctors table
  let doctorClinics = '';

  // check if user is a doctor or patient
  if (templateData.user.is_doctor === false) {
    // user is patient, render the profile page
    response.render('profile', templateData);
  } else {
    // user is doctor, make a database query to find clinics he/she is working at
    const doctorClinicsQuery = `SELECT clinic_id FROM clinic_doctors WHERE doctor_id=${templateData.user.id}`;

    const whenDoctorClinicsQueryDone = (result) => {
      console.log('doctorClinicsQuery done!');
      console.table(result.rows);

      doctorClinics = result.rows;

      // query for a list of clinics for checkboxes in profile.ejs
      const clinicsQuery = 'SELECT * FROM clinics';

      return pool.query(clinicsQuery);
    };

    const whenClinicsQueryDone = (result) => {
      console.log('clinicsQuery done!');
      console.table(result.rows);

      const clinics = result.rows;

      // give a notation if a clinic is where the doctor is working at
      clinics.forEach((clinic) => {
        doctorClinics.forEach((doctorClinic) => {
          if (doctorClinic.clinic_id === clinic.id) {
            // this clinic is where doctor works at so give a notation
            clinic.isDoctorClinic = true;
          }
        });
      });

      // store the clinics' info for profile.ejs
      templateData.clinics = clinics;

      // render the profile page for the doctor
      response.render('profile', templateData);
    };

    // callback function for query error
    const whenQueryError = (error) => {
      console.log('Error executing query', error.stack);
      response.status(503).send(queryErrorMessage);
    };

    pool
      .query(doctorClinicsQuery)
      .then(whenDoctorClinicsQueryDone)
      .then(whenClinicsQueryDone)
      .catch(whenQueryError);
  }
});

// accept a request to update a profile page
app.put('/profile', checkAuth, multerUpload.single('photo'), (request, response) => {
  console.log('request to update profile came in!');

  // check if user is a doctor or patient by checking if there is a 'bankNumber' input field
  let isDoctor = false;
  if ('bankNumber' in request.body) {
    isDoctor = true;
  }

  // array to store messages for invalid form inputs
  const invalidMessages = [];

  // object that stores data to be inserted into ejs file
  const templateData = {};
  templateData.invalidMessages = invalidMessages;

  // updated details (to be added to database) of the user
  const {
    name, email, password, allergies, creditCardNumber, creditCardExpiry, cvv,
  } = request.body;

  // if user updated a new photo, store the new photo hashed filename to update into database later
  let newPhotoFileName = '';
  if (request.file !== undefined) {
    newPhotoFileName = request.file.location;
  }
  console.log('request.file is ', request.file);

  // variables to store additionl details for doctors
  let clinicIds = '';
  let bankNumber = '';
  let consultationPrice = '';
  let doctorRegistrationNumber = '';

  // queries and callbacks---------------------------------------
  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send(queryErrorMessage);
  };

  // for checking if email to update is already taken by another user ----
  // query to check if email to update is already taken by another user
  const isExistingUserQuery = 'SELECT * FROM users WHERE email=$1';

  // values for isExistingUserQuery
  const isExistingUserQueryValues = [`${email}`];

  // callback function for isExistingUserQuery
  const whenIsExistingUserQueryDone = (result) => {
    console.log('existing user query done!');
    console.table(result.rows);

    if (isDoctor === false) {
      // check if the email already belongs to an existing user who is not the logged in user
      if (result.rows.length > 0 && result.rows[0].id !== request.user.id) {
        // patient's new email already belongs to an existing user who is not the logged in user

        // add message to inform user that email has been taken
        invalidMessages.push('The email you entered already exists.');

        // query for patient's details again to render into the profile form
        const patientQuery = `SELECT * FROM users WHERE id='${request.user.id}'`;

        // callback for patientQuery
        const whenPatientQueryDone = (selectResult) => {
          console.log('patient query done!');
          console.table(selectResult.rows);

          // store the patient data to render in profile.ejs
          const user = selectResult.rows[0];

          const searchForHttpString = user.photo.search('http');

          // eslint-disable-next-line max-len
          // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
          if (user.photo === null) {
            user.photo = '/profile-photos/anonymous-person.jpg';
          } else if (searchForHttpString === -1) {
            // if the photo is not a photo uploaded on AWS S3 (i.e. it is a test photo in
            // the heroku repo), change the url so it will render correctly
            user.photo = `/profile-photos/${user.photo}`;
          }

          templateData.user = user;

          // render the patient profile again with invalid form input messages
          response.render('profile', templateData);
        };

        pool
          .query(patientQuery)
          .then(whenPatientQueryDone)
          .catch(whenQueryError);
      } else {
        // patient new email does not belong to an existing user who is not the logged in user
        // so update the user new details into database
        // and redirect to route that renders patient profile (app.get('/profile')

        // query to update patient new details
        let updatePatientQuery = '';
        let updatePatientQueryValues = '';

        // query changes depending whether patient uploaded a new photo
        if (newPhotoFileName === '') {
          // patient did not upload a new photo
          updatePatientQuery = 'UPDATE users SET name=$1, email=$2, password=$3, is_doctor=$4, allergies=$5, credit_card_number=$6, credit_card_expiry=$7, credit_card_cvv=$8 WHERE id=$9 RETURNING *';

          updatePatientQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`, `${request.user.id}`];
        } else {
          // patient uploaded a new photo
          updatePatientQuery = 'UPDATE users SET name=$1, email=$2, password=$3, is_doctor=$4, allergies=$5, credit_card_number=$6, credit_card_expiry=$7, credit_card_cvv=$8, photo=$9 WHERE id=$10 RETURNING *';

          updatePatientQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`, `${newPhotoFileName}`, `${request.user.id}`];
        }

        // callback for updatePatientQuery
        const whenUpdatePatientQueryDone = (updateResult) => {
          console.log('update patient query done');
          console.table(updateResult.rows);

          // redirect to route that renders patient profile
          response.redirect('/profile');
        };

        pool
          .query(updatePatientQuery, updatePatientQueryValues)
          .then(whenUpdatePatientQueryDone)
          .catch(whenQueryError);
      }
    } else {
      // validation logic for updating doctor profile
      // get additional details of the doctor and check if doctor selected a clinic(s)
      if ('clinicIds' in request.body) {
        // if doctor selected at least 1 clinic, add the additional details
        clinicIds = request.body.clinicIds;
        bankNumber = request.body.bankNumber;
        consultationPrice = request.body.consultationPrice;
        doctorRegistrationNumber = request.body.doctorRegistrationNumber;
      } else {
        // else doctor did not select any clinics so give an invalid input message
        invalidMessages.push('1 or more clinics need to be selected');
      }

      // check if the email already belongs to an existing user who is not the logged in user
      if (result.rows.length > 0 && result.rows[0].id !== request.user.id) {
        // patient signup email already belongs to an existing user
        // add message to inform user that email has been taken
        invalidMessages.push('The email you entered already exists.');
      }

      if ((result.rows.length > 0 && result.rows[0].id !== request.user.id) || !('clinicIds' in request.body)) {
        // email already belongs to an existing user who is not the logged in user
        // or doctor did not select any clinics

        // query for doctor's details again to render into the profile form
        const doctorQuery = `SELECT * FROM users WHERE id='${request.user.id}'`;

        // callback for doctorQuery
        const whenDoctorQueryDone = (selectResult) => {
          console.log('doctor query done!');
          console.table(selectResult.rows);

          // store the doctor data to render in profile.ejs
          const user = selectResult.rows[0];

          const searchForHttpString = user.photo.search('http');

          // eslint-disable-next-line max-len
          // if user's photo field in database is empty, give it an anonymous photo to use in header.ejs
          if (user.photo === null) {
            user.photo = '/profile-photos/anonymous-person.jpg';
          } else if (searchForHttpString === -1) {
            // if the photo is not a photo uploaded on AWS S3 (i.e. it is a test photo in
            // the heroku repo), change the url so it will render correctly
            user.photo = `/profile-photos/${user.photo}`;
          }

          templateData.user = user;

          // make a database query to find clinics doctor is working at
          const doctorClinicsQuery = `SELECT clinic_id FROM clinic_doctors WHERE doctor_id=${templateData.user.id}`;

          // execute the next query
          return pool.query(doctorClinicsQuery);
        };

        // variable to store clinic_ids of the doctor from clinic_doctors table
        let doctorClinics = '';

        const whenDoctorClinicsQueryDone = (selectResult) => {
          console.log('doctorClinicsQuery done!');
          console.table(selectResult.rows);

          doctorClinics = selectResult.rows;

          // query for a list of clinics for checkboxes in profile.ejs
          const clinicsQuery = 'SELECT * FROM clinics';

          return pool.query(clinicsQuery);
        };

        const whenClinicsQueryDone = (selectResult) => {
          console.log('clinicsQuery done!');
          console.table(selectResult.rows);

          const clinics = selectResult.rows;

          // give a notation if a clinic is where the doctor is working at
          clinics.forEach((clinic) => {
            doctorClinics.forEach((doctorClinic) => {
              if (doctorClinic.clinic_id === clinic.id) {
                // this clinic is where doctor works at so give a notation
                clinic.isDoctorClinic = true;
              }
            });
          });

          // store the clinics' info for profile.ejs
          templateData.clinics = clinics;

          // render the profile page for the doctor
          response.render('profile', templateData);
        };

        pool
          .query(doctorQuery)
          .then(whenDoctorQueryDone)
          .then(whenDoctorClinicsQueryDone)
          .then(whenClinicsQueryDone)
          .catch(whenQueryError);
      } else {
        // doctor email to be updated does not belong to
        // an existing user who is not the logged in user
        // so update the user details in the database
        // and redirect to route that renders doctor profile (app.get('/profile')

        // query to update doctor's details
        let updateDoctorQuery = '';
        let updateDoctorQueryValues = '';

        // update query changes depending whether doctor uploaded a new photo
        if (newPhotoFileName === '') {
          // doctor did not upload a new photo
          updateDoctorQuery = 'UPDATE users SET name=$1, email=$2, password=$3, is_doctor=$4, allergies=$5, credit_card_number=$6, credit_card_expiry=$7, credit_card_cvv=$8, bank_number=$9, consultation_price_cents=$10, doctor_registration_number=$11 WHERE id=$12 RETURNING *';

          updateDoctorQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`, `${bankNumber}`, `${consultationPrice}`, `${doctorRegistrationNumber}`, `${request.user.id}`];
        } else {
          // doctor uploaded a new photo
          updateDoctorQuery = 'UPDATE users SET name=$1, email=$2, password=$3, is_doctor=$4, allergies=$5, credit_card_number=$6, credit_card_expiry=$7, credit_card_cvv=$8, bank_number=$9, consultation_price_cents=$10, doctor_registration_number=$11, photo=$12 WHERE id=$13 RETURNING *';

          updateDoctorQueryValues = [`${name}`, `${email}`, `${password}`, isDoctor, `${allergies}`, `${creditCardNumber}`, `${creditCardExpiry}`, `${cvv}`, `${bankNumber}`, `${consultationPrice}`, `${doctorRegistrationNumber}`, `${newPhotoFileName}`, `${request.user.id}`];
        }

        // callback for updateDoctorQuery
        const whenUpdateDoctorQueryDone = (updateResult) => {
          console.log('update doctor query done');
          console.table(updateResult.rows);

          // query to delete all clinics doctor previously worked
          // at (in the clinic_doctors table) before inserting updated data
          const deleteClinicAndDoctorIdsQuery = `DELETE FROM clinic_doctors WHERE doctor_id=${request.user.id}`;

          // execute the next query
          return pool.query(deleteClinicAndDoctorIdsQuery);
        };

        // callback for deleteClinicAndDoctorIdsQuery
        const whenDeleteClinicAndDoctorIdsQueryDone = () => {
          console.log('deleteClinicAndDoctorIdsQuery done!');

          // insert all the clinics' ids into clinic_doctors relational table -----
          // check if only 1 or multiple clinics were selected
          if (typeof (clinicIds) === 'string') {
            // only 1 clinic was selected so change it into an array
            const clinicId = clinicIds;
            clinicIds = [clinicId];
          }

          // create and execute the insert query for each clinic selected
          clinicIds.forEach((id) => {
            const insertClinicAndDoctorIdsQuery = 'INSERT INTO clinic_doctors (clinic_id, doctor_id) VALUES ($1, $2)';

            const insertClinicAndDoctorIdsQueryValues = [`${id}`, `${request.user.id}`];

            pool
              .query(insertClinicAndDoctorIdsQuery, insertClinicAndDoctorIdsQueryValues)
              .catch(whenQueryError);
          });
        };

        // callback for insertClinicAndDoctorIdsQuery
        const whenInsertClinicAndDoctorIdsQueryDone = () => {
          console.log('insertClinicAndDoctorIdsQuery done!');

          // redirect to route that renders doctor's profile
          response.redirect('/profile');
        };

        pool
          .query(updateDoctorQuery, updateDoctorQueryValues)
          .then(whenUpdateDoctorQueryDone)
          .then(whenDeleteClinicAndDoctorIdsQueryDone)
          .then(whenInsertClinicAndDoctorIdsQueryDone)
          .catch(whenQueryError);
      }
    }
  };

  // execute the queries for patient and doctor signup
  pool
    .query(isExistingUserQuery, isExistingUserQueryValues)
    .then(whenIsExistingUserQueryDone)
    .catch(whenQueryError);
});

// accept a logout request
app.get('/logout', (request, response) => {
  console.log('request to logout came in');

  response.clearCookie('userId');
  response.clearCookie('loggedInHash');
  response.clearCookie('mode');

  response.redirect('/');
});

// set the port to listen for requests
app.listen(PORT);
