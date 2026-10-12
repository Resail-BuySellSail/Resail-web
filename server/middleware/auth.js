const { getSdk, handleError } = require('../api-util/sdk');

/**
 * Require an authenticated user. The current user entity (incl. own privateData) is saved to
 * req.currentUser and its id & email to req.tokenUserId & req.email.
 */
async function auth(req, res, next) {
  try {
    const sdk = getSdk(req, res);
    const userResponse = await sdk.currentUser.show();
    const currentUser = userResponse?.data?.data;
    if (!currentUser) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    req.currentUser = currentUser;
    req.tokenUserId = currentUser.id.uuid;
    req.email = currentUser.attributes.email;

    next();
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = auth;
