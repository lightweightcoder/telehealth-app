import { getHash } from '../lib/non-db-helper-functions.mjs';

// error messages for queries
const queryErrorMessage = 'error 503: service unavilable.<br /> Return to login page <a href="/">here</a>';

export default function auth(db, pool) {
  /**
   * cookie checking middleware callback
   * and supply logged-in user data to subsequent middleware
   * @param {object} request - route request
   * @param {object} request - route response
   * @param {function} next - next middleware function of app.
   */
  const check = (request, response, next) => {
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

  return {
    check,
  };
}
