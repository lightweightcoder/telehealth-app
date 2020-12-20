// import db from './models/index.mjs';
// import items from './controllers/items.mjs';

// routes are placed in this function
export default function routes(app) {
  // render the login form
  app.get('/', (request, response) => {
    console.log('request to render a login form came in');

    response.render('login');
  });
}
