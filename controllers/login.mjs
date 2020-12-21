import { getHash } from '../helper-functions/helper-functions.mjs';

export default function login(db) {
  const findUser = async (request, response) => {
    const loginEmail = request.body.email;
    const loginPassword = request.body.password;

    // set object to store messages for invalid email or password input fields
    const templateData = {};

    try {
      const user = await db.User.findOne({
        attributes: ['id', 'email', 'password', 'isDoctor'],
        where: {
          email: loginEmail,
          password: loginPassword,
        },
      });

      console.log('select user query done!');

      // verify if server found a user with matching email and password in database
      if (user !== null) {
        console.log('found a match!');

        // generate a loggedInHash for user id ------
        const hashedCookieString = getHash(user.id);

        // set the loggedInHash and userId cookies in the response
        response.cookie('loggedInHash', hashedCookieString);
        response.cookie('userId', user.id);

        // if user is a doctor, send a cookie to keep track of what mode the doctor is in
        // the doctor starts in patient mode. This cookie will change the color of the navbar
        // depending on the mode doctor is in. Give cookie any mode because it will always
        // change to patient mode after redirecting to /patient-dashboard
        if (user.isDoctor === true) {
          response.cookie('mode', 'patient');
        }

        response.redirect('/');
        // redirect user to patient dashboard
        // response.redirect('/patient-dashboard');
      } else {
        // add message to inform user of invalid email/password
        templateData.invalidMessage = 'Sorry you have keyed in an incorrect email/password';

        // redirect to login page
        response.render('login', templateData);
      }
    } catch (error) {
      console.log(error);
    }
  };

  return {
    findUser,
  };
}
