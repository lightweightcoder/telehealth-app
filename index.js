// import libraries ------------------
import express from 'express';
import methodOverride from 'method-override';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import jsSha from 'jssha';
import multer from 'multer';
import moment from 'moment';

// global variables -------------------------------
// environment variable to use as a secret word for hashing userId cookie
// environment variable is currently stored in ~/.profile (see RA module 3.6.4)
const myEnvVar = process.env.MY_ENV_VAR;

// Initialise the DB connection ----------
const { Pool } = pg;

// create separate DB connection configs for production vs non-production environments.
// ensure our server still works on our local machines.
let pgConnectionConfigs;
if (process.env.ENV === 'PRODUCTION') {
  // determine how we connect to the remote Postgres server
  pgConnectionConfigs = {
    user: 'postgres',
    // set DB_PASSWORD as an environment variable for security.
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    database: 'telehealth_app',
    port: 5432,
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
// set the name of the upload directory here for multer
const multerUpload = multer({ dest: 'uploads/' });

// Initialise Express ---------------------
// create an express application
const app = express();
// set the port number
const PORT = 3000;
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
const checkAuth = ((request, response, next) => {
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
          response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
          return;
        }

        // set the user as a key in the request object so that it's accessible in the route
        const user = result.rows[0];
        request.user = user;

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
});

// routes ==============================

// start of functionality for user to login --------
// render the login form that will create the request
app.get('/', (request, response) => {
  console.log('request to render a login form came in');

  response.render('login');
});

// accept the login form request
app.post('/', (request, response) => {
  console.log('post request to login came in');

  const values = [request.body.email];

  pool.query('SELECT * from users WHERE email=$1', values, (error, result) => {
    if (error) {
      console.log('Error executing query', error.stack);
      response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
      return;
    }

    if (result.rows.length === 0) {
      // we didnt find a user with that email.
      // redirect to login page
      response.redirect('/');
      console.log('did not find user with that email');
      return;
    }

    const user = result.rows[0];

    // verify input password with password in database
    if (user.password === request.body.password) {
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

      // redirect user to patient dashboard
      response.redirect('/patient-dashboard');
    } else {
      // password didn't match
      // redirect to login page
      response.redirect('/');
      console.log('password did not match with database');
    }
  });
});
// end of functionality for user to login --------

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

    response.render('patient-dashboard', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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

    response.render('doctor-dashboard', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  const clinicsQuery = 'SELECT * FROM clinics';

  // callback function for clinicsQuery
  const whenClinicsQueryDone = (selectError, selectResult) => {
    if (selectError) {
      console.log('Error executing query', selectError.stack);
      response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  const clinicId = request.params.id;

  const doctorsQuery = `SELECT users.id, users.name, users.photo FROM users INNER JOIN clinic_doctors ON users.id=clinic_doctors.doctor_id WHERE clinic_doctors.clinic_id=${clinicId}`;

  const clinicQuery = `SELECT name, photo FROM clinics WHERE id=${clinicId}`;

  // callback function for doctorsQuery
  const whenDoctorsQueryDone = (result) => {
    console.table(result.rows);

    // store the doctors' data
    templateData.doctors = result.rows;

    return pool.query(clinicQuery);
  };

  // callback function for clinicQuery
  const whenClinicQueryDone = (result) => {
    console.table(result.rows);

    // store the doctors' data
    const clinic = result.rows[0];
    templateData.clinic = clinic;

    // render clinic.ejs
    response.render('clinic', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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
app.get('/new-consultation/:doctorId', checkAuth, (request, response) => {
  console.log('request to render a new consultation form came in');

  const templateData = {};

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

  const { doctorId } = request.params; // note: doctorId is a number in string data type
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
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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

  const { doctorId } = request.body;

  const consultationPriceQuery = `SELECT consultation_price_cents FROM users WHERE id=${doctorId}`;

  // callback function for consultationPriceQuery
  const whenConsultationPriceQueryDone = (result) => {
    const consultationPriceCents = result.rows[0].consultation_price_cents;

    // eslint-disable-next-line max-len
    const insertConsultationQueryValues = [request.body.patientId, doctorId, request.body.dateTime, 'requested', request.body.description, consultationPriceCents, consultationPriceCents, 0];

    const insertConsultationQuery = 'INSERT INTO consultations (patient_id, doctor_id, date, status, description, consultation_price_cents, total_price_cents, medicines_price_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

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
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
  };

  // execute the query
  pool
    .query(consultationPriceQuery)
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

    response.render('show-consultation', templateData);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
  };

  // execute the query
  pool
    .query(consultationQuery)
    .then(whenConsultationQueryDone)
    .then(whenPatientAndDoctorNamesQueryDone)
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
      response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
    }
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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
      response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
    }
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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

  // store user info for ejs file
  // currently used for navbarBrand links in header.ejs
  templateData.user = request.user;

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
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
  };

  // execute the query
  pool
    .query(consultationQuery)
    .then(whenConsultationQueryDone)
    .then(whenPatientAndDoctorNamesQueryDone)
    .then(whenMessagesQueryDone)
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
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
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
    medicine, quantity, frequency,
  } = request.body;
  const dosageQuantity = request.body.dosage_quantity;
  const dosageUnit = request.body.dosage_unit;

  // get the medicine id
  // only works for medicineId 1 to 9 due to slice method
  const medicineId = medicine.slice(0, 1);

  const insertPrescriptionQuery = 'INSERT INTO prescriptions (consultation_id, medicine_id, quantity, dosage_quantity, dosage_unit, frequency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';

  const insertPrescriptionQueryValues = [consultationId, medicineId, quantity, dosageQuantity, `${dosageUnit}`, `${frequency}`];

  // callback function for insertPrescriptionQuery
  const whenInsertPrescriptionQueryDone = (result) => {
    console.table(result.rows);

    // to extract the consultation price
    const selectConsultationPriceQuery = `SELECT consultation_price_cents, medicines_price_cents FROM consultations WHERE id=${consultationId}`;

    // execute the query
    return pool.query(selectConsultationPriceQuery);
  };

  // callback function for selectConsultationPriceQuery
  const whenSelectConsultationPriceQueryDone = (result) => {
    console.table(result.rows);

    // get the medicine price and calculate total price of medicine and consultation ----
    // only works for medicineId 1 to 9 due to slice method
    const medicinePriceCents = Number(medicine.slice(2));
    const medicinesPriceCents = medicinePriceCents * quantity;
    const consultationPriceCents = result.rows[0].consultation_price_cents;
    const accumulatedMedicinesPriceCents = result.rows[0].medicines_price_cents;
    // eslint-disable-next-line max-len
    const updatedAccumulatedMedicinesPriceCents = accumulatedMedicinesPriceCents + medicinesPriceCents;
    const totalPriceCents = updatedAccumulatedMedicinesPriceCents + consultationPriceCents;

    // set the next query to update the total_price_cents and medicines_price_cents of the consult
    const updateConsultationQuery = 'UPDATE consultations SET total_price_cents=$1, medicines_price_cents=$2 WHERE id=1';

    const updateConsultationQueryValues = [totalPriceCents, updatedAccumulatedMedicinesPriceCents];

    // execute the query
    return pool.query(updateConsultationQuery, updateConsultationQueryValues);
  };

  const whenUpdateConsultationQueryDone = () => {
    console.log('updated consultation total_price_cents and medicines_price_cents!');

    response.redirect(`/consultation/${consultationId}/edit`);
  };

  // callback function for query error
  const whenQueryError = (error) => {
    console.log('Error executing query', error.stack);
    response.status(503).send('error 503: service unavilable.<br /> Return to login page <a href="/">here</a>');
  };

  pool
    .query(insertPrescriptionQuery, insertPrescriptionQueryValues)
    .then(whenInsertPrescriptionQueryDone)
    .then(whenSelectConsultationPriceQueryDone)
    .then(whenUpdateConsultationQueryDone)
    .catch(whenQueryError);
});
// set the port to listen for requests
app.listen(PORT);
