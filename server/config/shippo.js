require('./../env').configureEnv();

const shippo = {
  key: process.env.SHIPPO_API_KEY_HEADER,
  version: process.env.SHIPPO_API_VERSION,
  // Secret token in the webhook URL: /api/webhooks/shippo?token=<SHIPPO_WEBHOOK_TOKEN>
  webhookToken: process.env.SHIPPO_WEBHOOK_TOKEN,
};

module.exports = { shippo };
