// Firebase removed - using webhooks only for privacy
module.exports.admin = {
  messaging: () => ({
    sendEachForMulticast: () => Promise.resolve({ failureCount: 0, responses: [] })
  })
}