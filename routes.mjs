import pg from 'pg';
import db from './models/index.mjs';
// import items from './controllers/items.mjs';
import auth from './controllers/auth.mjs';
import login from './controllers/login.mjs';

// normal pg stuff
const { Pool } = pg;
const poolConfig = {
  user: process.env.USER,
  host: 'localhost',
  database: 'telehealth_app',
  port: 5432,
};
const pool = new Pool(poolConfig);

// routes are placed in this function
export default function routes(app) {
  const LoginController = login(db);
  const AuthController = auth(db, pool);

  // render the login form
  app.get('/', (request, response) => {
    console.log('request to render a login form came in');

    response.render('login');
  });

  // accept the login form request
  app.post('/', LoginController.findUser);
}
